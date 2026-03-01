# Siestai — AI Agent Platform

Multi-agent voice conversation platform enabling agent-to-agent and agent-to-human interactions via LiveKit.

## Repo Structure

```
siestai/                          # Turborepo + pnpm workspace monorepo
├── apps/
│   ├── web/                      # Next.js 16 frontend (:3000)
│   ├── api/                      # NestJS 11 API server (:4200)
│   └── agent/                    # LiveKit voice agent (worker, no port)
├── packages/
│   ├── db/                       # Drizzle schema, migrations, client, seed
│   ├── shared/                   # Types, constants, enums (shared between apps)
│   └── tsconfig/                 # Shared TypeScript config bases
├── deploy/
│   ├── docker-compose.dev.yml    # Dev: postgres only
│   ├── docker-compose.staging.yml# Staging: full stack (4 services)
│   └── docker/                   # Per-service Dockerfiles
├── designs/                      # .pen design files
├── records/                      # Plan specs (.md) + task lists (.json)
│   ├── plans/
│   └── tasks/
├── scripts/                      # dev-db.sh, test harnesses
├── docs/                         # STAGING-SETUP.md
├── .claude/commands/             # /plan, /implement commands
├── .agents/skills/               # Installed agent skills
├── package.json                  # Root workspace scripts (turbo-powered)
├── pnpm-workspace.yaml           # apps/* + packages/*
├── turbo.json                    # Task orchestration
└── loop.sh                       # Automated implementation loop
```

## Tech Stack

| Layer | Tech | Version |
|-------|------|---------|
| Frontend | Next.js (App Router) + React + Tailwind v4 | 16.1.6 / 19.2.3 / 4 |
| UI Components | shadcn/ui (new-york) + Radix UI + Lucide icons | — |
| Auth | Better Auth + @thallesp/nestjs-better-auth | 1.4.x / 2.4.x |
| Backend | NestJS + Drizzle ORM (via @siestai/db) | 11 |
| AI Runtime | @mastra/core + @mastra/pg (in-process, no separate service) | 1.8.0 |
| Database | Drizzle ORM (packages/db) + PostgreSQL 16 (pgvector) | port 5433 (dev) |
| Voice | @livekit/agents + Deepgram STT + OpenAI LLM + Cartesia TTS | 1.0.48 |
| Build System | Turborepo + pnpm workspaces | turbo ^2 |
| Package Manager | pnpm | 10.18.3 |
| Node | >= 22 required (.nvmrc) | — |

## Architecture

```
Browser (:3000)                   NestJS Backend (:4200)
  Next.js App Router                /agents (CRUD, Drizzle via @siestai/db)
  LiveKit SDK (WebRTC)              /livekit/token
  shadcn/ui + Tailwind              /arena/sessions + /arena/ws (WebSocket)
       │                            JWT invite tokens (InvitationService)
       │ REST + WS                  @mastra/core in-process (MastraService)
       ▼                                 │
  LiveKit Cloud (wss://)          PostgreSQL (:5433)
       │                            agents, auth, tools tables
       │ agent dispatch             Drizzle ORM (packages/db)
       ▼                                 │
  @siestai/agent                  packages/db
    Agent (1:1 voice)               Schema, migrations, client factory
    ArenaAgent (multi-persona)      Seed script (4 default agents)
    Silero VAD + noise cancel
```

### Data Flow

- **Agents CRUD**: apps/web → apps/api `/agents` → Drizzle queries → `agents` table
- **Live voice**: apps/web → apps/api `/livekit/token` → LiveKit cloud room → dispatches `siestai-agent` → `apps/agent` process joins
- **Arena voice**: apps/web → apps/api `/arena/sessions` → `/arena/sessions/:id/start` (creates room with persona metadata) → `siestai-agent` reads metadata, creates multi-persona `ArenaAgent`
- **External agents**: POST `/arena/join` (JWT validation) → WebSocket `/arena/ws?token=...` → text-based message relay
- **Arena sessions**: In-memory only (backend `Map`), not persisted to DB
- **Mastra runtime**: @mastra/core runs in-process inside apps/api (MastraService), no separate HTTP service

