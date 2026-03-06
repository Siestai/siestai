"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  History,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Users,
  Clock,
  Calendar,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { listArenaSessions } from "@/lib/arena-api";
import type {
  ArenaSessionSummary,
  PaginatedArenaSessions,
  ParticipationMode,
} from "@/lib/types";

export function ArenaHistory() {
  const router = useRouter();
  const [data, setData] = useState<PaginatedArenaSessions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [participationMode, setParticipationMode] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listArenaSessions({
        search: debouncedSearch || undefined,
        participationMode: (participationMode as ParticipationMode) || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        status: "ended",
        page,
        limit: 20,
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, participationMode, dateFrom, dateTo, page]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by topic..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-secondary border-border"
        />
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={participationMode}
          onChange={(e) => {
            setParticipationMode(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-border bg-secondary px-3 text-sm text-foreground"
        >
          <option value="">All modes</option>
          <option value="human_collab">Human Collaboration</option>
          <option value="agent_only">Agent Only</option>
        </select>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-md border border-border bg-secondary px-2 text-sm text-foreground"
          />
          <span>to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-md border border-border bg-secondary px-2 text-sm text-foreground"
          />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="text-center py-12 text-muted-foreground">
          <p>{error}</p>
          <Button variant="ghost" size="sm" onClick={fetchSessions} className="mt-2">
            Retry
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && data && data.data.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <History className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No sessions found</p>
        </div>
      )}

      {/* Session cards */}
      {!loading && !error && data && data.data.length > 0 && (
        <div className="space-y-3">
          {data.data.map((session) => (
            <button
              key={session.id}
              onClick={() => router.push(`/arena/history/${session.id}`)}
              className="w-full text-left rounded-xl border border-border bg-card p-4 hover:bg-card/80 hover:border-border/80 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-foreground truncate">
                      {session.topic || "Untitled Session"}
                    </h3>
                    {session.teamName && (
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {session.teamName}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {session.participantCount} participant{session.participantCount !== 1 ? "s" : ""}
                    </span>
                    {session.durationMinutes && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {session.durationMinutes} min
                      </span>
                    )}
                    <span>{formatDate(session.createdAt)}</span>
                  </div>
                  {session.participantNames.length > 0 && (
                    <p className="text-xs text-muted-foreground/70 mt-1 truncate">
                      {session.participantNames.slice(0, 4).join(", ")}
                      {session.participantNames.length > 4 &&
                        ` +${session.participantNames.length - 4} more`}
                    </p>
                  )}
                </div>
                <Badge
                  variant="secondary"
                  className="shrink-0 text-[10px] capitalize"
                >
                  {session.participationMode === "human_collab"
                    ? "Collab"
                    : "Agent Only"}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && data && totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
