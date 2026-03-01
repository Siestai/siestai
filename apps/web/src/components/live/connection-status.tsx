"use client";

import { useConnectionState } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { CheckCircle2, Loader2, AlertCircle, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LiveConnectionState } from "@/lib/types";

const STATUS_CONFIG: Record<
  LiveConnectionState,
  { label: string; icon: React.ElementType; colorClass: string; animate?: boolean }
> = {
  connected: {
    label: "Connected",
    icon: CheckCircle2,
    colorClass: "text-success",
  },
  connecting: {
    label: "Connecting",
    icon: Loader2,
    colorClass: "text-warning",
    animate: true,
  },
  reconnecting: {
    label: "Reconnecting",
    icon: Loader2,
    colorClass: "text-warning",
    animate: true,
  },
  failed: {
    label: "Failed",
    icon: AlertCircle,
    colorClass: "text-destructive",
  },
  disconnected: {
    label: "Disconnected",
    icon: WifiOff,
    colorClass: "text-muted-foreground",
  },
  idle: {
    label: "Idle",
    icon: WifiOff,
    colorClass: "text-muted-foreground",
  },
};

interface ConnectionStatusBadgeProps {
  status: LiveConnectionState;
  className?: string;
}

export function ConnectionStatusBadge({
  status,
  className,
}: ConnectionStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs",
        config.colorClass,
        className,
      )}
    >
      <Icon className={cn("h-3 w-3", config.animate && "animate-spin")} />
      <span>{config.label}</span>
    </div>
  );
}

function mapConnectionState(state: ConnectionState): LiveConnectionState {
  switch (state) {
    case ConnectionState.Connected:
      return "connected";
    case ConnectionState.Connecting:
      return "connecting";
    case ConnectionState.Reconnecting:
      return "reconnecting";
    case ConnectionState.Disconnected:
      return "disconnected";
    default:
      return "disconnected";
  }
}

interface RoomConnectionStatusProps {
  className?: string;
}

export function RoomConnectionStatus({ className }: RoomConnectionStatusProps) {
  const connectionState = useConnectionState();
  const mapped = mapConnectionState(connectionState);

  return <ConnectionStatusBadge status={mapped} className={className} />;
}
