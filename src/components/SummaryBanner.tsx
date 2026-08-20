"use client";

import { useState, useEffect } from "react";
import { X, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface SummaryBannerProps {
  documentId: string;
  summary: string | null;
  summaryStatus: "PENDING" | "GENERATING" | "DONE" | "FAILED";
}

export default function SummaryBanner({ documentId, summary, summaryStatus }: SummaryBannerProps) {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (summaryStatus === "PENDING" || summaryStatus === "GENERATING") {
      const interval = setInterval(() => {
        router.refresh();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [summaryStatus, router]);

  const handleRetrySummary = async () => {
    if (isRetrying) return;
    
    setIsRetrying(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/summarize`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Summarization restarted!");
        router.refresh();
      } else {
        toast.error("Failed to restart summarization");
      }
    } catch (err) {
      toast.error("Error connecting to server");
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div
      className={`overflow-hidden transition-all duration-300 ease-in-out ${
        isVisible ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
      }`}
    >
      <div className="mx-4 mt-4 bg-[#111111] border border-white/10 rounded-xl p-4 relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-grow min-w-0">
            <h2 className="text-xs font-medium text-white mb-2 flex items-center gap-1.5 uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5 text-neutral-300" />
              AI Summary
            </h2>

            {(summaryStatus === "PENDING" || summaryStatus === "GENERATING") ? (
              <div className="flex items-center gap-2 text-neutral-500">
                <div className="w-3.5 h-3.5 border-2 border-neutral-600 border-t-neutral-400 rounded-full animate-spin flex-shrink-0" />
                <p className="text-sm italic">Generating summary...</p>
              </div>
            ) : summaryStatus === "FAILED" ? (
              <div className="flex items-center gap-3">
                <p className="text-sm text-red-400">Summary failed to generate.</p>
                <button
                  onClick={handleRetrySummary}
                  disabled={isRetrying}
                  className="text-xs border border-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-md text-neutral-300 transition-colors disabled:opacity-50"
                >
                  {isRetrying ? "Retrying..." : "Retry"}
                </button>
              </div>
            ) : (
              <p className="text-sm text-neutral-300 leading-relaxed pr-6">
                {summary}
              </p>
            )}
          </div>

          <button
            onClick={() => setIsVisible(false)}
            className="p-1.5 text-neutral-500 hover:text-white hover:bg-white/5 rounded-md transition-colors flex-shrink-0"
            aria-label="Close summary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
