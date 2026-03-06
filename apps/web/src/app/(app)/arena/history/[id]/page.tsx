"use client";

import { use, useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Loader2,
  AlertCircle,
  Users,
  Clock,
  Eye,
  Mic,
  Brain,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getArenaSession,
  getArenaSessionTranscripts,
  getArenaSessionBrief,
  getArenaSessionMemories,
} from "@/lib/arena-api";
import { ArenaBriefContent } from "@/components/arena/arena-brief-content";
import type {
  ArenaSession,
  ArenaTranscriptEntry,
  ArenaSessionBrief,
} from "@/lib/types";

// Raw DB row shape from GET /arena/sessions/:id/memories
interface MemoryRow {
  id: string;
  agentId: string;
  content: string;
  memoryType: string;
  sourceSessionId: string | null;
  importance: number | null;
  createdAt: string;
  lastAccessedAt: string | null;
}

type Tab = "overview" | "transcript" | "brief" | "memories";

const CATEGORY_COLORS: Record<string, string> = {
  decision: "bg-primary/15 text-primary border-primary/20",
  task: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  open_question: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  position: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  learning: "bg-blue-500/15 text-blue-400 border-blue-500/20",
};

const CONFIDENCE_DOT: Record<string, string> = {
  high: "bg-emerald-400",
  medium: "bg-yellow-400",
  low: "bg-muted-foreground",
};

