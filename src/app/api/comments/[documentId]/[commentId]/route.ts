import { NextResponse as Response, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { verifyDocumentAccess } from "@/lib/access";

// DELETE a comment
export async function DELETE(
  req: NextRequest, 
  { params }: { params: Promise<{ documentId: string; commentId: string }> }
) {
  try {
    const { documentId, commentId } = await params;
    const shareToken = req.headers.get("X-Share-Token");

    const accessCheck = await verifyDocumentAccess(documentId, shareToken);
    if (!accessCheck.authorized) {
      return Response.json({ message: accessCheck.message }, { status: accessCheck.status });
    }

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment || comment.documentId !== documentId) {
      return Response.json({ message: "Comment not found" }, { status: 404 });
    }

    // Permission Check: Only the author can delete their own comment
    // Guests pass their guestName via headers (or we can just require it in body, but DELETE usually shouldn't have body, let's use a header or query param)
    if (accessCheck.access === "owner") {
      // Owner can delete their own comment
      if (comment.authorUserId !== accessCheck.user.id) {
        return Response.json({ message: "Forbidden: You can only delete your own comments" }, { status: 403 });
      }
    } else {
      // Guest can delete their own comment if guestName matches
      const guestName = req.headers.get("X-Guest-Name");
      if (!guestName || comment.authorGuestName !== guestName) {
        return Response.json({ message: "Forbidden: You can only delete your own comments" }, { status: 403 });
      }
    }

    await prisma.comment.delete({
      where: { id: commentId },
    });

    return Response.json({ message: "Comment deleted" }, { status: 200 });
  } catch (error) {
    console.error("DELETE comment error:", error);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
