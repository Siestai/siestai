"use client";

import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentIconProps {
  agent: { name: string; color: string | null };
  size: "sm" | "md";
  onClick?: () => void;
}

const sizeStyles = {
  sm: "w-8 h-8 rounded-lg",
  md: "w-14 h-14 rounded-2xl",
} as const;

const iconSize = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
} as const;

export function AgentIcon({ agent, size, onClick }: AgentIconProps) {
  const color = agent.color || "#22d3ee";

  const className = cn(
    sizeStyles[size],
    "flex items-center justify-center shrink-0 transition-transform hover:scale-110",
    onClick ? "cursor-pointer" : "cursor-default"
  );
  const style = { backgroundColor: `${color}20`, color };

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={className}
        style={style}
        title={agent.name}
      >
        <Bot className={iconSize[size]} />
      </button>
    );
  }

  return (
    <div className={className} style={style} title={agent.name}>
      <Bot className={iconSize[size]} />
    </div>
  );
}
