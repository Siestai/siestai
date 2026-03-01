"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, User, Bot, MessageSquare, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { TranscriptMessage, AgentState } from "@/lib/types";

interface TranscriptSidebarProps {
  messages: TranscriptMessage[];
  agentState?: AgentState;
  isOpen: boolean;
  onToggle: () => void;
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-secondary rounded-2xl rounded-bl-md mr-8 p-3">
        <div className="flex items-center gap-1.5">
          <div
            className="h-2 w-2 rounded-full bg-muted-foreground animate-thinking-dot"
            style={{ animationDelay: "0s" }}
          />
          <div
            className="h-2 w-2 rounded-full bg-muted-foreground animate-thinking-dot"
            style={{ animationDelay: "0.2s" }}
          />
          <div
            className="h-2 w-2 rounded-full bg-muted-foreground animate-thinking-dot"
            style={{ animationDelay: "0.4s" }}
          />
        </div>
      </div>
    </div>
  );
}

export function TranscriptSidebar({
  messages,
  agentState,
  isOpen,
  onToggle,
}: TranscriptSidebarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [acknowledgedCount, setAcknowledgedCount] = useState(messages.length);

  const hasNewMessages = !autoScroll && messages.length > acknowledgedCount;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

  // Detect manual scroll-up
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceFromBottom > 100) {
      setAutoScroll(false);
    } else {
      setAutoScroll(true);
      setAcknowledgedCount(messages.length);
    }
  }, [messages.length]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setAutoScroll(true);
      setAcknowledgedCount(messages.length);
    }
  }, [messages.length]);

  return (
    <div
      className={cn(
        "fixed top-0 right-0 h-full w-[320px] max-w-full bg-card border-l border-border z-50 transform transition-transform duration-300 ease-in-out flex flex-col",
        isOpen ? "translate-x-0 animate-sidebar-in" : "translate-x-full"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">Transcript</h2>
          <span className="bg-primary text-primary-foreground rounded-full px-2 text-xs">
            {messages.length}
          </span>
        </div>
        <Button variant="ghost" size="icon-xs" onClick={onToggle}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Message list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="overflow-y-auto flex-1 p-3 space-y-3"
      >
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            No messages yet
          </p>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex animate-message-in",
              message.sender === "user" ? "justify-end" : "justify-start",
              !message.isFinal && "opacity-70"
            )}
          >
            <div
              className={cn(
                "max-w-[85%] space-y-1",
                message.sender === "user"
                  ? "bg-blue-600 text-white rounded-2xl rounded-br-md ml-8 p-3"
                  : "bg-secondary text-foreground rounded-2xl rounded-bl-md mr-8 p-3"
              )}
            >
              <div className="flex items-center gap-1.5 mb-1">
                {message.sender === "user" ? (
                  <User className="h-3 w-3 shrink-0" />
                ) : (
                  <Bot className="h-3 w-3 shrink-0" />
                )}
                <span className="text-[10px] opacity-70">
                  {message.sender === "user" ? "You" : "Agent"}
                </span>
              </div>
              <p className="text-sm leading-relaxed break-words">
                {message.text}
                {!message.isFinal && "..."}
              </p>
              <p
                className={cn(
                  "text-[10px]",
                  message.sender === "user"
                    ? "text-white/50"
                    : "text-muted-foreground"
                )}
              >
                {formatTimestamp(message.timestamp)}
              </p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {agentState === "thinking" && <TypingIndicator />}
      </div>

      {/* New messages indicator */}
      {hasNewMessages && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs flex items-center gap-1 shadow-lg hover:bg-primary/90 transition-colors"
        >
          <ChevronDown className="h-3 w-3" />
          New messages
        </button>
      )}
    </div>
  );
}

// Toggle button — render separately, always visible
interface TranscriptToggleButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  unreadCount: number;
}

export function TranscriptToggleButton({
  isOpen,
  onToggle,
  unreadCount,
}: TranscriptToggleButtonProps) {
  if (isOpen) return null;

  return (
    <Button
      variant="secondary"
      size="icon-lg"
      onClick={onToggle}
      className="fixed bottom-6 right-6 z-40 rounded-full shadow-lg"
    >
      <MessageSquare className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center text-[10px] font-bold">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Button>
  );
}