### Key Architectural Notes

- Backend uses Drizzle ORM via `@siestai/db` for all database access (no more raw SQL)
- Mastra runs as an in-process library in apps/api (MastraService wraps @mastra/core)
- `is_online` column exists in schema but is never written — defaults to `true`
- Shared types live in `@siestai/shared` and are re-exported from `apps/web/src/lib/types.ts`

### Authentication Flow

- **Google OAuth**: apps/web → `signIn.social({ provider: "google" })` → apps/api `/api/auth/callback/google` → Better Auth creates user/session → redirects to frontend with session cookie
- **Session check**: Next.js middleware calls apps/api `/api/auth/get-session` on every navigation, forwarding the cookie header. Unauthenticated users redirect to `/auth/login`.
- **API auth**: All backend routes protected by global `AuthGuard` from `@thallesp/nestjs-better-auth`. Public endpoints marked with `@AllowAnonymous()`.
- **Agent ownership**: `user_id` FK on agents table. Users see their own agents + unowned (seed) agents. Create sets `user_id`, delete restricted to own agents.

## Database

Single PostgreSQL instance, database `siestai`. Schema managed by Drizzle ORM in `packages/db/`.

### Migrations

Migrations live in `packages/db/drizzle/` with Drizzle Kit:
```bash
pnpm db:migrate       # Run pending migrations
pnpm --filter=@siestai/db generate  # Generate new migration
```

### Better Auth tables (Drizzle-managed)

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| user | id (text PK), name, email (unique), email_verified, image, created_at, updated_at | User accounts |
| session | id (text PK), token (unique), expires_at, user_id (FK→user) | Active sessions |
| account | id (text PK), account_id, provider_id, user_id (FK→user), access_token, refresh_token | OAuth provider links |
| verification | id (text PK), identifier, value, expires_at | Verification tokens |

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
| user_id | text (FK→user.id) | null |
| created_at | timestamp | now() |
| updated_at | timestamp | now() |

### `agent_files` table (Drizzle-managed)

| Column | Type | Default |
|--------|------|---------|
| id | uuid PK | gen_random_uuid() |
| agent_id | uuid NOT NULL (FK→agents.id, CASCADE) | — |
| filename | varchar(255) NOT NULL | — |
| file_path | text NOT NULL | — |
| mime_type | varchar(100) | null |
| file_size | integer | null |
| created_at | timestamp | now() |

### `tools` table (Drizzle-managed)

| Column | Type | Default |
|--------|------|---------|
| id | uuid PK | gen_random_uuid() |
| name | varchar(100) UNIQUE NOT NULL | — |
| description | text | '' |
| icon | varchar(50) | 'wrench' |
| category | varchar(50) | 'utility' |
| is_active | boolean | true |
| created_at | timestamp | now() |

### `agent_tools` table (Drizzle-managed)

| Column | Type | Default |
|--------|------|---------|
| id | uuid PK | gen_random_uuid() |
| agent_id | uuid NOT NULL (FK→agents.id, CASCADE) | — |
| tool_id | uuid NOT NULL (FK→tools.id, CASCADE) | — |
| config | jsonb | '{}' |
| created_at | timestamp | now() |
| | UNIQUE(agent_id, tool_id) | |

### Seed Agents

| Name | Category | Color | LLM |
|------|----------|-------|-----|
| Atlas | technical | #3b82f6 (blue) | anthropic/claude-sonnet-4-6 |
| Nova | creative | #8b5cf6 (purple) | anthropic/claude-sonnet-4-6 |
| Sage | conversational | #22c55e (green) | anthropic/claude-sonnet-4-6 |
| Axiom | debate | #ef4444 (red) | anthropic/claude-sonnet-4-6 |

## Services

### apps/web (Next.js :3000)

**Pages (App Router):**

