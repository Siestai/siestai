"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { User, Mic, MicOff, PhoneOff, Link, Check } from "lucide-react";
import {
  RoomAudioRenderer,
  useVoiceAssistant,
  useLocalParticipant,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CallTimer } from "@/components/live/call-timer";
import { useConversationTranscript } from "@/hooks/use-conversation-transcript";
import { ArenaTranscript, ArenaTranscriptToggleButton } from "./arena-transcript";
import { ExternalParticipantTile } from "./external-participant-tile";
import type { ArenaParticipant, ParticipationMode, TranscriptMessage } from "@/lib/types";

interface ArenaRoomProps {
  participants: ArenaParticipant[];
  participationMode: ParticipationMode;
  topic?: string;
  inviteUrl?: string;
  onEndSession: () => void;
}

const SPEAKER_REGEX = /^\[([^\]]+)\]:\s*/;

function parseSpeaker(text: string): { speaker: string; content: string } | null {
  const match = text.match(SPEAKER_REGEX);
  if (!match) return null;
  return { speaker: match[1], content: text.slice(match[0].length) };
}

function useActiveSpeaker(messages: TranscriptMessage[]): string | null {
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const lastAgent = [...messages].reverse().find((m) => m.sender === "agent");
    if (!lastAgent) return;

    const parsed = parseSpeaker(lastAgent.text);
    if (parsed) {
      setActiveSpeaker(parsed.speaker);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setActiveSpeaker(null), 3000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [messages]);

  return activeSpeaker;
}

// --- Participant tile (native agent) ---

interface AgentTileProps {
  name: string;
  color: string;
  isSpeaking: boolean;
}

function AgentTile({ name, color, isSpeaking }: AgentTileProps) {
  const speakingScale = isSpeaking ? 1.3 : 1;
  const ringOpacity = isSpeaking ? 0.6 : 0.15;
  const bgOpacity = isSpeaking ? 0.15 : 0.05;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 rounded-xl border p-6 transition-all duration-200 min-h-[200px]",
        isSpeaking
          ? "border-opacity-60 shadow-lg"
          : "border-border/50 bg-card/30",
      )}
      style={{
        borderColor: isSpeaking ? color : undefined,
        backgroundColor: `${color}${Math.round(bgOpacity * 255)
          .toString(16)
          .padStart(2, "0")}`,
        boxShadow: isSpeaking
          ? `0 0 30px ${color}20, 0 0 60px ${color}10`
          : undefined,
      }}
    >
      {/* Avatar circle with speaking ring */}
      <div className="relative flex items-center justify-center">
        <div
          className="absolute rounded-full transition-all duration-100"
          style={{
            width: 88 * speakingScale,
            height: 88 * speakingScale,
            backgroundColor: `${color}${Math.round(ringOpacity * 0.3 * 255)
              .toString(16)
              .padStart(2, "0")}`,
          }}
        />
        <div
          className="absolute rounded-full transition-all duration-75"
          style={{
            width: 76 * speakingScale,
            height: 76 * speakingScale,
            backgroundColor: `${color}${Math.round(ringOpacity * 0.5 * 255)
              .toString(16)
              .padStart(2, "0")}`,
          }}
        />
        <div
          className="relative z-10 flex items-center justify-center rounded-full w-16 h-16"
          style={{ backgroundColor: `${color}30` }}
        >
          <User className="h-7 w-7" style={{ color }} />
        </div>
      </div>

      <span className="text-sm font-semibold text-foreground">{name}</span>

      {isSpeaking && (
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
          style={{ backgroundColor: `${color}20`, color }}
        >
          <div
            className="h-1.5 w-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: color }}
          />
          Speaking
        </div>
      )}
    </div>
  );
}

// --- Human "You" tile ---

