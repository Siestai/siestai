# Plan: Mastra Agents Service

**Status:** Proposed (v3 — refined after doc review + codebase audit)
**Date:** 2026-02-27
**Tasks:** records/tasks/0003-mastra-agents-service.json

## Problem
The Agents page is entirely mock data — hardcoded agents in `ui-web/src/lib/api.ts` with no backend persistence. Users can't create, edit, or delete agents. The arena setup wizard Step 1 (agent selection) is non-functional. There's no structured agent runtime framework.

## Decision
Add a **Mastra service** (`mastra/`) to the monorepo as the agent runtime and management layer. Use **PostgreSQL + Drizzle** for a custom `agents` table. Use **Mastra's built-in server** (Hono-based, port 4111) with `registerApiRoute()` for custom CRUD endpoints. Mastra auto-exposes `/api/agents/:agentId/stream` for registered agents. The NestJS backend proxies agent CRUD to the Mastra service. The arena agent picker fetches real agents and passes them to session creation.

## Voice Project Reference
The `Siestai/voice` repo has a mature arena implementation we should align with:
- **`AgentPicker`** — fetches agents from API, toggle-select UI with max 4, shows voice/category
- **`AgentConfigPanel`** — manual mode: name + voice + instructions per agent
- **`ArenaRoom`** — volume visualization, speaker detection, call timer, transcript sidebar
- **Arena page flow** — config mode toggle (agents vs manual), participation mode, duration picker, moderator option, topic input, provider settings

Our siestai arena should mirror this pattern but simplified for the current scope.

## Architecture
```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Frontend   │────▶│  Backend     │────▶│  Mastra Service  │
│  (Next.js)  │     │  (NestJS)    │     │  (Mastra Server) │
│  :3000      │     │  :4200       │     │  :4111           │
└─────────────┘     └──────────────┘     └──────────────────┘
                                                  │
                                          ┌───────▼────────┐
                                          │  PostgreSQL     │
                                          │  (Drizzle ORM   │
                                          │  + @mastra/pg)  │
                                          └────────────────┘
```

### How storage works
- **Custom `agents` table**: Managed by **Drizzle ORM** (`drizzle-orm` + `drizzle-kit`) with our own schema. This is independent of Mastra's internal storage.
- **Mastra internals** (memory, threads, workflow state): Managed by **`@mastra/pg` (`PostgresStore`)**, which auto-creates its own tables (`mastra_threads`, `mastra_messages`, etc.).
- Both use the same PostgreSQL database via `DATABASE_URL`.

### How the server works
- `mastra dev` starts a Hono server on port 4111
- Registered agents auto-get: `POST /api/agents/:agentId/stream` and `POST /api/agents/:agentId/generate`
- Custom CRUD routes added via `registerApiRoute()` in the Mastra config
- No need for separate Express/Hono setup

## Agent Schema (Core Fields — Day 1)

```typescript
enum AgentSource {
  MASTRA = 'mastra',      // Mastra runtime agent (internal)
  LIVEKIT = 'livekit',    // LiveKit voice agent
  EXTERNAL = 'external',  // External agent (OpenClaw, third-party)
}

interface Agent {
  id: string;               // uuid
  name: string;             // max 100 chars
  description: string;      // short description
  instructions: string;     // system prompt
  category: string;         // conversational, creative, technical, debate
  tags: string[];           // labels
  color: string;            // hex color for UI
  icon: string;             // icon name
  source: AgentSource;      // where this agent runs
  llm_model: string | null; // e.g. openai/gpt-4.1-mini
  is_online: boolean;       // availability flag
  created_at: string;
  updated_at: string;
}
```

Voice config fields (voice_id, tts_provider, stt_provider, etc.) deferred to a future plan.

## Mastra Agent Runtime
Mastra agents are registered in the `Mastra` instance. Once registered, they auto-expose streaming endpoints. For dynamic agents (loaded from DB), we create `Agent` instances at request time using `new Agent({ name, instructions, model })` and call `.stream()` directly. This enables:
- Chat with individual agents (Live page)
- Arena multi-agent conversations where each agent streams responses
- Future: tool use, MCP integration, workflows

## Phases

### Phase 1: Mastra Service Setup
Scaffold Mastra service, Drizzle schema with custom agents table + AgentSource enum, Mastra entry point with registered agents, custom CRUD routes via `registerApiRoute()`.

### Phase 2: Backend Agent Module
NestJS proxy module for agent CRUD + stream passthrough. Install `@nestjs/axios`.

### Phase 3: Frontend — Replace Mock Data
Real API client, create/edit/delete agents, update types (remove voice fields, add source).

### Phase 4: Arena Agent Selection
Wire AgentPicker into arena setup Step 1. Selected agents → `nativeAgents` with instructions to `createSession`.

### Phase 5: Infrastructure
PostgreSQL in docker-compose, seed agents, dev setup.

## Reference Files
- `ui-web/src/app/agents/page.tsx` — agents list (mock data)
- `ui-web/src/lib/api.ts` — mock API client
- `ui-web/src/lib/types.ts` — Agent interface (has voice fields to remove + call_count)
- `ui-web/src/components/agents/agent-card.tsx` — renders call_count, needs update
- `ui-web/src/app/arena/page.tsx` — arena setup (Step 1 placeholder, `canProceedFromStep(1)` always true)
- `ui-web/src/lib/arena-api.ts` — `CreateArenaSessionParams` has `nativeAgents` field
- `backend/src/arena/arena.service.ts` — `createSession` accepts `nativeAgents`
- `backend/src/arena/dto/create-arena-session.dto.ts` — `NativeAgentDto` has `agentId` field

## Non-Goals
- Voice config (TTS/STT provider, voice selection) — future plan
- Agent tool execution, MCP, workflows — future plan
- Agent analytics/call tracking — future
- Agent versioning — future
- Authentication — no auth for staging
