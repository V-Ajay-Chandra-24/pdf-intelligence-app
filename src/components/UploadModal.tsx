"use client";

import { useState, useRef, useEffect } from "react";
import { UploadCloud, CheckCircle, AlertCircle, Loader2, X } from "lucide-react";
import { upload } from "@vercel/blob/client";
import { useSession } from "next-auth/react";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: (document: any) => void;
}

type Stage = "IDLE" | "UPLOADING" | "EXTRACTING" | "DONE";

export default function UploadModal({ isOpen, onClose, onUploadComplete }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("IDLE");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: session } = useSession();
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset state on close
      setFile(null);
      setStage("IDLE");
      setProgress(0);
      setError(null);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    }
  }, [isOpen]);

  const validateAndSetFile = (selected: File | undefined) => {
    setError(null);
    if (!selected) return;

    if (selected.type !== "application/pdf") {
      setError("Please select a valid PDF file.");
      return;
    }

    if (selected.size > 10 * 1024 * 1024) {
      setError("File size exceeds 10MB limit.");
      return;
    }

    setFile(selected);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndSetFile(e.target.files?.[0]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    validateAndSetFile(e.dataTransfer.files?.[0]);
  };

  const handleUpload = async () => {
    if (!file || !session?.user?.id) {
      if (!session?.user?.id) setError("Authentication required");
      return;
    }

    setStage("UPLOADING");
    setError(null);
    setProgress(0);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // 1. Generate UUID for the blob
      const uuid = crypto.randomUUID();
      const pathname = `pdfs/${session.user.id}/${uuid}.pdf`;

      // 2. Upload to Vercel Blob
      await upload(pathname, file, {
        access: "private",
        handleUploadUrl: "/api/upload/token",
        abortSignal: abortController.signal,
        onUploadProgress: (event) => {
          setProgress(event.percentage);
        },
      });

      setStage("EXTRACTING");

      // 3. Post to our backend to create the Document and start processing
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uuid,
          originalName: file.name,
          size: file.size,
        }),
        signal: abortController.signal,
      });

      abortControllerRef.current = null;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to process document");
      }

      const data = await response.json();
      setStage("DONE");
      setTimeout(() => {
        onUploadComplete(data.document);
      }, 1000); // Wait 1s to show success state before closing

    } catch (err: unknown) {
      abortControllerRef.current = null;
      if (err instanceof Error) {
        if (err.name === "AbortError") {
          setError("Upload cancelled by user.");
        } else {
          setError(err.message || "Something went wrong during upload");
        }
      } else {
        setError("Something went wrong during upload");
      }
      setStage("IDLE");
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStage("IDLE");
    setProgress(0);
    setError("Upload cancelled by user.");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111111] rounded-2xl shadow-2xl w-full max-w-lg border border-white/10 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-white/10">
          <h2 className="text-base font-semibold text-white">Upload PDF Document</h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white transition-colors p-1 rounded-md hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {stage === "IDLE" && (
            <>
              <p className="text-sm text-neutral-400 mb-5">
                Upload a PDF with selectable text (up to 10MB). Scanned or image-only PDFs aren't supported.
              </p>

              {/* Upload Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/10 bg-black hover:bg-white/[0.02] px-6 py-12 text-center transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                <UploadCloud className="mb-4 h-10 w-10 text-neutral-500" />
                <h3 className="text-sm font-medium text-white">
                  {file ? file.name : "Click or drag file to this area"}
                </h3>
                <p className="mt-1.5 text-xs text-neutral-400">
                  {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Strictly PDF up to 10MB"}
                </p>
              </div>

              {error && (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-red-400 border border-red-500/20">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={!file}
                className="mt-5 w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black transition-colors hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Upload &amp; Extract Text
              </button>
            </>
          )}

          {stage === "UPLOADING" && (
            <div className="py-8 flex flex-col items-center text-center">
              <UploadCloud className="w-10 h-10 text-neutral-400 mb-4 animate-pulse" />
              <h3 className="text-sm font-medium text-white mb-4">Uploading file...</h3>
              <div className="w-full max-w-xs bg-white/10 rounded-full h-1.5 mb-2">
                <div className="bg-white h-1.5 rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-neutral-500 mb-6">{Math.round(progress)}% completed</p>
              <button
                onClick={handleCancel}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Cancel upload
              </button>
            </div>
          )}

          {stage === "EXTRACTING" && (
            <div className="py-8 flex flex-col items-center text-center">
              <Loader2 className="w-10 h-10 text-neutral-400 mb-4 animate-spin" />
              <h3 className="text-sm font-medium text-white mb-2">Processing Document</h3>
              <p className="text-sm text-neutral-500">
                Extracting text and preparing your document...
              </p>
            </div>
          )}

          {stage === "DONE" && (
            <div className="py-8 flex flex-col items-center text-center">
              <CheckCircle className="w-14 h-14 text-emerald-500 mb-4" />
              <h3 className="text-base font-semibold text-white mb-1">Success!</h3>
              <p className="text-sm text-neutral-400">Document processed and ready for summary.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
