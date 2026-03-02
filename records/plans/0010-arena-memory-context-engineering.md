# Plan: Arena Memory & Context Engineering

**Status:** Proposed
**Date:** 2026-03-02
**Tasks:** records/tasks/0010-arena-memory-context-engineering.json

## Problem

Arena sessions are ephemeral islands — agents start blank, conversations vanish at session end, and nothing carries forward. For recurring use cases (weekly standups, strategy sessions, design reviews) this is a dealbreaker. The marketing agent doesn't remember last week's "enterprise first" decision. The technical advisor forgot which architecture was approved. Research (arXiv:2602.19320) confirms episodic memory is the highest-value, lowest-implemented memory type across agent frameworks.

Currently: sessions live in an in-memory `Map`, transcripts are broadcast via WebSocket but never stored, agents get a fresh system prompt each time, and `@mastra/memory` is not installed despite `PostgresStore` being configured.

## Decision

Build a three-layer memory architecture anchored to the session lifecycle:

1. **Session persistence** — persist sessions, participants, and transcripts to PostgreSQL via Drizzle (prerequisite for everything else)
2. **Episodic memory** — at session end, run structured LLM extraction per-agent (positions, decisions, tasks, open questions); at session start, inject recent memories into the system prompt
3. **Session briefs** — extract structured outputs (decisions, action items, unresolved topics) visible in a post-session page

Use simple structured episodic extraction (not vector DB RAG) per the research finding that structured episodic memory outperforms generic vector retrieval for meeting context. Design for future `@mastra/memory` integration but ship independently first.

## Architecture

```
SESSION LIFECYCLE (new):

  Create Session
    → Persist to arena_sessions table (replaces in-memory Map)
    → Persist participants to arena_session_participants

  Start Session (arena.controller.ts → startSession)
    → Load agent memories from DB for each native_agent participant
    → Include per-agent memory blocks in room metadata (ArenaMetadata.agents[].memories)
    → Agent worker reads metadata, ArenaAgent injects memories into system prompt
    → Fallback: if metadata exceeds 60KB, agent worker fetches via HTTP

  During Session
    → Transcript POST endpoint saves to arena_transcripts table (alongside WS broadcast)
    → WS agent_message events also persisted to arena_transcripts

  End Session
    → Update arena_sessions.ended_at, status='ended'
    → Trigger extraction pipeline (async, fire-and-forget):
        For each native_agent participant:
          → LLM structured extraction (via Anthropic SDK / haiku):
            positions, decisions, tasks, open_questions
          → Store as agent_memories rows
        For session:
          → LLM structured extraction: decisions, action_items, unresolved, next_questions
          → Store as arena_session_briefs row

MEMORY SCOPING:
  ┌─────────────────────────────────┐
  │  Session Brief (shared)          │  → decisions, action items (all participants see)
  └─────────────────────────────────┘
           ▲               ▲
  ┌────────┴──────┐ ┌─────┴────────┐
  │ Agent A Memory │ │ Agent B Memory│  → private per-agent episodic memories
  │ (positions,    │ │ (positions,   │
  │  tasks, etc.)  │ │  tasks, etc.) │
  └───────────────┘ └──────────────┘
```

## Implementation Patterns (from codebase review)

**DB access:** Import `db` directly from `@siestai/db` (singleton, no DI injection needed). Same pattern as `AgentsService`:
```typescript
import { db, agents, eq } from '@siestai/db';
```

**NestJS module pattern:** Add new services to `ArenaModule.providers` array. `MastraModule` is `@Global()` so `MastraService` is injectable anywhere.

**LLM extraction:** MastraService only handles agent registry (register/unregister/get). It does NOT expose inference methods. For extraction, either:
- Use `@anthropic-ai/sdk` directly (simpler, recommended)
- Or use Mastra agent via `mastra.getAgent(id).generate()` from `instance.ts`

**Memory delivery to agent worker:** Room metadata has a 60KB hard limit (`livekit.service.ts:107`). Current metadata already includes agent instructions. Prefer embedding compact memory strings in metadata (`agents[].memories` field). If that pushes over 60KB, the agent worker falls back to HTTP fetch via `backendUrl`.

**ArenaService async migration:** All methods become `async` when switching to DB. The controller already uses `async startSession()`, but `createSession()`, `getSession()`, `endSession()` are currently sync — they must become async with `await`.

**Shared types barrel:** `packages/shared/src/index.ts` re-exports all type modules. New types go in `packages/shared/src/types/arena.ts` (extend existing) or `packages/shared/src/types/memory.ts` (new file). Must add exports to `packages/shared/src/index.ts`.

**DB barrel:** `packages/db/src/index.ts` re-exports from `./schema/index.js`. New schema files must be added to both `packages/db/src/schema/index.ts` AND `packages/db/src/index.ts`.

**Arena API (frontend):** `apps/web/src/lib/arena-api.ts` exists with standalone fetch functions (not ApiClient methods). New brief/memory endpoints follow same pattern.

