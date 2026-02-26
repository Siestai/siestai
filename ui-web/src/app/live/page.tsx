"use client";

import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import "@livekit/components-styles";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
  useRoomContext,
  useConnectionState,
} from "@livekit/components-react";
import { ConnectionState, MediaDeviceFailure } from "livekit-client";
import {
  Phone,
  Mic,
  Bot,
  Zap,
  Loader2,
  ArrowLeft,
  Clock,
  RotateCcw,
  AlertCircle,
  RefreshCw,
  MicOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConversationRoom } from "@/components/live/conversation-room";
import { ConversationControls } from "@/components/live/conversation-controls";
import {
  TranscriptSidebar,
  TranscriptToggleButton,
} from "@/components/live/transcript-sidebar";
import { useConversationTranscript } from "@/hooks/use-conversation-transcript";
import {
  fetchToken,
  generateRoomName,
  generateParticipantIdentity,
  ROOM_OPTIONS,
} from "@/lib/livekit";
import type { LiveSessionState, AgentState } from "@/lib/types";
import { useLiveSession } from "@/lib/live-session-context";

type PageState = "idle" | "connecting" | "connected" | "disconnected" | "reconnecting";

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}m ${secs}s`;
}

function classifyFetchError(err: unknown): string {
  if (err instanceof TypeError) {
    return "Backend not reachable — make sure the backend is running on port 4200";
  }
  if (err instanceof Error) {
    const msg = err.message;
    if (msg.includes("401") || msg.includes("403")) {
      return "Invalid LiveKit credentials — check your .env configuration";
    }
    return `Connection failed: ${msg}`;
  }
  return "Connection failed";
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];

// --- Active Session: rendered inside LiveKitRoom context ---

interface ActiveSessionProps {
  session: LiveSessionState;
  onEndSession: () => void;
}

function ActiveSession({ session, onEndSession }: ActiveSessionProps) {
  const room = useRoomContext();
  const { state: agentState } = useVoiceAssistant();
  const { messages } = useConversationTranscript();
  const connectionState = useConnectionState();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevCountRef = useRef(messages.length);

  // Track unread when sidebar is closed
  useEffect(() => {
    if (!sidebarOpen && messages.length > prevCountRef.current) {
      setUnreadCount((prev) => prev + (messages.length - prevCountRef.current));
    }
    prevCountRef.current = messages.length;
  }, [messages.length, sidebarOpen]);

  // Warn before closing tab during active session
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Verify connection is still active when tab regains visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && connectionState === ConnectionState.Disconnected) {
        onEndSession();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [connectionState, onEndSession]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      if (!prev) setUnreadCount(0);
      return !prev;
    });
  }, []);

  const handleEndSession = useCallback(() => {
    room.disconnect();
    onEndSession();
  }, [room, onEndSession]);

  return (
    <>
      <ConversationRoom
        agentName={session.agentName}
        onEndSession={handleEndSession}
        startTime={session.startedAt}
        controls={
          <ConversationControls onEndSession={handleEndSession} />
        }
      />
      <TranscriptSidebar
        messages={messages}
        agentState={agentState as AgentState | undefined}
        isOpen={sidebarOpen}
        onToggle={handleToggleSidebar}
      />
      <TranscriptToggleButton
        isOpen={sidebarOpen}
        onToggle={handleToggleSidebar}
        unreadCount={unreadCount}
      />
    </>
  );
}

// --- Main Page Content ---

function LivePageContent() {
  const searchParams = useSearchParams();
  const agentId = searchParams.get("agent_id");
  const agentName = searchParams.get("agent_name");
  const { setSession: setLiveSession } = useLiveSession();

  const [pageState, setPageState] = useState<PageState>("idle");
  const [session, setSession] = useState<LiveSessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up retry timer on unmount
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  const connectWithToken = useCallback(async (roomName: string, identity: string) => {
    const tokenResponse = await fetchToken({ roomName, identity });

    setSession({
      roomName: tokenResponse.roomName,
      token: tokenResponse.token,
      serverUrl: tokenResponse.serverUrl,
      agentName: agentName || undefined,
      startedAt: Date.now(),
    });
    setLiveSession(tokenResponse.roomName);
    setPageState("connected");
    retryCountRef.current = 0;
  }, [agentName, setLiveSession]);

  const handleStartConversation = useCallback(async () => {
    setPageState("connecting");
    setError(null);
    setMediaError(null);
    retryCountRef.current = 0;
    setRetryAttempt(0);

    try {
      await connectWithToken(generateRoomName(), generateParticipantIdentity());
    } catch (err) {
      setError(classifyFetchError(err));
      setPageState("idle");
    }
  }, [connectWithToken]);

  const handleDisconnected = useCallback(() => {
    // If already disconnected or idle, skip
    if (!session) return;

    // Attempt retry with exponential backoff for unexpected disconnects
    if (retryCountRef.current < MAX_RETRIES && pageState === "connected") {
      const delay = RETRY_DELAYS[retryCountRef.current] ?? 4000;
      retryCountRef.current += 1;
      setRetryAttempt(retryCountRef.current);
      setPageState("reconnecting");

      retryTimerRef.current = setTimeout(async () => {
        try {
          await connectWithToken(session.roomName, generateParticipantIdentity());
        } catch {
          // If retry fails and we still have retries left, the next onDisconnected will trigger another
          if (retryCountRef.current >= MAX_RETRIES) {
            setError("Connection lost after multiple retry attempts");
            setEndedAt(Date.now());
            setLiveSession(null);
            setPageState("disconnected");
          }
        }
      }, delay);
      return;
    }

    setEndedAt(Date.now());
    setLiveSession(null);
    setPageState("disconnected");
  }, [setLiveSession, session, pageState, connectWithToken]);

  const handleEndSession = useCallback(() => {
    // Intentional end — skip retries
    retryCountRef.current = MAX_RETRIES;
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    setEndedAt(Date.now());
    setLiveSession(null);
    setPageState("disconnected");
  }, [setLiveSession]);

  const handleMediaDeviceFailure = useCallback((failure?: MediaDeviceFailure) => {
    if (failure === MediaDeviceFailure.PermissionDenied) {
      setMediaError(
        "Microphone access denied. Please allow microphone access in your browser settings and try again."
      );
    } else if (failure === MediaDeviceFailure.NotFound) {
      setMediaError("No microphone found. Please connect a microphone and try again.");
    } else if (failure === MediaDeviceFailure.DeviceInUse) {
      setMediaError("Microphone is in use by another application. Please close it and try again.");
    } else {
      setMediaError("Media device error. Please check your audio settings.");
    }
  }, []);

  const handleReset = useCallback(() => {
    setSession(null);
    setError(null);
    setMediaError(null);
    setEndedAt(null);
    retryCountRef.current = 0;
    setRetryAttempt(0);
    setPageState("idle");
  }, []);

  // --- Connected state ---
  if ((pageState === "connected" || pageState === "reconnecting") && session) {
    return (
      <div className="relative min-h-[calc(100vh-8rem)] animate-fade-scale-in">
        {mediaError && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3 max-w-lg">
            <MicOff className="h-4 w-4 shrink-0" />
            <p>{mediaError}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMediaError(null)}
              className="ml-auto shrink-0 text-xs"
            >
              Dismiss
            </Button>
          </div>
        )}
        {pageState === "reconnecting" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 text-sm text-warning bg-warning/10 border border-warning/20 rounded-lg px-4 py-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Reconnecting... (attempt {retryAttempt}/{MAX_RETRIES})</span>
          </div>
        )}
        <LiveKitRoom
          serverUrl={session.serverUrl}
          token={session.token}
          connect={true}
          audio={true}
          options={ROOM_OPTIONS}
          onDisconnected={handleDisconnected}
          onMediaDeviceFailure={handleMediaDeviceFailure}
          onError={(err) => {
            if (process.env.NODE_ENV === "development") {
              console.error("LiveKitRoom error:", err);
            }
            setError(err?.message || "Connection error");
            retryCountRef.current = MAX_RETRIES; // Don't retry on explicit errors
            setEndedAt(Date.now());
            setLiveSession(null);
            setPageState("disconnected");
          }}
        >
          <RoomAudioRenderer />
          <ActiveSession
            session={session}
            onEndSession={handleEndSession}
          />
        </LiveKitRoom>
      </div>
    );
  }

  // --- Connecting state ---
  if (pageState === "connecting") {
    return (
      <div className="container mx-auto px-4 py-6 lg:px-6 lg:py-8">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Connecting to LiveKit...</p>
        </div>
      </div>
    );
  }

  // --- Disconnected state (post-session summary) ---
  if (pageState === "disconnected" && session) {
    const duration = (endedAt ?? session.startedAt) - session.startedAt;

    return (
      <div className="container mx-auto px-4 py-6 lg:px-6 lg:py-8">
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="rounded-lg border border-border bg-card p-8 max-w-md w-full text-center space-y-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mx-auto">
              <Phone className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-foreground mb-1">
                Session Ended
              </h2>
              {session.agentName && (
                <p className="text-sm text-muted-foreground">
                  Conversation with {session.agentName}
                </p>
              )}
            </div>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-mono">{formatDuration(duration)}</span>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}
            <Button onClick={handleReset} className="gap-2 w-full" size="lg">
              <RotateCcw className="h-4 w-4" />
              Start New Conversation
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Idle state (pre-connection) ---
  return (
    <div className="container mx-auto px-4 py-6 lg:px-6 lg:py-8">
      {/* Back to Agent link */}
      {agentId && (
        <Link
          href={`/agents/${agentId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Agent
        </Link>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {agentName
              ? `Conversation with ${agentName}`
              : "Live Conversation"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {agentName
              ? `Start a real-time conversation with ${agentName}`
              : "Have real-time conversations with AI agents"}
          </p>
        </div>
      </div>

      {/* Connection Panel */}
      <div className="flex flex-col items-center justify-center min-h-[400px] rounded-lg border border-dashed border-border bg-card/50 p-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
          {agentId ? (
            <Bot className="h-8 w-8 text-primary" />
          ) : (
            <Phone className="h-8 w-8 text-primary" />
          )}
        </div>
        <h2 className="text-lg font-medium text-foreground mb-2">
          {agentId
            ? `Chat with ${agentName || "Agent"}`
            : "Live Voice Conversation"}
        </h2>
        <p className="text-muted-foreground text-center max-w-md mb-6">
          {agentId
            ? `Ready to start a conversation with ${agentName || "this agent"}. The agent's persona is pre-configured.`
            : "Start a real-time conversation with AI. Connect to a backend to enable live voice interactions."}
        </p>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3 mb-4 max-w-md w-full">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p className="flex-1">{error}</p>
          </div>
        )}

        <div className="flex flex-col gap-2 w-full max-w-md">
          <Button
            onClick={handleStartConversation}
            className="gap-2 w-full"
            size="lg"
          >
            <Mic className="h-4 w-4" />
            {error ? "Retry Connection" : "Start Conversation"}
          </Button>
        </div>
      </div>

      {/* Info Cards */}
      {!agentId && (
        <div className="grid gap-4 sm:grid-cols-3 mt-8">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Mic className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-medium text-foreground">Natural Speech</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Speak naturally and the AI will understand and respond in
              real-time.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-medium text-foreground">AI Agents</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Choose from pre-configured agents with unique personalities and
              expertise.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-medium text-foreground">Low Latency</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Sub-second response times for fluid, natural conversations.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LivePage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-6 lg:px-6 lg:py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      }
    >
      <LivePageContent />
    </Suspense>
  );
}
