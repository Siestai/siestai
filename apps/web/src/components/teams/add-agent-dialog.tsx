"use client";

import { useState } from "react";
import { Bot, Check, Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Agent } from "@/lib/types";

interface AddAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableAgents: Agent[];
  loading: boolean;
  onAdd: (agentId: string) => Promise<void>;
}

export function AddAgentDialog({
  open,
  onOpenChange,
  availableAgents,
  loading,
  onAdd,
}: AddAgentDialogProps) {
  const [filter, setFilter] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  const filtered = filter.trim()
    ? availableAgents.filter((a) =>
        a.name.toLowerCase().includes(filter.toLowerCase())
      )
    : availableAgents;

  async function handleAdd(agentId: string) {
    setAdding(agentId);
    try {
      await onAdd(agentId);
    } finally {
      setAdding(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Agent to Team</DialogTitle>
          <DialogDescription>
            Select an agent to add to this team.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : availableAgents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            All agents are already in this team
          </p>
        ) : (
          <div className="space-y-3">
            {availableAgents.length > 4 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search agents..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 max-h-[320px] overflow-y-auto py-1">
              {filtered.map((agent) => {
                const color = agent.color || "#22d3ee";
                const isAdding = adding === agent.id;
                return (
                  <button
                    key={agent.id}
                    onClick={() => handleAdd(agent.id)}
                    disabled={isAdding}
                    className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/40 hover:bg-secondary/30 disabled:opacity-50"
                  >
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{ backgroundColor: `${color}20`, color }}
                    >
                      {isAdding ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Bot className="h-5 w-5" />
                      )}
                    </div>
                    <span className="text-xs text-foreground truncate max-w-full text-center">
                      {agent.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No agents match "{filter}"
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
