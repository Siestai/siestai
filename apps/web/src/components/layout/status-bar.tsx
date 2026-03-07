"use client";

import { useEffect, useState } from "react";
import { useLiveSession } from "@/lib/live-session-context";
import { api } from "@/lib/api";

export function StatusBar() {
  const { isInSession } = useLiveSession();
  const activeSessions = isInSession ? 1 : 0;
  const [agentCount, setAgentCount] = useState<number | null>(null);
  const [teamCount, setTeamCount] = useState<number | null>(null);
  const [apiStatus, setApiStatus] = useState<"ok" | "error" | null>(null);

  useEffect(() => {
    api.checkHealth().then((h) => setApiStatus(h.status === "error" ? "error" : "ok"));
    api.listAgents().then((a) => setAgentCount(a.length)).catch(() => setAgentCount(0));
    api.listTeams().then((t) => setTeamCount(t.length)).catch(() => setTeamCount(0));
  }, []);

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background">
      <div className="flex h-8 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                isInSession
                  ? "bg-primary"
                  : apiStatus === "ok"
                    ? "bg-success"
                    : apiStatus === "error"
                      ? "bg-destructive"
                      : "bg-muted-foreground"
              }`}
            />
            <span className="font-mono text-[11px] font-medium text-muted-foreground">
              {isInSession ? "Live" : apiStatus === "ok" ? "API Ready" : apiStatus === "error" ? "API Down" : "Checking..."}
            </span>
          </div>
          <span className="font-mono text-[11px] font-medium text-muted-foreground">
            {agentCount ?? "–"} Agents
          </span>
          <span className="font-mono text-[11px] font-medium text-muted-foreground">
            {teamCount ?? "–"} Teams
          </span>
          <span className="font-mono text-[11px] font-medium text-muted-foreground">
            {activeSessions} Sessions
          </span>
        </div>
        <span className="font-mono text-[11px] text-[#48484A]">v0.3.0</span>
      </div>
    </footer>
  );
}
