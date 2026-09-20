import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { validateBlobPathname } from "@/lib/storage";

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
          throw new Error('Unauthorized');
        }

        const docCount = await prisma.document.count({ where: { userId: session.user.id } });
        if (docCount >= 25) {
          throw new Error('Upload limit reached. You can only store up to 25 documents in this demo.');
        }
        
        const { valid } = validateBlobPathname(pathname, session.user.id);
        if (!valid) {
          throw new Error('Invalid pathname or UUID format');
        }
        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: 10 * 1024 * 1024,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const status = error instanceof Error && error.message === 'Unauthorized' ? 401 : 400;
    return NextResponse.json(
      { error: (error as Error).message },
      { status },
    );
  }
}
