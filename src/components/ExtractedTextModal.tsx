"use client";

import { useState } from "react";
import { FileText, X } from "lucide-react";

interface ExtractedTextModalProps {
  extractedText: string;
}

export default function ExtractedTextModal({ extractedText }: ExtractedTextModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-neutral-300 border border-white/10 bg-transparent hover:bg-white/5 hover:text-white transition-colors"
        title="View extracted raw text for debugging"
      >
        <FileText className="w-4 h-4" />
        View extracted text
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111111] rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] border border-white/10 flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-white/10">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-neutral-400" />
                Raw Extracted Text
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-neutral-500 hover:text-white hover:bg-white/5 rounded-md p-1.5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 overflow-hidden flex-grow flex flex-col">
              <div className="flex-grow overflow-y-auto bg-black rounded-xl border border-white/10 p-4">
                <pre className="text-sm text-neutral-300 font-mono whitespace-pre-wrap break-words">
                  {extractedText || "No text was extracted for this document."}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
