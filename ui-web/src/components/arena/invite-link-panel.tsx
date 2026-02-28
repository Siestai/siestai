"use client";

import { useState, useEffect } from "react";
import { Copy, Check, Mic, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ArenaInvite, ArenaParticipant } from "@/lib/types";

interface InviteLinkPanelProps {
  invite: ArenaInvite;
  participants: ArenaParticipant[];
  onStartCall: () => void;
}

const STATUS_STYLES: Record<string, { className: string; label: string }> = {
  joining: { className: "bg-yellow-500/15 text-yellow-400", label: "Joining" },
  connected: { className: "bg-green-500/15 text-green-400", label: "Connected" },
  disconnected: { className: "bg-muted text-muted-foreground", label: "Disconnected" },
  invited: { className: "bg-blue-500/15 text-blue-400", label: "Invited" },
};

export function InviteLinkPanel({
  invite,
  participants,
  onStartCall,
}: InviteLinkPanelProps) {
  const [copied, setCopied] = useState(false);
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);

  // Expiration countdown
  useEffect(() => {
    const update = () => {
      const remaining = Math.max(
        0,
        Math.floor(
          (new Date(invite.expiresAt).getTime() - Date.now()) / 60_000,
        ),
      );
      setMinutesLeft(remaining);
    };
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [invite.expiresAt]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(invite.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const externalAgents = participants.filter(
    (p) => p.type === "external_agent",
  );
  const nativeAgents = participants.filter(
    (p) => p.type === "native_agent",
  );
  const connectedCount = externalAgents.filter(
    (p) => p.status === "connected",
  ).length;

  // Can start if we have at least 1 native agent or at least 1 connected external agent
  // The total participants (including human host) will be at least 2 in many cases
  // but even with 1 agent, we want to allow starting to wait for others or talk to one.
  const canStart = nativeAgents.length > 0 || connectedCount > 0;

  return (
    <div className="rounded-xl border border-border/50 bg-card/30 p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Invitation Link
        </h3>
        {minutesLeft !== null && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {minutesLeft > 0 ? `Expires in ${minutesLeft}m` : "Expired"}
          </div>
        )}
      </div>

      {/* Copy row */}
      <div className="flex items-center gap-2">
        <Input
          value={invite.url}
          readOnly
          className="font-mono text-xs"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="shrink-0 min-w-[80px]"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </Button>
      </div>

      {/* External participants list */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          External Agents ({externalAgents.length})
        </div>

        {externalAgents.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 py-2">
            Waiting for external agents to join...
          </p>
        ) : (
          <ul className="space-y-2">
            {externalAgents.map((p) => {
              const style = STATUS_STYLES[p.status] ?? STATUS_STYLES.invited;
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-border/30 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="text-sm font-medium">{p.name}</span>
                    {p.platform && (
                      <span className="text-xs text-muted-foreground">
                        via {p.platform}
                      </span>
                    )}
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn("text-[10px] px-1.5 py-0", style.className)}
                  >
                    {style.label}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Start Call button */}
      <Button
        onClick={onStartCall}
        disabled={!canStart}
        className="w-full gap-2"
      >
        <Mic className="h-4 w-4" />
        Start Call
      </Button>
    </div>
  );
}
