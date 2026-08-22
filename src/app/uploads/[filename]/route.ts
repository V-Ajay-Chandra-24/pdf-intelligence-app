import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { filename } = await params;
    
    // Security check to prevent directory traversal
    if (filename.includes("..") || filename.includes("/")) {
      return new NextResponse("Invalid filename", { status: 400 });
    }

    const url = new URL(req.url);
    const shareToken = url.searchParams.get("shareToken");
    const fileUrl = `/uploads/${filename}`;
    
    let isAuthorized = false;

    if (session?.user?.id) {
      const document = await prisma.document.findFirst({
        where: { fileUrl, userId: session.user.id }
      });
      if (document) isAuthorized = true;
    }

    if (!isAuthorized && shareToken) {
      const share = await prisma.share.findFirst({
        where: { token: shareToken, revokedAt: null, document: { fileUrl } }
      });
      if (share) isAuthorized = true;
    }

    if (!isAuthorized) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), "public", "uploads");
    const filePath = path.join(uploadsDir, filename);

    try {
      const fileBuffer = await fs.readFile(filePath);
      
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${filename}"`,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch (err) {
      console.error(`File not found: ${filePath}`, err);
      return new NextResponse("File not found", { status: 404 });
    }
  } catch (error) {
    console.error("Error serving file:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
