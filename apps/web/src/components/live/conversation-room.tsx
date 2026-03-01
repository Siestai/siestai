"use client";

import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import {
  useVoiceAssistant,
  useLocalParticipant,
} from "@livekit/components-react";
import { cn } from "@/lib/utils";
import { RoomConnectionStatus } from "./connection-status";
import { CallTimer } from "./call-timer";
import type { AgentState } from "@/lib/types";

function getAgentStatusText(state: AgentState | undefined | null): string {
  switch (state) {
    case "listening":
      return "Listening...";
    case "thinking":
      return "Thinking...";
    case "speaking":
      return "Speaking...";
    case "connecting":
    case "initializing":
    default:
      return "Waiting for agent...";
  }
}

function getIndicatorStyle(state: AgentState | undefined | null): string {
  switch (state) {
    case "speaking":
      return "bg-green-500 animate-speaking-pulse";
    case "listening":
      return "bg-blue-500";
    case "thinking":
      return "bg-yellow-500 animate-pulse";
    case "connecting":
    case "initializing":
      return "bg-orange-500 animate-pulse";
    default:
      return "bg-orange-500 animate-pulse";
  }
}

interface ConversationRoomProps {
  agentName?: string;
  onEndSession: () => void;
  startTime?: number;
  controls: ReactNode;
}

export function ConversationRoom({
  agentName,
  onEndSession,
  startTime,
  controls,
}: ConversationRoomProps) {
  const { state: agentState } = useVoiceAssistant();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const [sessionStart] = useState(() => startTime ?? Date.now());
  const onEndRef = useRef(onEndSession);
  useEffect(() => {
    onEndRef.current = onEndSession;
  }, [onEndSession]);

  const toggleMute = useCallback(async () => {
    await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  }, [localParticipant, isMicrophoneEnabled]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture shortcuts when typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        toggleMute();
      } else if (e.code === "Escape") {
        onEndRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleMute]);

  const mappedState = agentState as AgentState | undefined;

  return (
    <div className="relative flex flex-col items-center gap-6 p-6">
      {/* Top-right: connection status */}
      <div className="absolute right-4 top-4">
        <RoomConnectionStatus />
      </div>

      {/* Agent name badge */}
      {agentName && (
        <div className="text-sm text-muted-foreground bg-secondary rounded-full px-3 py-1">
          {agentName}
        </div>
      )}

      {/* Agent status indicator */}
      <div className="flex flex-col items-center gap-4 min-h-[200px] justify-center">
        <div
          className={cn(
            "h-24 w-24 rounded-full transition-colors duration-300",
            getIndicatorStyle(mappedState),
          )}
        />
        <p className="text-lg text-muted-foreground">
          {getAgentStatusText(mappedState)}
        </p>
      </div>

      {/* Call timer */}
      <CallTimer startTime={sessionStart} />

      {/* Controls slot */}
      {controls}

      {/* Keyboard hints */}
      <p className="text-xs text-muted-foreground font-mono">
        Space to mute/unmute, Esc to end
      </p>
    </div>
  );
}
