"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import type { Agent, UpdateAgentData } from "@/lib/types";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function useAgentEditor(id: string) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingUpdates = useRef<UpdateAgentData>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.getAgent(id);
        if (!cancelled) setAgent(data);
      } catch {
        // agent not found
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const flush = useCallback(async () => {
    const updates = { ...pendingUpdates.current };
    pendingUpdates.current = {};

    if (Object.keys(updates).length === 0) return;

    setSaveStatus("saving");
    try {
      const updated = await api.updateAgent(id, updates);
      setAgent(updated);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 2000);
    } catch {
      setSaveStatus("error");
    }
  }, [id]);

  const updateField = useCallback(
    (field: keyof UpdateAgentData, value: UpdateAgentData[keyof UpdateAgentData]) => {
      setAgent((prev) => (prev ? { ...prev, [field]: value } as Agent : prev));
      pendingUpdates.current = { ...pendingUpdates.current, [field]: value };

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(flush, 800);
    },
    [flush]
  );

  const updateFields = useCallback(
    (updates: UpdateAgentData) => {
      setAgent((prev) => (prev ? { ...prev, ...updates } as Agent : prev));
      pendingUpdates.current = { ...pendingUpdates.current, ...updates };

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(flush, 800);
    },
    [flush]
  );

  const saveNow = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    flush();
  }, [flush]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAgent(id);
      setAgent(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return {
    agent,
    loading,
    saveStatus,
    updateField,
    updateFields,
    saveNow,
    reload,
  };
}
