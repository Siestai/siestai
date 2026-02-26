"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, AlertCircle, Circle } from "lucide-react";
import { useLiveSession } from "@/lib/live-session-context";

interface StatusItemProps {
  label: string;
  status: "ready" | "loading" | "error" | "idle";
}

function StatusItem({ label, status }: StatusItemProps) {
  const statusConfig = {
    ready: {
      icon: CheckCircle2,
      color: "text-success",
      text: "Ready",
    },
    loading: {
      icon: Loader2,
      color: "text-warning",
      text: "Loading",
    },
    error: {
      icon: AlertCircle,
      color: "text-destructive",
      text: "Error",
    },
    idle: {
      icon: Circle,
      color: "text-muted-foreground",
      text: "Idle",
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span className={cn("flex items-center gap-1", config.color)}>
        <Icon
          className={cn(
            "h-3 w-3",
            status === "loading" && "animate-spin"
          )}
        />
        {config.text}
      </span>
    </div>
  );
}

interface ActiveCountProps {
  label: string;
  count: number;
}

function ActiveCount({ label, count }: ActiveCountProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-mono text-foreground">{count}</span>
    </div>
  );
}

function LiveIndicator() {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">API:</span>
      <span className="flex items-center gap-1 text-success">
        <span className="relative flex h-3 w-3 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/40" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
        Live
      </span>
    </div>
  );
}

export function StatusBar() {
  const { isInSession } = useLiveSession();
  const apiStatus: "ready" | "loading" | "error" | "idle" = "ready";
  const activeAgents = 3;
  const activeSessions = isInSession ? 1 : 0;

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card">
      <div className="flex h-8 items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-4 md:gap-6">
          {isInSession ? (
            <LiveIndicator />
          ) : (
            <StatusItem label="API" status={apiStatus} />
          )}
          <ActiveCount label="Active Agents" count={activeAgents} />
        </div>
        <ActiveCount label="Sessions" count={activeSessions} />
      </div>
    </footer>
  );
}
