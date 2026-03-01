"use client";

import { User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ArenaParticipantStatus } from "@/lib/types";

interface ExternalParticipantTileProps {
  name: string;
  color: string;
  platform?: string;
  status: ArenaParticipantStatus;
  isSpeaking: boolean;
}

export function ExternalParticipantTile({
  name,
  color,
  platform,
  status,
  isSpeaking,
}: ExternalParticipantTileProps) {
  const isJoining = status === "joining";
  const isDisconnected = status === "disconnected";
  const speakingScale = isSpeaking ? 1.3 : 1;
  const ringOpacity = isSpeaking ? 0.6 : 0.15;
  const bgOpacity = isSpeaking ? 0.15 : 0.05;

  const tileColor = isDisconnected ? "#6b7280" : color;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 rounded-xl border p-6 transition-all duration-200 min-h-[200px]",
        isSpeaking
          ? "border-opacity-60 shadow-lg"
          : "border-border/50 bg-card/30",
        isDisconnected && "opacity-50",
      )}
      style={{
        borderColor: isSpeaking ? tileColor : undefined,
        backgroundColor: `${tileColor}${Math.round(bgOpacity * 255)
          .toString(16)
          .padStart(2, "0")}`,
        boxShadow: isSpeaking
          ? `0 0 30px ${tileColor}20, 0 0 60px ${tileColor}10`
          : undefined,
      }}
    >
      {/* Avatar circle with speaking ring */}
      <div className="relative flex items-center justify-center">
        {/* Outer pulsing ring */}
        <div
          className="absolute rounded-full transition-all duration-100"
          style={{
            width: 88 * speakingScale,
            height: 88 * speakingScale,
            backgroundColor: `${tileColor}${Math.round(ringOpacity * 0.3 * 255)
              .toString(16)
              .padStart(2, "0")}`,
          }}
        />
        {/* Inner ring */}
        <div
          className="absolute rounded-full transition-all duration-75"
          style={{
            width: 76 * speakingScale,
            height: 76 * speakingScale,
            backgroundColor: `${tileColor}${Math.round(ringOpacity * 0.5 * 255)
              .toString(16)
              .padStart(2, "0")}`,
          }}
        />
        {/* Avatar */}
        <div
          className="relative z-10 flex items-center justify-center rounded-full w-16 h-16"
          style={{ backgroundColor: `${tileColor}30` }}
        >
          {isJoining ? (
            <Loader2
              className="h-7 w-7 animate-spin"
              style={{ color: tileColor }}
            />
          ) : (
            <User className="h-7 w-7" style={{ color: tileColor }} />
          )}
        </div>
      </div>

      {/* Name + platform */}
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-sm font-semibold text-foreground">{name}</span>
        {platform && (
          <span className="text-xs text-muted-foreground">
            via {platform}
          </span>
        )}
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-1.5">
        {isSpeaking ? (
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
            style={{ backgroundColor: `${tileColor}20`, color: tileColor }}
          >
            <div
              className="h-1.5 w-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: tileColor }}
            />
            Speaking
          </div>
        ) : isJoining ? (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" />
            Joining...
          </div>
        ) : isDisconnected ? (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">
            Disconnected
          </div>
        ) : null}
      </div>

      {/* External badge */}
      <div className="absolute top-2 left-2">
        <span className="inline-flex items-center rounded-full bg-secondary px-1.5 py-0 text-[10px] font-medium text-secondary-foreground">
          External
        </span>
      </div>
    </div>
  );
}
