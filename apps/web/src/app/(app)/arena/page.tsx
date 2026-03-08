"use client";

import { useState, Suspense, useRef, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Users,
  Bot,
  Eye,
  Mic,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Check,
  MessageCircle,
  RotateCcw,
  Clock,
  Plus,
  Trash2,
  FileText,
} from "lucide-react";
import "@livekit/components-styles";
import { LiveKitRoom } from "@livekit/components-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ROOM_OPTIONS } from "@/lib/livekit";
import type { Agent, ParticipationMode } from "@/lib/types";
import {
  ArenaSessionProvider,
  useArenaSession,
} from "@/lib/arena-session-context";
import { InviteLinkPanel } from "@/components/arena/invite-link-panel";
import { ExternalParticipantTile } from "@/components/arena/external-participant-tile";
import { ArenaRoom } from "@/components/arena/arena-room";
import { AgentPicker } from "@/components/arena/agent-picker";
import { TeamPicker } from "@/components/arena/team-picker";
import { ArenaHistory } from "@/components/arena/arena-history";
import { ArenaActionBadges } from "@/components/arena/arena-action-badges";
import type { Team, TeamAgent } from "@/lib/types";
import { api } from "@/lib/api";

type PageState = "setup" | "waiting" | "live" | "ended";

const STEPS = [
  { id: 1, label: "Agents", icon: Bot },
  { id: 2, label: "Mode", icon: Users },
  { id: 3, label: "Topic & Launch", icon: MessageCircle },
] as const;

