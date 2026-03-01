"use client";

import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { AGENT_CATEGORIES, AGENT_CARD_COLORS } from "@/lib/types";
import type { Agent, AgentSource, CreateAgentData } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AgentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent?: Agent;
  onSaved: () => void;
}

const SOURCES: { value: AgentSource; label: string }[] = [
  { value: "mastra", label: "Mastra" },
  { value: "livekit", label: "LiveKit" },
  { value: "external", label: "External" },
];

export function AgentFormDialog({
  open,
  onOpenChange,
  agent,
  onSaved,
}: AgentFormDialogProps) {
  const isEdit = !!agent;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [category, setCategory] = useState("conversational");
  const [color, setColor] = useState<string>(AGENT_CARD_COLORS[0]);
  const [icon, setIcon] = useState("bot");
  const [source, setSource] = useState<AgentSource>("mastra");
  const [llmModel, setLlmModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (agent) {
        setName(agent.name);
        setDescription(agent.description || "");
        setInstructions(agent.instructions);
        setCategory(agent.category);
        setColor(agent.color);
        setIcon(agent.icon);
        setSource(agent.source);
        setLlmModel(agent.llmModel || "");
      } else {
        setName("");
        setDescription("");
        setInstructions("");
        setCategory("conversational");
        setColor(AGENT_CARD_COLORS[0]);
        setIcon("bot");
        setSource("mastra");
        setLlmModel("");
      }
      setError(null);
    }
  }, [open, agent]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const data: CreateAgentData = {
      name: name.trim(),
      instructions: instructions.trim(),
      description: description.trim(),
      category,
      color,
      icon: icon.trim() || "bot",
      source,
      llmModel: llmModel.trim() || undefined,
    };

    try {
      if (isEdit) {
        await api.updateAgent(agent.id, data);
      } else {
        await api.createAgent(data);
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save agent");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Agent" : "Create Agent"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the agent configuration."
              : "Configure a new AI agent."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="agent-name">Name *</Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Atlas"
              maxLength={100}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="agent-description">Description</Label>
            <Input
              id="agent-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short description of what this agent does"
            />
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <Label htmlFor="agent-instructions">Instructions *</Label>
            <Textarea
              id="agent-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="System prompt / instructions for the agent..."
              rows={4}
              required
            />
          </div>

          {/* Category + Source row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
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
            <div className="space-y-2">
              <Label>Source</Label>
              <Select value={source} onValueChange={(v) => setSource(v as AgentSource)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Color picker */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {AGENT_CARD_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-8 w-8 rounded-full border-2 transition-all",
                    color === c
                      ? "border-foreground scale-110"
                      : "border-transparent hover:border-muted-foreground/50"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Icon + LLM Model row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="agent-icon">Icon</Label>
              <Input
                id="agent-icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="bot"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-llm">LLM Model</Label>
              <Input
                id="agent-llm"
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                placeholder="openai/gpt-4.1-mini"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* Footer */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Saving..."
                : isEdit
                  ? "Update Agent"
                  : "Create Agent"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