## New Database Tables

```sql
-- Session persistence (replaces in-memory Map)
arena_sessions (id, topic, mode, participation_mode, status, room_name,
                created_by FK→user.id, started_at, ended_at, created_at)

arena_session_participants (id, session_id FK, agent_id FK nullable,
                            name, type, instructions, color, joined_at)

-- Transcript storage
arena_transcripts (id, session_id FK, speaker_name, speaker_type,
                   content, source, timestamp)

-- Per-agent episodic memory
agent_memories (id, agent_id FK, session_id FK, category, content,
                confidence, created_at, expires_at nullable)
  categories: decision, position, task, open_question, learning

-- Session-level structured output
arena_session_briefs (id, session_id FK UNIQUE, decisions jsonb,
                      action_items jsonb, unresolved jsonb,
                      next_session_questions jsonb, created_at)
```

## Reference Files

**Backend (apps/api):**
- `src/arena/arena.service.ts` — in-memory `Map<string, ArenaSession>` lifecycle → migrate to DB queries
- `src/arena/arena.controller.ts` — REST endpoints including `POST sessions/:id/transcript` (@AllowAnonymous, HttpCode 204)
- `src/arena/arena.gateway.ts` — WS gateway with `broadcastTranscript()`, `broadcastToSession()` helpers
- `src/arena/arena.module.ts` — providers: [ArenaService, InvitationService, ArenaGateway], imports: [LivekitModule]
- `src/arena/arena.interfaces.ts` — TypeScript interfaces for ArenaSession, ArenaParticipant (backend-only, mirrors shared types)
- `src/arena/dto/post-transcript.dto.ts` — `{ speaker: string, text: string, timestamp?: number }`
- `src/agents/agents.service.ts` — reference for DB access pattern (`import { db, agents, eq } from '@siestai/db'`)
- `src/agents/agents.module.ts` — reference for module structure (exports AgentsService)
- `src/livekit/livekit.service.ts` — `generateArenaToken()` builds room metadata JSON, 60KB limit enforced
- `src/mastra/mastra.service.ts` — agent registry only (register/unregister/get), no inference methods
- `src/mastra/instance.ts` — `mastra` singleton with PostgresStore, `mastra.getAgent()` could be used for extraction

**Agent worker (apps/agent):**
- `src/arena-agent.ts` — `ArenaAgent extends voice.Agent`, builds multi-persona system prompt, `ArenaMetadata` interface
- `src/main.ts` — `parseArenaMetadata()` at line 408, arena flow starts at line 513, `backendUrl` available at `arenaMetadata.backendUrl`

**Database (packages/db):**
- `src/schema/agents.ts` — agents table (FK target for agent_memories)
- `src/schema/index.ts` — barrel export for all schema files
- `src/index.ts` — package barrel: re-exports schema, db client, drizzle operators
- `drizzle/` — migration SQL files (generated by `drizzle-kit generate`)

**Shared types (packages/shared):**
- `src/types/arena.ts` — ArenaSession, ArenaParticipant, ArenaWsServerMessage types
- `src/index.ts` — barrel re-export of all type modules

**Frontend (apps/web):**
- `src/lib/arena-api.ts` — standalone fetch functions (createArenaSession, getArenaSession, joinArena)
- `src/lib/api.ts` — ApiClient class with request() helper (for agent endpoints)
- `src/app/(app)/arena/page.tsx` — arena main page with session lifecycle states

## Constraints

- Arena sessions currently live in a `Map<string, ArenaSession>` — migration to DB must be backward-compatible (API responses stay the same shape)
- ArenaAgent system prompt has 16K char limit (`MAX_SYSTEM_PROMPT_CHARS`) — memory injection must stay within budget alongside existing character instructions
- Agent worker (`apps/agent`) is a separate process — communicates with backend via HTTP/LiveKit only, no direct module imports
- LLM extraction at session end must be async (non-blocking) — don't delay session end response
- Memory architecture must work for both internal (Mastra) and future external agents
- `@mastra/memory` is NOT installed yet — this plan uses direct Drizzle queries for memory CRUD, not Mastra's memory processors
- PostgreSQL 16 with pgvector is available but vector features are deferred to a future plan

## Non-Goals

- Vector DB / semantic recall (RAG) — structured episodic memory first, per research findings
- Full `@mastra/memory` integration — design-compatible but ship independently
- Working memory (live scratchpad during session) — future enhancement
- ObservationalMemory compression — future for long sessions
- Agent-to-agent private messaging within memories — memories are per-agent, scoped
- Persistent chat history for 1:1 Live sessions (separate concern)
- UI for memory management/editing (admin feature, future)

## Gotchas

