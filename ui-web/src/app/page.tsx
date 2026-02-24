import { Users, Phone, Bot, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickActionCard } from "@/components/dashboard/quick-action-card";
import { AgentPreviewCard } from "@/components/dashboard/agent-preview-card";
import { RecentActivityItem } from "@/components/dashboard/recent-activity-item";
import { SystemStatus } from "@/components/dashboard/system-status";
import Link from "next/link";
import type { Agent } from "@/lib/types";

// Mock data for server component
const recentAgents: Agent[] = [
  {
    id: "1", name: "Atlas", description: "Research assistant", instructions: "",
    tags: ["research"], color: "#3b82f6", icon: "brain", category: "technical",
    voice_id: null, preset_voice: "alloy", stt_provider: null, llm_provider: null,
    tts_provider: null, tts_engine: null, tts_cloud_provider: null, llm_model: null,
    is_online: true, voice_name: null, call_count: 24,
    created_at: "2025-01-15T10:00:00Z", updated_at: "2025-02-20T14:30:00Z",
  },
  {
    id: "2", name: "Nova", description: "Creative storyteller", instructions: "",
    tags: ["creative"], color: "#8b5cf6", icon: "sparkles", category: "creative",
    voice_id: null, preset_voice: "shimmer", stt_provider: null, llm_provider: null,
    tts_provider: null, tts_engine: null, tts_cloud_provider: null, llm_model: null,
    is_online: true, voice_name: null, call_count: 18,
    created_at: "2025-01-20T08:00:00Z", updated_at: "2025-02-19T11:00:00Z",
  },
  {
    id: "5", name: "Cipher", description: "Coding assistant", instructions: "",
    tags: ["coding"], color: "#eab308", icon: "code", category: "technical",
    voice_id: null, preset_voice: "fable", stt_provider: null, llm_provider: null,
    tts_provider: null, tts_engine: null, tts_cloud_provider: null, llm_model: null,
    is_online: true, voice_name: null, call_count: 45,
    created_at: "2025-01-05T09:00:00Z", updated_at: "2025-02-22T10:00:00Z",
  },
];

const recentActivity = [
  { agentName: "Atlas", mode: "Live", duration: "5:20", timestamp: "Today" },
  { agentName: "Axiom", mode: "Arena", duration: "3:00", timestamp: "Yesterday" },
  { agentName: "Cipher", mode: "Live", duration: "10:00", timestamp: "2 days ago" },
];

export default function DashboardPage() {
  return (
    <div className="container mx-auto px-4 py-6 lg:px-6 lg:py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Welcome back
          </h1>
          <p className="text-muted-foreground mt-1">
            Build, deploy, and interact with AI agents
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/agents">
            <Plus className="h-4 w-4" />
            Create Agent
          </Link>
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <QuickActionCard
          href="/arena"
          icon={Users}
          title="Arena"
          description="Multi-agent conversations"
        />
        <QuickActionCard
          href="/live"
          icon={Phone}
          title="Live Chat"
          description="Real-time voice conversation"
        />
        <QuickActionCard
          href="/agents"
          icon={Bot}
          title="Browse Agents"
          description="Manage your AI agents"
        />
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Agents */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-foreground">
              Recent Agents
            </h2>
            <Link
              href="/agents"
              className="text-sm text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
            {recentAgents.map((agent) => (
              <AgentPreviewCard key={agent.id} agent={agent} />
            ))}
            <Link
              href="/agents"
              className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/50 p-4 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-current">
                <span className="text-2xl font-light">+</span>
              </div>
              <span className="text-sm">New Agent</span>
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-foreground">
              Recent Activity
            </h2>
          </div>
          <div className="flex flex-col gap-2">
            {recentActivity.map((item, index) => (
              <RecentActivityItem
                key={index}
                agentName={item.agentName}
                mode={item.mode}
                duration={item.duration}
                timestamp={item.timestamp}
              />
            ))}
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="mt-8">
        <SystemStatus />
      </div>
    </div>
  );
}
