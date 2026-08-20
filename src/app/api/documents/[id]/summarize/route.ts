import { NextResponse as Response } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { summarizeDocumentJob } from "@/lib/jobs/summarize";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id: documentId } = await params;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document || document.userId !== session.user.id) {
      return Response.json({ message: "Not found" }, { status: 404 });
    }

    // Fire and forget background job
    summarizeDocumentJob(document.id, document.extractedText || "");

    return Response.json({ message: "Summarization started" }, { status: 200 });
  } catch (error) {
    console.error("Manual summarize trigger error:", error);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
