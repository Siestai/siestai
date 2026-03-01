"use client";

import Link from "next/link";
import { Bot, Eye, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Agent } from "@/lib/types";

interface AgentCardProps {
  agent?: Agent;
  loading?: boolean;
  onStartChat?: (agent: Agent) => void;
  onEdit?: (agent: Agent) => void;
  onDelete?: (agent: Agent) => void;
}

export function AgentCard({ agent, loading, onStartChat, onEdit, onDelete }: AgentCardProps) {
  if (loading || !agent) {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden animate-pulse">
        <div className="h-5 bg-secondary/30" />
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-secondary/50 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-secondary/50 rounded w-2/3" />
              <div className="h-3 bg-secondary/40 rounded w-1/3" />
            </div>
          </div>
          <div className="h-4 bg-secondary/40 rounded w-full" />
          <div className="h-3 bg-secondary/30 rounded w-3/4" />
          <div className="flex gap-2">
            <div className="h-5 bg-secondary/30 rounded w-16" />
            <div className="h-5 bg-secondary/30 rounded w-12" />
          </div>
        </div>
        <div className="border-t border-border p-3 flex gap-2">
          <div className="h-7 bg-secondary/30 rounded flex-1" />
          <div className="h-7 bg-secondary/30 rounded flex-1" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden group">
      {/* Gradient Header Strip */}
      <div
        className="h-5"
        style={{
          background: `linear-gradient(180deg, ${agent.color}20 0%, transparent 100%)`,
        }}
      />

      {/* Body */}
      <div className="px-4 pb-3 flex flex-col gap-3">
        {/* Avatar + Name + Category */}
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: agent.color }}
          >
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground truncate">
              {agent.name}
            </p>
            <p className="text-xs text-muted-foreground capitalize">
              {agent.category}
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-[13px] leading-relaxed text-muted-foreground line-clamp-2">
          {agent.description || "No description"}
        </p>

        {/* Tags */}
        {agent.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {agent.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-1 rounded"
                style={{
                  backgroundColor: `${agent.color}15`,
                  color: agent.color,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border justify-end">
        {onEdit && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground" onClick={() => onEdit(agent)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        {onDelete && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => onDelete(agent)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
        <div className="flex-1" />
        <Button variant="ghost" size="sm" asChild className="h-7 gap-1.5 text-muted-foreground">
          <Link href={`/agents/${agent.id}`}>
            <Eye className="h-3.5 w-3.5" />
            View
          </Link>
        </Button>
        <Button
          size="sm"
          className="h-7 gap-1.5"
          onClick={() => onStartChat?.(agent)}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Chat
        </Button>
      </div>
    </div>
  );
}
