import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";
import ShareManager from "@/components/ShareManager";
import CommentsSidebar from "@/components/CommentsSidebar";
import SummaryBanner from "@/components/SummaryBanner";
import ExtractedTextModal from "@/components/ExtractedTextModal";

export const metadata = {
  title: "PDF Viewer | PDF Intelligence",
};

export default async function PDFViewerPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    redirect("/login");
  }

  const { id } = params;

  const document = await prisma.document.findUnique({
    where: { id },
  });

  if (!document) {
    notFound();
  }

  if (document.userId !== session.user.id) {
    redirect("/dashboard");
  }

  // Fetch chat history
  const history = await prisma.chatMessage.findMany({
    where: { documentId: id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex flex-col h-screen bg-black text-neutral-50 overflow-hidden font-sans selection:bg-white/20">
      {/* Header Bar */}
      <header className="flex items-center justify-between px-6 py-3.5 bg-black border-b border-white/5 flex-shrink-0 relative z-50">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 text-neutral-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-sm font-medium text-white truncate max-w-xl">
              {document.filename}
            </h1>
            <p className="text-xs text-neutral-500">
              Uploaded on {new Date(document.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ShareManager documentId={document.id} />
          <ExtractedTextModal extractedText={document.extractedText || ""} />
          <a
            href={document.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-neutral-300 border border-white/10 bg-transparent hover:bg-white/5 hover:text-white transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Open Native
          </a>
        </div>
      </header>

      {/* Summary Banner */}
      {(document.summary || document.summaryStatus !== "DONE") && (
        <SummaryBanner
          documentId={document.id}
          summary={document.summary}
          summaryStatus={document.summaryStatus as any}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-grow flex overflow-hidden relative">
        {/* PDF Viewer */}
        <div className="flex-grow relative bg-black p-4 md:p-6 lg:p-8">
          <div className="w-full h-full relative rounded-xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.6)] border border-white/10">
            <iframe
              src={`${document.fileUrl}#toolbar=0&navpanes=0`}
              className="absolute inset-0 w-full h-full border-0 bg-white"
              title={document.filename}
              loading="lazy"
            />
          </div>
        </div>

        <ChatPanel documentId={document.id} initialHistory={history} />
        <CommentsSidebar documentId={document.id} />
      </main>
    </div>
  );
}
