# Siestai — AI Agent Platform

Multi-agent voice conversation platform enabling agent-to-agent and agent-to-human interactions via LiveKit.

## Repo Structure

```
siestai/                          # monorepo root (git)
├── ui-web/                       # Next.js 16 frontend (:3000)
├── backend/                      # NestJS 11 API server (:4200)
├── mastra/                       # Mastra AI runtime (:4111)
├── agent/                        # LiveKit voice agent (worker, no port)
├── designs/                      # .pen design files
├── records/                      # Plan specs (.md) + task lists (.json)
│   ├── plans/
│   └── tasks/
├── scripts/                      # Test harnesses
├── docs/                         # Deployment guides
├── .claude/commands/             # /plan, /implement commands
├── .agents/skills/               # Installed agent skills
├── docker-compose.dev.yml        # Dev: postgres only
├── docker-compose.staging.yml    # Staging: full stack (5 services)
├── Makefile                      # Dev orchestration
└── loop.sh                       # Automated implementation loop
```

## Tech Stack

| Layer | Tech | Version |
|-------|------|---------|
| Frontend | Next.js (App Router) + React + Tailwind v4 | 16.1.6 / 19.2.3 / 4 |
| UI Components | shadcn/ui (new-york) + Radix UI + Lucide icons | — |
| Backend | NestJS + raw pg (no ORM) | 11 |
| AI Runtime | @mastra/core + @mastra/pg + Drizzle ORM | 1.8.0 |
| Voice | @livekit/agents + Deepgram STT + OpenAI LLM + Cartesia TTS | 1.0.47 |
| Database | PostgreSQL 16 (pgvector) | port 5433 (dev) |
| Package Manager | pnpm | — |
| Node | >= 22 required (.nvmrc) | — |

## Architecture

```
Browser (:3000)                   NestJS Backend (:4200)
  Next.js App Router                /agents (CRUD, raw pg)
  LiveKit SDK (WebRTC)              /livekit/token
  shadcn/ui + Tailwind              /arena/sessions + /arena/ws (WebSocket)
       │                            JWT invite tokens (InvitationService)
       │ REST + WS                       │
       ▼                                 ▼
  LiveKit Cloud (wss://)          PostgreSQL (:5433)
       │                            agents table
       │ agent dispatch             mastra internal tables
       ▼                                 ▲
  @siestai/agent                  Mastra Runtime (:4111)
    Agent (1:1 voice)               @mastra/core + PostgresStore
    ArenaAgent (multi-persona)      Drizzle ORM (migrations + seed)
    Silero VAD + noise cancel       default-agent (anthropic/claude-sonnet-4-6)
```

### Data Flow

- **Agents CRUD**: ui-web → backend `/agents` → raw pg → `agents` table (shared with Mastra)
- **Live voice**: ui-web → backend `/livekit/token` → LiveKit cloud room → dispatches `siestai-agent` → `agent/` process joins
- **Arena voice**: ui-web → backend `/arena/sessions` → `/arena/sessions/:id/start` (creates room with persona metadata) → `siestai-agent` reads metadata, creates multi-persona `ArenaAgent`
- **External agents**: POST `/arena/join` (JWT validation) → WebSocket `/arena/ws?token=...` → text-based message relay
- **Arena sessions**: In-memory only (backend `Map`), not persisted to DB

### Key Architectural Notes

- Backend queries the `agents` table directly via `pg.Pool` (bypasses Mastra HTTP API due to Mastra CLI 1.3.5 `registerApiRoute` bundler bug)
- Mastra owns DB migrations (Drizzle), backend reads/writes the same table via raw SQL
- `is_online` column exists in schema but is never written — defaults to `true`
- `MASTRA_URL` is declared in backend .env but currently unused

## Database

Single PostgreSQL instance, database `siestai`.

### `agents` table (Drizzle-managed)

