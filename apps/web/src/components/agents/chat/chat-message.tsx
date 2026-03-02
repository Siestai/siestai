"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import type { UIMessage } from "ai";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: UIMessage;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  if (message.role === "user") {
    const text = message.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("");

    return (
      <div className="flex justify-end animate-message-in">
        <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap bg-cyan-400/15 text-foreground">
          {text}
        </div>
      </div>
    );
  }

  // Assistant message
  const hasContent = message.parts.some(
    (p) => (p.type === "text" && p.text.length > 0) || p.type === "dynamic-tool"
  );

  // Show bounce dots if streaming with no content yet
  if (!hasContent && isStreaming) {
    return (
      <div className="flex justify-start animate-message-in">
        <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-secondary text-foreground">
          <span className="inline-flex gap-1 text-muted-foreground">
            <span className="animate-bounce [animation-delay:0ms]">.</span>
            <span className="animate-bounce [animation-delay:150ms]">.</span>
            <span className="animate-bounce [animation-delay:300ms]">.</span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 animate-message-in">
      {message.parts.map((part, i) => {
        if (part.type === "text" && part.text.length > 0) {
          return (
            <div key={i} className="flex justify-start">
              <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap bg-secondary text-foreground">
                {part.text}
              </div>
            </div>
          );
        }

        if (part.type === "dynamic-tool") {
          return <ToolInvocationCard key={part.toolCallId} part={part} />;
        }

        return null;
      })}
    </div>
  );
}

type DynamicToolPart = Extract<UIMessage["parts"][number], { type: "dynamic-tool" }>;

function ToolInvocationCard({ part }: { part: DynamicToolPart }) {
  const [expanded, setExpanded] = useState(false);

  const isDone = part.state === "output-available";
  const isError = part.state === "output-error";
  const isRunning = !isDone && !isError;

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-md border border-border bg-card/60 text-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-secondary/50 transition-colors"
        >
          {isRunning ? (
            <Loader2 className="h-3 w-3 text-cyan-400 animate-spin shrink-0" />
          ) : isError ? (
            <span className="h-3 w-3 text-destructive shrink-0">!</span>
          ) : (
            <Check className="h-3 w-3 text-success shrink-0" />
          )}
          <span className="font-mono text-xs text-muted-foreground truncate">
            {part.toolName}
          </span>
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
          )}
        </button>

        {expanded && (
          <div className="border-t border-border px-3 py-2 space-y-2">
            {part.input != null && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Input
                </p>
                <pre className="text-xs font-mono text-muted-foreground bg-background/50 rounded p-2 overflow-x-auto max-h-32 overflow-y-auto">
                  {formatJSON(part.input)}
                </pre>
              </div>
            )}
            {isDone && part.output != null && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Output
                </p>
                <pre className="text-xs font-mono text-muted-foreground bg-background/50 rounded p-2 overflow-x-auto max-h-32 overflow-y-auto">
                  {formatJSON(part.output)}
                </pre>
              </div>
            )}
            {isError && "errorText" in part && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-destructive mb-1">
                  Error
                </p>
                <pre className="text-xs font-mono text-destructive/80 bg-background/50 rounded p-2 overflow-x-auto max-h-32 overflow-y-auto">
                  {part.errorText}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatJSON(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