function ArenaPageContent() {
  const searchParams = useSearchParams();
  const [pageState, setPageState] = useState<PageState>("setup");
  const [activeView, setActiveView] = useState<"new" | "history">(
    searchParams.get("tab") === "history" ? "history" : "new",
  );
  const [step, setStep] = useState(1);
  const [participationMode, setParticipationMode] =
    useState<ParticipationMode>("human_collab");
  const [topic, setTopic] = useState("");
  const [configMode, setConfigMode] = useState<"manual" | "agents" | "team">(
    "agents",
  );
  const [selectedAgents, setSelectedAgents] = useState<Agent[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamAgents, setTeamAgents] = useState<TeamAgent[]>([]);
  const [loadingTeamAgents, setLoadingTeamAgents] = useState(false);
  const [manualAgents, setManualAgents] = useState<
    { name: string; instructions: string }[]
  >([
    { name: "", instructions: "" },
    { name: "", instructions: "" },
  ]);
  const [isCreating, setIsCreating] = useState(false);
  const sessionStartedAt = useRef<number>(0);
  const [endedSessionId, setEndedSessionId] = useState<string | null>(null);

  const arenaSession = useArenaSession();

  // Auto-select team from query param (e.g. from team detail page "Start Meeting" button)
  const initialTeamId = searchParams.get("team_id");
  const [teamAutoLoaded, setTeamAutoLoaded] = useState(false);

  useEffect(() => {
    if (!initialTeamId || teamAutoLoaded) return;
    setTeamAutoLoaded(true);
    setConfigMode("team");
    // Fetch team and its agents
    (async () => {
      try {
        const [teamData, teams] = await Promise.all([
          api.getTeamAgents(initialTeamId),
          api.listTeams(),
        ]);
        const team = teams.find((t: Team) => t.id === initialTeamId);
        if (team) {
          setSelectedTeam(team);
          setTeamAgents(teamData);
        }
      } catch {
        // Silently fail — user can manually select
      }
    })();
  }, [initialTeamId, teamAutoLoaded]);

  const agentOnlyNeedsTopic =
    participationMode === "agent_only" && !topic.trim();

  const validManualAgents = manualAgents.filter(
    (a) => a.name.trim() && a.instructions.trim(),
  );

  const canProceedFromStep = (s: number) => {
    if (s === 1) {
      if (configMode === "team") return selectedTeam !== null && teamAgents.length >= 1;
      return configMode === "agents"
        ? selectedAgents.length >= 1
        : validManualAgents.length >= 1;
    }
    if (s === 2) return true;
    if (s === 3) return !agentOnlyNeedsTopic;
    return false;
  };

  const goNext = () => {
    if (step < STEPS.length && canProceedFromStep(step)) setStep(step + 1);
  };
  const goBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleStartConversation = async () => {
    setIsCreating(true);
    try {
      let nativeAgents: { name: string; agentId?: string; instructions?: string }[];

      if (configMode === "team") {
        nativeAgents = teamAgents
          .filter((ta) => ta.agent)
          .map((ta) => ({
            name: ta.agent!.name,
            agentId: ta.agentId,
            instructions: ta.agent!.description ?? undefined,
          }));
      } else if (configMode === "agents") {
        nativeAgents = selectedAgents.map((a) => ({
          name: a.name,
          agentId: a.id,
          instructions: a.instructions,
        }));
      } else {
        nativeAgents = validManualAgents.map((a) => ({
          name: a.name.trim(),
          instructions: a.instructions.trim(),
        }));
      }

      await arenaSession.createSession({
        topic: topic.trim(),
        mode: "group",
        participationMode,
        nativeAgents,
        teamId: configMode === "team" ? selectedTeam?.id : undefined,
      });
      arenaSession.startListening();
      sessionStartedAt.current = Date.now();
      setPageState("waiting");
    } catch (err) {
      console.error("Failed to create arena session:", err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartCall = async () => {
    setPageState("live");
    try {
      await arenaSession.startCall();
    } catch (err) {
      console.error("Failed to start arena call:", err);
      setPageState("waiting");
    }
  };

  const handleEndSession = () => {
    setEndedSessionId(arenaSession.session?.id ?? null);
    arenaSession.endSession();
    setPageState("ended");
  };

  const handleNewSession = () => {
    setPageState("setup");
    setStep(1);
    setTopic("");
    setParticipationMode("human_collab");
    setConfigMode("agents");
    setSelectedAgents([]);
    setSelectedTeam(null);
    setTeamAgents([]);
    setManualAgents([
      { name: "", instructions: "" },
      { name: "", instructions: "" },
    ]);
  };

  const externalParticipants = arenaSession.participants.filter(
    (p) => p.type === "external_agent",
  );

  // --- Setup wizard ---
  if (pageState === "setup") {
    return (
      <div className="flex flex-col gap-6 px-6 md:px-12 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold text-foreground">
              Arena
            </h1>
            <p className="text-sm text-muted-foreground">
              Multi-agent collaborative conversation.
            </p>
          </div>
          {activeView === "new" && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-muted-foreground text-sm">
              Step {step} of {STEPS.length}
            </div>
          )}
        </div>

        {/* Tab toggle */}
        <div className="flex gap-4 border-b border-border">
          <button
            onClick={() => setActiveView("new")}
            className={cn(
              "pb-2 text-sm font-medium transition-colors",
              activeView === "new"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            New Session
          </button>
          <button
            onClick={() => setActiveView("history")}
            className={cn(
              "pb-2 text-sm font-medium transition-colors",
              activeView === "history"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            History
          </button>
        </div>

        {activeView === "history" ? (
          <ArenaHistory />
        ) : (
        <>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-0 mb-10">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isCompleted = step > s.id;
            const isCurrent = step === s.id;
            return (
              <div key={s.id} className="flex items-center">
                <button
                  onClick={() => {
                    if (isCompleted) setStep(s.id);
                  }}
                  disabled={!isCompleted && !isCurrent}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors",
                    isCurrent && "bg-primary text-primary-foreground",
                    isCompleted &&
                      "bg-primary/15 text-primary cursor-pointer hover:bg-primary/25",
                    !isCurrent &&
                      !isCompleted &&
                      "bg-secondary text-muted-foreground",
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{s.id}</span>
                </button>

                {i < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "w-8 sm:w-16 h-0.5 mx-1",
                      step > s.id ? "bg-primary/40" : "bg-border",
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="max-w-2xl mx-auto">
          {/* Step 1: Select Agents */}
          {step === 1 && (
            <div className="space-y-6 animate-message-in">
              <div className="rounded-lg border border-border bg-card/50 p-6">
                <Label className="text-sm font-medium mb-3 block">
                  How do you want to add agents?
                </Label>
                <div className="flex rounded-lg border border-border overflow-hidden w-fit">
                  <button
                    type="button"
                    onClick={() => setConfigMode("agents")}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors",
                      configMode === "agents"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                    )}
                  >
                    <Bot className="h-4 w-4" />
                    Choose from Agents
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfigMode("team")}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors",
                      configMode === "team"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                    )}
                  >
                    <Users className="h-4 w-4" />
                    Use a Team
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfigMode("manual")}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors",
                      configMode === "manual"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                    )}
                  >
                    Build Manually
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {configMode === "agents"
                    ? "Select from your saved agents with pre-configured personalities."
                    : configMode === "team"
                      ? "Select a team to automatically include all its agents."
                      : "Configure each agent's name and persona from scratch."}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card/30 p-6">
                {configMode === "team" ? (
                  <div className="space-y-4">
                    <TeamPicker
                      selectedTeam={selectedTeam}
                      onSelectionChange={(team) => {
                        setSelectedTeam(team);
                        setTeamAgents([]);
                        if (team) {
                          setLoadingTeamAgents(true);
                          api
                            .getTeamAgents(team.id)
                            .then(setTeamAgents)
                            .catch(() => setTeamAgents([]))
                            .finally(() => setLoadingTeamAgents(false));
                        }
                      }}
                    />
                    {selectedTeam && (
                      <div className="rounded-lg border border-border bg-card/50 p-4">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                          Team Agents
                        </h4>
                        {loadingTeamAgents ? (
                          <div className="flex items-center gap-2 py-3">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              Loading team agents...
                            </span>
                          </div>
                        ) : teamAgents.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-2">
                            No agents in this team. Add agents to the team
                            first.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {teamAgents.map((ta) => (
                              <div
                                key={ta.id}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/30 bg-card"
                              >
                                <span
                                  className="h-2 w-2 rounded-full shrink-0"
                                  style={{
                                    backgroundColor:
                                      ta.agent?.color ?? "#3b82f6",
                                  }}
                                />
                                <span className="text-sm">
                                  {ta.agent?.name ?? "Unknown"}
                                </span>
                                <span className="text-[10px] text-muted-foreground capitalize">
                                  {ta.role}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : configMode === "agents" ? (
                  <AgentPicker
                    selectedAgents={selectedAgents}
                    onSelectionChange={setSelectedAgents}
                    maxAgents={4}
                  />
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Define 1–4 agents with name and instructions
                      </p>
                      <span
                        className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full",
                          validManualAgents.length >= 1
                            ? "bg-primary/15 text-primary"
                            : "bg-secondary text-muted-foreground",
                        )}
                      >
                        {validManualAgents.length}/4 ready
                      </span>
                    </div>

                    {manualAgents.map((agent, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-border bg-card p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-medium">
                            Agent {i + 1}
                          </Label>
                          {manualAgents.length > 2 && (
                            <button
                              type="button"
                              onClick={() =>
                                setManualAgents((prev) =>
                                  prev.filter((_, idx) => idx !== i),
                                )
                              }
                              className="text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <Input
                          placeholder="Agent name"
                          value={agent.name}
                          onChange={(e) =>
                            setManualAgents((prev) =>
                              prev.map((a, idx) =>
                                idx === i
                                  ? { ...a, name: e.target.value }
                                  : a,
                              ),
                            )
                          }
                          className="bg-secondary border-border text-sm"
                        />
                        <Textarea
                          placeholder="Instructions / system prompt"
                          value={agent.instructions}
                          onChange={(e) =>
                            setManualAgents((prev) =>
                              prev.map((a, idx) =>
                                idx === i
                                  ? { ...a, instructions: e.target.value }
                                  : a,
                              ),
                            )
                          }
                          rows={2}
                          className="bg-secondary border-border text-sm resize-none"
                        />
                      </div>
                    ))}

                    {manualAgents.length < 4 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-muted-foreground"
                        onClick={() =>
                          setManualAgents((prev) => [
                            ...prev,
                            { name: "", instructions: "" },
                          ])
                        }
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Agent
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Participation Mode */}
          {step === 2 && (
            <div className="space-y-6 animate-message-in">
              <div className="rounded-lg border border-border bg-card/50 p-6">
                <Label className="text-sm font-medium mb-4 block">
                  How do you want to participate?
                </Label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setParticipationMode("human_collab")}
                    className={cn(
                      "flex flex-col items-start gap-3 p-4 rounded-lg border text-left transition-all",
                      participationMode === "human_collab"
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border bg-card hover:border-border-strong",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg",
                        participationMode === "human_collab"
                          ? "bg-primary/15 text-primary"
                          : "bg-secondary text-muted-foreground",
                      )}
                    >
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Human Collaboration
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Join the conversation alongside the agents. Speak and
                        they&apos;ll respond.
                      </p>
                    </div>
                    {participationMode === "human_collab" && (
                      <div className="flex items-center gap-1 text-xs text-primary">
                        <Check className="h-3 w-3" />
                        Selected
                      </div>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setParticipationMode("agent_only")}
                    className={cn(
                      "flex flex-col items-start gap-3 p-4 rounded-lg border text-left transition-all",
                      participationMode === "agent_only"
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border bg-card hover:border-border-strong",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg",
                        participationMode === "agent_only"
                          ? "bg-primary/15 text-primary"
                          : "bg-secondary text-muted-foreground",
                      )}
                    >
                      <Eye className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Observe Only
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Watch agents converse autonomously. You provide the
                        topic, they do the rest.
                      </p>
                    </div>
                    {participationMode === "agent_only" && (
                      <div className="flex items-center gap-1 text-xs text-primary">
                        <Check className="h-3 w-3" />
                        Selected
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Topic & Launch */}
          {step === 3 && (
            <div className="space-y-6 animate-message-in">
              <div className="rounded-lg border border-border bg-card/50 p-6">
                <Label
                  htmlFor="arena-topic"
                  className="text-sm font-medium mb-1 block"
                >
                  Conversation Topic{" "}
                  {participationMode === "agent_only" ? (
                    <span className="text-destructive">*</span>
                  ) : (
                    <span className="text-muted-foreground">(optional)</span>
                  )}
                </Label>
                <p className="text-xs text-muted-foreground mb-3">
                  {participationMode === "agent_only"
                    ? "Required — the agents need a topic to discuss autonomously."
                    : "Give the agents a starting point, or leave blank for a free-form chat."}
                </p>
                <Input
                  id="arena-topic"
                  placeholder="e.g. The future of AI in education"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="bg-secondary border-border"
                />
                {agentOnlyNeedsTopic && (
                  <p className="text-xs text-destructive mt-2">
                    A topic is required in observe-only mode.
                  </p>
                )}
              </div>

              {/* Summary */}
              <div className="rounded-lg border border-border bg-card/50 p-6">
                <h3 className="text-sm font-medium text-foreground mb-3">
                  Summary
                </h3>
                <div className="space-y-2 text-sm">
                  {configMode === "team" && selectedTeam && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Team</span>
                      <span className="text-foreground truncate max-w-[250px]">
                        {selectedTeam.name}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Agents</span>
                    <span className="text-foreground truncate max-w-[250px]">
                      {configMode === "team"
                        ? teamAgents.length > 0
                          ? `${teamAgents.map((ta) => ta.agent?.name ?? "Unknown").join(", ")} (${teamAgents.length})`
                          : "None in team"
                        : configMode === "agents"
                          ? selectedAgents.length > 0
                            ? `${selectedAgents.map((a) => a.name).join(", ")} (${selectedAgents.length})`
                            : "None selected"
                          : validManualAgents.length > 0
                            ? `${validManualAgents.map((a) => a.name.trim()).join(", ")} (${validManualAgents.length})`
                            : "None configured"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mode</span>
                    <span className="text-foreground">
                      {participationMode === "human_collab"
                        ? "Human Collaboration"
                        : "Observe Only"}
                    </span>
                  </div>
                  {topic.trim() && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Topic</span>
                      <span className="text-foreground truncate max-w-[200px]">
                        {topic}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Launch */}
              <div className="flex flex-col items-center gap-3 pt-2">
                <Button
                  disabled={agentOnlyNeedsTopic || isCreating}
                  className="gap-2 w-full"
                  size="lg"
                  onClick={handleStartConversation}
                >
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : participationMode === "agent_only" ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                  {isCreating
                    ? "Creating Session..."
                    : participationMode === "agent_only"
                      ? "Start Observation"
                      : "Start Conversation"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Creates a session and generates an invitation link
                </p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            <Button
              variant="ghost"
              onClick={goBack}
              disabled={step === 1}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>

            {step < STEPS.length ? (
              <Button
                onClick={goNext}
                disabled={!canProceedFromStep(step)}
                className="gap-2"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <div />
            )}
          </div>
        </div>
        </>
        )}
      </div>
    );
  }

  // --- Waiting room ---
  if (pageState === "waiting") {
    return (
      <div className="container mx-auto px-4 py-6 lg:px-6 lg:py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Waiting Room
            </h1>
            <p className="text-muted-foreground mt-1">
              {arenaSession.session?.topic
                ? `Topic: ${arenaSession.session.topic}`
                : "Share the invite link to bring external agents into the arena"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                arenaSession.connectionStatus === "connected"
                  ? "bg-green-400"
                  : arenaSession.connectionStatus === "connecting"
                    ? "bg-yellow-400 animate-pulse"
                    : "bg-muted-foreground",
              )}
            />
            <span className="text-sm text-muted-foreground capitalize">
              {arenaSession.connectionStatus}
            </span>
          </div>
        </div>

        <div className="max-w-2xl mx-auto space-y-6">
          {/* Arena action badges */}
          <ArenaActionBadges actions={arenaSession.actions} />

          {/* Native agents summary */}
          {arenaSession.participants.filter((p) => p.type === "native_agent")
            .length > 0 && (
            <div className="rounded-xl border border-border/50 bg-card/30 p-4">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Native Agents
              </h3>
              <div className="flex flex-wrap gap-2">
                {arenaSession.participants
                  .filter((p) => p.type === "native_agent")
                  .map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/30"
                    >
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="text-sm">{p.name}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Invite panel */}
          {arenaSession.invite && (
            <InviteLinkPanel
              invite={arenaSession.invite}
              participants={arenaSession.participants}
              onStartCall={handleStartCall}
            />
          )}

          {/* Back to setup */}
          <div className="flex justify-center pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                arenaSession.endSession();
                setPageState("setup");
              }}
              className="text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Setup
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Live arena ---
  if (pageState === "live") {
    if (!arenaSession.liveState) {
      return (
        <div className="container mx-auto px-4 py-6 lg:px-6 lg:py-8">
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">
              Connecting to arena room...
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="container mx-auto px-4 py-6 lg:px-6 lg:py-8">
        <ArenaActionBadges actions={arenaSession.actions} />
        <LiveKitRoom
          serverUrl={arenaSession.liveState.serverUrl}
          token={arenaSession.liveState.token}
          connect={true}
          audio={true}
          options={ROOM_OPTIONS}
          onError={(err) => {
            console.error("LiveKitRoom error:", err);
          }}
        >
          <ArenaRoom
            participants={arenaSession.participants}
            participationMode={participationMode}
            topic={topic}
            inviteUrl={arenaSession.invite?.url}
            onEndSession={handleEndSession}
          />
        </LiveKitRoom>
      </div>
    );
  }

  // --- Ended ---
  const durationMs = Date.now() - (sessionStartedAt.current || Date.now());
  const durationMins = Math.max(1, Math.round(durationMs / 60_000));

  return (
    <div className="container mx-auto px-4 py-6 lg:px-6 lg:py-8">
      <div className="max-w-md mx-auto text-center py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto mb-6">
          <Check className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground mb-2">
          Session Ended
        </h1>
        <p className="text-muted-foreground mb-8">
          The arena session has concluded.
        </p>

        <div className="rounded-xl border border-border/50 bg-card/30 p-6 text-left space-y-3 mb-8">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Duration
            </span>
            <span className="text-foreground">
              ~{durationMins} min{durationMins !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Participants
            </span>
            <span className="text-foreground">
              {arenaSession.participants.length}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 items-center">
          {endedSessionId && (
            <Button asChild className="gap-2 w-full">
              <Link href={`/arena/sessions/${endedSessionId}/brief`}>
                <FileText className="h-4 w-4" />
                View Session Brief
              </Link>
            </Button>
          )}
          <Button onClick={handleNewSession} variant={endedSessionId ? "outline" : "default"} className="gap-2 w-full">
            <RotateCcw className="h-4 w-4" />
            New Session
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ArenaPage() {
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
      <ArenaSessionProvider>
        <ArenaPageContent />
      </ArenaSessionProvider>
    </Suspense>
  );
}
