"use client";

import { Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ArenaAction, ArenaActionType } from "@/lib/types";

const ACTION_CONFIG: Record<
  ArenaActionType,
  { icon: typeof Sparkles; className: string }
> = {
  team_first_meeting: {
    icon: Users,
    className: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  },
  // Add new action styles here
};

interface ArenaActionBadgesProps {
  actions: ArenaAction[];
}

export function ArenaActionBadges({ actions }: ArenaActionBadgesProps) {
  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action, i) => {
        const config = ACTION_CONFIG[action.type] ?? {
          icon: Sparkles,
          className: "bg-muted text-muted-foreground",
        };
        const Icon = config.icon;

        return (
          <Badge
            key={`${action.type}-${i}`}
            variant="outline"
            className={`${config.className} gap-1.5 px-3 py-1 text-xs font-medium`}
          >
            <Icon className="h-3 w-3" />
            {action.label}
          </Badge>
        );
      })}
    </div>
  );
}
