"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAgentDialog({
  open,
  onOpenChange,
}: CreateAgentDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && instructions.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || saving) return;

    setSaving(true);
    setError(null);

    try {
      const agent = await api.createAgent({
        name: name.trim(),
        instructions: instructions.trim(),
      });
      onOpenChange(false);
      setName("");
      setInstructions("");
      router.push(`/agents/${agent.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create agent"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Agent</DialogTitle>
          <DialogDescription>
            Give your agent a name and personality. You can configure everything
            else after.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-name">Name</Label>
            <Input
              id="create-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Atlas"
              maxLength={100}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-instructions">System Prompt</Label>
            <Textarea
              id="create-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="You are a helpful assistant that..."
              rows={5}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {instructions.length} characters
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Agent
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
