"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AGENT_CATEGORIES } from "@/lib/types";
import type { Agent, UpdateAgentData } from "@/lib/types";
import { api } from "@/lib/api";

interface SettingsSectionProps {
  agent: Agent;
  onUpdate: (field: keyof UpdateAgentData, value: UpdateAgentData[keyof UpdateAgentData]) => void;
}

export function SettingsSection({ agent, onUpdate }: SettingsSectionProps) {
  const router = useRouter();
  const [tagInput, setTagInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !agent.tags.includes(tag)) {
      onUpdate("tags", [...agent.tags, tag]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    onUpdate(
      "tags",
      agent.tags.filter((t) => t !== tag)
    );
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await api.deleteAgent(agent.id);
      router.push("/agents");
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="space-y-5">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.15em]">
        Settings
      </h3>

      {/* Category */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Category</label>
        <Select
          value={agent.category}
          onValueChange={(v) => onUpdate("category", v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGENT_CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Tags</label>
        <div className="flex flex-wrap gap-1.5">
          {agent.tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="gap-1 cursor-pointer hover:bg-destructive/20"
              onClick={() => removeTag(tag)}
            >
              {tag}
              <span className="text-muted-foreground">&times;</span>
            </Badge>
          ))}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            onBlur={addTag}
            placeholder="Add tag..."
            className="h-6 w-24 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
          />
        </div>
      </div>

      {/* Source (read-only display) */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Source</label>
        <p className="text-sm text-foreground capitalize">{agent.source}</p>
      </div>

      {/* Danger Zone */}
      <div className="pt-4 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          disabled={deleting}
          className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 mr-2" />
          )}
          {confirmDelete ? "Confirm delete" : "Delete Agent"}
        </Button>
      </div>
    </div>
  );
}
