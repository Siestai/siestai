"use client";

import { useEffect, useState } from "react";
import { Bot, Zap } from "lucide-react";
import { api } from "@/lib/api";
import type { ActivityEvent } from "@/lib/types";

function relativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    api.getActivity().then(setEvents).catch(() => {});

    const interval = setInterval(() => {
      api.getActivity().then(setEvents).catch(() => {});
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card/50 p-6">
      <h3
        className="font-mono text-[11px] font-semibold text-muted-foreground uppercase mb-4"
        style={{ letterSpacing: "2px" }}
      >
        Recent Activity
      </h3>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No activity yet — create or test an agent to see events here.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {events.slice(0, 20).map((event) => (
            <div
              key={event.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/30"
            >
              {event.type === "agent_created" ? (
                <Bot className="h-4 w-4 shrink-0 text-primary" />
              ) : (
                <Zap className="h-4 w-4 shrink-0 text-primary" />
              )}
              <span className="text-sm text-muted-foreground">
                {event.type === "agent_created" ? "Created" : "Tested"}
              </span>
              <span className="text-sm font-medium text-foreground truncate">
                {event.agentName}
              </span>
              <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                {relativeTime(event.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
