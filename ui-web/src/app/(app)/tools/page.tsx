"use client";

import { useState, useEffect } from "react";
import {
  Wrench,
  Globe,
  Calculator,
  Code2,
  Image,
  Calendar,
  Mail,
  Search,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Tool } from "@/lib/types";

const TOOL_ICON_MAP: Record<string, LucideIcon> = {
  globe: Globe,
  calculator: Calculator,
  "code-2": Code2,
  image: Image,
  calendar: Calendar,
  mail: Mail,
  wrench: Wrench,
  search: Search,
};

const CATEGORY_COLORS: Record<string, string> = {
  search: "#3b82f6",
  utility: "#22c55e",
  developer: "#8b5cf6",
  creative: "#ec4899",
  productivity: "#eab308",
};

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    api
      .listTools()
      .then(setTools)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const categories = [
    "all",
    ...Array.from(new Set(tools.map((t) => t.category))),
  ];

  const filtered = tools.filter((t) => {
    if (selectedCategory !== "all" && t.category !== selectedCategory)
      return false;
    if (
      searchQuery &&
      !t.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !t.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6 px-6 md:px-12 py-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Tools</h1>
        <p className="text-sm text-muted-foreground">
          Browse available tools that extend your agents&apos; capabilities.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-none">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full sm:w-[280px] rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md border transition-colors capitalize",
                selectedCategory === cat
                  ? "bg-secondary border-primary/50 text-foreground"
                  : "bg-transparent border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-border bg-card p-5 space-y-3"
            >
              <div className="h-10 w-10 bg-secondary rounded-lg" />
              <div className="h-4 bg-secondary rounded w-24" />
              <div className="h-3 bg-secondary/50 rounded w-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Wrench className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No tools found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((tool) => {
            const Icon = TOOL_ICON_MAP[tool.icon] || Wrench;
            const color = CATEGORY_COLORS[tool.category] || "#6b7280";
            return (
              <div
                key={tool.id}
                className="group rounded-xl border border-border bg-card hover:border-muted-foreground/30 transition-colors p-5 space-y-3"
              >
                <div
                  className="h-10 w-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${color}15` }}
                >
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {tool.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {tool.description}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize"
                    style={{
                      backgroundColor: `${color}15`,
                      color,
                    }}
                  >
                    {tool.category}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full",
                      tool.isActive
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {tool.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
