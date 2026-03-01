"use client";

import { useState, useRef, useEffect } from "react";
import {
  Bot,
  Brain,
  Sparkles,
  Zap,
  MessageSquare,
  Code2,
  type LucideIcon,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { AGENT_CARD_COLORS } from "@/lib/types";
import type { Agent, UpdateAgentData } from "@/lib/types";

const ICON_MAP: Record<string, LucideIcon> = {
  bot: Bot,
  brain: Brain,
  sparkles: Sparkles,
  zap: Zap,
  "message-square": MessageSquare,
  "code-2": Code2,
};

const ICON_OPTIONS = Object.entries(ICON_MAP);

interface AgentHeaderProps {
  agent: Agent;
  onUpdate: (field: keyof UpdateAgentData, value: string) => void;
  onUpdateMultiple: (updates: UpdateAgentData) => void;
}

export function AgentHeader({ agent, onUpdate, onUpdateMultiple }: AgentHeaderProps) {
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName && nameRef.current) {
      nameRef.current.focus();
      nameRef.current.select();
    }
  }, [editingName]);

  useEffect(() => {
    if (editingDesc && descRef.current) {
      descRef.current.focus();
      descRef.current.select();
    }
  }, [editingDesc]);

  const Icon = ICON_MAP[agent.icon] || Bot;

  return (
    <div className="flex items-start gap-5">
      {/* Avatar with popover picker */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="group relative h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 transition-all hover:scale-105 hover:shadow-lg cursor-pointer"
            style={{ backgroundColor: agent.color }}
          >
            <Icon className="h-8 w-8 text-white" />
            <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <span className="text-white text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                Edit
              </span>
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Icon
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {ICON_OPTIONS.map(([key, IconComp]) => (
                <button
                  key={key}
                  onClick={() => onUpdate("icon", key)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
                    agent.icon === key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                  )}
                >
                  <IconComp className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Color
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {AGENT_CARD_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => onUpdate("color", c)}
                  className={cn(
                    "h-8 w-8 rounded-full border-2 transition-all",
                    agent.color === c
                      ? "border-foreground scale-110"
                      : "border-transparent hover:border-muted-foreground/50"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Name + Description */}
      <div className="flex-1 min-w-0 space-y-1">
        {editingName ? (
          <input
            ref={nameRef}
            defaultValue={agent.name}
            maxLength={100}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== agent.name) onUpdate("name", v);
              setEditingName(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setEditingName(false);
            }}
            className="text-2xl font-semibold text-foreground bg-transparent border-b border-primary/50 outline-none w-full pb-0.5"
          />
        ) : (
          <h1
            onClick={() => setEditingName(true)}
            className="text-2xl font-semibold text-foreground cursor-text hover:text-primary/90 transition-colors"
          >
            {agent.name}
          </h1>
        )}

        {editingDesc ? (
          <input
            ref={descRef}
            defaultValue={agent.description}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== agent.description) onUpdate("description", v);
              setEditingDesc(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setEditingDesc(false);
            }}
            className="text-sm text-muted-foreground bg-transparent border-b border-primary/30 outline-none w-full pb-0.5"
            placeholder="Add a description..."
          />
        ) : (
          <p
            onClick={() => setEditingDesc(true)}
            className="text-sm text-muted-foreground cursor-text hover:text-foreground/80 transition-colors"
          >
            {agent.description || "Add a description..."}
          </p>
        )}
      </div>
    </div>
  );
}