| Column | Type | Default |
|--------|------|---------|
| id | uuid PK | gen_random_uuid() |
| name | varchar(100) UNIQUE NOT NULL | — |
| description | text | '' |
| instructions | text NOT NULL | — |
| category | varchar(50) | 'conversational' |
| tags | jsonb | '[]' |
| color | varchar(7) | '#3b82f6' |
| icon | varchar(50) | 'bot' |
| source | enum(mastra,livekit,external) | 'mastra' |
| llm_model | varchar(100) | null |
| is_online | boolean | true |
| created_at | timestamp | now() |
| updated_at | timestamp | now() |

### Seed Agents

| Name | Category | Color | LLM |
|------|----------|-------|-----|
| Atlas | technical | #3b82f6 (blue) | anthropic/claude-sonnet-4-6 |
| Nova | creative | #8b5cf6 (purple) | anthropic/claude-sonnet-4-6 |
| Sage | conversational | #22c55e (green) | anthropic/claude-sonnet-4-6 |
| Axiom | debate | #ef4444 (red) | anthropic/claude-sonnet-4-6 |

## Services

### ui-web (Next.js :3000)

**Pages (App Router):**

| Route | Description |
|-------|-------------|
| `/` | Dashboard — quick actions, recent agents (hardcoded), activity |
| `/agents` | Agent list — real API, search/filter, create/edit/delete |
| `/agents/[id]` | Agent detail — overview, config, history tabs |
| `/arena` | Multi-agent arena — 3-step wizard → waiting room → live room → ended |
| `/live` | 1:1 voice chat — LiveKit room, transcript sidebar, controls |
| `/settings` | Display-only settings (no persistence) |

**Key lib files:**
- `lib/api.ts` — `ApiClient` class → backend REST calls
- `lib/livekit.ts` — token fetching, room options
- `lib/arena-api.ts` — arena session management
- `lib/live-session-context.tsx` — global LiveKit session context
- `lib/arena-session-context.tsx` — arena page context (WebSocket + state machine)
- `lib/types.ts` — all TypeScript interfaces
- `hooks/use-conversation-transcript.ts` — transcript from LiveKit voice events

**Theme:** Dark-only (`#0a0a0b` bg, `#22d3ee` cyan primary, `#a855f7` purple gradient end). Defined in `globals.css` as CSS custom properties.

**Layout:** NavBar (sticky top, `z-50`) + StatusBar (fixed bottom, `z-40`, live session indicator).

### backend (NestJS :4200)

**Modules:**

| Module | Endpoints | Description |
|--------|-----------|-------------|
| Agents | `GET/POST/PUT/DELETE /agents` | CRUD via raw pg Pool |
| Livekit | `POST /livekit/token` | LiveKit token generation + agent dispatch |
| Arena | `POST /arena/sessions`, `GET /arena/sessions/:id`, `POST /arena/sessions/:id/start`, `POST /arena/join`, `WS /arena/ws` | Session lifecycle + WebSocket relay |
| Root | `GET /` | Health check |

**Key services:**
- `AgentsService` — pg.Pool queries, dynamic SET builder for updates
- `ArenaService` — in-memory `Map<string, ArenaSession>`, 1hr expiry
- `InvitationService` — JWT sign/verify for arena invites (host + agent roles)
- `ArenaGateway` — WebSocket: identify, message relay, system broadcasts
- `LivekitService` — token generation, room creation, `siestai-agent` dispatch

**Auth:** No global guards. Arena WebSocket validates JWT inline. Global `ValidationPipe` (whitelist + forbidNonWhitelisted). 10KB body limit.

### mastra (Mastra Runtime :4111)

- Hono server via `mastra dev`
- Registered agent: `default-agent` (anthropic/claude-sonnet-4-6)
- Storage: `@mastra/pg` PostgresStore (auto-creates internal tables)
- `agent-crud.ts` — Drizzle-based CRUD (used by seed script, not by backend at runtime)
- `runtime.ts` — `createRuntimeAgent()` for dynamic agent instantiation from DB records
- Migrations: `drizzle-kit generate && drizzle-kit migrate`

