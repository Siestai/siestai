"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bot,
  ChevronLeft,
  MessageSquare,
  Mic,
  Users,
  Loader2,
  Settings,
  FileText,
  Brain,
  Calendar,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAgentEditor } from "@/hooks/use-agent-editor";
import { AgentHeader } from "@/components/agents/detail/agent-header";
import { ModelSection } from "@/components/agents/detail/model-section";
import { FilesSection } from "@/components/agents/detail/files-section";
import { ToolsSection } from "@/components/agents/detail/tools-section";
import { SkillsSection } from "@/components/agents/detail/skills-section";
import { SettingsSection } from "@/components/agents/detail/settings-section";
import { ChatPanel } from "@/components/agents/chat/chat-panel";
import { api } from "@/lib/api";
import type { AgentFile, MdFile, DailyMemoryFile, MemorySearchResult } from "@/lib/types";

type Tab = "overview" | "files" | "memory" | "daily";

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { agent, loading, saveStatus, updateField, updateFields, saveNow } =
    useAgentEditor(id);
  const [uploadedFiles, setUploadedFiles] = useState<AgentFile[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");

  // Files tab
  const [mdFiles, setMdFiles] = useState<MdFile[]>([]);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [mdLoading, setMdLoading] = useState(false);

  // Memory tab
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemorySearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Daily tab
  const [dailyFiles, setDailyFiles] = useState<DailyMemoryFile[]>([]);
  const [dailyLoading, setDailyLoading] = useState(false);

  useEffect(() => {
    api.listAgentFiles(id).then(setUploadedFiles).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!agent) return;
    if (tab === "files") loadMdFiles();
    if (tab === "daily") loadDailyFiles();
  }, [tab, agent]);

  async function loadMdFiles() {
    setMdLoading(true);
    try {
      const files = await api.getAgentMdFiles(id);
      setMdFiles(files);
    } catch {
      // ignore
    } finally {
      setMdLoading(false);
    }
  }

  async function loadDailyFiles() {
    setDailyLoading(true);
    try {
      const files = await api.getAgentDailyFiles(id);
      setDailyFiles(files);
    } catch {
      // ignore
    } finally {
      setDailyLoading(false);
    }
  }

  async function handleSaveFile(fileKey: string) {
    await api.updateAgentMdFile(id, fileKey, editContent);
    setEditingFile(null);
    await loadMdFiles();
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await api.searchAgentMemories(id, searchQuery);
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Bot className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-medium">Agent not found</h2>
        <Button asChild variant="outline">
          <Link href="/agents">Back to Agents</Link>
        </Button>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: typeof Settings }[] = [
    { key: "overview", label: "Overview", icon: Settings },
    { key: "files", label: "Files", icon: FileText },
    { key: "memory", label: "Memory", icon: Brain },
    { key: "daily", label: "Daily Log", icon: Calendar },
  ];

  return (
    <>
      <div className="px-6 py-8 max-w-3xl mx-auto space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/agents"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Agents
          </Link>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => router.push(`/arena?agent_ids=${agent.id}`)}
            >
              <Users className="h-3.5 w-3.5" />
              Arena
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                router.push(
                  `/live?agent_id=${agent.id}&agent_name=${encodeURIComponent(agent.name)}`
                )
              }
            >
              <Mic className="h-3.5 w-3.5" />
              Voice
            </Button>
            <Button
              variant={chatOpen ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setChatOpen(!chatOpen)}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Chat
            </Button>
          </div>
        </div>

        {/* Header: avatar + name + description */}
        <AgentHeader
          agent={agent}
          onUpdate={updateField}
          onUpdateMultiple={updateFields}
        />

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
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
        {tab === "overview" && (
          <div className="space-y-8 divide-y divide-border [&>*:not(:first-child)]:pt-8">
            <ModelSection
              model={agent.llmModel}
              onUpdate={(value) => updateField("llmModel", value)}
            />
            <FilesSection
              agentId={agent.id}
              files={uploadedFiles}
              onFilesChange={setUploadedFiles}
            />
            <ToolsSection agentId={agent.id} />
            <SkillsSection
              currentInstructions={agent.instructions}
              onApply={(updates) => updateFields(updates)}
            />
            <SettingsSection agent={agent} onUpdate={updateField} />
          </div>
        )}

        {tab === "files" && (
          <div className="space-y-4">
            {mdLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
              </div>
            ) : mdFiles.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">
                No markdown files yet. They will be created automatically when the agent is used.
              </p>
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
                  placeholder="Search agent memories..."
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
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-primary/15 text-primary border-primary/20"
                      >
                        {mem.memoryType}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        score: {typeof mem.score === "number" ? mem.score.toFixed(3) : mem.score}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{mem.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-12">
                Search for agent memories using semantic search
              </p>
            )}
          </div>
        )}

        {tab === "daily" && (
          <div className="space-y-3">
            {dailyLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
              </div>
            ) : dailyFiles.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">
                No daily logs yet. They are created after arena sessions.
              </p>
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

      {/* Backdrop overlay (mobile & desktop) */}
      {chatOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm md:hidden"
          onClick={() => setChatOpen(false)}
        />
      )}

      {/* Right sidebar chat panel */}
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-[420px] border-l border-border bg-background shadow-2xl transition-transform duration-300 ease-in-out ${
          chatOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <ChatPanel
          agentId={id}
          agentName={agent.name}
          onClose={() => setChatOpen(false)}
        />
      </aside>
    </>
  );
}