| Route | Description |
|-------|-------------|
| `/auth/login` | Google OAuth login page (no NavBar) — `(auth)` route group |
| `/` | Dashboard — quick actions, recent agents (hardcoded), activity |
| `/agents` | Agent list — real API, search/filter, create dialog (name + instructions) |
| `/agents/[id]` | Agent detail/edit — modular sections: avatar, instructions, model, files, tools, skills, settings (auto-save) |
| `/tools` | Tools marketplace — browse available tools, category filter |
| `/arena` | Multi-agent arena — 3-step wizard → waiting room → live room → ended |
| `/live` | 1:1 voice chat — LiveKit room, transcript sidebar, controls |
| `/profile` | User profile — edit display name, view account info |
| `/settings` | Display-only settings (no persistence) |

**Route groups:** `(auth)/` has a minimal centered layout (no NavBar/StatusBar). `(app)/` has the full layout with NavBar, StatusBar, and LiveSessionProvider.

**Key lib files:**
- `lib/auth-client.ts` — Better Auth React client (`signIn`, `signOut`, `useSession`)
- `lib/api.ts` — `ApiClient` class → backend REST calls (with `credentials: "include"`)
- `lib/livekit.ts` — token fetching, room options
- `lib/arena-api.ts` — arena session management
- `lib/live-session-context.tsx` — global LiveKit session context
- `lib/arena-session-context.tsx` — arena page context (WebSocket + state machine)
- `lib/types.ts` — re-exports all types from `@siestai/shared`
- `hooks/use-agent-editor.ts` — agent detail page auto-save hook (debounced updateField, save status)
- `hooks/use-conversation-transcript.ts` — transcript from LiveKit voice events
- `middleware.ts` — session check on every navigation, redirects to `/auth/login` if unauthenticated

**Theme:** Dark-only (`#0a0a0b` bg, `#22d3ee` cyan primary, `#a855f7` purple gradient end). Defined in `globals.css` as CSS custom properties.

**Layout:** NavBar (sticky top, `z-50`) + StatusBar (fixed bottom, `z-40`, live session indicator).

### apps/api (NestJS :4200)

**Modules:**

| Module | Endpoints | Description |
|--------|-----------|-------------|
| Auth | `/api/auth/*` (auto-mounted) | Better Auth via `@thallesp/nestjs-better-auth` — Google OAuth, sessions |
| Agents | `GET/POST/PUT/DELETE /agents` | CRUD via Drizzle (@siestai/db), user_id ownership |
| Livekit | `POST /livekit/token` | LiveKit token generation + agent dispatch |
| Arena | `POST /arena/sessions`, `GET /arena/sessions/:id`, `POST /arena/sessions/:id/start`, `POST /arena/join`, `WS /arena/ws` | Session lifecycle + WebSocket relay |
| AgentFiles | `GET/POST/DELETE /agents/:id/files`, `GET /agents/:id/files/:fileId/download` | Multipart upload (multer, 10MB), file CRUD, disk storage |
| Tools | `GET /tools`, `GET/POST/DELETE /agents/:id/tools` | Tools marketplace CRUD, agent-tool connections. Seeds 6 placeholder tools on init |
| Mastra | (internal) | MastraService wraps @mastra/core in-process — registerAgent, unregisterAgent, getAgent, listRegistered |
| Root | `GET /` | Health check (`@AllowAnonymous`) |

**Key services:**
- `AgentsService` — Drizzle queries via @siestai/db, user_id filtering
- `AgentFilesService` — file upload to `uploads/agents/{agentId}/`, disk + DB management
- `ToolsService` — tools CRUD, agent-tool connections, auto-seeds placeholder tools
- `MastraService` — wraps @mastra/core in-process, manages runtime agent registration
- `ArenaService` — in-memory `Map<string, ArenaSession>`, 1hr expiry
- `InvitationService` — JWT sign/verify for arena invites (host + agent roles)
- `ArenaGateway` — WebSocket: identify, message relay, system broadcasts
- `LivekitService` — token generation, room creation, `siestai-agent` dispatch

