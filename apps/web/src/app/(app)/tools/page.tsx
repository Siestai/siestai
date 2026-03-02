"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Wrench,
  Globe,
  Calculator,
  Code2,
  Image,
  Calendar,
  Mail,
  Search,
  Github,
  ExternalLink,
  Unplug,
  Key,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToolDetailDialog } from "@/components/tools/tool-detail-dialog";
import type { ToolWithStatus } from "@/lib/types";

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

const CATEGORY_COLORS: Record<string, string> = {
  search: "#3b82f6",
  research: "#3b82f6",
  utility: "#22c55e",
  developer: "#8b5cf6",
  development: "#8b5cf6",
  creative: "#ec4899",
  productivity: "#eab308",
  communication: "#f97316",
};

function StatusBadge({ tool }: { tool: ToolWithStatus }) {
  if (tool.type === "api_key") {
    return (
      <span
        className={cn(
          "text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1",
          tool.connected
            ? "bg-emerald-500/10 text-emerald-400"
            : "bg-amber-500/10 text-amber-400"
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tool.connected ? "bg-emerald-400" : "bg-amber-400"
          )}
        />
        {tool.connected ? "Configured" : "API Key Required"}
      </span>
    );
  }

  if (tool.type === "oauth") {
    return (
      <span
        className={cn(
          "text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1",
          tool.connected
            ? "bg-emerald-500/10 text-emerald-400"
            : "bg-secondary text-muted-foreground"
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tool.connected ? "bg-emerald-400" : "bg-muted-foreground"
          )}
        />
        {tool.connected ? "Connected" : "Not Connected"}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "text-[10px] px-2 py-0.5 rounded-full",
        tool.isActive
          ? "bg-emerald-500/10 text-emerald-400"
          : "bg-secondary text-muted-foreground"
      )}
    >
      {tool.isActive ? "Active" : "Inactive"}
    </span>
  );
}

