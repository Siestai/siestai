"use client";

import { use, useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Loader2,
  CheckCircle2,
  ListTodo,
  HelpCircle,
  MessageCircle,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getArenaSessionBrief } from "@/lib/arena-api";
import type { ArenaSessionBrief } from "@/lib/types";

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  medium: "bg-primary/15 text-primary border-primary/20",
  low: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
};

export default function SessionBriefPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [brief, setBrief] = useState<ArenaSessionBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const retryRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchBrief() {
      try {
        const result = await getArenaSessionBrief(id);
        if (cancelled) return;

        if (result) {
          setBrief(result);
          setLoading(false);
          if (retryRef.current) {
            clearInterval(retryRef.current);
            retryRef.current = null;
          }
        } else {
          // Still processing — retry every 3s
          if (!retryRef.current) {
            retryRef.current = setInterval(async () => {
              try {
                const r = await getArenaSessionBrief(id);
                if (cancelled) return;
                if (r) {
                  setBrief(r);
                  setLoading(false);
                  if (retryRef.current) {
                    clearInterval(retryRef.current);
                    retryRef.current = null;
                  }
                }
              } catch {
                // keep retrying
              }
            }, 3000);
          }
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load brief");
        setLoading(false);
      }
    }

    fetchBrief();

    return () => {
      cancelled = true;
      if (retryRef.current) {
        clearInterval(retryRef.current);
        retryRef.current = null;
      }
    };
  }, [id]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-8">
        <Link
          href="/arena"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ChevronLeft className="h-4 w-4" />
          Arena
        </Link>
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-8">
        <Link
          href="/arena"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ChevronLeft className="h-4 w-4" />
          Arena
        </Link>
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">
            Generating session brief...
          </p>
          <p className="text-xs text-muted-foreground/60">
            AI is extracting key insights from the session
          </p>
        </div>
      </div>
    );
  }

  if (!brief) return null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 space-y-8">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/arena"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Arena
        </Link>
        <p className="text-xs text-muted-foreground">
          {new Date(brief.createdAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Session Brief
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Key takeaways extracted from the session
        </p>
      </div>

      {/* Decisions */}
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

      {/* Action Items */}
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

      {/* Unresolved Topics */}
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

      {/* Next Session Questions */}
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

      {/* Empty state */}
      {brief.decisions.length === 0 &&
        brief.actionItems.length === 0 &&
        brief.unresolved.length === 0 &&
        brief.nextSessionQuestions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <MessageCircle className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              No structured insights were extracted from this session.
            </p>
          </div>
        )}
    </div>
  );
}
