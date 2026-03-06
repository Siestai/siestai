"use client";

import { useEffect, useState } from "react";
import { Users, Check, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { Team } from "@/lib/types";

interface TeamPickerProps {
  selectedTeam: Team | null;
  onSelectionChange: (team: Team | null) => void;
}

export function TeamPicker({
  selectedTeam,
  onSelectionChange,
}: TeamPickerProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .listTeams()
      .then((data) => {
        if (!cancelled) setTeams(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load teams");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Loading teams...</p>
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

  if (teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <Users className="h-6 w-6 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          No teams found. Create a team first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Select a team to use its agents in the arena
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {teams.map((team) => {
          const isSelected = selectedTeam?.id === team.id;

          return (
            <button
              key={team.id}
              type="button"
              onClick={() => onSelectionChange(isSelected ? null : team)}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border bg-card hover:border-border-strong",
              )}
            >
              <div
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  isSelected
                    ? "bg-primary/15 text-primary"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                {isSelected ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Users className="h-4 w-4" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {team.name}
                </p>
                {team.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {team.description}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
