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
  let created = false;
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    let payload;
    try {
      payload = await req.json();
    } catch {
      return Response.json({ message: "Invalid JSON" }, { status: 400 });
    }

    const { uuid, originalName } = payload;

    if (!uuid || typeof originalName !== "string") {
      return Response.json({ message: "Invalid payload" }, { status: 400 });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    if (!uuidRegex.test(uuid)) {
      return Response.json({ message: "Invalid UUID" }, { status: 400 });
    }

    const fileUrl = `/uploads/${uuid}.pdf`;

    // Check if document already exists
    const existingDocument = await prisma.document.findFirst({
      where: { userId: session.user.id, fileUrl }
    });
    if (existingDocument) {
      return Response.json({ message: "Upload successful", document: existingDocument }, { status: 200 });
    }

    blobPathname = deriveBlobPathname(session.user.id, uuid);

    // Download blob to check size, magic bytes and extract text
    const result = await getPdfStream(blobPathname, { useCache: false });
    if (!result) {
      return Response.json({ message: "File not found in blob storage." }, { status: 400 });
    }

    const blobSize = result.blob.size;
    if (blobSize !== null && blobSize > 10 * 1024 * 1024) {
      await deleteFile(blobPathname);
      return Response.json({ message: "File exceeds 10MB limit." }, { status: 400 });
    }

    if (!result.stream) {
      return Response.json({ message: "File stream not available." }, { status: 400 });
    }

    const arrayBuffer = await new Response(result.stream).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > 10 * 1024 * 1024) {
      await deleteFile(blobPathname);
      return Response.json({ message: "File exceeds 10MB limit." }, { status: 400 });
    }

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
    created = true;

    after(async () => {
      try {
        await summarizeDocumentJob(document.id, document.extractedText || "");
      } catch (err) {
        console.error("Error in summarize job after()", err);
        await prisma.document.update({
          where: { id: document.id },
          data: { summaryStatus: "FAILED" },
        }).catch(() => {});
      }
    });

    return Response.json({ message: "Upload and extraction successful", document }, { status: 200 });

  } catch (error) {
    console.error("Upload handler error:", error);
    if (blobPathname && !created) {
      await deleteFile(blobPathname);
    }
    return Response.json({ message: "Something went wrong during upload" }, { status: 500 });
  }
}
