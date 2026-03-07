"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { AgentIcon } from "./agent-icon";
import { Button } from "@/components/ui/button";
import type { Team, TeamAgent } from "@/lib/types";

interface TeamFolderExpandedProps {
  team: Team;
  agents: TeamAgent[];
  onClose: () => void;
}

export function TeamFolderExpanded({ team, agents, onClose }: TeamFolderExpandedProps) {
  const router = useRouter();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 animate-backdrop-fade-in"
        onClick={onClose}
      />

      {/* Content */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${team.name} team folder`}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="max-w-md w-[90vw] rounded-3xl bg-[#1a1a1d]/95 backdrop-blur-xl border border-border/50 p-6 animate-folder-open"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-foreground">{team.name}</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Agent grid */}
          {agents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No agents in this team yet
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
              {agents.map((ta) => (
                <div key={ta.id} className="flex flex-col items-center gap-1.5">
                  <AgentIcon
                    agent={{
                      name: ta.agent?.name || "Agent",
                      color: ta.agent?.color || null,
                    }}
                    size="md"
                    onClick={() => router.push(`/agents/${ta.agentId}`)}
                  />
                  <span className="text-xs text-muted-foreground truncate max-w-[56px] text-center">
                    {ta.agent?.name || "Agent"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/teams/${team.id}`)}
              className="rounded-full"
            >
              View Details
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