**Auth:** Global `AuthGuard` from `@thallesp/nestjs-better-auth` — all routes protected by default. `@AllowAnonymous()` on health check and arena join. `@Session()` decorator provides `UserSession` in controllers. `bodyParser: false` required in `NestFactory.create()`. Better Auth uses the shared `@siestai/db` Drizzle instance. CORS with `credentials: true`.

### apps/agent (LiveKit Voice Worker)

- Registers as `siestai-agent` with LiveKit cloud
- Regular mode: `Agent` class — concise conversational assistant
- Arena mode: `ArenaAgent` class — multi-persona orchestrator (reads room metadata)
- Pipeline: Silero VAD → Deepgram STT (nova-3, multilingual) → OpenAI GPT-4.1-mini → Cartesia TTS (sonic-3)
- Interruptions enabled (300ms min), background noise cancellation

### packages/db (Database Package)

- Drizzle ORM schema split into `src/schema/`: auth.ts, agents.ts, files.ts, tools.ts
- Client factory in `src/client.ts` — shared `db` instance
- Migrations in `drizzle/` (Drizzle Kit managed)
- Seed script in `src/seed.ts` — 4 default agents
- Re-exports drizzle-orm operators (eq, and, or, ilike, desc, sql) for consumers

### packages/shared (Shared Types)

- TypeScript types shared between apps/web and apps/api
- Agent, Arena, LiveKit, Tool, and API response types
- No runtime dependencies — types only

### packages/tsconfig (TypeScript Configs)

- `base.json` — shared base (ES2022, strict, bundler resolution)
- `nestjs.json` — NestJS-specific (decorators, nodenext resolution)
- `nextjs.json` — Next.js-specific (react-jsx, dom libs)
- `library.json` — workspace packages (declaration, composite)

## Deployment

Staging is live at **https://staging.siestai.com**. See [`docs/STAGING-SETUP.md`](./docs/STAGING-SETUP.md) for infrastructure details (Hetzner + Dokploy + Cloudflare).

**Docker builds:** All services use multi-stage builds from monorepo root context. Dockerfiles in `deploy/docker/`. Compose files in `deploy/`.

## Local Development

**Prerequisites:** Node >= 22 (`nvm use 22`), pnpm, Docker

```bash
# First-time setup
pnpm install              # Install all workspace dependencies
pnpm dev:db               # Start PostgreSQL (deploy/docker-compose.dev.yml)
pnpm db:setup             # Run migrations + seed

# Development
pnpm dev                  # Start all services via turbo (web + api + agent)
pnpm dev:web              # Start only frontend (:3000)
pnpm dev:api              # Start only backend (:4200)
pnpm dev:agent            # Start only LiveKit agent

# Database
pnpm db:migrate           # Run pending migrations
pnpm db:seed              # Run seed script
pnpm db:reset             # Destroy + recreate database

# Build & Test
pnpm build                # Build all packages and apps
pnpm test                 # Run all tests
pnpm stop:db              # Stop PostgreSQL container
```

**Service URLs:**
- Frontend: http://localhost:3000
- Backend: http://localhost:4200
- PostgreSQL: localhost:5433

**Environment files:** `.env.staging.example` at root. Per-service `.env` / `.env.local` files.

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
- **Auth:** Google OAuth via Better Auth + `@thallesp/nestjs-better-auth`. Session cookies, global AuthGuard. `@AllowAnonymous()` for public endpoints.
- **Database:** Drizzle ORM via `@siestai/db` — type-safe queries, shared schema
- **ESM everywhere** — all packages use `"type": "module"`
- **Migration names must be meaningful** — always use `drizzle-kit generate --name=<descriptive_name>` (e.g. `create_agents_table`, `add_agent_files_and_tools`). Never accept Drizzle's random codenames.
- **Workspace deps:** use `workspace:*` protocol for internal packages

## Installed Skills

| Skill | Purpose |
|-------|---------|
| agent-browser | Playwright browser automation for e2e tasks |
| better-auth-best-practices | Better Auth integration guidance |
| frontend-design | Production-grade UI generation |
| livekit-agents | LiveKit voice agent guidance |
| vercel-composition-patterns | React composition patterns |
| vercel-react-best-practices | React/Next.js performance |
