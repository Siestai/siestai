"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { X, User, MessageSquare, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ArenaParticipant, TranscriptMessage } from "@/lib/types";

interface ArenaTranscriptProps {
  participants: ArenaParticipant[];
  messages: TranscriptMessage[];
  isOpen: boolean;
  onToggle: () => void;
}

const SPEAKER_REGEX = /^\[([^\]]+)\]:\s*/;

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface ParsedMessage {
  id: string;
  speakerName: string;
  speakerColor: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
  isUser: boolean;
}

export function ArenaTranscript({
  participants,
  messages,
  isOpen,
  onToggle,
}: ArenaTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [acknowledgedCount, setAcknowledgedCount] = useState(messages.length);

  const hasNewMessages = !autoScroll && messages.length > acknowledgedCount;

  // Build name→color lookup from participants
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of participants) {
      map.set(p.name, p.color);
    }
    return map;
  }, [participants]);

  // Parse messages: extract [AgentName]: prefix → speaker + color
  const parsed: ParsedMessage[] = useMemo(() => {
    return messages.map((msg) => {
      if (msg.sender === "user") {
        return {
          id: msg.id,
          speakerName: "You",
          speakerColor: "#06b6d4", // cyan
          text: msg.text,
          isFinal: msg.isFinal,
          timestamp: msg.timestamp,
          isUser: true,
        };
      }

      const match = msg.text.match(SPEAKER_REGEX);
      if (match) {
        const name = match[1];
        return {
          id: msg.id,
          speakerName: name,
          speakerColor: colorMap.get(name) || "#8b5cf6",
          text: msg.text.slice(match[0].length),
          isFinal: msg.isFinal,
          timestamp: msg.timestamp,
          isUser: false,
        };
      }

      return {
        id: msg.id,
        speakerName: "Agent",
        speakerColor: "#8b5cf6",
        text: msg.text,
        isFinal: msg.isFinal,
        timestamp: msg.timestamp,
        isUser: false,
      };
    });
  }, [messages, colorMap]);

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
        isOpen ? "translate-x-0 animate-sidebar-in" : "translate-x-full",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">Arena Transcript</h2>
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
        {parsed.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            No messages yet
          </p>
        )}

        {parsed.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex animate-message-in",
              msg.isUser ? "justify-end" : "justify-start",
              !msg.isFinal && "opacity-70",
            )}
          >
            <div
              className={cn(
                "max-w-[85%] space-y-1",
                msg.isUser
                  ? "bg-cyan-600 text-white rounded-2xl rounded-br-md ml-8 p-3"
                  : "bg-secondary text-foreground rounded-2xl rounded-bl-md mr-8 p-3",
              )}
            >
              {/* Speaker header with colored dot */}
              <div className="flex items-center gap-1.5 mb-1">
                <div
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: msg.speakerColor }}
                />
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: msg.isUser ? "rgba(255,255,255,0.8)" : msg.speakerColor }}
                >
                  {msg.speakerName}
                </span>
              </div>
              <p className="text-sm leading-relaxed break-words">
                {msg.text}
                {!msg.isFinal && "..."}
              </p>
              <p
                className={cn(
                  "text-[10px]",
                  msg.isUser ? "text-white/50" : "text-muted-foreground",
                )}
              >
                {formatTimestamp(msg.timestamp)}
              </p>
            </div>
          </div>
        ))}
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
interface ArenaTranscriptToggleButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  unreadCount: number;
}

export function ArenaTranscriptToggleButton({
  isOpen,
  onToggle,
  unreadCount,
}: ArenaTranscriptToggleButtonProps) {
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
