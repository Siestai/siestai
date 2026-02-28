# Plan: Mastra Agent Registration — Every Internal Agent = Mastra Agent

**Status:** Proposed
**Date:** 2026-03-01
**Tasks:** records/tasks/0007-mastra-agent-registration.json

## Problem
When users create agents through the UI wizard, the agent is saved as a plain database row. No Mastra `Agent` instance is registered, so there is no tracing, no memory, no tool binding, and no Mastra-managed lifecycle. The preview service creates throwaway `new Agent()` instances per-request that are immediately discarded. The Mastra singleton only knows about a hardcoded `defaultAgent`. This means we get none of Mastra's observability, agent discovery, or runtime features.

## Decision
Introduce a **MastraRegistryService** in the NestJS backend that owns the Mastra singleton and manages a live registry of Mastra `Agent` instances. On startup, it loads all `source='mastra'` agents from the DB and calls `mastra.addAgent()`. On CRUD operations, it syncs the registry (add/remove/re-create). All agent execution (preview, chat, arena) goes through the registry instead of creating throwaway instances. This keeps the backend as the single orchestrator — the standalone Mastra service on :4111 is not involved in this change.

## Architecture
```
                         NestJS Backend (:4200)
                    ┌─────────────────────────────────┐
                    │  MastraRegistryService           │
                    │  ┌───────────────────────────┐   │
                    │  │ Mastra singleton           │   │
 POST /agents ─────│──│  .addAgent(agent)          │   │
 PUT  /agents/:id ─│──│  .removeAgent(id)          │   │
 DEL  /agents/:id ─│──│  .getAgent(key)            │   │
                    │  │  .listAgents()             │   │
                    │  │                            │   │
                    │  │  Registry:                 │   │
                    │  │   atlas → Agent instance   │   │
                    │  │   nova  → Agent instance   │   │
                    │  │   user1-bot → Agent inst.  │   │
                    │  └───────────────────────────┘   │
                    │                │                  │
  GET /agents/      │  AgentsService │ (DB CRUD)       │
  preview/stream ───│──AgentPreviewService             │
                    │    uses registry.getAgent(id)    │
                    └────────────────┬─────────────────┘
                                     │
                              ┌──────▼──────┐
                              │  PostgreSQL  │
                              │  agents tbl  │
                              └─────────────┘
```

### Key design choices
1. **Registry lives in backend** — not the standalone Mastra :4111 service. Backend already has `@mastra/core` as a dependency and does all CRUD.
2. **Agents are immutable** — Mastra `Agent` instances can't be mutated after construction. On update, we `removeAgent()` + `addAgent()` with fresh config.
3. **Only `source='mastra'` agents get registered** — `livekit` and `external` agents are not Mastra agents.
4. **Agent key = DB id** — consistent lookup between DB and Mastra registry.

## Reference Files
- `backend/src/agents/agents.service.ts` — current DB CRUD, must call registry after mutations
- `backend/src/agents/agents.module.ts` — wire new MastraRegistryService
- `backend/src/agents/preview/agent-preview.service.ts` — replace throwaway Agent with registry lookup
- `mastra/src/agents/runtime.ts` — existing `createRuntimeAgent()`, will be moved/adapted into registry
- `mastra/src/mastra/index.ts` — current Mastra singleton (only defaultAgent)
- `mastra/src/db/schema.ts` — Agent DB type used to construct runtime agents
- `backend/src/app.module.ts` — module imports

## Constraints
- `@mastra/core` is already in backend's package.json (^1.8.0)
- `mastra.addAgent()` **silently skips** if key already exists (logs debug, returns void) — must `removeAgent()` first on updates, otherwise the new config is ignored
- `mastra.getAgent()` **throws `MastraError`** if agent not found (does NOT return null) — always wrap in try/catch or check `listAgents()` first
- `mastra.removeAgent()` returns `boolean` — safe to call even if not found (returns false)
- `addAgent()` calls `__registerMastra(this)` + `__registerPrimitives({ logger, storage, agents, tts, vectors })` — this is what connects the agent to the Mastra runtime (tracing, storage, inter-agent comms)
- Mastra `Agent` constructor requires `id`, `name`, `instructions`, `model` — all in our DB schema
- Agent instances are immutable — no `.setInstructions()` etc.

## Non-Goals
- Observability/tracing configuration (separate plan — this lays the groundwork)
- Agent memory or tool binding (future — registry enables it)
- Changes to the standalone Mastra service on :4111
- Changes to the UI wizard steps
- Multi-tenant isolation of Mastra instances (single shared registry for now)

## Gotchas
- **Startup race condition**: `AgentsService` already uses `OnModuleInit` to create its pg Pool. `MastraRegistryService` should use `OnApplicationBootstrap` (fires after all `OnModuleInit`) so the Pool is guaranteed ready before loading agents.
- **Update = destroy + recreate**: Since `addAgent()` silently skips duplicates, `updateAgent()` MUST call `removeAgent(id)` before `addAgent()`. Order matters — if reversed, the new agent is silently ignored.
- **`getAgent()` throws**: Never call `mastra.getAgent(id)` without a try/catch. The plan's `getAgent()` wrapper must catch `MastraError` and return `null` for missing agents. Do NOT use `mastra.getAgent()` directly in service code.
- **Seed agents have `user_id IS NULL`**: The startup loader must query `WHERE source = 'mastra'` without filtering by `user_id` — seed agents and user agents both get registered.
- **`@mastra/pg` PostgresStore**: Don't instantiate in the backend registry — it's for Mastra's internal storage (threads, messages). Use `new Mastra({ agents: {} })` without storage for now. Storage can be added when we need memory/threads.
- **Agent key = DB UUID**: Use the DB `id` (UUID) as the Mastra key, not `name`, to avoid collisions on rename. This means `getAgent(id)` uses the UUID, matching what `addAgent(agent, record.id)` sets.
- **DB column naming**: The DB column is `llm_model` (snake_case) but the raw query rows return `llm_model` — the `createRuntimeAgent`-style function must map `row.llm_model` to `model` in the Agent constructor.
- **Preview controller route collision**: `AgentPreviewController` is also on `@Controller('agents')` and has `@Post('preview/stream')`. The new `@Get('registry/status')` in `AgentsController` is also `@Controller('agents')` — they won't collide (different methods + paths) but verify ordering.