export default function ToolsPage() {
  const [tools, setTools] = useState<ToolWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Detail dialog state
  const [selectedTool, setSelectedTool] = useState<ToolWithStatus | null>(null);

  // API key config dialog state
  const [apiKeyDialog, setApiKeyDialog] = useState<ToolWithStatus | null>(null);
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [apiKeySaving, setApiKeySaving] = useState(false);

  // Disconnecting state
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const loadTools = useCallback(async () => {
    try {
      const data = await api.listToolsWithStatus();
      setTools(data);
    } catch {
      // failed
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTools();
  }, [loadTools]);

  const handleOAuthConnect = (slug: string) => {
    window.location.href = api.getOAuthConnectUrl(slug);
  };

  const handleOAuthDisconnect = async (slug: string) => {
    setDisconnecting(slug);
    try {
      await api.disconnectToolOAuth(slug);
      await loadTools();
    } catch {
      // failed
    } finally {
      setDisconnecting(null);
    }
  };

  const handleApiKeySave = async () => {
    if (!apiKeyDialog || !apiKeyValue.trim()) return;
    setApiKeySaving(true);
    try {
      await api.configureTool(apiKeyDialog.slug, { apiKey: apiKeyValue.trim() });
      setApiKeyDialog(null);
      setApiKeyValue("");
      await loadTools();
    } catch {
      // failed
    } finally {
      setApiKeySaving(false);
    }
  };

  const categories = [
    "all",
    ...Array.from(new Set(tools.map((t) => t.category))),
  ];

  const filtered = tools.filter((t) => {
    if (selectedCategory !== "all" && t.category !== selectedCategory)
      return false;
    if (
      searchQuery &&
      !t.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !t.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6 px-6 md:px-12 py-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Tools</h1>
        <p className="text-sm text-muted-foreground">
          Browse available tools that extend your agents&apos; capabilities.
          Connect OAuth accounts or configure API keys to get started.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-none">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full sm:w-[280px] rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md border transition-colors capitalize",
                selectedCategory === cat
                  ? "bg-secondary border-primary/50 text-foreground"
                  : "bg-transparent border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-border bg-card p-5 space-y-3"
            >
              <div className="h-10 w-10 bg-secondary rounded-lg" />
              <div className="h-4 bg-secondary rounded w-24" />
              <div className="h-3 bg-secondary/50 rounded w-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Wrench className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No tools found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((tool) => {
            const Icon = TOOL_ICON_MAP[tool.icon] || Wrench;
            const color = CATEGORY_COLORS[tool.category] || "#6b7280";
            const isDisconnecting = disconnecting === tool.slug;
            return (
              <div
                key={tool.id}
                className="group rounded-xl border border-border bg-card hover:border-muted-foreground/30 transition-colors p-5 flex flex-col gap-3 cursor-pointer"
                onClick={() => setSelectedTool(tool)}
              >
                <div className="flex items-start justify-between">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${color}15` }}
                  >
                    <Icon className="h-5 w-5" style={{ color }} />
                  </div>
                  <StatusBadge tool={tool} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {tool.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {tool.description}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-auto pt-1">
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize"
                    style={{
                      backgroundColor: `${color}15`,
                      color,
                    }}
                  >
                    {tool.category}
                  </span>

                  {/* Action buttons */}
                  {tool.type === "oauth" && !tool.connected && (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOAuthConnect(tool.slug);
                      }}
                    >
                      <ExternalLink className="h-3 w-3" />
                      Connect
                    </Button>
                  )}
                  {tool.type === "oauth" && tool.connected && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOAuthDisconnect(tool.slug);
                      }}
                      disabled={isDisconnecting}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      {isDisconnecting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Unplug className="h-3 w-3" />
                      )}
                      Disconnect
                    </Button>
                  )}
                  {tool.type === "api_key" && !tool.connected && (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setApiKeyDialog(tool);
                        setApiKeyValue("");
                      }}
                    >
                      <Key className="h-3 w-3" />
                      Configure
                    </Button>
                  )}
                  {tool.type === "api_key" && tool.connected && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setApiKeyDialog(tool);
                        setApiKeyValue("");
                      }}
                      className="text-muted-foreground"
                    >
                      <Key className="h-3 w-3" />
                      Reconfigure
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tool Detail Dialog */}
      <ToolDetailDialog
        tool={selectedTool}
        open={selectedTool !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedTool(null);
        }}
        icon={
          selectedTool
            ? TOOL_ICON_MAP[selectedTool.icon] || Wrench
            : Wrench
        }
        color={
          selectedTool
            ? CATEGORY_COLORS[selectedTool.category] || "#6b7280"
            : "#6b7280"
        }
        onConnect={(slug) => {
          setSelectedTool(null);
          handleOAuthConnect(slug);
        }}
        onDisconnect={async (slug) => {
          await handleOAuthDisconnect(slug);
          setSelectedTool((prev) =>
            prev ? { ...prev, connected: false } : null
          );
        }}
        onConfigureApiKey={(tool) => {
          setSelectedTool(null);
          setApiKeyDialog(tool);
          setApiKeyValue("");
        }}
        isDisconnecting={disconnecting === selectedTool?.slug}
      />

      {/* API Key Configuration Dialog */}
      <Dialog
        open={apiKeyDialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setApiKeyDialog(null);
            setApiKeyValue("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configure {apiKeyDialog?.name}</DialogTitle>
            <DialogDescription>
              Enter your API key to enable {apiKeyDialog?.name} for your agents.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Enter API key..."
              value={apiKeyValue}
              onChange={(e) => setApiKeyValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleApiKeySave();
              }}
            />
            <p className="text-xs text-muted-foreground">
              Your API key is encrypted and stored securely.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setApiKeyDialog(null);
                setApiKeyValue("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApiKeySave}
              disabled={!apiKeyValue.trim() || apiKeySaving}
            >
              {apiKeySaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
