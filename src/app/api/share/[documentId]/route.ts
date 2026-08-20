import { NextResponse as Response, NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import crypto from "crypto";

// GET active share link
export async function GET(req: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { documentId } = await params;
    const document = await prisma.document.findUnique({ where: { id: documentId } });

    if (!document || document.userId !== session.user.id) {
      return Response.json({ message: "Not found or forbidden" }, { status: 404 });
    }

    const share = await prisma.share.findFirst({
      where: { documentId, revokedAt: null },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ share }, { status: 200 });
  } catch (error) {
    console.error("GET share error:", error);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}

// POST generate new share link
export async function POST(req: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { documentId } = await params;
    const document = await prisma.document.findUnique({ where: { id: documentId } });

    if (!document || document.userId !== session.user.id) {
      return Response.json({ message: "Not found or forbidden" }, { status: 404 });
    }

    // Revoke any existing active shares before creating a new one to be safe
    await prisma.share.updateMany({
      where: { documentId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomBytes(8).toString("hex");

    const share = await prisma.share.create({
      data: {
        documentId,
        token,
        createdBy: session.user.id,
      },
    });

    return Response.json({ share }, { status: 201 });
  } catch (error) {
    console.error("POST share error:", error);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}

// PATCH revoke share link
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { documentId } = await params;
    const document = await prisma.document.findUnique({ where: { id: documentId } });

    if (!document || document.userId !== session.user.id) {
      return Response.json({ message: "Not found or forbidden" }, { status: 404 });
    }

    await prisma.share.updateMany({
      where: { documentId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return Response.json({ message: "Share links revoked" }, { status: 200 });
  } catch (error) {
    console.error("PATCH share error:", error);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
