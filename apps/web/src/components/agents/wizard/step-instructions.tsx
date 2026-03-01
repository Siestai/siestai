"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StepInstructionsProps {
  value: {
    instructions: string;
    llmModel: string;
  };
  onChange: (updates: Partial<StepInstructionsProps["value"]>) => void;
}

const LLM_MODELS = [
  { value: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6 (Recommended)" },
  { value: "anthropic/claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (Fast)" },
  { value: "openai/gpt-4.1", label: "GPT-4.1" },
  { value: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini" },
];

export function StepInstructions({ value, onChange }: StepInstructionsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Instructions &amp; Model
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Define your agent&apos;s behavior with a system prompt and pick a model.
        </p>
      </div>

      {/* System Prompt */}
      <div className="space-y-2">
        <Label htmlFor="wizard-instructions">System Prompt *</Label>
        <Textarea
          id="wizard-instructions"
          value={value.instructions}
          onChange={(e) => onChange({ instructions: e.target.value })}
          placeholder="You are a helpful assistant that..."
          rows={10}
          required
        />
        <p className="text-xs text-muted-foreground">
          {value.instructions.length} characters
        </p>
      </div>

      {/* LLM Model */}
      <div className="space-y-2">
        <Label>LLM Model</Label>
        <Select
          value={value.llmModel}
          onValueChange={(v) => onChange({ llmModel: v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LLM_MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
