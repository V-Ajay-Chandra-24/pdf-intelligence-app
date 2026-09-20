import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { deleteFile, deriveBlobPathname } from "@/lib/storage";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if document exists and belongs to user
    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      return NextResponse.json({ message: "Document not found" }, { status: 404 });
    }

    if (document.userId !== session.user.id) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // Delete from database
    await prisma.document.delete({
      where: { id },
    });

    // Delete blob best-effort
    if (document.fileUrl && document.fileUrl.startsWith("/uploads/")) {
      const uuid = document.fileUrl.replace("/uploads/", "").replace(".pdf", "");
      const blobPathname = deriveBlobPathname(document.userId, uuid);
      await deleteFile(blobPathname);
    }

    return NextResponse.json({ message: "Document deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
