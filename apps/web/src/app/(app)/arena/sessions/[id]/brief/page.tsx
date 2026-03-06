"use client";

import { use, useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { getArenaSessionBrief } from "@/lib/arena-api";
import { ArenaBriefContent } from "@/components/arena/arena-brief-content";
import type { ArenaSessionBrief } from "@/lib/types";

export default function SessionBriefPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [brief, setBrief] = useState<ArenaSessionBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const result = await getArenaSessionBrief(id);
        if (cancelled) return;

        if (result) {
          setBrief(result);
          setLoading(false);
        } else {
          // Still processing — schedule next poll after 3s
          timeoutRef.current = setTimeout(poll, 3000);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load brief");
        setLoading(false);
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
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

      <ArenaBriefContent brief={brief} />
    </div>
  );
}
