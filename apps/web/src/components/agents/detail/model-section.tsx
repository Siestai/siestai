"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LLM_MODELS = [
  { value: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6", tag: "Recommended" },
  { value: "anthropic/claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", tag: "Fast" },
  { value: "openai/gpt-4.1", label: "GPT-4.1", tag: null },
  { value: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini", tag: "Budget" },
];

interface ModelSectionProps {
  model: string | null;
  onUpdate: (value: string) => void;
}

export function ModelSection({ model, onUpdate }: ModelSectionProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.15em]">
        Model
      </h3>
      <Select
        value={model || LLM_MODELS[0].value}
        onValueChange={onUpdate}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LLM_MODELS.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              <span>{m.label}</span>
              {m.tag && (
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                  {m.tag}
                </span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
