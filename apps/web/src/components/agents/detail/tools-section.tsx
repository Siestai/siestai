"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Wrench,
  Plus,
  X,
  Search,
  Globe,
  Calculator,
  Code2,
  Image,
  Calendar,
  Mail,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { Tool, AgentTool } from "@/lib/types";

const TOOL_ICON_MAP: Record<string, LucideIcon> = {
  globe: Globe,
  calculator: Calculator,
  "code-2": Code2,
  image: Image,
  calendar: Calendar,
  mail: Mail,
  wrench: Wrench,
  search: Search,
};

interface ToolsSectionProps {
  agentId: string;
}

export function ToolsSection({ agentId }: ToolsSectionProps) {
  const [connectedTools, setConnectedTools] = useState<AgentTool[]>([]);
  const [allTools, setAllTools] = useState<Tool[]>([]);
  const [showBrowser, setShowBrowser] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [connected, tools] = await Promise.all([
          api.listAgentTools(agentId),
          api.listTools(),
        ]);
        setConnectedTools(connected);
        setAllTools(tools);
      } catch {
        // tools not available yet
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [agentId]);

  const connectTool = useCallback(
    async (toolId: string) => {
      try {
        const result = await api.connectAgentTool(agentId, toolId);
        setConnectedTools((prev) => [...prev, result]);
      } catch {
        // failed
      }
    },
    [agentId]
  );

  const disconnectTool = useCallback(
    async (toolId: string) => {
      try {
        await api.disconnectAgentTool(agentId, toolId);
        setConnectedTools((prev) => prev.filter((t) => t.toolId !== toolId));
      } catch {
        // failed
      }
    },
    [agentId]
  );

  const connectedToolIds = new Set(connectedTools.map((t) => t.toolId));
  const availableTools = allTools.filter((t) => !connectedToolIds.has(t.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.15em]">
          Tools
        </h3>
        <button
          onClick={() => setShowBrowser(!showBrowser)}
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Browse
        </button>
      </div>

      {/* Connected tools */}
      {connectedTools.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {connectedTools.map((ct) => {
            const tool = allTools.find((t) => t.id === ct.toolId);
            if (!tool) return null;
            const ToolIcon = TOOL_ICON_MAP[tool.icon] || Wrench;
            return (
              <div
                key={ct.id}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-1.5 text-sm group"
              >
                <ToolIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-foreground">{tool.name}</span>
                <button
                  onClick={() => disconnectTool(tool.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      ) : !showBrowser ? (
        <p className="text-sm text-muted-foreground/60">
          No tools connected.{" "}
          <button
            onClick={() => setShowBrowser(true)}
            className="text-primary hover:underline"
          >
            Browse tools
          </button>
        </p>
      ) : null}

      {/* Inline tool browser */}
      {showBrowser && (
        <div className="rounded-lg border border-border bg-card/30 p-3 space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading tools...</p>
          ) : availableTools.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              All available tools are connected.{" "}
              <Link href="/tools" className="text-primary hover:underline">
                View marketplace
              </Link>
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {availableTools.map((tool) => {
                const ToolIcon = TOOL_ICON_MAP[tool.icon] || Wrench;
                return (
                  <button
                    key={tool.id}
                    onClick={() => connectTool(tool.id)}
                    className="flex items-start gap-2.5 rounded-lg border border-border bg-card/50 p-2.5 text-left hover:border-primary/30 transition-colors"
                  >
                    <ToolIcon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {tool.name}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {tool.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
