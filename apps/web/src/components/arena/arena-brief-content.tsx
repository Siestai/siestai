"use client";

import {
  CheckCircle2,
  ListTodo,
  HelpCircle,
  MessageCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ArenaSessionBrief } from "@/lib/types";

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  medium: "bg-primary/15 text-primary border-primary/20",
  low: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
};

export function ArenaBriefContent({ brief }: { brief: ArenaSessionBrief }) {
  const isEmpty =
    brief.decisions.length === 0 &&
    brief.actionItems.length === 0 &&
    brief.unresolved.length === 0 &&
    brief.nextSessionQuestions.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <MessageCircle className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">
          No structured insights were extracted from this session.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {brief.decisions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.15em]">
              Decisions
            </h3>
          </div>
          <div className="space-y-2">
            {brief.decisions.map((d, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-card/50 p-4 flex items-start justify-between gap-3"
              >
                <p className="text-sm text-foreground leading-relaxed">
                  {d.text}
                </p>
                <Badge
                  variant="outline"
                  className={`shrink-0 text-[10px] ${CONFIDENCE_COLORS[d.confidence] || CONFIDENCE_COLORS.medium}`}
                >
                  {d.confidence}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}

      {brief.actionItems.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.15em]">
              Action Items
            </h3>
          </div>
          <div className="space-y-2">
            {brief.actionItems.map((item, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-card/50 p-4 flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{item.task}</p>
                  {item.deadline && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Due: {item.deadline}
                    </p>
                  )}
                </div>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {item.owner}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}

      {brief.unresolved.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-yellow-400" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.15em]">
              Unresolved Topics
            </h3>
          </div>
          <div className="space-y-2">
            {brief.unresolved.map((item, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-card/50 p-4"
              >
                <p className="text-sm font-medium text-foreground mb-2">
                  {item.topic}
                </p>
                {item.positions.length > 0 && (
                  <ul className="space-y-1">
                    {item.positions.map((pos, j) => (
                      <li
                        key={j}
                        className="text-xs text-muted-foreground pl-3 border-l-2 border-border"
                      >
                        {pos}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {brief.nextSessionQuestions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-purple-400" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.15em]">
              Questions for Next Session
            </h3>
          </div>
          <div className="rounded-lg border border-border bg-card/50 p-4">
            <ul className="space-y-2">
              {brief.nextSessionQuestions.map((q, i) => (
                <li
                  key={i}
                  className="text-sm text-foreground flex items-start gap-2"
                >
                  <span className="text-muted-foreground mt-0.5 shrink-0">
                    &bull;
                  </span>
                  {q}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
