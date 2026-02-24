import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";

interface StatusItemProps {
  label: string;
  status: "ready" | "loading" | "error";
}

function StatusItem({ label, status }: StatusItemProps) {
  const config = {
    ready: {
      icon: CheckCircle2,
      color: "text-success",
      bg: "bg-success/10",
    },
    loading: {
      icon: Loader2,
      color: "text-warning",
      bg: "bg-warning/10",
    },
    error: {
      icon: AlertCircle,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
  };

  const { icon: Icon, color, bg } = config[status];

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full",
          bg
        )}
      >
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            color,
            status === "loading" && "animate-spin"
          )}
        />
      </div>
      <span className="text-sm text-foreground">{label}</span>
    </div>
  );
}

export function SystemStatus() {
  const statuses: StatusItemProps[] = [
    { label: "API Server: Ready", status: "ready" },
    { label: "Agent Runtime: Ready", status: "ready" },
    { label: "WebSocket: Connected", status: "ready" },
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">
        System Status
      </h3>
      <div className="flex flex-wrap gap-4 md:gap-6">
        {statuses.map((item, index) => (
          <StatusItem key={index} label={item.label} status={item.status} />
        ))}
      </div>
    </div>
  );
}
