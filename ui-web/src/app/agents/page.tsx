"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bot, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AgentCard } from "@/components/agents/agent-card";
import { api } from "@/lib/api";
import { AGENT_CATEGORIES } from "@/lib/types";
import type { Agent } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchAgents = useCallback(
    async (search?: string, category?: string) => {
      try {
        setError(null);
        setLoading(true);
        const response = await api.listAgents({
          category: category && category !== "all" ? category : undefined,
          search: search || undefined,
        });
        setAgents(response.agents);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load agents"
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchAgents(searchQuery, selectedCategory);
  }, [selectedCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchAgents(searchQuery, selectedCategory);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartChat = (agent: Agent) => {
    router.push(
      `/live?agent_id=${agent.id}&agent_name=${encodeURIComponent(agent.name)}`
    );
  };

  return (
    <div className="container mx-auto px-4 py-6 lg:px-6 lg:py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage your AI conversation agents
          </p>
        </div>
        <Button className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Create Agent
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-6">
        <div className="relative flex-1 sm:flex-none">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full sm:w-[240px] bg-secondary border-border"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedCategory("all")}
            className={cn(
              "px-3 py-1.5 text-xs rounded-md border transition-colors",
              selectedCategory === "all"
                ? "bg-secondary border-primary/50 text-foreground"
                : "bg-transparent border-border text-muted-foreground hover:text-foreground"
            )}
          >
            All
          </button>
          {AGENT_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-md border transition-colors",
                selectedCategory === cat.value
                  ? "bg-secondary border-primary/50 text-foreground"
                  : "bg-transparent border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-center gap-2 text-destructive bg-destructive/10 px-4 py-3 rounded-lg">
          <span className="flex-1 text-sm">{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchAgents(searchQuery, selectedCategory)}
            className="text-destructive hover:text-destructive"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <AgentCard key={i} loading />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-muted-foreground mb-4">
            <Bot className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-1">
            {searchQuery || selectedCategory !== "all"
              ? "No matching agents"
              : "No agents yet"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchQuery || selectedCategory !== "all"
              ? "Try a different search or filter."
              : "Create your first agent to get started"}
          </p>
          {(searchQuery || selectedCategory !== "all") && (
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onStartChat={handleStartChat}
            />
          ))}
        </div>
      )}
    </div>
  );
}
