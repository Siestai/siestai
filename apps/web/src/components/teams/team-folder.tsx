"use client";

import { Users } from "lucide-react";
import { AgentIcon } from "./agent-icon";
import type { Team, TeamAgent } from "@/lib/types";

interface TeamFolderProps {
  team: Team;
  agents: TeamAgent[];
  loading?: boolean;
  onClick: () => void;
}

export function TeamFolder({ team, agents, loading, onClick }: TeamFolderProps) {
  if (loading) {
    return (
      <div className="w-48 flex flex-col items-center gap-2">
        <div className="w-full aspect-[4/3] rounded-2xl bg-secondary/20 border border-border animate-pulse" />
        <div className="h-4 w-20 rounded bg-secondary/30 animate-pulse" />
      </div>
    );
  }

  const visibleAgents = agents.slice(0, 6);
  const overflow = agents.length - 6;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-48 flex flex-col items-center gap-2 group cursor-pointer"
    >
      <div className="w-full aspect-[4/3] rounded-2xl bg-secondary/20 border border-border p-3 transition-all duration-200 hover:scale-[1.03] hover:border-primary/30 hover:shadow-[0_0_20px_rgba(34,211,238,0.08)]">
        {agents.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center rounded-xl border border-dashed border-border">
            <Users className="h-6 w-6 text-muted-foreground/30" />
          </div>
        ) : (
          <div className="w-full h-full flex flex-wrap gap-1.5 items-center justify-center content-center">
            {visibleAgents.map((ta) => (
              <AgentIcon
                key={ta.id}
                agent={{
                  name: ta.agent?.name || "Agent",
                  color: ta.agent?.color || null,
                }}
                size="sm"
              />
            ))}
            {overflow > 0 && (
              <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                <span className="text-xs text-muted-foreground font-medium">
                  +{overflow}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
      <span className="text-sm text-foreground truncate max-w-full group-hover:text-primary transition-colors">
        {team.name}
      </span>
    </button>
  );
}
