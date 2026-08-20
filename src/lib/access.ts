import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { User, Document, Share } from "@/generated/prisma/client";

export type AccessResult = 
  | { authorized: false; message: string; status: number }
  | { authorized: true; access: "owner"; user: User; document: Document }
  | { authorized: true; access: "guest"; share: Share; document: Document };

export async function verifyDocumentAccess(documentId: string, shareToken?: string | null): Promise<AccessResult> {
  // Try Guest Access First if Token is Provided
  if (shareToken) {
    const share = await prisma.share.findUnique({
      where: { token: shareToken },
      include: { document: true },
    });

    if (!share || share.documentId !== documentId) {
      return { authorized: false, message: "This link is invalid", status: 404 };
    }

    if (share.revokedAt) {
      return { authorized: false, message: "This link has been revoked by the owner", status: 403 };
    }

    return { authorized: true, access: "guest", share, document: share.document };
  }

  // Fallback to Owner Access
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return { authorized: false, message: "Unauthorized", status: 401 };
  }

  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    return { authorized: false, message: "Document not found", status: 404 };
  }

  if (document.userId !== session.user.id) {
    return { authorized: false, message: "Forbidden", status: 403 };
  }

  // We fetch the full user since session.user might be a partial
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return { authorized: false, message: "User not found", status: 404 };
  }

  return { authorized: true, access: "owner", user, document };
}
