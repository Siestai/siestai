"use client";

import { useState, useEffect } from "react";
import { Brain, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import type { AgentMemory, MemoryCategory } from "@/lib/types";

const CATEGORY_STYLES: Record<MemoryCategory, { label: string; className: string }> = {
  decision: {
    label: "Decision",
    className: "bg-primary/15 text-primary border-primary/20",
  },
  task: {
    label: "Task",
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  },
  open_question: {
    label: "Question",
    className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  },
  position: {
    label: "Position",
    className: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  },
  learning: {
    label: "Learning",
    className: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  },
};

const CONFIDENCE_DOT: Record<string, string> = {
  high: "bg-emerald-400",
  medium: "bg-yellow-400",
  low: "bg-muted-foreground",
};

interface AgentMemoriesProps {
  agentId: string;
}

export function AgentMemories({ agentId }: AgentMemoriesProps) {
  const [memories, setMemories] = useState<AgentMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    api
      .getAgentMemories(agentId)
      .then(setMemories)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [agentId]);

  // Don't render the section at all if no memories
  if (!loading && memories.length === 0) return null;

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full group"
      >
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.15em]">
            Memory
          </h3>
          {!loading && memories.length > 0 && (
            <span className="text-[10px] text-muted-foreground bg-secondary rounded-full px-1.5 py-0.5">
              {memories.length}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="space-y-2 animate-message-in">
          {loading ? (
            <div className="rounded-lg border border-border bg-card/50 p-4">
              <p className="text-xs text-muted-foreground animate-pulse">
                Loading memories...
              </p>
            </div>
          ) : (
            memories.map((memory) => {
              const cat = CATEGORY_STYLES[memory.category] || CATEGORY_STYLES.learning;
              const dot = CONFIDENCE_DOT[memory.confidence] || CONFIDENCE_DOT.medium;
              return (
                <div
                  key={memory.id}
                  className="rounded-lg border border-border bg-card/50 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${cat.className}`}
                    >
                      {cat.label}
                    </Badge>
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`h-1.5 w-1.5 rounded-full ${dot}`}
                        title={`${memory.confidence} confidence`}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(memory.createdAt).toLocaleDateString(
                          undefined,
                          { month: "short", day: "numeric" },
                        )}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">
                    {memory.content}
                  </p>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
