"use client";

import { useState } from "react";
import SearchBar from "./SearchBar";
import DocumentCard from "./DocumentCard";
import { toast } from "sonner";
import { FileText, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import UploadModal from "./UploadModal";

interface Document {
  id: string;
  filename: string;
  createdAt: string | Date;
  summaryStatus: "PENDING" | "GENERATING" | "DONE" | "FAILED";
  summary: string | null;
}

interface DashboardClientProps {
  initialDocuments: Document[];
}

export default function DashboardClient({ initialDocuments }: DashboardClientProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  useEffect(() => {
    const hasPending = documents.some(doc => doc.summaryStatus === "PENDING" || doc.summaryStatus === "GENERATING");
    if (!hasPending) return;

    const interval = setInterval(() => {
      router.refresh();
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [documents, router]);

  const filteredDocuments = documents.filter((doc) =>
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    // Optimistic update
    const previousDocs = [...documents];
    setDocuments(documents.filter((doc) => doc.id !== id));

    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete document");
      }
      
      toast.success("Document deleted successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete document");
      // Revert on failure
      setDocuments(previousDocs);
    }
  };

  const handleUploadComplete = (document: Document) => {
    setDocuments((prev) => [document, ...prev]);
    setIsUploadModalOpen(false);
  };

  return (
    <div className="w-full">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="inline-flex items-center gap-2 bg-white text-black font-medium px-5 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors text-sm whitespace-nowrap w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          Upload PDF
        </button>
      </div>

      {/* Empty State */}
      {documents.length === 0 ? (
        <div className="border-2 border-dashed border-white/10 rounded-xl py-24 flex flex-col items-center justify-center text-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5">
            <FileText className="w-6 h-6 text-neutral-500" />
          </div>
          <div>
            <h3 className="text-base font-medium text-white">No documents yet</h3>
            <p className="text-sm text-neutral-500 mt-1">Upload your first PDF to get started.</p>
          </div>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="mt-2 inline-flex items-center gap-2 bg-white text-black font-medium px-5 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Upload PDF
          </button>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-neutral-500">No documents found matching &ldquo;{searchQuery}&rdquo;</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc, index) => (
            <DocumentCard key={doc.id} document={doc} onDelete={handleDelete} index={index} />
          ))}
        </div>
      )}

      <UploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
        onUploadComplete={handleUploadComplete} 
      />
    </div>
  );
}
