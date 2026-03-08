"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Bot,
  Loader2,
  Users,
  FileText,
  Brain,
  Calendar,
  Plus,
  X,
  Search,
  Trash2,
  Video,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AddAgentDialog } from "@/components/teams/add-agent-dialog";
import { AgentIcon } from "@/components/teams/agent-icon";
import { listArenaSessions } from "@/lib/arena-api";
import type { Team, TeamAgent, MdFile, DailyMemoryFile, MemorySearchResult, Agent, ArenaSessionSummary } from "@/lib/types";

type Tab = "agents" | "files" | "memory" | "daily" | "meetings";

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
  const [removingAgent, setRemovingAgent] = useState<TeamAgent | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  // Delete team
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  // Meetings tab
  const [meetings, setMeetings] = useState<ArenaSessionSummary[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);

  useEffect(() => {
    loadTeam();
  }, [id]);

  useEffect(() => {
    if (!team) return;
    if (tab === "agents") loadAgents();
    if (tab === "files") loadFiles();
    if (tab === "daily") loadDaily();
    if (tab === "meetings") loadMeetings();
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

  async function loadMeetings() {
    setMeetingsLoading(true);
    try {
      const result = await listArenaSessions({ teamId: id, limit: 50 });
      setMeetings(result.data);
    } catch {
      setMeetings([]);
    } finally {
      setMeetingsLoading(false);
    }
  }

  async function handleAddAgent(agentId: string) {
    await api.addTeamAgent(id, agentId);
    setShowAddAgent(false);
    await loadAgents();
  }

  async function handleRemoveAgent() {
    if (!removingAgent) return;
    setRemoveLoading(true);
    try {
      await api.removeTeamAgent(id, removingAgent.agentId);
      setRemovingAgent(null);
      await loadAgents();
    } finally {
      setRemoveLoading(false);
    }
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
    setDeleteLoading(true);
    try {
      await api.deleteTeam(id);
      router.push("/teams");
    } finally {
      setDeleteLoading(false);
    }
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
    { key: "meetings", label: "Meetings", icon: Video },
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
        <Button variant="ghost" size="icon" onClick={() => setShowDeleteConfirm(true)}>
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
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { if (allAgents.length === 0) loadAgents(); setShowAddAgent(true); }}>
              <Plus className="h-4 w-4 mr-1" />
              Add Agent
            </Button>
          </div>

          {teamAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No agents in this team yet</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                Add agents to start collaborating
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {teamAgents.map((ta) => {
                const color = ta.agent?.color || "#22d3ee";
                return (
                  <div
                    key={ta.id}
                    className="group relative flex flex-col items-center gap-2.5 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:bg-secondary/20"
                  >
                    <button
                      type="button"
                      onClick={() => setRemovingAgent(ta)}
                      className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
                      title="Remove from team"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
                      style={{ backgroundColor: `${color}20`, color }}
                      onClick={() => router.push(`/agents/${ta.agentId}`)}
                    >
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="text-center min-w-0 w-full">
                      <p
                        className="text-sm font-medium text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                        onClick={() => router.push(`/agents/${ta.agentId}`)}
                      >
                        {ta.agent?.name || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{ta.role}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <AddAgentDialog
            open={showAddAgent}
            onOpenChange={setShowAddAgent}
            availableAgents={availableAgents}
            loading={allAgents.length === 0}
            onAdd={handleAddAgent}
          />

          <Dialog open={!!removingAgent} onOpenChange={(open) => !open && setRemovingAgent(null)}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Remove Agent</DialogTitle>
                <DialogDescription>
                  Are you sure you want to remove{" "}
                  <span className="font-medium text-foreground">
                    {removingAgent?.agent?.name || "this agent"}
                  </span>{" "}
                  from the team?
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setRemovingAgent(null)}
                  disabled={removeLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleRemoveAgent}
                  disabled={removeLoading}
                >
                  {removeLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Remove
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {tab === "meetings" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => router.push(`/arena?team_id=${id}`)}>
              <Video className="h-4 w-4 mr-1" />
              Start Meeting
            </Button>
          </div>

          {meetingsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : meetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Video className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No meetings yet</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                Start your first team meeting in the Arena
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {meetings.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => router.push(`/arena/history/${session.id}`)}
                  className="w-full text-left rounded-lg border border-border bg-card p-4 hover:border-primary/30 hover:bg-secondary/20 transition-all"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-foreground truncate max-w-[60%]">
                      {session.topic || "Untitled meeting"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        session.status === "ended"
                          ? "bg-muted text-muted-foreground"
                          : session.status === "active"
                            ? "bg-green-500/15 text-green-400"
                            : "bg-yellow-500/15 text-yellow-400"
                      }`}>
                        {session.status}
                      </span>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                        {session.participationMode === "human_collab" ? "Collab" : "Observe"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{new Date(session.createdAt).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {session.participantCount}
                    </span>
                    {session.durationMinutes != null && (
                      <span>{session.durationMinutes} min</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
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

      {/* Delete team confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={(open) => !open && setShowDeleteConfirm(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Team</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">{team.name}</span>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteTeam}
              disabled={deleteLoading}
            >
              {deleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
