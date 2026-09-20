import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

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
        
        // Require pathname to match ^pdfs/<session.user.id>/<uuid>\.pdf$ (uuid v4 format)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const expectedPrefix = `pdfs/${session.user.id}/`;
        
        if (!pathname.startsWith(expectedPrefix)) {
          throw new Error('Invalid pathname prefix');
        }
        
        const filename = pathname.slice(expectedPrefix.length);
        const uuid = filename.replace(/\.pdf$/i, '');
        
        if (!uuidRegex.test(uuid)) {
          throw new Error('Invalid uuid format in pathname');
        }

        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: 10 * 1024 * 1024,
          addRandomSuffix: false,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
