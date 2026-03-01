"use client";

import { useState } from "react";
import {
  Headphones,
  Code2,
  Sparkles,
  MessageSquare,
  Brain,
  Zap,
  Pencil,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StepSkillsProps {
  currentInstructions: string;
  onChange: (updates: {
    instructions: string;
    category?: string;
    color?: string;
    icon?: string;
  }) => void;
}

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
    description: "Friendly, helpful support agent that resolves issues efficiently.",
    category: "conversational",
    Icon: Headphones,
    color: "#22c55e",
    instructions:
      "You are a friendly and professional customer support agent. Your goal is to help users resolve their issues quickly and efficiently. Always be empathetic, ask clarifying questions when needed, and provide step-by-step solutions. If you cannot resolve an issue, clearly explain next steps and escalation options.",
  },
  {
    id: "code-reviewer",
    label: "Code Reviewer",
    description: "Technical reviewer that provides actionable code feedback.",
    category: "technical",
    Icon: Code2,
    color: "#3b82f6",
    instructions:
      "You are an expert code reviewer. Analyze code snippets for bugs, security vulnerabilities, performance issues, and style improvements. Provide specific, actionable feedback with code examples. Prioritize issues by severity and always explain the reasoning behind your suggestions. Follow industry best practices and common design patterns.",
  },
  {
    id: "creative-writer",
    label: "Creative Writer",
    description: "Imaginative writer that crafts compelling stories and content.",
    category: "creative",
    Icon: Sparkles,
    color: "#8b5cf6",
    instructions:
      "You are a creative writer with a vivid imagination. Help users craft compelling stories, poetry, marketing copy, and other creative content. Adapt your tone and style to match the user's needs — from formal business writing to casual blog posts. Offer multiple variations when appropriate and explain your creative choices.",
  },
  {
    id: "debate-partner",
    label: "Debate Partner",
    description: "Articulate debater that argues positions thoughtfully.",
    category: "debate",
    Icon: MessageSquare,
    color: "#ef4444",
    instructions:
      "You are a skilled debate partner. Take a clear position on topics and argue it persuasively using logic, evidence, and rhetoric. Challenge the user's arguments respectfully while acknowledging strong points. Present counterarguments fairly and help the user strengthen their reasoning. Always maintain intellectual honesty and distinguish between facts and opinions.",
  },
  {
    id: "research-assistant",
    label: "Research Assistant",
    description: "Thorough researcher that synthesizes information clearly.",
    category: "technical",
    Icon: Brain,
    color: "#3b82f6",
    instructions:
      "You are a meticulous research assistant. Help users explore topics in depth by breaking down complex subjects into clear explanations. Organize information logically, cite relevant concepts, and highlight key takeaways. When uncertain, clearly state limitations and suggest areas for further investigation. Provide balanced perspectives on controversial topics.",
  },
  {
    id: "personal-coach",
    label: "Personal Coach",
    description: "Motivational coach that helps set and achieve goals.",
    category: "conversational",
    Icon: Zap,
    color: "#eab308",
    instructions:
      "You are an encouraging personal coach. Help users set clear, achievable goals and create actionable plans to reach them. Ask powerful questions that promote self-reflection. Celebrate progress, provide accountability, and offer practical strategies for overcoming obstacles. Adapt your coaching style to each user's personality and needs while maintaining a positive, motivating tone.",
  },
];

export function StepSkills({ currentInstructions, onChange }: StepSkillsProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const handleTemplateClick = (template: SkillTemplate) => {
    const hasExisting =
      currentInstructions.trim().length > 0 &&
      currentInstructions !== template.instructions;

    if (hasExisting && confirmId !== template.id) {
      setConfirmId(template.id);
      return;
    }

    setSelectedId(template.id);
    setConfirmId(null);
    onChange({
      instructions: template.instructions,
      category: template.category,
      color: template.color,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Skills Templates
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a starter template to pre-fill instructions, or keep your own.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Custom / Keep My Instructions */}
        <button
          type="button"
          onClick={() => {
            setSelectedId(null);
            setConfirmId(null);
          }}
          className={cn(
            "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors",
            selectedId === null
              ? "border-cyan-400 bg-cyan-400/5"
              : "border-border bg-card/50 hover:border-muted-foreground/50"
          )}
        >
          <div className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium text-foreground">Custom</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Keep my own instructions as-is.
          </p>
        </button>

        {/* Template tiles */}
        {SKILL_TEMPLATES.map((template) => {
          const Icon = template.Icon;
          const isSelected = selectedId === template.id;
          const isConfirming = confirmId === template.id;

          return (
            <button
              key={template.id}
              type="button"
              onClick={() => handleTemplateClick(template)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors",
                isSelected
                  ? "border-cyan-400 bg-cyan-400/5"
                  : "border-border bg-card/50 hover:border-muted-foreground/50"
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5" style={{ color: template.color }} />
                <span className="font-medium text-foreground">
                  {template.label}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground capitalize">
                  {template.category}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {template.description}
              </p>
              {isConfirming && (
                <p className="text-xs text-amber-400 mt-1">
                  This will replace your instructions. Click again to confirm.
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
