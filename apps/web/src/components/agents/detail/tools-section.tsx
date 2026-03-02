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
  Github,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { ToolWithStatus, AgentTool } from "@/lib/types";

const TOOL_ICON_MAP: Record<string, LucideIcon> = {
  globe: Globe,
  calculator: Calculator,
  "code-2": Code2,
  image: Image,
  calendar: Calendar,
  mail: Mail,
  wrench: Wrench,
  search: Search,
  github: Github,
};

interface ToolsSectionProps {
  agentId: string;
}

export function ToolsSection({ agentId }: ToolsSectionProps) {
  const [connectedTools, setConnectedTools] = useState<AgentTool[]>([]);
  const [allTools, setAllTools] = useState<ToolWithStatus[]>([]);
  const [showBrowser, setShowBrowser] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [connected, tools] = await Promise.all([
          api.listAgentTools(agentId),
          api.listToolsWithStatus(),
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

  const toolTypeLabel = (tool: ToolWithStatus) => {
    if (tool.type === "oauth") return "via OAuth";
    if (tool.type === "api_key") return "via API Key";
    return "built-in";
  };

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
                title={toolTypeLabel(tool)}
              >
                <ToolIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-foreground">{tool.name}</span>
                <span className="text-[10px] text-muted-foreground/60">
                  {toolTypeLabel(tool)}
                </span>
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
                const needsSetup =
                  (tool.type === "oauth" || tool.type === "api_key") &&
                  !tool.connected;

                return (
                  <div
                    key={tool.id}
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg border border-border bg-card/50 p-2.5 text-left transition-colors",
                      needsSetup
                        ? "opacity-70"
                        : "hover:border-primary/30 cursor-pointer"
                    )}
                    role={needsSetup ? undefined : "button"}
                    tabIndex={needsSetup ? undefined : 0}
                    onClick={
                      needsSetup ? undefined : () => connectTool(tool.id)
                    }
                    onKeyDown={
                      needsSetup
                        ? undefined
                        : (e) => {
                            if (e.key === "Enter" || e.key === " ")
                              connectTool(tool.id);
                          }
                    }
                  >
                    <div className="relative mt-0.5 shrink-0">
                      <ToolIcon className="h-4 w-4 text-muted-foreground" />
                      <span
                        className={cn(
                          "absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border border-card/30",
                          tool.connected ? "bg-emerald-400" : "bg-amber-400"
                        )}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {tool.name}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {tool.description}
                      </p>
                      {needsSetup && (
                        <Link
                          href="/tools"
                          className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 mt-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <AlertCircle className="h-3 w-3" />
                          Setup required
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