### agent (LiveKit Voice Worker)

- Registers as `siestai-agent` with LiveKit cloud
- Regular mode: `Agent` class — concise conversational assistant
- Arena mode: `ArenaAgent` class — multi-persona orchestrator (reads room metadata)
- Pipeline: Silero VAD → Deepgram STT (nova-3, multilingual) → OpenAI GPT-4.1-mini → Cartesia TTS (sonic-3)
- Interruptions enabled (300ms min), background noise cancellation

## Deployment

### Staging

- **Platform:** Dokploy (manages Docker Compose deployments)
- **URL:** https://staging.siestai.com (ui-web), https://api-staging.siestai.com (backend)
- **Compose file:** `docker-compose.staging.yml` — 5 services (postgres, mastra, backend, ui-web, agent) on a `siestai` bridge network
- **Build:** All services use multi-stage Docker builds (node:22-alpine). ui-web uses `output: "standalone"` and receives `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_LIVEKIT_URL` as build args.
- **Internal networking:** Services communicate via Docker service names (e.g., `http://backend:4200`, `http://mastra:4111`). Only ui-web (:3000) and backend (:4200) are exposed externally via Dokploy reverse proxy.
- **Env vars:** Staging secrets (API keys, DB password) are configured in Dokploy. Template: `.env.staging.example`.

## Local Development

**Prerequisites:** Node >= 22 (`nvm use 22`), pnpm, Docker

```bash
make setup    # copy .env files + install deps + start db + migrate + seed
make dev      # start postgres + mastra + backend + ui-web (Ctrl+C stops all)
make dev-agent  # start LiveKit voice agent separately
make stop     # kill all services
make db-reset # destroy + recreate database
make nuke     # full reset (stop + clean node_modules + destroy db)
```

**Service URLs:**
- Frontend: http://localhost:3000
- Backend: http://localhost:4200
- Mastra: http://localhost:4111
- PostgreSQL: localhost:5433

**Environment files:** Each service has `.env.example`. `make env` copies them as `.env.local`.

## Planning & Implementation

```bash
/plan [topic]      # creates records/plans/{N}-{slug}.md + records/tasks/{N}-{slug}.json
/implement         # interactive: pick task file, implement next phase
./loop.sh <N>      # automated: phase-by-phase via claude CLI cycles
```

- Plans: problem, decision, architecture, constraints, non-goals, gotchas
- Tasks: JSON with `id`, `phase`, `description`, `steps[]`, `files[]`, `verify` (shell cmd), `done` (boolean)
- `loop.sh` tracks `done` field as ground truth, detects stale cycles (2 consecutive with no progress)

## Conventions

- **Dark theme only** — `<html class="dark">` hardcoded, no toggle
- **Agent categories:** conversational, creative, technical, debate
- **Agent card colors:** blue `#3b82f6`, green `#22c55e`, yellow `#eab308`, red `#ef4444`, purple `#8b5cf6`, pink `#ec4899`
- **CSS:** Tailwind v4 utility-first, CSS custom properties for theme tokens
- **Components:** shadcn/ui (new-york style), `cn()` helper for class merging
- **Icons:** lucide-react exclusively
- **Server/Client split:** Dashboard is Server Component, all interactive pages are `"use client"`
- **No authentication layer** — no user management, no session auth
- **No ORM in backend** — raw pg queries (NestJS); Drizzle only in mastra/ for migrations
- **ESM everywhere** — all packages use `"type": "module"`

## Installed Skills

| Skill | Purpose |
|-------|---------|
| agent-browser | Playwright browser automation for e2e tasks |
| better-auth-best-practices | Better Auth integration guidance |
| frontend-design | Production-grade UI generation |
| livekit-agents | LiveKit voice agent guidance |
| vercel-composition-patterns | React composition patterns |
| vercel-react-best-practices | React/Next.js performance |
