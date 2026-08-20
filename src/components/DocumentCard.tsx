"use client";

import { FileText, MoreVertical, Share2, Trash2, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";

interface Document {
  id: string;
  filename: string;
  createdAt: string | Date;
  summaryStatus: "PENDING" | "GENERATING" | "DONE" | "FAILED";
  summary: string | null;
}

interface DocumentCardProps {
  document: Document;
  onDelete: (id: string) => void;
  index?: number;
}

export default function DocumentCard({ document, onDelete, index = 0 }: DocumentCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.document.addEventListener("mousedown", handleClickOutside);
    return () => window.document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDoubleClick = () => {
    router.push(`/dashboard/pdf/${document.id}`);
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    
    const toastId = toast.loading("Generating share link...");
    try {
      let res = await fetch(`/api/share/${document.id}`);
      let data = await res.json();
      let token = data?.share?.token;

      if (!token) {
        res = await fetch(`/api/share/${document.id}`, { method: "POST" });
        if (!res.ok) throw new Error("Failed to generate link");
        data = await res.json();
        token = data?.share?.token;
      }

      if (!token) throw new Error("No token returned");

      const shareUrl = `${window.location.origin}/shared/${token}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied!", { id: toastId });
    } catch (err) {
      toast.error("Failed to copy share link", { id: toastId });
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirm(true);
    setMenuOpen(false);
  };

  const confirmDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirm(false);
    onDelete(document.id);
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirm(false);
  };

  const handleRetrySummary = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRetrying) return;
    
    setIsRetrying(true);
    try {
      const res = await fetch(`/api/documents/${document.id}/summarize`, {
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

  const formattedDate = new Date(document.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className="relative flex flex-col bg-[#111111] rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all duration-200 cursor-pointer p-5 group animate-fade-in-up opacity-0"
      style={{ animationDelay: `${index * 60}ms` }}
      onDoubleClick={handleDoubleClick}
      title="Double click to open"
    >
      {/* Top row — icon + actions */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5">
          <FileText className="w-4 h-4 text-neutral-300" />
        </div>

        <div className="flex items-center gap-2">
          {/* View Button */}
          <Link
            href={`/dashboard/pdf/${document.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            View
          </Link>
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1 w-36 bg-[#1a1a1a] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.6)] border border-white/10 z-20 py-1 overflow-hidden">
              <button
                onClick={handleShare}
                className="w-full text-left px-3 py-2 text-sm text-neutral-300 hover:text-white hover:bg-white/5 flex items-center gap-2 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" /> Share
              </button>
              <button
                onClick={handleDeleteClick}
                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Filename */}
      <h3
        className="font-medium text-white truncate"
        title={document.filename}
      >
        {document.filename}
      </h3>

      {/* Date */}
      <p className="text-xs text-neutral-500 mt-1 mb-3">{formattedDate}</p>

      {/* Summary */}
      <div className="flex-grow">
        {document.summaryStatus === "PENDING" || document.summaryStatus === "GENERATING" ? (
          <div className="flex items-center gap-2 text-neutral-500">
            <div className="w-3.5 h-3.5 border-2 border-neutral-600 border-t-neutral-400 rounded-full animate-spin flex-shrink-0" />
            <p className="text-sm italic">Generating summary...</p>
          </div>
        ) : document.summaryStatus === "FAILED" ? (
          <div className="flex items-center gap-3">
            <p className="text-sm text-red-400">Summary failed.</p>
            <button
              onClick={handleRetrySummary}
              disabled={isRetrying}
              className="text-xs border border-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-md text-neutral-300 transition-colors disabled:opacity-50"
            >
              {isRetrying ? "Retrying..." : "Retry"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-neutral-400 leading-relaxed line-clamp-3">
            {document.summary}
          </p>
        )}
      </div>

      {/* Delete Confirmation Overlay */}
      {showConfirm && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-4 rounded-xl text-center gap-4">
          <p className="text-sm font-medium text-white">Delete this PDF?</p>
          <div className="flex gap-2">
            <button
              onClick={cancelDelete}
              className="px-4 py-1.5 text-xs font-medium text-neutral-300 border border-white/10 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className="px-4 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
