# Plan: Agent Creation Wizard

**Status:** Ready
**Date:** 2026-03-01
**Tasks:** records/tasks/0006-agent-creation-wizard.json

## Problem

The current agent creation flow is a plain single-page dialog (`AgentFormDialog`) that dumps all fields at once — no guidance, no test-before-save, no live feedback. Users can't try their agent before committing, and there's no activity visible on the dashboard after creation.

## Decision

Replace the "New Agent" dialog with a dedicated 4-step wizard page at `/agents/new`. The wizard walks through Identity → Instructions & Model → Skills Templates → Test Run (live streaming chat). After confirming the agent works, it saves to the backend. The dashboard gains a live activity feed polling `/activity`.

## Architecture

```
/agents/new  (4-step wizard)
  Step 1 – Identity         → name, description, color, category, icon
  Step 2 – Instructions     → system prompt (textarea), LLM model selector
  Step 3 – Skills / Templates → pick a starter template (pre-fills instructions)
  Step 4 – Test Run         → streaming chat via POST /agents/preview/stream (SSE)
                             → "Save Agent" button triggers POST /agents

Backend additions
  POST /agents/preview/stream   AgentPreviewController → @mastra/core Agent.stream()
  GET  /activity                ActivityController → in-memory ring buffer per user_id

Dashboard (/page.tsx)
  ActivityFeed component  →  polls GET /activity every 5 s
```

## Phases

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1, 2 | Backend: AgentPreviewModule (SSE streaming) + ActivityModule (ring buffer) |
| 2 | 3, 4, 5 | Frontend: Wizard shell + layout + steps 1-3 + types/API |
| 3 | 6, 7 | Frontend: Step 4 (test run) + wire agents page + dashboard activity feed |
| 4 | — | Removed: E2E screenshots (not suitable for headless loop) |

## Reference Files

- `ui-web/src/components/agents/agent-form-dialog.tsx` — form fields + API calls to replicate in wizard
- `ui-web/src/app/(app)/agents/page.tsx` — "New Agent" button to redirect to `/agents/new`
- `ui-web/src/lib/api.ts` — add `previewStream()` and `getActivity()` methods
- `ui-web/src/lib/types.ts` — add `ActivityEvent`, `AgentPreviewRequest` types
- `backend/src/agents/agents.service.ts` — inject ActivityService, fire `agent_created` event
- `backend/src/agents/agents.module.ts` — existing module (no changes needed, ActivityModule is @Global)
- `backend/src/app.module.ts` — import ActivityModule + AgentPreviewModule
- `mastra/src/agents/runtime.ts` — `createRuntimeAgent()` pattern to replicate in backend preview service

## Constraints

- `@mastra/core` is NOT currently a backend dependency — must be added via `pnpm add @mastra/core`
- `@mastra/core@1.8.0` ships dual CJS/ESM (`.cjs` + `.js` exports) — works with NestJS `nodenext` module resolution without dynamic imports
- Mastra's `registerApiRoute` bundler bug means no custom Mastra routes; streaming is handled by the backend directly
- SSE streaming from POST endpoint: NestJS `@Post` with `@Res() res: Response`, manual `res.write()` loop; frontend uses `fetch` + `ReadableStream`
- Activity feed is in-memory only (resets on backend restart); no DB migration needed
- Edit agent stays as the existing `AgentFormDialog` dialog — wizard is create-only
- `source` field defaults to `'mastra'` in the wizard (not exposed to user); matches existing behavior
- Backend uses `crypto.randomUUID()` (Node 22) for activity event IDs — no extra packages needed
- `uuid` package is already installed in backend but `crypto.randomUUID()` is preferred (built-in)

## Non-Goals

- Replacing the edit agent dialog with a wizard
- Persisting activity events across backend restarts
- WebSocket / push-based activity feed (polling is sufficient)
- Mastra tool integration in agent preview (Mastra Agent without tools)
- Saving the draft wizard state across page refreshes
- E2E browser screenshots (manual verification after implementation)

## Gotchas

- NestJS `@Sse()` only works with GET; for POST streaming use `@Res() res: Response` + manual headers, not `@Sse()`
- `agent.stream()` from `@mastra/core` returns `StreamTextResult`; iterate via `result.textStream` (AsyncIterable)
- Agent preview doesn't save to DB — it's a throwaway Agent instance with the wizard's current config
- After `res.end()`, writing further SSE chunks throws; wrap in try/finally
- Templates in Step 3 pre-fill instructions — if user already wrote custom instructions in Step 2, show a confirmation before overwriting
- Dashboard `page.tsx` is currently a Server Component; adding polling requires adding `ActivityFeed` as a `"use client"` client island (dashboard page stays Server Component)
- The agents page uses `AgentFormDialog` for BOTH create and edit — when removing it for create, keep the edit flow using the same dialog (re-open for edit with `editAgent` set)
- Backend global AuthGuard protects all routes by default — no extra `@UseGuards()` needed on new controllers
- `@Session()` decorator provides the user session in NestJS controllers (from `@thallesp/nestjs-better-auth`)
