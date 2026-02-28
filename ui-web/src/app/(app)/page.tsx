import { Users, Phone, Bot, Plus, Zap } from "lucide-react";
import Link from "next/link";
import type { Agent } from "@/lib/types";

const recentAgents: Agent[] = [
  {
    id: "1", name: "Atlas", description: "Technical assistant for engineering questions and code analysis.", instructions: "",
    tags: ["engineering", "code"], color: "#3b82f6", icon: "brain", category: "technical",
    source: "mastra", llmModel: null, isOnline: true,
    createdAt: "2025-01-15T10:00:00Z", updatedAt: "2025-02-20T14:30:00Z",
  },
  {
    id: "2", name: "Nova", description: "Creative writing and brainstorming companion.", instructions: "",
    tags: ["creativity", "arts"], color: "#8b5cf6", icon: "sparkles", category: "creative",
    source: "mastra", llmModel: null, isOnline: true,
    createdAt: "2025-01-20T08:00:00Z", updatedAt: "2025-02-19T11:00:00Z",
  },
  {
    id: "3", name: "Sage", description: "Thoughtful conversational companion for any topic.", instructions: "",
    tags: ["conversation", "talk"], color: "#22c55e", icon: "messages", category: "conversational",
    source: "mastra", llmModel: null, isOnline: true,
    createdAt: "2025-01-05T09:00:00Z", updatedAt: "2025-02-22T10:00:00Z",
  },
];

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex-1 rounded-xl border border-border bg-card p-5 flex flex-col gap-2">
      <span
        className="font-mono text-[11px] font-semibold text-muted-foreground uppercase"
        style={{ letterSpacing: "2px" }}
      >
        {label}
      </span>
      <span className="text-3xl font-semibold text-foreground">{value}</span>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof Users;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex-1 rounded-xl border border-border bg-card p-5 flex flex-col gap-3 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 active:scale-[0.98]"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
    </Link>
  );
}

function AgentPreview({ agent }: { agent: Agent }) {
  return (
    <Link
      href={`/agents/${agent.id}`}
      className="rounded-xl border border-border bg-card overflow-hidden transition-all hover:border-border-strong group"
    >
      <div
        className="h-5"
        style={{
          background: `linear-gradient(180deg, ${agent.color}20 0%, transparent 100%)`,
        }}
      />
      <div className="px-4 pb-3 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: agent.color }}
          >
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground truncate">
              {agent.name}
            </p>
            <p className="text-xs text-muted-foreground capitalize">
              {agent.category}
            </p>
          </div>
        </div>
        <p className="text-[13px] leading-relaxed text-muted-foreground line-clamp-2">
          {agent.description}
        </p>
        {agent.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {agent.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-1 rounded"
                style={{
                  backgroundColor: `${agent.color}15`,
                  color: agent.color,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border justify-end">
        <span className="text-[13px] font-medium text-muted-foreground flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors">
          <Zap className="h-3.5 w-3.5" />
          View
        </span>
        <span className="text-[13px] font-medium text-primary-foreground bg-primary px-3 py-1 rounded-md flex items-center gap-1.5 cursor-pointer hover:bg-primary/90 transition-colors">
          <Phone className="h-3.5 w-3.5" />
          Chat
        </span>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8 px-6 md:px-12 py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back. Here&apos;s your agent overview.
          </p>
        </div>
        <Link
          href="/agents"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 shrink-0"
        >
          <Plus className="h-4 w-4" />
          Create Agent
        </Link>
      </div>

      {/* Stats Row */}
      <div className="flex gap-4 flex-col sm:flex-row">
        <StatCard label="Active Agents" value={4} />
        <StatCard label="Total Chats" value={12} />
        <StatCard label="Arena Sessions" value={3} />
      </div>

      {/* Quick Actions */}
      <div className="flex gap-4 flex-col sm:flex-row">
        <QuickAction
          href="/arena"
          icon={Users}
          title="Start Arena"
          description="Launch multi-agent collaboration."
        />
        <QuickAction
          href="/live"
          icon={Phone}
          title="Live Chat"
          description="Run a 1:1 voice conversation."
        />
        <QuickAction
          href="/agents"
          icon={Bot}
          title="Browse Agents"
          description="Explore and manage your AI agents."
        />
      </div>

      {/* Recent Agents */}
      <div className="flex flex-col gap-4">
        <span
          className="font-mono text-[11px] font-semibold text-muted-foreground uppercase"
          style={{ letterSpacing: "2px" }}
        >
          Recent Agents
        </span>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recentAgents.map((agent) => (
            <AgentPreview key={agent.id} agent={agent} />
          ))}
        </div>
      </div>
    </div>
  );
}
