"use client";

import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, Trash2, User, Minus, Bold, Italic, List, Reply, CornerDownRight, X } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Comment {
  id: string;
  content: string;
  authorUserId: string | null;
  authorGuestName: string | null;
  createdAt: string;
  parentId: string | null;
  user: { name: string | null; email: string } | null;
}

interface CommentNode extends Comment {
  children: CommentNode[];
}

interface CommentsSidebarProps {
  documentId: string;
  shareToken?: string;
}

export default function CommentsSidebar({ documentId, shareToken }: CommentsSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [input, setInput] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null);
  const [guestName, setGuestName] = useState("");
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (shareToken) {
      const storedName = localStorage.getItem(`guestName_${shareToken}`);
      if (storedName) {
        setGuestName(storedName);
      }
    }
  }, [shareToken]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const fetchComments = async () => {
      try {
        const headers: Record<string, string> = {};
        if (shareToken) headers["X-Share-Token"] = shareToken;

        const res = await fetch(`/api/comments/${documentId}`, { headers });
        if (!res.ok) throw new Error("Failed to load comments");
        const data = await res.json();
        setComments(data.comments);
      } catch (err) {
        setError("Unable to load comments");
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      fetchComments();
      interval = setInterval(fetchComments, 3000);
      scrollToBottom();
    }

    return () => clearInterval(interval);
  }, [documentId, shareToken, isOpen]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (shareToken && !guestName) {
      setShowGuestModal(true);
      return;
    }

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (shareToken) headers["X-Share-Token"] = shareToken;

      const payload = {
        content: input,
        guestName: guestName || undefined,
        parentId: replyingTo?.id || null,
      };

      const res = await fetch(`/api/comments/${documentId}`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to post comment");
      }

      const data = await res.json();
      setComments((prev) => [...prev, data.comment]);
      setInput("");
      setReplyingTo(null);
      setError(null);
      scrollToBottom();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (commentId: string, authorGuestName: string | null) => {
    try {
      const headers: Record<string, string> = {};
      if (shareToken) headers["X-Share-Token"] = shareToken;
      if (authorGuestName) headers["X-Guest-Name"] = authorGuestName; // prove ownership for guest

      const res = await fetch(`/api/comments/${documentId}/${commentId}`, {
        method: "DELETE",
        headers,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to delete comment");
      }

      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const saveGuestName = (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const name = fd.get("name") as string;
    if (name.trim() && shareToken) {
      localStorage.setItem(`guestName_${shareToken}`, name.trim());
      setGuestName(name.trim());
      setShowGuestModal(false);
      handlePost(new Event("submit") as any);
    }
  };

  const insertFormatting = (prefix: string, suffix: string) => {
    if (!textareaRef.current) return;
    
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = input;
    
    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end);
    
    const newText = `${before}${prefix}${selection || "text"}${suffix}${after}`;
    setInput(newText);
    
    // Focus and restore cursor
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(
          start + prefix.length,
          start + prefix.length + (selection.length || 4)
        );
      }
    }, 0);
  };

  // Build comment tree
  const buildTree = (flatComments: Comment[]): CommentNode[] => {
    const map = new Map<string, CommentNode>();
    const roots: CommentNode[] = [];

    flatComments.forEach(c => {
      map.set(c.id, { ...c, children: [] });
    });

    flatComments.forEach(c => {
      const node = map.get(c.id)!;
      if (c.parentId && map.has(c.parentId)) {
        map.get(c.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const commentTree = buildTree(comments);

  const renderComment = (node: CommentNode, depth: number = 0) => {
    const isOwner = node.authorUserId !== null;
    const isMyComment = isOwner ? !shareToken : node.authorGuestName === guestName;
    const authorName = isOwner ? (node.user?.name || node.user?.email.split("@")[0] || "Owner") : `${node.authorGuestName} (Guest)`;

    return (
      <div key={node.id} className={`${depth > 0 ? "ml-3 pl-3 border-l-2 border-white/5 mt-3" : "mt-4"}`}>
        <div className={`p-3 rounded-lg border ${depth > 0 ? "border-transparent bg-transparent p-0" : "border-white/5 bg-white/[0.02]"} text-sm`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
              {depth > 0 && <CornerDownRight className="w-3 h-3 text-neutral-600" />}
              {authorName}
            </span>
            {isMyComment && (
              <button
                onClick={() => handleDelete(node.id, node.authorGuestName)}
                className="text-neutral-600 hover:text-red-400 transition-colors p-1 rounded hover:bg-white/5"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
          
          {/* Markdown Rendering */}
          <div className="text-neutral-200 leading-relaxed text-sm prose prose-invert prose-p:my-1 prose-ul:my-1 prose-ul:pl-4 prose-li:my-0 max-w-none">
            <ReactMarkdown
              components={{
                p: ({node, ...props}) => <p className="mb-1 last:mb-0" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-1" {...props} />,
                ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-1" {...props} />,
                li: ({node, ...props}) => <li className="mb-0" {...props} />,
                strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props} />,
                em: ({node, ...props}) => <em className="italic text-neutral-300" {...props} />
              }}
            >
              {node.content}
            </ReactMarkdown>
          </div>
          
          <div className="flex items-center justify-between mt-2">
            <button
              onClick={() => {
                setReplyingTo({ id: node.id, name: authorName });
                textareaRef.current?.focus();
              }}
              className="text-xs font-medium text-neutral-500 hover:text-white flex items-center gap-1 transition-colors"
            >
              <Reply className="w-3 h-3" /> Reply
            </button>
            <span className="text-[10px] text-neutral-600">
              {new Date(node.createdAt).toLocaleDateString()} {new Date(node.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
        
        {/* Render children recursively */}
        {node.children.length > 0 && (
          <div className="space-y-1">
            {node.children.map(child => renderComment(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-8 md:right-12 lg:right-16 w-12 h-12 bg-[#111111] border border-white/10 text-white shadow-[0_4px_20px_rgba(0,0,0,0.5)] rounded-full flex items-center justify-center transition-all duration-200 hover:bg-white/10 hover:scale-105 z-40"
        aria-label="Open Comments"
      >
        <MessageSquare className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-8 md:right-12 lg:right-16 w-full max-w-[350px] h-[550px] max-h-[85vh] bg-[#0a0a0a] border border-white/10 shadow-[0_16px_48px_rgba(0,0,0,0.7)] rounded-xl z-50 flex flex-col overflow-hidden animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-neutral-300" />
          <h2 className="text-sm font-medium text-white">Comments</h2>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1.5 text-neutral-500 hover:text-white hover:bg-white/5 rounded-md transition-colors"
          aria-label="Minimize Comments"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>

      {/* Comment List */}
      <div className="flex-grow overflow-y-auto p-4 space-y-1 pt-0">
        {isLoading ? (
          <p className="text-center text-sm text-neutral-500 mt-4">Loading comments...</p>
        ) : comments.length === 0 ? (
          <p className="text-center text-sm text-neutral-500 mt-4">No comments yet.</p>
        ) : (
          commentTree.map(root => renderComment(root, 0))
        )}
        <div ref={commentsEndRef} />
      </div>

      {error && <div className="px-4 py-2 text-xs text-red-400 bg-red-500/10 text-center border-t border-red-500/20">{error}</div>}

      {/* Input Area */}
      <div className="border-t border-white/10 flex-shrink-0 bg-[#0a0a0a] flex flex-col">
        {/* Reply Indicator */}
        {replyingTo && (
          <div className="flex items-center justify-between bg-[#111111] px-3 py-2 border-b border-white/5">
            <span className="text-xs text-neutral-400 flex items-center gap-1.5">
              <Reply className="w-3 h-3" /> Replying to <strong className="text-neutral-200">{replyingTo.name}</strong>
            </span>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-neutral-500 hover:text-white p-0.5 rounded transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        
        {/* Formatting Toolbar */}
        <div className="flex items-center gap-1 px-2 py-1.5 bg-[#111111] border-b border-white/5">
          <button
            type="button"
            onClick={() => insertFormatting("**", "**")}
            className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Bold"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting("*", "*")}
            className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Italic"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting("- ", "")}
            className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Bullet List"
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handlePost} className="relative flex items-end p-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handlePost(e as unknown as React.FormEvent);
              }
            }}
            placeholder={replyingTo ? "Write a reply..." : "Add a comment..."}
            rows={1}
            className="w-full bg-black text-sm text-white rounded-lg border border-white/10 focus:border-white/30 focus:ring-1 focus:ring-white/30 focus:outline-none py-2.5 pl-3 pr-10 transition-all resize-none max-h-32 min-h-[42px] overflow-y-auto placeholder:text-neutral-500"
            style={{
              height: input ? Math.min(textareaRef.current?.scrollHeight || 42, 128) : 42
            }}
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="absolute right-3 bottom-3.5 p-1.5 text-neutral-400 hover:text-white disabled:text-neutral-700 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Guest Name Modal */}
      {showGuestModal && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#111111] rounded-xl p-6 w-full max-w-sm border border-white/10 shadow-[0_16px_48px_rgba(0,0,0,0.7)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                <User className="w-4 h-4 text-neutral-300" />
              </div>
              <h3 className="text-sm font-semibold text-white">Join the Conversation</h3>
            </div>
            <p className="text-sm text-neutral-400 mb-5">
              Please provide a display name so others know who is commenting. You don&apos;t need to create an account.
            </p>
            <form onSubmit={saveGuestName} className="space-y-3">
              <input
                type="text"
                name="name"
                placeholder="Enter your name..."
                required
                className="w-full bg-black border border-white/10 text-white px-3 py-2.5 rounded-lg focus:ring-1 focus:ring-white/30 focus:border-white/30 focus:outline-none transition-all text-sm placeholder:text-neutral-500"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowGuestModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-neutral-400 border border-white/10 bg-white/5 hover:bg-white/10 hover:text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-sm font-medium text-black bg-white hover:bg-neutral-200 rounded-lg transition-colors"
                >
                  Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
