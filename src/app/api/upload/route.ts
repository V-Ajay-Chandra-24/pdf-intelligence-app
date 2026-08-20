import { NextResponse as Response } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";

import { summarizeDocumentJob } from "@/lib/jobs/summarize";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return Response.json({ message: "No file provided" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return Response.json({ message: "Invalid file type. Only PDF is allowed." }, { status: 400 });
    }

    if (file.size > 20 * 1024 * 1024) {
      return Response.json({ message: "File exceeds 20MB limit." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uuid = crypto.randomUUID();
    const filename = `${uuid}.pdf`;

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });

    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, buffer);
    const fileUrl = `/uploads/${filename}`;

    // 1. Primary Pass — Digital Text Extraction via unpdf
    //    Zero native deps, serverless-safe pdfjs-dist build.
    let extractedText = "";
    let isScannedOcr = false;

    try {
      const { getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      
      let text = "";
      const TOLERANCE = 4; // y-coordinate tolerance for grouping rows

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Group items by Y coordinate
        const rows: { [y: number]: { x: number; text: string }[] } = {};
        
        for (const item of textContent.items) {
          if (!("str" in item) || !item.str.trim()) continue;
          
          // item.transform is [scaleX, skewX, skewY, scaleY, tx, ty]
          const x = Number(item.transform[4]);
          const y = Number(item.transform[5]);
          
          // Find if there's an existing row within tolerance
          const existingY = Object.keys(rows).map(Number).find(key => Math.abs(key - y) <= TOLERANCE);
          const targetY = existingY !== undefined ? existingY : y;

          if (!rows[targetY]) {
            rows[targetY] = [];
          }
          
          rows[targetY].push({ x, text: item.str });
        }
        
        // Sort rows top-to-bottom (highest Y to lowest Y, since PDF origin is bottom-left usually)
        const sortedY = Object.keys(rows).map(Number).sort((a, b) => b - a);
        
        for (const y of sortedY) {
          // Sort items in row left-to-right
          const rowItems = rows[y].sort((a, b) => a.x - b.x);
          // Join row items with space or tab
          const rowText = rowItems.map(item => item.text).join("  ").trim();
          if (rowText) {
            text += rowText + "\n";
          }
        }
        text += "\n";
      }
      extractedText = text.trim();
    } catch (parseError) {
      console.warn("unpdf extraction failed:", parseError);
    }

    // 2. Readability Check — fall back to OCR if text is sparse/empty
    const cleanedText = extractedText.replace(/\s+/g, "");
    const isReadable = cleanedText.length > 50;

    // 3. OCR Fallback — 100% system binaries, zero JS dependency conflicts
    //    Step A: Ghostscript (gs) renders each PDF page to a PNG image.
    //    Step B: Tesseract reads each PNG and outputs text to stdout.
    //    No npm packages involved — both binaries are installed in the Alpine image.
    if (!isReadable) {
      console.log("Digital text insufficient. Starting OCR fallback...");
      isScannedOcr = true;
      extractedText = "";

      const ocrWorkDir = path.join(uploadsDir, `ocr_${uuid}`);
      await fs.mkdir(ocrWorkDir, { recursive: true });

      try {
        // Step A: Convert all PDF pages to PNGs with Ghostscript
        // Output: ocrWorkDir/page-%04d.png (page-0001.png, page-0002.png, ...)
        const gsCmd = [
          "gs",
          "-dNOPAUSE",
          "-dBATCH",
          "-dSAFER",
          "-sDEVICE=png16m",
          "-r300",
          `-sOutputFile=${ocrWorkDir}/page-%04d.png`,
          filePath,
        ].join(" ");

        console.log("Running Ghostscript:", gsCmd);
        execSync(gsCmd, { stdio: "pipe" });

        // Step B: Find all generated PNG files and OCR each one
        const pngFiles = (await fs.readdir(ocrWorkDir))
          .filter((f) => f.endsWith(".png"))
          .sort(); // ensure correct page order

        console.log(`OCR: found ${pngFiles.length} page(s) to process`);

        for (const pngFile of pngFiles) {
          const pngPath = path.join(ocrWorkDir, pngFile);
          // tesseract <input> stdout -l eng  → prints text to stdout
          const text = execSync(`tesseract "${pngPath}" stdout -l eng`, {
            stdio: ["pipe", "pipe", "pipe"],
          }).toString();
          extractedText += text + "\n\n";
          // Clean up the PNG after processing
          await fs.unlink(pngPath).catch(console.error);
        }
      } catch (ocrError) {
        console.error("OCR process failed:", ocrError);
        return Response.json({ message: "Failed to extract text from scanned document." }, { status: 500 });
      } finally {
        // Always clean up the temp work directory
        await fs.rm(ocrWorkDir, { recursive: true, force: true }).catch(console.error);
      }
    }

    // 4. Database Persistence
    const document = await prisma.document.create({
      data: {
        userId: session.user.id,
        filename: file.name,
        fileUrl,
        extractedText: extractedText.trim(),
        isScannedOcr,
      },
    });

    // 5. Fire and forget summarization job
    summarizeDocumentJob(document.id, document.extractedText || "");

    return Response.json({ message: "Upload and extraction successful", document }, { status: 200 });

  } catch (error) {
    console.error("Upload handler error:", error);
    return Response.json({ message: "Something went wrong during upload" }, { status: 500 });
  }
}
