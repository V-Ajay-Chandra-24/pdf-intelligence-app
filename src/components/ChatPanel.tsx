"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, AlertCircle, Minus } from "lucide-react";

interface ChatMessage {
  id: string;
  role: string;
  content: string;
}

interface ChatPanelProps {
  documentId: string;
  initialHistory: ChatMessage[];
  shareToken?: string;
}

export default function ChatPanel({ documentId, initialHistory, shareToken }: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(initialHistory);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [guestSessionId, setGuestSessionId] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (shareToken) {
      const key = `guestChatSessionId_${shareToken}`;
      let sessionId = localStorage.getItem(key);
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem(key, sessionId);
      }
      setGuestSessionId(sessionId);
    }
  }, [shareToken]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const fetchChat = async () => {
      try {
        const headers: Record<string, string> = {};
        if (shareToken) {
          headers["X-Share-Token"] = shareToken;
          if (guestSessionId) {
            headers["X-Guest-Session-Id"] = guestSessionId;
          } else {
            return; // Wait until guestSessionId is available
          }
        }
        const res = await fetch(`/api/chat/${documentId}`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (!isLoading) {
            setMessages(data.history);
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    if (isOpen) {
      scrollToBottom();
      fetchChat(); // Initial fetch on open
      interval = setInterval(fetchChat, 3000);
    }
    return () => clearInterval(interval);
  }, [isOpen, isLoading, documentId, shareToken, guestSessionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { id: crypto.randomUUID(), role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    const assistantMessageId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: assistantMessageId, role: "assistant", content: "" }]);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (shareToken) {
        headers["X-Share-Token"] = shareToken;
        if (guestSessionId) {
          headers["X-Guest-Session-Id"] = guestSessionId;
        }
      }

      const res = await fetch(`/api/chat/${documentId}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ question: userMessage.content }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || "Failed to reach AI provider.");
      }

      const contextMode = res.headers.get("X-Context-Mode");
      if (contextMode) setMode(contextMode);

      if (!res.body) throw new Error("No response body.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId ? { ...msg, content: msg.content + chunk } : msg
          )
        );
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "AI Provider is unreachable or encountered an error. Please ensure it is running and correctly configured.");
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last.id === assistantMessageId && last.content === "") {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-8 md:right-12 lg:right-16 w-12 h-12 bg-[#111111] border border-white/10 text-white shadow-[0_4px_20px_rgba(0,0,0,0.5)] rounded-full flex items-center justify-center transition-all duration-200 hover:bg-white/10 hover:scale-105 z-40"
        aria-label="Open AI Assistant"
      >
        <Bot className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-8 md:right-12 lg:right-16 w-full max-w-[350px] h-[550px] max-h-[85vh] bg-[#0a0a0a] border border-white/10 shadow-[0_16px_48px_rgba(0,0,0,0.7)] rounded-xl z-50 flex flex-col overflow-hidden animate-fade-in-up">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-neutral-300" />
          <h2 className="text-sm font-medium text-white">AI Assistant</h2>
          {mode && (
            <span className="ml-1 text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full bg-white/5 text-neutral-400 border border-white/10">
              {mode}
            </span>
          )}
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1.5 text-neutral-500 hover:text-white hover:bg-white/5 rounded-md transition-colors"
          aria-label="Minimize Chat"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <Bot className="w-10 h-10 text-neutral-600" />
            <p className="text-sm text-neutral-500 text-center">
              Ask any question about this document.<br />
              I will answer based strictly on its contents.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2.5 max-w-[90%] animate-fade-in-up ${
                msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
              }`}
            >
              <div
                className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                  msg.role === "user" ? "bg-white/10 border border-white/10" : "bg-white/5 border border-white/10"
                }`}
              >
                {msg.role === "user" ? <User className="w-3.5 h-3.5 text-neutral-300" /> : <Bot className="w-3.5 h-3.5 text-neutral-300" />}
              </div>
              <div
                className={`p-3 rounded-xl text-sm ${
                  msg.role === "user"
                    ? "bg-white text-black rounded-tr-sm"
                    : "bg-[#111111] text-neutral-200 border border-white/10 rounded-tl-sm whitespace-pre-wrap"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-white/10 flex-shrink-0">
        <form onSubmit={handleSubmit} className="relative flex items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (input.trim() && !isLoading) {
                  handleSubmit(e as unknown as React.FormEvent);
                }
              }
            }}
            disabled={isLoading}
            placeholder="Ask a question..."
            rows={1}
            className="w-full bg-black text-sm text-white rounded-lg border border-white/10 focus:border-white/30 focus:ring-1 focus:ring-white/30 focus:outline-none py-2.5 pl-3 pr-10 disabled:opacity-50 transition-all resize-none max-h-32 min-h-[42px] overflow-y-auto placeholder:text-neutral-500"
            ref={(el) => {
              if (el) {
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
              }
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 bottom-1.5 p-1.5 text-neutral-400 hover:text-white disabled:text-neutral-700 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