function HumanTile() {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const isSpeaking = localParticipant.isSpeaking;
  const color = "#06b6d4"; // cyan

  const toggleMic = useCallback(() => {
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  }, [localParticipant, isMicrophoneEnabled]);

  const speakingScale = isSpeaking ? 1.3 : 1;
  const ringOpacity = isSpeaking ? 0.6 : 0.15;
  const bgOpacity = isSpeaking ? 0.15 : 0.05;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 rounded-xl border p-6 transition-all duration-200 min-h-[200px]",
        isSpeaking
          ? "border-opacity-60 shadow-lg"
          : "border-border/50 bg-card/30",
      )}
      style={{
        borderColor: isSpeaking ? color : undefined,
        backgroundColor: `${color}${Math.round(bgOpacity * 255)
          .toString(16)
          .padStart(2, "0")}`,
        boxShadow: isSpeaking
          ? `0 0 30px ${color}20, 0 0 60px ${color}10`
          : undefined,
      }}
    >
      <div className="relative flex items-center justify-center">
        <div
          className="absolute rounded-full transition-all duration-100"
          style={{
            width: 88 * speakingScale,
            height: 88 * speakingScale,
            backgroundColor: `${color}${Math.round(ringOpacity * 0.3 * 255)
              .toString(16)
              .padStart(2, "0")}`,
          }}
        />
        <div
          className="absolute rounded-full transition-all duration-75"
          style={{
            width: 76 * speakingScale,
            height: 76 * speakingScale,
            backgroundColor: `${color}${Math.round(ringOpacity * 0.5 * 255)
              .toString(16)
              .padStart(2, "0")}`,
          }}
        />
        <div
          className="relative z-10 flex items-center justify-center rounded-full w-16 h-16"
          style={{ backgroundColor: `${color}30` }}
        >
          <User className="h-7 w-7" style={{ color }} />
        </div>
      </div>

      <span className="text-sm font-semibold text-foreground">You</span>

      <button
        onClick={toggleMic}
        className={cn(
          "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors",
          isMicrophoneEnabled
            ? "bg-cyan-500/20 text-cyan-400"
            : "bg-red-500/20 text-red-400",
        )}
      >
        {isMicrophoneEnabled ? (
          <Mic className="h-3 w-3" />
        ) : (
          <MicOff className="h-3 w-3" />
        )}
        {isMicrophoneEnabled ? "Mic on" : "Mic off"}
      </button>
    </div>
  );
}

// --- Main ArenaRoom ---

export function ArenaRoom({
  participants,
  participationMode,
  topic,
  inviteUrl,
  onEndSession,
}: ArenaRoomProps) {
  const { state: agentState } = useVoiceAssistant();
  const { messages } = useConversationTranscript();
  const activeSpeaker = useActiveSpeaker(messages);
  const [startTime] = useState(() => Date.now());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevCountRef = useRef(messages.length);
  const [copied, setCopied] = useState(false);

  const handleCopyInvite = useCallback(async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [inviteUrl]);

  const nativeAgents = useMemo(
    () => participants.filter((p) => p.type === "native_agent"),
    [participants],
  );

  const externalAgents = useMemo(
    () => participants.filter((p) => p.type === "external_agent"),
    [participants],
  );

  // Track unread when sidebar is closed
  useEffect(() => {
    if (!sidebarOpen && messages.length > prevCountRef.current) {
      setUnreadCount((prev) => prev + (messages.length - prevCountRef.current));
    }
    prevCountRef.current = messages.length;
  }, [messages.length, sidebarOpen]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      if (!prev) setUnreadCount(0);
      return !prev;
    });
  }, []);

  return (
    <>
      <RoomAudioRenderer />

      <div className="flex flex-col items-center gap-6 w-full max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <CallTimer startTime={startTime} />
          {topic && (
            <span className="text-sm text-muted-foreground truncate max-w-xs">
              {topic}
            </span>
          )}
          {inviteUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyInvite}
              className="gap-1.5 text-xs text-muted-foreground h-7 px-2"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-green-400" />
                  Copied!
                </>
              ) : (
                <>
                  <Link className="h-3 w-3" />
                  Copy Invite Link
                </>
              )}
            </Button>
          )}
        </div>

        {/* Participant grid */}
        <div
          className={cn(
            "grid gap-4 w-full",
            nativeAgents.length + externalAgents.length + (participationMode === "human_collab" ? 1 : 0) <= 2
              ? "grid-cols-1 sm:grid-cols-2"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
          )}
        >
          {nativeAgents.map((agent) => (
            <AgentTile
              key={agent.id}
              name={agent.name}
              color={agent.color}
              isSpeaking={activeSpeaker === agent.name}
            />
          ))}
          {participationMode === "human_collab" && <HumanTile />}
          {externalAgents.map((agent) => (
            <ExternalParticipantTile
              key={agent.id}
              name={agent.name}
              color={agent.color}
              platform={agent.platform}
              status={agent.status}
              isSpeaking={activeSpeaker === agent.name}
            />
          ))}
        </div>

        {/* End session button */}
        <Button
          variant="destructive"
          size="lg"
          onClick={onEndSession}
          className="rounded-full gap-2"
        >
          <PhoneOff className="h-4 w-4" />
          End Session
        </Button>
      </div>

      {/* Transcript sidebar */}
      <ArenaTranscript
        participants={participants}
        messages={messages}
        isOpen={sidebarOpen}
        onToggle={handleToggleSidebar}
      />
      <ArenaTranscriptToggleButton
        isOpen={sidebarOpen}
        onToggle={handleToggleSidebar}
        unreadCount={unreadCount}
      />
    </>
  );
}
