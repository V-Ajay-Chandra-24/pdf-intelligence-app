import { NextResponse as Response, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { verifyDocumentAccess } from "@/lib/access";

// GET all comments for a document
export async function GET(req: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  try {
    const { documentId } = await params;
    const shareToken = req.headers.get("X-Share-Token");

    const accessCheck = await verifyDocumentAccess(documentId, shareToken);
    if (!accessCheck.authorized) {
      return Response.json({ message: accessCheck.message }, { status: accessCheck.status });
    }

    const comments = await prisma.comment.findMany({
      where: { documentId },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    return Response.json({ comments }, { status: 200 });
  } catch (error) {
    console.error("GET comments error:", error);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}

// POST a new comment
export async function POST(req: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  try {
    const { documentId } = await params;
    const shareToken = req.headers.get("X-Share-Token");

    const accessCheck = await verifyDocumentAccess(documentId, shareToken);
    if (!accessCheck.authorized) {
      return Response.json({ message: accessCheck.message }, { status: accessCheck.status });
    }

    const body = await req.json();
    const { content, guestName, parentId } = body;

    if (!content || !content.trim()) {
      return Response.json({ message: "Comment content is required" }, { status: 400 });
    }

    let authorUserId = null;
    let authorGuestName = null;

    if (accessCheck.access === "owner") {
      authorUserId = accessCheck.user.id;
    } else {
      if (!guestName || !guestName.trim()) {
        return Response.json({ message: "Guest name is required" }, { status: 400 });
      }
      authorGuestName = guestName.trim();
    }

    const comment = await prisma.comment.create({
      data: {
        documentId,
        content: content.trim(),
        authorUserId,
        authorGuestName,
        parentId: parentId || null,
      },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    return Response.json({ comment }, { status: 201 });
  } catch (error) {
    console.error("POST comment error:", error);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
