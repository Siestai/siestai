"use client";

import { useState } from "react";
import {
  Headphones,
  Code2,
  Sparkles,
  MessageSquare,
  Brain,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SkillTemplate {
  id: string;
  label: string;
  description: string;
  category: string;
  Icon: LucideIcon;
  color: string;
  instructions: string;
}

const SKILL_TEMPLATES: SkillTemplate[] = [
  {
    id: "customer-support",
    label: "Customer Support",
    description: "Friendly, helpful support agent.",
    category: "conversational",
    Icon: Headphones,
    color: "#22c55e",
    instructions:
      "You are a friendly and professional customer support agent. Your goal is to help users resolve their issues quickly and efficiently. Always be empathetic, ask clarifying questions when needed, and provide step-by-step solutions. If you cannot resolve an issue, clearly explain next steps and escalation options.",
  },
  {
    id: "code-reviewer",
    label: "Code Reviewer",
    description: "Technical code feedback.",
    category: "technical",
    Icon: Code2,
    color: "#3b82f6",
    instructions:
      "You are an expert code reviewer. Analyze code snippets for bugs, security vulnerabilities, performance issues, and style improvements. Provide specific, actionable feedback with code examples.",
  },
  {
    id: "creative-writer",
    label: "Creative Writer",
    description: "Compelling stories and content.",
    category: "creative",
    Icon: Sparkles,
    color: "#8b5cf6",
    instructions:
      "You are a creative writer with a vivid imagination. Help users craft compelling stories, poetry, marketing copy, and other creative content. Adapt your tone and style to match the user's needs.",
  },
  {
    id: "debate-partner",
    label: "Debate Partner",
    description: "Argue positions thoughtfully.",
    category: "debate",
    Icon: MessageSquare,
    color: "#ef4444",
    instructions:
      "You are a skilled debate partner. Take a clear position on topics and argue it persuasively using logic, evidence, and rhetoric. Challenge the user's arguments respectfully.",
  },
  {
    id: "research-assistant",
    label: "Research Assistant",
    description: "Synthesize information clearly.",
    category: "technical",
    Icon: Brain,
    color: "#3b82f6",
    instructions:
      "You are a meticulous research assistant. Help users explore topics in depth by breaking down complex subjects into clear explanations. Organize information logically and highlight key takeaways.",
  },
  {
    id: "personal-coach",
    label: "Personal Coach",
    description: "Set and achieve goals.",
    category: "conversational",
    Icon: Zap,
    color: "#eab308",
    instructions:
      "You are an encouraging personal coach. Help users set clear, achievable goals and create actionable plans to reach them. Ask powerful questions that promote self-reflection.",
  },
];

interface SkillsSectionProps {
  currentInstructions: string;
  onApply: (updates: {
    instructions: string;
    category?: string;
    color?: string;
  }) => void;
}

export function SkillsSection({
  currentInstructions,
  onApply,
}: SkillsSectionProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const activeTemplate = SKILL_TEMPLATES.find(
    (t) => t.instructions === currentInstructions
  );

  const handleApply = (template: SkillTemplate) => {
    if (
      currentInstructions.trim().length > 0 &&
      currentInstructions !== template.instructions &&
      confirmId !== template.id
    ) {
      setConfirmId(template.id);
      return;
    }

    setConfirmId(null);
    onApply({
      instructions: template.instructions,
      category: template.category,
      color: template.color,
    });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.15em]">
        Skills
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {SKILL_TEMPLATES.map((template) => {
          const Icon = template.Icon;
          const isActive = activeTemplate?.id === template.id;
          const isConfirming = confirmId === template.id;

          return (
            <button
              key={template.id}
              onClick={() => handleApply(template)}
              className={cn(
                "flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors",
                isActive
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card/50 hover:border-muted-foreground/50"
              )}
            >
              <div className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5" style={{ color: template.color }} />
                <span className="text-xs font-medium text-foreground">
                  {template.label}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {template.description}
              </p>
              {isConfirming && (
                <p className="text-[11px] text-amber-400">
                  Click again to apply
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
