"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Agent } from "@/lib/types";

interface DeleteAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: Agent;
  onDeleted: () => void;
}

export function DeleteAgentDialog({
  open,
  onOpenChange,
  agent,
  onDeleted,
}: DeleteAgentDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await api.deleteAgent(agent.id);
      onDeleted();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete agent");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Agent</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{agent.name}</strong>? This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
