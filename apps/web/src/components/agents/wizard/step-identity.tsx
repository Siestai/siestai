"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AGENT_CATEGORIES, AGENT_CARD_COLORS } from "@/lib/types";
import {
  Bot,
  Brain,
  Sparkles,
  Zap,
  MessageSquare,
  Code2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StepIdentityProps {
  value: {
    name: string;
    description: string;
    category: string;
    color: string;
    icon: string;
  };
  onChange: (updates: Partial<StepIdentityProps["value"]>) => void;
}

const ICON_OPTIONS: { value: string; Icon: LucideIcon }[] = [
  { value: "bot", Icon: Bot },
  { value: "brain", Icon: Brain },
  { value: "sparkles", Icon: Sparkles },
  { value: "zap", Icon: Zap },
  { value: "message-square", Icon: MessageSquare },
  { value: "code-2", Icon: Code2 },
];

export function StepIdentity({ value, onChange }: StepIdentityProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Identity</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Give your agent a name, look, and category.
        </p>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="wizard-name">Name *</Label>
        <Input
          id="wizard-name"
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. Atlas"
          maxLength={100}
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="wizard-desc">Description</Label>
        <Input
          id="wizard-desc"
          value={value.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="A short description of what this agent does"
        />
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label>Category</Label>
        <div className="flex flex-wrap gap-2">
          {AGENT_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => onChange({ category: cat.value })}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-full border transition-colors",
                value.category === cat.value
                  ? "bg-cyan-400/15 border-cyan-400 text-cyan-400"
                  : "bg-transparent border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex gap-2">
          {AGENT_CARD_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ color: c })}
              className={cn(
                "h-8 w-8 rounded-full border-2 transition-all",
                value.color === c
                  ? "border-cyan-400 scale-110"
                  : "border-transparent hover:border-muted-foreground/50"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Icon */}
      <div className="space-y-2">
        <Label>Icon</Label>
        <div className="flex gap-2">
          {ICON_OPTIONS.map(({ value: iconVal, Icon }) => (
            <button
              key={iconVal}
              type="button"
              onClick={() => onChange({ icon: iconVal })}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg border transition-colors",
                value.icon === iconVal
                  ? "border-cyan-400 bg-cyan-400/10 text-cyan-400"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
