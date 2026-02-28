"use client";

import { useEffect, useState } from "react";
import { Bot, Check, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { Agent } from "@/lib/types";

interface AgentPickerProps {
  selectedAgents: Agent[];
  onSelectionChange: (agents: Agent[]) => void;
  maxAgents?: number;
}

export function AgentPicker({
  selectedAgents,
  onSelectionChange,
  maxAgents = 4,
}: AgentPickerProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .listAgents()
      .then((data) => {
        if (!cancelled) setAgents(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load agents");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleAgent = (agent: Agent) => {
    const isSelected = selectedAgents.some((a) => a.id === agent.id);
    if (isSelected) {
      onSelectionChange(selectedAgents.filter((a) => a.id !== agent.id));
    } else if (selectedAgents.length < maxAgents) {
      onSelectionChange([...selectedAgents, agent]);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Loading agents...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <AlertCircle className="h-6 w-6 text-destructive mb-2" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <Bot className="h-6 w-6 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          No agents found. Create some agents first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Select 1–{maxAgents} agents for the conversation
        </p>
        <span
          className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full",
            selectedAgents.length >= 1
              ? "bg-primary/15 text-primary"
              : "bg-secondary text-muted-foreground",
          )}
        >
          {selectedAgents.length}/{maxAgents} selected
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {agents.map((agent) => {
          const isSelected = selectedAgents.some((a) => a.id === agent.id);
          const isDisabled = !isSelected && selectedAgents.length >= maxAgents;

          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => toggleAgent(agent)}
              disabled={isDisabled}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border bg-card hover:border-border-strong",
                isDisabled && "opacity-50 cursor-not-allowed",
              )}
            >
              <div
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${agent.color}20` }}
              >
                {isSelected ? (
                  <Check className="h-4 w-4" style={{ color: agent.color }} />
                ) : (
                  <Bot className="h-4 w-4" style={{ color: agent.color }} />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: agent.color }}
                  />
                  <p className="text-sm font-medium text-foreground truncate">
                    {agent.name}
                  </p>
                </div>
                {agent.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {agent.description}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground/70 mt-1 capitalize">
                  {agent.category}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