export default function ArenaHistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [session, setSession] = useState<ArenaSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Lazy-loaded tab data
  const [transcripts, setTranscripts] = useState<ArenaTranscriptEntry[] | null>(null);
  const [transcriptsLoading, setTranscriptsLoading] = useState(false);
  const [brief, setBrief] = useState<ArenaSessionBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefProcessing, setBriefProcessing] = useState(false);
  const [memories, setMemories] = useState<MemoryRow[] | null>(null);
  const [memoriesLoading, setMemoriesLoading] = useState(false);

  const briefPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch session on mount
  useEffect(() => {
    getArenaSession(id)
      .then(setSession)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load session"),
      )
      .finally(() => setLoading(false));
  }, [id]);

  // Lazy-load tab data when tab changes
  useEffect(() => {
    if (activeTab === "transcript" && transcripts === null && !transcriptsLoading) {
      setTranscriptsLoading(true);
      getArenaSessionTranscripts(id)
        .then(setTranscripts)
        .catch(() => setTranscripts([]))
        .finally(() => setTranscriptsLoading(false));
    }
    if (activeTab === "brief" && brief === null && !briefLoading) {
      setBriefLoading(true);
      pollBrief();
    }
    if (activeTab === "memories" && memories === null && !memoriesLoading) {
      setMemoriesLoading(true);
      getArenaSessionMemories(id)
        .then(setMemories)
        .catch(() => setMemories([]))
        .finally(() => setMemoriesLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Cleanup brief polling
  useEffect(() => {
    return () => {
      if (briefPollRef.current) clearTimeout(briefPollRef.current);
    };
  }, []);

  async function pollBrief() {
    try {
      const result = await getArenaSessionBrief(id);
      if (result) {
        setBrief(result);
        setBriefLoading(false);
        setBriefProcessing(false);
      } else {
        setBriefProcessing(true);
        briefPollRef.current = setTimeout(pollBrief, 3000);
      }
    } catch {
      setBriefLoading(false);
      setBriefProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <Link
          href="/arena"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ChevronLeft className="h-4 w-4" />
          Arena
        </Link>
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-muted-foreground">{error || "Session not found"}</p>
        </div>
      </div>
    );
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "transcript", label: "Transcript" },
    { id: "brief", label: "Brief" },
    { id: "memories", label: "Memories" },
  ];

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const durationMinutes =
    session.startedAt && session.endedAt
      ? Math.max(
          1,
          Math.round(
            (new Date(session.endedAt).getTime() -
              new Date(session.startedAt).getTime()) /
              60_000,
          ),
        )
      : undefined;

  // Group memories by agent
  const memoriesByAgent = memories
    ? memories.reduce(
        (acc, m) => {
          const key = m.agentId;
          if (!acc[key]) acc[key] = [];
          acc[key].push(m);
          return acc;
        },
        {} as Record<string, MemoryRow[]>,
      )
    : {};

  // Find agent name from participant list
  const agentNameMap = new Map<string, string>();
  for (const p of session.participants) {
    if (p.type === "native_agent") {
      // Match by name since we don't have agentId on participant
      agentNameMap.set(p.name, p.color);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/arena"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          onClick={(e) => {
            e.preventDefault();
            // Navigate back to arena with history tab active
            window.history.back();
          }}
        >
          <ChevronLeft className="h-4 w-4" />
          Arena
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">
          {session.topic || "Untitled Session"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {formatDate(session.createdAt)}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-4 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "pb-2 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="space-y-6 animate-message-in">
          {/* Team info */}
          {session.teamName && (
            <div className="rounded-xl border border-border bg-card/30 p-5 flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Team</p>
                <p className="text-sm font-medium text-foreground">
                  {session.teamName}
                </p>
              </div>
            </div>
          )}

          {/* Participants */}
          <div className="rounded-xl border border-border bg-card/30 p-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Participants
            </h3>
            <div className="space-y-2">
              {session.participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 py-1.5"
                >
                  <div
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="text-sm text-foreground">{p.name}</span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] capitalize"
                  >
                    {p.type.replace("_", " ")}
                  </Badge>
                </div>
              ))}
              {session.participants.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No participants recorded
                </p>
              )}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {durationMinutes && (
              <div className="rounded-lg border border-border bg-card/50 p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-xs">Duration</span>
                </div>
                <p className="text-sm font-medium text-foreground">
                  {durationMinutes} min
                </p>
              </div>
            )}
            <div className="rounded-lg border border-border bg-card/50 p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Users className="h-3.5 w-3.5" />
                <span className="text-xs">Participants</span>
              </div>
              <p className="text-sm font-medium text-foreground">
                {session.participants.length}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card/50 p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                {session.participationMode === "human_collab" ? (
                  <Mic className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
                <span className="text-xs">Mode</span>
              </div>
              <p className="text-sm font-medium text-foreground">
                {session.participationMode === "human_collab"
                  ? "Collab"
                  : "Agent Only"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card/50 p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <span className="text-xs">Status</span>
              </div>
              <p className="text-sm font-medium text-foreground capitalize">
                {session.status}
              </p>
            </div>
          </div>

          {/* Topic */}
          {session.topic && (
            <div className="rounded-xl border border-border bg-card/30 p-5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Topic
              </h3>
              <p className="text-sm text-foreground">{session.topic}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "transcript" && (
        <div className="animate-message-in">
          {transcriptsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : transcripts && transcripts.length > 0 ? (
            <div className="space-y-3">
              {transcripts.map((entry, i) => {
                const prevSpeaker = i > 0 ? transcripts[i - 1].speakerName : null;
                const showSpeaker = entry.speakerName !== prevSpeaker;
                const participant = session.participants.find(
                  (p) => p.name === entry.speakerName,
                );
                const color = participant?.color || "#6b7280";

                return (
                  <div key={entry.id || i} className={cn(!showSpeaker && "mt-1")}>
                    {showSpeaker && (
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span
                          className="text-xs font-medium"
                          style={{ color }}
                        >
                          {entry.speakerName}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">
                          {new Date(entry.timestamp).toLocaleTimeString(
                            undefined,
                            { hour: "2-digit", minute: "2-digit", second: "2-digit" },
                          )}
                        </span>
                      </div>
                    )}
                    <div className="pl-4 border-l-2 border-border ml-1">
                      <p className="text-sm text-foreground leading-relaxed">
                        {entry.content}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Brain className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">No transcripts available</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "brief" && (
        <div className="animate-message-in">
          {briefLoading || briefProcessing ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">
                {briefProcessing
                  ? "Generating session brief..."
                  : "Loading brief..."}
              </p>
              {briefProcessing && (
                <p className="text-xs text-muted-foreground/60">
                  AI is extracting key insights from the session
                </p>
              )}
            </div>
          ) : brief ? (
            <ArenaBriefContent brief={brief} />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Brain className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">No brief available</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "memories" && (
        <div className="animate-message-in">
          {memoriesLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : memories && memories.length > 0 ? (
            <div className="space-y-6">
              {Object.entries(memoriesByAgent).map(([agentId, agentMemories]) => {
                const participant = session.participants.find(
                  (p) => p.agentId === agentId,
                );
                const displayName = participant?.name || `Agent ${agentId.slice(0, 8)}`;

                return (
                  <div key={agentId}>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      {displayName}
                    </h3>
                    <div className="space-y-2">
                      {agentMemories.map((memory) => {
                        const importance = memory.importance ?? 0.5;
                        const confidenceLevel =
                          importance > 0.6
                            ? "high"
                            : importance > 0.3
                              ? "medium"
                              : "low";
                        const memType = memory.memoryType || "learning";

                        return (
                          <div
                            key={memory.id}
                            className="rounded-lg border border-border bg-card/50 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm text-foreground leading-relaxed flex-1">
                                {memory.content}
                              </p>
                              <div className="flex items-center gap-2 shrink-0">
                                <div
                                  className={cn(
                                    "h-2 w-2 rounded-full",
                                    CONFIDENCE_DOT[confidenceLevel],
                                  )}
                                  title={`Importance: ${importance.toFixed(1)}`}
                                />
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px]",
                                    CATEGORY_COLORS[memType] ||
                                      CATEGORY_COLORS.learning,
                                  )}
                                >
                                  {memType.replace("_", " ")}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Brain className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">No memories extracted</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
