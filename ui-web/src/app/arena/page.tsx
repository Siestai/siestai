"use client";

import { useState, Suspense } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ParticipationMode } from "@/lib/types";

const STEPS = [
  { id: 1, label: "Agents", icon: Bot },
  { id: 2, label: "Mode", icon: Users },
  { id: 3, label: "Topic & Launch", icon: MessageCircle },
] as const;

function ArenaPageContent() {
  const [step, setStep] = useState(1);
  const [participationMode, setParticipationMode] =
    useState<ParticipationMode>("human_collab");
  const [topic, setTopic] = useState("");
  const [configMode, setConfigMode] = useState<"manual" | "agents">("agents");

  const agentOnlyNeedsTopic =
    participationMode === "agent_only" && !topic.trim();

  const canProceedFromStep = (s: number) => {
    if (s === 1) return true; // agents step — always passable for now (mock)
    if (s === 2) return true; // mode selected
    if (s === 3) return !agentOnlyNeedsTopic;
    return false;
  };

  const goNext = () => {
    if (step < STEPS.length && canProceedFromStep(step)) setStep(step + 1);
  };
  const goBack = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="container mx-auto px-4 py-6 lg:px-6 lg:py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Arena — Multi-Agent Conversation
          </h1>
          <p className="text-muted-foreground mt-1">
            Set up a group discussion between multiple AI agents
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-muted-foreground text-sm">
          Step {step} of {STEPS.length}
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-0 mb-10">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isCompleted = step > s.id;
          const isCurrent = step === s.id;
          return (
            <div key={s.id} className="flex items-center">
              {/* Step circle */}
              <button
                onClick={() => {
                  if (isCompleted) setStep(s.id);
                }}
                disabled={!isCompleted && !isCurrent}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors",
                  isCurrent &&
                    "bg-primary text-primary-foreground",
                  isCompleted &&
                    "bg-primary/15 text-primary cursor-pointer hover:bg-primary/25",
                  !isCurrent &&
                    !isCompleted &&
                    "bg-secondary text-muted-foreground"
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

              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "w-8 sm:w-16 h-0.5 mx-1",
                    step > s.id ? "bg-primary/40" : "bg-border"
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
                      : "bg-card text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                >
                  <Bot className="h-4 w-4" />
                  Choose from Agents
                </button>
                <button
                  type="button"
                  onClick={() => setConfigMode("manual")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors",
                    configMode === "manual"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                >
                  Build Manually
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {configMode === "agents"
                  ? "Select from your saved agents with pre-configured personalities."
                  : "Configure each agent's name and persona from scratch."}
              </p>
            </div>

            <div className="rounded-lg border border-dashed border-border bg-card/30 p-6">
              <div className="flex flex-col items-center justify-center py-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4">
                  <Bot className="h-7 w-7 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  {configMode === "agents"
                    ? "Select at least 2 agents"
                    : "Add your agents"}
                </p>
                <p className="text-xs text-muted-foreground text-center max-w-sm">
                  {configMode === "agents"
                    ? "Pick agents from your library to participate in the group discussion."
                    : "Define each agent's name and instructions. Add 2–4 agents for the best results."}
                </p>
              </div>
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
                      : "border-border bg-card hover:border-border-strong"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      participationMode === "human_collab"
                        ? "bg-primary/15 text-primary"
                        : "bg-secondary text-muted-foreground"
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
                      : "border-border bg-card hover:border-border-strong"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      participationMode === "agent_only"
                        ? "bg-primary/15 text-primary"
                        : "bg-secondary text-muted-foreground"
                    )}
                  >
                    <Eye className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Observe Only
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Watch agents converse autonomously. You provide the topic,
                      they do the rest.
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
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Agents</span>
                  <span className="text-foreground">
                    {configMode === "agents"
                      ? "From library (none selected)"
                      : "Manual configuration"}
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
                disabled={agentOnlyNeedsTopic}
                className="gap-2 w-full"
                size="lg"
              >
                {participationMode === "agent_only" ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
                {participationMode === "agent_only"
                  ? "Start Observation"
                  : "Start Conversation"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Connection to real-time backend required
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
      <ArenaPageContent />
    </Suspense>
  );
}
