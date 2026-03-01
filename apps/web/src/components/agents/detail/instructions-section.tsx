"use client";

import { useRef, useEffect } from "react";
import type { SaveStatus } from "@/hooks/use-agent-editor";

interface InstructionsSectionProps {
  instructions: string;
  saveStatus: SaveStatus;
  onUpdate: (value: string) => void;
  onBlur: () => void;
}

export function InstructionsSection({
  instructions,
  saveStatus,
  onUpdate,
  onBlur,
}: InstructionsSectionProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [instructions]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.15em]">
          System Prompt
        </h3>
        <SaveIndicator status={saveStatus} />
      </div>
      <textarea
        ref={textareaRef}
        value={instructions}
        onChange={(e) => onUpdate(e.target.value)}
        onBlur={onBlur}
        placeholder="Define your agent's personality, role, and behavior..."
        className="w-full min-h-[160px] rounded-lg border border-border bg-card/50 p-4 text-sm text-foreground leading-relaxed resize-none outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground/50"
      />
      <p className="text-xs text-muted-foreground text-right">
        {instructions.length} characters
      </p>
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <span
      className={`text-xs font-medium transition-opacity ${
        status === "saving"
          ? "text-muted-foreground animate-pulse"
          : status === "saved"
            ? "text-emerald-400"
            : "text-destructive"
      }`}
    >
      {status === "saving" ? "Saving..." : status === "saved" ? "Saved" : "Error saving"}
    </span>
  );
}
