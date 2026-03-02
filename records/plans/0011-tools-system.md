# Plan: Tools System — GitHub, Gmail, Web Search

**Status:** Proposed
**Date:** 2026-03-02
**Tasks:** records/tasks/0011-tools-system.json

## Problem

Agents currently have no ability to take actions beyond conversation. The `tools` and `agentTools` tables exist in the database but are empty shells — no tool definitions, no OAuth, no runtime execution. Users cannot give agents capabilities like searching the web, reading GitHub repos, or sending emails.

## Decision

Build a complete tools system with three initial tools (GitHub, Gmail, Tavily Web Search). Tools are defined as seed data with a registry pattern. OAuth credentials for tools (GitHub, Gmail) are stored in a **separate `toolCredentials` table** — not in Better Auth's `account` table, which is only for user login. At runtime, Mastra `createTool()` instances (from `@mastra/core/tools`) are constructed from DB config and injected into the preview streaming path. For the arena voice path, tools are described in room metadata and executed via HTTP proxy back to the backend (the voice worker cannot import Mastra).

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Frontend                                               │
│  /tools (marketplace) ─── browse, see status            │
│  /agents/[id] (detail) ── connect/disconnect tools      │
│                           configure tool (OAuth connect) │
└──────────────┬──────────────────────────────────────────┘
               │ REST
┌──────────────▼──────────────────────────────────────────┐
│  Backend (NestJS)                                       │
│                                                         │
│  ToolsModule                                            │
│  ├── ToolsController     — CRUD + OAuth callback        │
│  ├── ToolsService        — DB ops + credential lookup   │
│  ├── ToolRegistryService — Mastra createTool() factory  │
│  └── OAuthService        — token exchange + refresh     │
│                                                         │
│  Integration points:                                    │
│  ├── AgentPreviewService — inject tools into .stream()  │
│  └── ArenaController     — pass tools in room metadata  │
└──────────────┬──────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────┐
│  Database                                               │
│  tools           — tool catalog (seeded, 3 rows)        │
│  agentTools      — junction (which agent has which)     │
│  toolCredentials — OAuth tokens per tool (workspace)    │
└─────────────────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────┐
│  Voice Worker (apps/agent)                              │
│  Reads tool definitions from room metadata              │
│  Exposes tools to LLM via function-calling              │
│  Executes tool calls, returns results to conversation   │
└─────────────────────────────────────────────────────────┘
```

## Reference Files

**Must read before implementing:**

- `packages/db/src/schema/tools.ts` — existing tools + agentTools schema; needs toolCredentials table added
- `packages/db/src/schema/auth.ts` — Better Auth tables; understand session/account structure
- `apps/api/src/tools/tools.service.ts` — existing service with listTools, connectTool, disconnectTool
- `apps/api/src/tools/tools.controller.ts` — existing 5 endpoints; extend, don't replace
- `apps/api/src/auth/auth.ts` — Better Auth config with Google OAuth already configured
- `apps/api/src/mastra/runtime.ts` — `createRuntimeAgent()` currently creates agents with no tools
- `apps/api/src/agents/preview/agent-preview.service.ts` — preview streaming; needs tool injection
- `apps/api/src/arena/arena.controller.ts` — startSession; needs to pass tool defs in metadata
- `apps/api/src/livekit/livekit.service.ts` — generateArenaToken; room metadata assembly
- `apps/agent/src/main.ts` — voice worker; needs to parse tool defs and execute them
- `apps/agent/src/arena-agent.ts` — ArenaAgentConfig; needs tools field
- `apps/web/src/components/agents/detail/tools-section.tsx` — existing tools UI in agent detail
- `apps/web/src/app/(app)/tools/page.tsx` — existing tools marketplace page (basic listing, needs OAuth/status)
- `apps/web/src/components/layout/nav-bar.tsx` — nav already has /tools link, no changes needed
- `apps/web/src/lib/api.ts` — ApiClient; existing tool methods, needs OAuth methods
- `packages/shared/src/types/tool.ts` — Tool and AgentTool interfaces; needs expansion

## Constraints

- Room metadata has a 60KB hard limit — tool definitions must be compact
- OAuth tokens must be encrypted at rest (use `BETTER_AUTH_SECRET` as encryption key)
- Tavily requires only an API key (no OAuth) — handle as simple config, not OAuth flow
- Gmail OAuth scope: `gmail.send` only (start narrow, expand later)
- GitHub OAuth scope: `repo` + `read:user` (read repos, issues, PRs)
- Voice worker (`apps/agent`) cannot import `@mastra/core` — tool execution in voice path must use raw HTTP calls or a lightweight adapter
- All three tools should be seeded via a migration, not created by users

## Non-Goals

- Custom user-created tools (future)
- Per-user OAuth (this is per-workspace/global)
- MCP server integration
- Tool usage analytics/billing
- Tool versioning

## Gotchas

- Better Auth has a generic OAuth plugin but it manages user auth, not third-party API tokens. We need a **separate** `toolCredentials` table for storing OAuth tokens for tools (GitHub, Gmail). Don't try to shoehorn tool tokens into Better Auth's `account` table.
- The voice worker runs in a separate process from the API. It can't call NestJS services directly. Tool execution in arena must either: (a) happen via HTTP callbacks to the backend, or (b) be self-contained in the worker with credentials passed in metadata. Option (a) is safer and avoids leaking tokens into room metadata.
- Gmail OAuth requires a Google Cloud project with Gmail API enabled — this is a **different** OAuth app from the login Google OAuth. Use separate client ID/secret env vars (`GOOGLE_TOOLS_CLIENT_ID`, `GOOGLE_TOOLS_CLIENT_SECRET`).
- Mastra's `createTool()` (from `@mastra/core/tools`) expects a Zod schema for parameters and an `execute` function. The tool registry must construct these at runtime from tool definitions.
- The existing `tools-section.tsx` in agent detail (`apps/web/src/components/agents/detail/`) has a basic UI for connecting tools. It needs to be extended with OAuth status indicators and a "Connect Account" button, not rewritten from scratch.
- The `/tools` page already exists (`apps/web/src/app/(app)/tools/page.tsx`) as a basic listing. It needs to be extended, not recreated. The nav-bar already has a `/tools` link.
- There is **no seed script** in `packages/db`. One must be created along with a `db:seed` npm script in `packages/db/package.json` and the root `db:setup` script must be updated to run `pnpm db:migrate && pnpm db:seed`.
- The voice worker uses `@livekit/agents-plugin-openai` (OpenAI function-calling), NOT Mastra. Tool calling in the arena path must use OpenAI's native tool/function schema, with execution proxied to the backend via HTTP.
- The `TOOL_ICON_MAP` in both `tools/page.tsx` and `tools-section.tsx` does not include `github`. Lucide's `Github` icon must be added to the map when seeding the GitHub tool.
