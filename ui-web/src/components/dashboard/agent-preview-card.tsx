import Link from "next/link";
import { Bot } from "lucide-react";
import type { Agent } from "@/lib/types";

interface AgentPreviewCardProps {
  agent: Agent;
}

export function AgentPreviewCard({ agent }: AgentPreviewCardProps) {
  return (
    <Link
      href={`/agents/${agent.id}`}
      className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:border-border-strong"
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: agent.color }}
      >
        <Bot className="h-5 w-5 text-white" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">{agent.name}</p>
        <p className="text-xs text-muted-foreground capitalize">
          {agent.category}
        </p>
      </div>
      <div
        className={`h-2 w-2 rounded-full ${
          agent.is_online ? "bg-success" : "bg-muted-foreground"
        }`}
      />
    </Link>
  );
}
