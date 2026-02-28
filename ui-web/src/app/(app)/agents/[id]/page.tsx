"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bot,
  MessageSquare,
  Users,
  Calendar,
  Hash,
  ChevronRight,
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
        const data = await api.getAgent(id);
        setAgent(data);
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
      <div className="flex flex-col gap-6 px-6 md:px-12 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-4 bg-secondary rounded w-32" />
          <div className="h-24 bg-secondary/50 rounded-xl" />
          <div className="h-64 bg-secondary/30 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex flex-col gap-6 px-6 md:px-12 py-8">
        <Link
          href="/agents"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Agents
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
    <div className="flex flex-col gap-6 px-6 md:px-12 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/agents"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Agents
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium text-foreground">{agent.name}</span>
      </div>

      {/* Hero */}
      <div className="flex items-center gap-5">
        <div
          className="h-16 w-16 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: agent.color }}
        >
          <Bot className="h-8 w-8 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">
            {agent.name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-muted-foreground capitalize">
              {agent.category}
            </span>
            {agent.llmModel && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="text-sm text-primary font-mono">
                  {agent.llmModel}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() =>
              router.push(`/arena?agent_ids=${agent.id}`)
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
            <MessageSquare className="h-4 w-4" />
            Start Chat
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="flex gap-6 flex-col lg:flex-row">
            {/* Left: Instructions */}
            <div className="flex-1 space-y-6">
              <div className="rounded-xl border border-border bg-card p-5">
                <h3
                  className="font-mono text-[11px] font-semibold text-muted-foreground uppercase mb-3"
                  style={{ letterSpacing: "2px" }}
                >
                  Instructions
                </h3>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {agent.instructions || "No instructions configured."}
                </p>
              </div>

              {/* Tags */}
              {agent.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
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
              )}
            </div>

            {/* Right: Details */}
            <div className="w-full lg:w-80 space-y-4">
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <h3
                  className="font-mono text-[11px] font-semibold text-muted-foreground uppercase"
                  style={{ letterSpacing: "2px" }}
                >
                  Details
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Source</span>
                    <span className="text-foreground capitalize">{agent.source}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Model</span>
                    <span className="text-primary font-mono text-xs">
                      {agent.llmModel || "Default"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span className="flex items-center gap-1.5 text-foreground">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          agent.isOnline ? "bg-success" : "bg-muted-foreground"
                        }`}
                      />
                      {agent.isOnline ? "Online" : "Offline"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Created</span>
                    <span className="text-foreground">
                      {new Date(agent.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="configuration" className="mt-6 space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="text-sm font-medium text-foreground">
              Model Settings
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">LLM Model</p>
                <p className="text-sm text-foreground">
                  {agent.llmModel || "Default"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Source</p>
                <p className="text-sm text-foreground capitalize">
                  {agent.source}
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <div className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No conversation history yet
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
