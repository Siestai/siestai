"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Phone,
  Users,
  Globe,
  Calendar,
  Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import type { Agent } from "@/lib/types";

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAgent() {
      try {
        const response = await api.getAgent(id);
        setAgent(response.agent);
      } catch {
        // Agent not found
      } finally {
        setLoading(false);
      }
    }
    loadAgent();
  }, [id]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 lg:px-6 lg:py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-6 bg-secondary rounded w-32" />
          <div className="h-40 bg-secondary/50 rounded-xl" />
          <div className="h-64 bg-secondary/30 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="container mx-auto px-4 py-6 lg:px-6 lg:py-8">
        <Link
          href="/agents"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Agents
        </Link>
        <div className="flex flex-col items-center justify-center py-16">
          <Bot className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-medium">Agent not found</h2>
          <Button asChild className="mt-4">
            <Link href="/agents">Browse Agents</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 lg:px-6 lg:py-8">
      {/* Back Link */}
      <Link
        href="/agents"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Agents
      </Link>

      {/* Hero Section */}
      <div
        className="rounded-xl border border-border overflow-hidden mb-6"
        style={{
          background: `linear-gradient(135deg, ${agent.color}1f 0%, transparent 100%)`,
        }}
      >
        <div className="p-6 flex flex-col sm:flex-row items-start gap-4">
          <div
            className="h-16 w-16 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: agent.color }}
          >
            <Bot className="h-8 w-8 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-semibold text-foreground">
                {agent.name}
              </h1>
              <div
                className={`h-2.5 w-2.5 rounded-full ${
                  agent.is_online ? "bg-success" : "bg-muted-foreground"
                }`}
              />
            </div>
            <p className="text-muted-foreground">{agent.description}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {agent.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  style={{
                    backgroundColor: `${agent.color}26`,
                    color: agent.color,
                  }}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() =>
                router.push(
                  `/arena?agent_ids=${agent.id}`
                )
              }
            >
              <Users className="h-4 w-4" />
              Arena
            </Button>
            <Button
              className="gap-2"
              onClick={() =>
                router.push(
                  `/live?agent_id=${agent.id}&agent_name=${encodeURIComponent(agent.name)}`
                )
              }
            >
              <Phone className="h-4 w-4" />
              Start Chat
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Globe className="h-4 w-4" />
                <span className="text-xs">Category</span>
              </div>
              <p className="text-sm font-medium text-foreground capitalize">
                {agent.category}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Phone className="h-4 w-4" />
                <span className="text-xs">Total Calls</span>
              </div>
              <p className="text-sm font-medium text-foreground">
                {agent.call_count}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Calendar className="h-4 w-4" />
                <span className="text-xs">Created</span>
              </div>
              <p className="text-sm font-medium text-foreground">
                {new Date(agent.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Hash className="h-4 w-4" />
                <span className="text-xs">ID</span>
              </div>
              <p className="text-sm font-medium text-foreground font-mono truncate">
                {agent.id}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Instructions
            </h3>
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {agent.instructions || "No instructions configured."}
            </p>
          </div>
        </TabsContent>

        <TabsContent value="configuration" className="mt-6 space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h3 className="text-sm font-medium text-foreground">
              Provider Settings
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">LLM Provider</p>
                <p className="text-sm text-foreground">
                  {agent.llm_provider || "Default"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">LLM Model</p>
                <p className="text-sm text-foreground">
                  {agent.llm_model || "Default"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">TTS Provider</p>
                <p className="text-sm text-foreground">
                  {agent.tts_provider || "Default"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">STT Provider</p>
                <p className="text-sm text-foreground">
                  {agent.stt_provider || "Default"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Voice</p>
                <p className="text-sm text-foreground">
                  {agent.voice_name || agent.preset_voice || "None"}
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <div className="flex flex-col items-center justify-center py-12">
            <Phone className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No conversation history yet
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
