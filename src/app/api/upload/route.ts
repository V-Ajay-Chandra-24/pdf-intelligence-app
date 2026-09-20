import { NextResponse as Response } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { after } from "next/server";
import { summarizeDocumentJob } from "@/lib/jobs/summarize";
import { deriveBlobPathname, getPdfStream, deleteFile } from "@/lib/storage";

export const maxDuration = 300;

export async function POST(req: Request) {
  let blobPathname = "";
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { uuid, originalName, size } = await req.json();

    if (!uuid || !originalName || size === undefined) {
      return Response.json({ message: "Invalid payload" }, { status: 400 });
    }

    // Validate UUID format again just in case
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
      return Response.json({ message: "Invalid UUID" }, { status: 400 });
    }

    blobPathname = deriveBlobPathname(session.user.id, uuid);

    if (size > 20 * 1024 * 1024) {
      await deleteFile(blobPathname);
      return Response.json({ message: "File exceeds 20MB limit." }, { status: 400 });
    }

    // Download blob to check magic bytes and extract text
    const result = await getPdfStream(blobPathname);
    if (!result || !result.stream) {
      await deleteFile(blobPathname);
      return Response.json({ message: "File not found in blob storage." }, { status: 400 });
    }

    const arrayBuffer = await new Response(result.stream).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Verify magic bytes %PDF-
    if (buffer.length < 5 || buffer.toString("utf8", 0, 5) !== "%PDF-") {
      await deleteFile(blobPathname);
      return Response.json({ message: "Invalid file type. Only PDF is allowed." }, { status: 400 });
    }

    // 1. Primary Pass — Digital Text Extraction via unpdf
    let extractedText = "";

    try {
      const { getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      
      let text = "";
      const TOLERANCE = 4;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        const rows: { [y: number]: { x: number; text: string }[] } = {};
        
        for (const item of textContent.items) {
          if (!("str" in item) || !item.str.trim()) continue;
          
          const x = Number(item.transform[4]);
          const y = Number(item.transform[5]);
          
          const existingY = Object.keys(rows).map(Number).find(key => Math.abs(key - y) <= TOLERANCE);
          const targetY = existingY !== undefined ? existingY : y;

          if (!rows[targetY]) {
            rows[targetY] = [];
          }
          
          rows[targetY].push({ x, text: item.str });
        }
        
        const sortedY = Object.keys(rows).map(Number).sort((a, b) => b - a);
        
        for (const y of sortedY) {
          const rowItems = rows[y].sort((a, b) => a.x - b.x);
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

    const cleanedText = extractedText.replace(/\s+/g, "");
    if (cleanedText.length < 100) {
      await deleteFile(blobPathname);
      return Response.json({ message: "This PDF appears to be scanned or image-based, so no text could be extracted. Please upload a PDF with selectable text." }, { status: 422 });
    }

    // Sanitize filename
    let sanitizedFilename = originalName.replace(/[\/\\]/g, "").replace(/[\x00-\x1F\x7F]/g, "").trim();
    if (sanitizedFilename.length > 255) {
      sanitizedFilename = sanitizedFilename.substring(0, 255);
    }
    if (!sanitizedFilename) {
      sanitizedFilename = "document.pdf";
    }

    const fileUrl = `/uploads/${uuid}.pdf`;

    // Database Persistence
    const document = await prisma.document.create({
      data: {
        userId: session.user.id,
        filename: sanitizedFilename,
        fileUrl,
        extractedText: extractedText.trim(),
        isScannedOcr: false,
      },
    });

    after(async () => {
      await summarizeDocumentJob(document.id, document.extractedText || "");
    });

    return Response.json({ message: "Upload and extraction successful", document }, { status: 200 });

  } catch (error) {
    console.error("Upload handler error:", error);
    if (blobPathname) {
      await deleteFile(blobPathname);
    }
    return Response.json({ message: "Something went wrong during upload" }, { status: 500 });
  }
}
