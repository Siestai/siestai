"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Users,
  FileText,
  Brain,
  Calendar,
  Plus,
  X,
  Search,
  Trash2,
} from "lucide-react";
import type { Team, TeamAgent, MdFile, DailyMemoryFile, MemorySearchResult, Agent } from "@/lib/types";

type Tab = "agents" | "files" | "memory" | "daily";

export default function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [tab, setTab] = useState<Tab>("agents");
  const [loading, setLoading] = useState(true);

  // Agents tab
  const [teamAgents, setTeamAgents] = useState<TeamAgent[]>([]);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [showAddAgent, setShowAddAgent] = useState(false);

  // Files tab
  const [mdFiles, setMdFiles] = useState<MdFile[]>([]);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  // Memory tab
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemorySearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Daily tab
  const [dailyFiles, setDailyFiles] = useState<DailyMemoryFile[]>([]);

  useEffect(() => {
    loadTeam();
  }, [id]);

  useEffect(() => {
    if (!team) return;
    if (tab === "agents") loadAgents();
    if (tab === "files") loadFiles();
    if (tab === "daily") loadDaily();
  }, [tab, team]);

  async function loadTeam() {
    try {
      const data = await api.getTeam(id);
      setTeam(data);
    } catch {
      router.push("/teams");
    } finally {
      setLoading(false);
    }
  }

  async function loadAgents() {
    const [ta, all] = await Promise.all([
      api.getTeamAgents(id),
      api.listAgents(),
    ]);
    setTeamAgents(ta);
    setAllAgents(all);
  }

  async function loadFiles() {
    const files = await api.getTeamMdFiles(id);
    setMdFiles(files);
  }

  async function loadDaily() {
    const files = await api.getTeamDailyFiles(id);
    setDailyFiles(files);
  }

  async function handleAddAgent(agentId: string) {
    await api.addTeamAgent(id, agentId);
    setShowAddAgent(false);
    await loadAgents();
  }

  async function handleRemoveAgent(agentId: string) {
    await api.removeTeamAgent(id, agentId);
    await loadAgents();
  }

  async function handleSaveFile(fileKey: string) {
    await api.updateTeamMdFile(id, fileKey, editContent);
    setEditingFile(null);
    await loadFiles();
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await api.searchTeamMemories(id, searchQuery);
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  }

  async function handleDeleteTeam() {
    if (!confirm("Delete this team? This cannot be undone.")) return;
    await api.deleteTeam(id);
    router.push("/teams");
  }

  if (loading || !team) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: "agents", label: "Agents", icon: Users },
    { key: "files", label: "Files", icon: FileText },
    { key: "memory", label: "Memory", icon: Brain },
    { key: "daily", label: "Daily Log", icon: Calendar },
  ];

  const existingAgentIds = new Set(teamAgents.map((ta) => ta.agentId));
  const availableAgents = allAgents.filter((a) => !existingAgentIds.has(a.id));

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push("/teams")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-foreground">{team.name}</h1>
          {team.description && (
            <p className="text-sm text-muted-foreground">{team.description}</p>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={handleDeleteTeam}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {tab === "agents" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowAddAgent(!showAddAgent)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Agent
            </Button>
          </div>

          {showAddAgent && availableAgents.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <p className="text-sm text-muted-foreground">Select an agent to add:</p>
              {availableAgents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => handleAddAgent(agent.id)}
                  className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm text-foreground hover:bg-secondary/50 transition-colors"
                >
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: agent.color }}
                  />
                  {agent.name}
                </button>
              ))}
            </div>
          )}

          {teamAgents.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No agents in this team yet</p>
          ) : (
            teamAgents.map((ta) => (
              <div
                key={ta.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: ta.agent?.color || "#3b82f6" }}
                  >
                    {ta.agent?.name?.charAt(0) || "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {ta.agent?.name || "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground">{ta.role}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveAgent(ta.agentId)}
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "files" && (
        <div className="space-y-4">
          {mdFiles.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No files yet</p>
          ) : (
            mdFiles.map((file) => (
              <div key={file.id} className="rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">
                      {file.fileKey}.md
                    </span>
                    <span className="text-xs text-muted-foreground">v{file.version}</span>
                  </div>
                  {editingFile === file.fileKey ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditingFile(null)}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={() => handleSaveFile(file.fileKey)}>
                        Save
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingFile(file.fileKey);
                        setEditContent(file.content);
                      }}
                    >
                      Edit
                    </Button>
                  )}
                </div>
                <div className="p-4">
                  {editingFile === file.fileKey ? (
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full min-h-[200px] rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                    />
                  ) : (
                    <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                      {file.content || "(empty)"}
                    </pre>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "memory" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search team memories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <Button size="sm" onClick={handleSearch} disabled={searching}>
              {searching ? "..." : "Search"}
            </Button>
          </div>

          {searchResults.length > 0 ? (
            <div className="space-y-2">
              {searchResults.map((mem) => (
                <div
                  key={mem.id}
                  className="rounded-lg border border-border bg-card p-3 space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-primary px-1.5 py-0.5 rounded bg-primary/10">
                      {mem.memoryType}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      score: {typeof mem.score === "number" ? mem.score.toFixed(3) : mem.score}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{mem.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Search for team memories using semantic search
            </p>
          )}
        </div>
      )}

      {tab === "daily" && (
        <div className="space-y-3">
          {dailyFiles.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No daily logs yet</p>
          ) : (
            dailyFiles.map((df) => (
              <div key={df.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">{df.date}</span>
                  <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-secondary">
                    {df.status}
                  </span>
                </div>
                <pre className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {df.content}
                </pre>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
