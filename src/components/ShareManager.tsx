"use strict";
"use client";

import { useState, useEffect } from "react";
import { Share2, Link as LinkIcon, Check, Trash2, X } from "lucide-react";

interface ShareManagerProps {
  documentId: string;
}

export default function ShareManager({ documentId }: ShareManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchActiveShare();
    }
  }, [isOpen]);

  const fetchActiveShare = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/share/${documentId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.share) {
          setShareLink(`${window.location.origin}/shared/${data.share.token}`);
        } else {
          setShareLink(null);
        }
      }
    } catch (err) {
      console.error("Failed to fetch share link");
    } finally {
      setIsLoading(false);
    }
  };

  const generateLink = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/share/${documentId}`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setShareLink(`${window.location.origin}/shared/${data.share.token}`);
      }
    } catch (err) {
      console.error("Failed to generate link");
    } finally {
      setIsLoading(false);
    }
  };

  const revokeLink = async () => {
    if (!confirm("Are you sure you want to revoke this link? Guests will immediately lose access.")) return;
    
    try {
      setIsLoading(true);
      const res = await fetch(`/api/share/${documentId}`, { method: "PATCH" });
      if (res.ok) {
        setShareLink(null);
      }
    } catch (err) {
      console.error("Failed to revoke link");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200 transition-colors"
      >
        <Share2 className="w-4 h-4" />
        Share
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-[#111111] border border-white/10 rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.7)] z-[100] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h3 className="text-sm font-medium text-white">Share Document</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-neutral-500 hover:text-white hover:bg-white/5 rounded-md p-1 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4">
              {isLoading ? (
                <div className="text-center text-sm text-neutral-500 py-4">Loading...</div>
              ) : shareLink ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-neutral-500 uppercase tracking-widest">
                      Public Link
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-300 truncate">
                        {shareLink}
                      </div>
                      <button
                        onClick={copyToClipboard}
                        className="p-2 border border-white/10 bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white rounded-lg transition-colors flex-shrink-0"
                        title="Copy to clipboard"
                      >
                        {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <LinkIcon className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={revokeLink}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-red-500/20 bg-transparent"
                  >
                    <Trash2 className="w-4 h-4" />
                    Revoke Access
                  </button>
                </div>
              ) : (
                <div className="text-center py-2 space-y-4">
                  <p className="text-sm text-neutral-400">
                    Generate a secure link to share this document with guests.
                  </p>
                  <button
                    onClick={generateLink}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200 transition-colors"
                  >
                    <LinkIcon className="w-4 h-4" />
                    Generate Link
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
