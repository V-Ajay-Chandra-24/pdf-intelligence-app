import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { deriveBlobPathname, getPdfStream } from "@/lib/storage";

export const dynamic = 'force-dynamic';

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
    let authorizedDocument = null;

    if (session?.user?.id) {
      const document = await prisma.document.findFirst({
        where: { fileUrl, userId: session.user.id }
      });
      if (document) {
        isAuthorized = true;
        authorizedDocument = document;
      }
    }

    if (!isAuthorized && shareToken) {
      const share = await prisma.share.findFirst({
        where: { token: shareToken, revokedAt: null, document: { fileUrl } },
        include: { document: true }
      });
      if (share && share.document) {
        isAuthorized = true;
        authorizedDocument = share.document;
      }
    }

    if (!isAuthorized || !authorizedDocument) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const uuid = filename.replace(".pdf", "");
    const blobPathname = deriveBlobPathname(authorizedDocument.userId, uuid);

    const result = await getPdfStream(blobPathname);
    
    if (!result || !result.stream) {
      return new NextResponse("File not found", { status: 404 });
    }
    
    const name = authorizedDocument.filename;
    const ascii = name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") || "document.pdf";
    const encoded = encodeURIComponent(name).replace(/['()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());

    return new NextResponse(result.stream as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${ascii}"; filename*=UTF-8''${encoded}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });

  } catch (error) {
    console.error("Error serving file:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
