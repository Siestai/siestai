"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUp, AlertCircle, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "./chat-message";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4200";

interface ChatPanelProps {
  agentId: string;
  agentName: string;
  onClose?: () => void;
}

export function ChatPanel({ agentId, agentName, onClose }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${API_URL}/agents/${agentId}/chat`,
        credentials: "include",
      }),
    [agentId],
  );

  const { messages, sendMessage, status, error } = useChat({ transport });

  const isActive = status === "submitted" || status === "streaming";

  // Auto-scroll when messages change
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isActive) return;
    setInput("");
    sendMessage({ text });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/50">
        <MessageSquare className="h-4 w-4 text-cyan-400" />
        <span className="text-sm font-medium text-foreground truncate">
          {agentName}
        </span>
        <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded ml-auto shrink-0">
          Preview
        </span>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 ml-1"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              Send a message to chat with {agentName}
            </p>
          </div>
        )}
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            isStreaming={
              isActive &&
              message === messages[messages.length - 1] &&
              message.role === "assistant"
            }
          />
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2 border-t border-destructive/30 bg-destructive/5 text-destructive text-xs">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span className="truncate">{error.message || "Something went wrong"}</span>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-border">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Type a message..."
          disabled={isActive}
          className="flex-1 h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
        />
        <Button
          type="submit"
          size="icon"
          disabled={isActive || !input.trim()}
          className="h-10 w-10 shrink-0"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
