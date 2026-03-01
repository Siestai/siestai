"use client";

import { useLiveSession } from "@/lib/live-session-context";

export function StatusBar() {
  const { isInSession } = useLiveSession();
  const activeSessions = isInSession ? 1 : 0;

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background">
      <div className="flex h-8 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                isInSession ? "bg-primary" : "bg-success"
              }`}
            />
            <span className="font-mono text-[11px] font-medium text-muted-foreground">
              {isInSession ? "Live" : "API Ready"}
            </span>
          </div>
          <span className="font-mono text-[11px] font-medium text-muted-foreground">
            4 Agents
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
