import { cn } from "@/lib/utils";
import { Bot } from "lucide-react";

interface RecentActivityItemProps {
  agentName: string;
  mode: string;
  duration: string;
  timestamp: string;
  className?: string;
}

export function RecentActivityItem({
  agentName,
  mode,
  duration,
  timestamp,
  className,
}: RecentActivityItemProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-border-strong",
        className
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-muted-foreground">
        <Bot className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {agentName}
        </p>
        <p className="text-xs text-muted-foreground">
          {mode} &middot; {duration} &middot; {timestamp}
        </p>
      </div>
    </div>
  );
}
