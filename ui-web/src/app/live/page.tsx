"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Phone,
  Mic,
  Bot,
  Zap,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function LivePageContent() {
  const searchParams = useSearchParams();
  const agentId = searchParams.get("agent_id");
  const agentName = searchParams.get("agent_name");

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
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-muted-foreground text-sm">
          <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
          Setup required
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

        <Button disabled className="gap-2 w-full max-w-md" size="lg">
          <Mic className="h-4 w-4" />
          Start Conversation
        </Button>
        <p className="text-xs text-muted-foreground text-center mt-3">
          Connection to real-time backend required
        </p>
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
