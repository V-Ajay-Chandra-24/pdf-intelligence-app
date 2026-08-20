import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import prisma from "@/lib/prisma";
import ChatPanel from "@/components/ChatPanel";
import CommentsSidebar from "@/components/CommentsSidebar";
import SummaryBanner from "@/components/SummaryBanner";

export const metadata = {
  title: "Shared Document | PDF Intelligence",
};

export default async function SharedDocumentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const share = await prisma.share.findUnique({
    where: { token },
    include: {
      document: true,
      user: { select: { name: true, email: true } }, // The owner
    },
  });

  // Invalid link
  if (!share) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-neutral-50 font-sans">
        <div className="p-8 bg-[#111111] border border-white/10 rounded-2xl shadow-2xl flex flex-col items-center text-center animate-fade-in-up">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mb-4" />
          <h1 className="text-xl font-semibold mb-2 text-white">This link is invalid</h1>
          <p className="text-sm text-neutral-400">The share link does not exist or has a typo.</p>
        </div>
      </div>
    );
  }

  // Revoked link
  if (share.revokedAt) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-neutral-50 font-sans">
        <div className="p-8 bg-[#111111] border border-white/10 rounded-2xl shadow-2xl flex flex-col items-center text-center animate-fade-in-up">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <h1 className="text-xl font-semibold mb-2 text-white">Access Revoked</h1>
          <p className="text-sm text-neutral-400">This link has been revoked by the owner.</p>
        </div>
      </div>
    );
  }

  const { document } = share;
  const ownerName = share.user.name || share.user.email.split("@")[0];

  // History will be fetched client-side using the guestSessionId

  return (
    <div className="flex flex-col h-screen bg-black text-neutral-50 overflow-hidden font-sans selection:bg-white/20">
      {/* Header Bar */}
      <header className="flex items-center justify-between px-6 py-3.5 bg-black border-b border-white/5 flex-shrink-0 relative z-50">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-sm font-medium text-white truncate max-w-xl">
              {document.filename}
            </h1>
            <p className="text-xs text-neutral-500">
              Shared by {ownerName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="border border-white/10 bg-white/5 text-neutral-300 rounded-full px-3 py-1 text-xs font-medium">
            Guest View
          </span>
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
              src={`${document.fileUrl}?shareToken=${token}#toolbar=0&navpanes=0`}
              className="absolute inset-0 w-full h-full border-0 bg-white"
              title={document.filename}
              loading="lazy"
            />
          </div>
        </div>

        <ChatPanel documentId={document.id} initialHistory={[]} shareToken={token} />
        <CommentsSidebar documentId={document.id} shareToken={token} />
      </main>
    </div>
  );
}