- **Transcript POST is `@AllowAnonymous()`** — the agent worker calls it without auth. Persisting transcripts means unauthenticated writes to DB. The existing `getSession(id)` call validates the session exists — keep this as minimum guard.
- **ArenaService methods become async** — `createSession()`, `getSession()`, `endSession()` are currently sync (Map lookups). All become `async` with DB queries. Every call site in `arena.controller.ts` and `arena.gateway.ts` must add `await`. The gateway's `handleClientMessage()` is sync — either make it async or use fire-and-forget for DB writes.
- **ArenaGateway uses ArenaService.getSession() heavily** — the gateway calls `getSession()` on every WS message (lines 60, 141, 180, 197). With DB, this becomes N queries per message. Consider a short-lived in-memory cache for active sessions (Map<string, ArenaSession> with 30s TTL) to avoid DB round-trips on hot paths.
- **Memory injection token budget** — with 3+ agents × 500+ char instructions, the 16K char prompt budget is partially consumed. Cap memory block at ~2000 chars total, leaving room for instructions. The existing truncation logic in ArenaAgent (line 113) handles overflow.
- **LLM extraction cost** — each session end triggers N+1 LLM calls (N per-agent + 1 session brief). Use `claude-haiku-4-5-20251001` or `gpt-4.1-mini` to control cost. Extraction is async fire-and-forget — errors logged but don't block session end.
- **Race condition on session end** — if multiple clients call end simultaneously, extraction pipeline could run twice. Use a DB-level status guard: `UPDATE arena_sessions SET status='ended' WHERE id=$1 AND status='active' RETURNING *` — only proceeds if the row was actually transitioned.
- **External agent memories** — external agents may not have an `agent_id` in our DB. Skip memory extraction for external agents initially. Store their transcript entries with `speaker_type='external_agent'` so they appear in session briefs.
- **Room metadata size** — 60KB hard limit enforced in `livekit.service.ts:107`. Current metadata averages 2-5KB. Adding per-agent memories (capped at 500 chars each) should stay well under. If it exceeds, agent worker fetches memories via HTTP from `backendUrl` instead.
- **Drizzle schema import path** — packages/db uses ESM with `.js` extensions in imports (e.g., `'./auth.js'`). New schema files must follow this pattern in `schema/index.ts` exports.
- **arena.interfaces.ts duplication** — backend has its own `ArenaSession`/`ArenaParticipant` interfaces that mirror `@siestai/shared` types. When adding DB-backed sessions, use Drizzle inferred types internally and map to the shared type shape for API responses.

## Research Backing

| Source | Key Finding | Relevance |
|--------|-------------|-----------|
| arXiv:2602.19320 (Anatomy of Agentic Memory) | Episodic memory is highest-value, lowest-implemented. Structured episodic beats vector RAG for meeting context. | Core justification for the approach |
| arXiv:2602.06053 (PersonaPlex) | Voice and role are independent axes | Informs future voice forge, not this plan |
| Anthropic Context Engineering Blog | Most agent failures are context failures, not prompt failures | Validates memory-first approach |
| Microsoft Multi-Agent Reference Architecture | Two-tier memory (private + shared) with access control | Informs scoping model |
| Mastra Memory Docs | Thread/Resource model, 4 processors, supervisor pattern | Future integration path |

## Phases

### Phase 1: Foundation (tasks 1-2, parallel)
- Task 1: Drizzle schema — arena_sessions, arena_session_participants, arena_transcripts, agent_memories, arena_session_briefs tables + migration
- Task 2: Shared types — ArenaTranscriptEntry, AgentMemory, ArenaSessionBrief in @siestai/shared

### Phase 2: Session Persistence (tasks 3-4, sequential — 4 depends on 3)
- Task 3: Migrate ArenaService from in-memory Map to DB — all CRUD methods become async, add session cache for gateway hot path
- Task 4: Persist transcripts — save to arena_transcripts in POST endpoint and WS message handler

### Phase 3: Extraction Pipeline + API (tasks 5-7, sequential — 6 depends on 5, 7 depends on 6)
- Task 5: MemoryExtractionService — install @anthropic-ai/sdk, build LLM extraction for agent memories and session briefs
- Task 6: Wire extraction to session end — triggerSessionEndExtraction() in ArenaService, async fire-and-forget
- Task 7: API endpoints — GET /arena/sessions/:id/brief, GET /agents/:id/memories

### Phase 4: Memory Injection + Frontend API (tasks 8-9, parallel)
- Task 8: Inject memories into ArenaAgent system prompt — load at session start, include in room metadata, render in prompt
- Task 9: Frontend API functions — getArenaSessionBrief(), getAgentMemories() in arena-api.ts and api.ts

### Phase 5: Frontend UI (tasks 10-11, parallel)
- Task 10: Session Brief page at /arena/sessions/[id]/brief — structured display of decisions, action items, unresolved
- Task 11: Agent memories section on agent detail page — episodic memory display with category badges

### Phase 6: E2E Verification (task 12)
- Task 12: Browser verification of brief page and agent memory display
