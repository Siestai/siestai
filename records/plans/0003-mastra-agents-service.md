# Plan: Mastra Agents Service

**Status:** Proposed
**Date:** 2026-02-27
**Tasks:** records/tasks/0003-mastra-agents-service.json

## Problem
The Agents page is entirely mock data — hardcoded agents in `ui-web/src/lib/api.ts` with no backend persistence. Users can't create, edit, or delete agents. The arena setup wizard Step 1 (agent selection) is non-functional because there are no real agents to select from. There's no agent runtime framework — the LiveKit voice agent has inline logic with no structured tool/agent composition.

## Decision
Add a **Mastra service** (`mastra/`) to the monorepo as the agent runtime and management layer. Mastra provides a TypeScript-native agent framework with tools, structured output, and a built-in server. Use **PostgreSQL + Drizzle** as the persistence layer for agent definitions (CRUD). The NestJS backend proxies agent CRUD to the Mastra service, and the frontend replaces mock data with real API calls. Arena setup wizard Step 1 fetches real agents for selection and passes them as `nativeAgents` to session creation.

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
                                          │  (Drizzle ORM)  │
                                          └────────────────┘
```

**Flow:**
1. User creates/edits agents on the Agents page → Frontend calls Backend
2. Backend proxies to Mastra service (`/api/agents` REST)
3. Mastra service persists agent configs in PostgreSQL via Drizzle
4. Arena setup Step 1 fetches agent list → user selects agents → passed as `nativeAgents`
5. Mastra agents are available as runtime instances (for future: arena voice agent reads agent config from Mastra)

## Reference Files
- `ui-web/src/app/agents/page.tsx` — agents list page (currently uses mock data)
- `ui-web/src/app/agents/[id]/page.tsx` — agent detail page
- `ui-web/src/lib/api.ts` — API client with mock agents (lines 18-160)
- `ui-web/src/lib/types.ts` — Agent interface definition
- `ui-web/src/components/agents/agent-card.tsx` — agent card component
- `ui-web/src/app/arena/page.tsx` — arena setup Step 1 (non-functional agent selection)
- `backend/src/app.module.ts` — NestJS root module
- `backend/src/arena/arena.service.ts` — createSession (nativeAgents param)

## Phases

### Phase 1: Mastra Service Setup
Initialize the Mastra service in the monorepo with PostgreSQL + Drizzle. Create the database schema for agent definitions. Set up the Mastra server with agent CRUD endpoints.

### Phase 2: Backend Agent Module
Add an `agents` module to the NestJS backend that proxies CRUD operations to the Mastra service. Endpoints: list, get, create, update, delete agents.

### Phase 3: Frontend — Replace Mock Data
Replace the mock API client with real backend calls. Wire up the Agents page, agent detail page, and add a Create/Edit Agent form.

### Phase 4: Arena Agent Selection
Make arena setup Step 1 functional — fetch real agents, allow selection, pass selected agents as `nativeAgents` to session creation with their instructions.

### Phase 5: Seed Agents
Create 3-4 default agents (Atlas, Nova, Sage, Debate Bot) via a seed script so the platform has agents out of the box for testing.

## Constraints
- Mastra service runs on port 4111 (default)
- PostgreSQL connection via `DATABASE_URL` env var
- Agent schema must include: id, name, description, instructions, category, tags, color, icon, voice config, model config
- The existing `Agent` TypeScript interface in `types.ts` is the source of truth for the agent shape
- Mastra agents are config-only for now — runtime tool execution comes in a future plan
- Keep the NestJS backend as the API gateway — frontend never calls Mastra directly

## Non-Goals
- Agent runtime tool execution (tools, MCP, workflows) — future plan
- Voice configuration (TTS/STT provider selection) — already exists in the Agent type, just persist it
- Agent analytics/call tracking — future
- Agent versioning — future
- Authentication/authorization — no auth for staging

## Gotchas
- **Mastra's built-in agent API** serves agents registered in the Mastra instance. For CRUD, we need a custom REST layer on top of Drizzle, not Mastra's agent registry (which is in-memory). Mastra's `Agent` class is for runtime; persistence is separate.
- **Drizzle schema** must match the frontend `Agent` interface closely to avoid mapping boilerplate.
- **`pnpm create mastra`** scaffolds a project with opinions — we may need to restructure to fit our monorepo layout.
- **PostgreSQL** — need to add to docker-compose.staging.yml and ensure connection works in dev (local postgres or docker).
- **Arena integration** — when selecting agents in Step 1, we need both the agent `name` and `instructions` to pass as `nativeAgents` to `createSession`. The instructions feed into the LiveKit room metadata → ArenaAgent persona system prompt.
