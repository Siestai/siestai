"use client";

import Link from "next/link";
import { Bot, Globe, Phone, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Agent } from "@/lib/types";

interface AgentCardProps {
  agent?: Agent;
  loading?: boolean;
  onStartChat?: (agent: Agent) => void;
}

export function AgentCard({ agent, loading, onStartChat }: AgentCardProps) {
  if (loading || !agent) {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden animate-pulse">
        <div className="h-20 bg-secondary/50 flex items-center gap-3 px-4">
          <div className="h-10 w-10 rounded-full bg-secondary/80 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-secondary/80 rounded w-2/3" />
          </div>
          <div className="h-2 w-2 rounded-full bg-secondary/80" />
        </div>
        <div className="p-4 space-y-3">
          <div className="h-4 bg-secondary/50 rounded w-3/4" />
          <div className="h-3 bg-secondary/50 rounded w-1/2" />
          <div className="flex gap-2 mt-3">
            <div className="h-5 bg-secondary/50 rounded-full w-16" />
            <div className="h-5 bg-secondary/50 rounded-full w-12" />
          </div>
        </div>
        <div className="border-t border-border" />
        <div className="p-4 flex gap-2">
          <div className="h-8 bg-secondary/50 rounded flex-1" />
          <div className="h-8 bg-secondary/50 rounded flex-1" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Gradient Header */}
      <div
        className="h-20 relative flex items-center gap-3 px-4"
        style={{
          background: `linear-gradient(135deg, ${agent.color}1f 0%, transparent 100%)`,
        }}
      >
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: agent.color }}
        >
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground truncate">{agent.name}</p>
        </div>
        <div
          className={`h-2 w-2 rounded-full shrink-0 ${
            agent.is_online ? "bg-green-500" : "bg-gray-500"
          }`}
        />
      </div>

      {/* Body */}
      <div className="p-4">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {agent.description || "No description"}
        </p>

        {/* Tags */}
        {agent.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {agent.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${agent.color}26`,
                  color: agent.color,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Meta Row */}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Globe className="h-3 w-3" />
            {agent.category}
          </span>
          <span className="flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {agent.call_count} calls
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Actions */}
      <div className="p-4 flex gap-2">
        <Button variant="ghost" size="sm" asChild className="flex-1">
          <Link href={`/agents/${agent.id}`}>
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            View Details
          </Link>
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={() => onStartChat?.(agent)}
        >
          <Phone className="h-3.5 w-3.5 mr-1.5" />
          Start Chat
        </Button>
      </div>
    </div>
  );
}
