# Plan: Monorepo Reorganization (Turborepo + pnpm Workspaces)

**Status:** Proposed
**Date:** 2026-03-02
**Tasks:** records/tasks/0009-monorepo-reorg.json

## Problem

Siestai has 4 independent services with separate `package.json` files, no workspace root, and no shared packages. Types are duplicated between `ui-web/src/lib/types.ts` and backend DTOs. Database schema lives in `mastra/` but backend accesses the same tables via raw SQL with no type safety. The Mastra service runs on :4111 but nobody calls it — backend bypasses it due to a CLI bug. There's no path from this structure to Kubernetes-ready microservices.

## Decision

Restructure into a Turborepo + pnpm workspace monorepo with `apps/` (deployable services) and `packages/` (shared libraries). Kill Mastra as a service — absorb it as a library dependency in the API. Extract database schema, shared types, and auth config into workspace packages. Keep the same tech stack (NestJS, Next.js, LiveKit agents) but with proper dependency management and type sharing.

## Architecture

```
siestai/
├── apps/
│   ├── web/                    # Next.js 16 (renamed from ui-web)
│   ├── api/                    # NestJS 11 (renamed from backend)
│   └── agent/                  # LiveKit voice worker
├── packages/
│   ├── db/                     # Drizzle schema, migrations, client factory
│   ├── shared/                 # Types, constants, enums, Zod schemas
│   └── tsconfig/               # Shared tsconfig bases
├── deploy/
│   ├── docker-compose.dev.yml  # Dev infra (postgres only)
│   ├── docker-compose.staging.yml
│   └── docker/                 # Per-service Dockerfiles
├── package.json                # Root: workspace scripts
├── pnpm-workspace.yaml         # apps/* + packages/*
└── turbo.json                  # Task orchestration
```

**Service map after reorg:**

| Service | Port | Owns tables | Mastra usage |
|---------|------|-------------|--------------|
| apps/api | 4200 | agents, auth, arena, tools | `@mastra/core` as library (in-process) |
| apps/web | 3000 | none | none |
| apps/agent | — | none (future: transcripts) | none |

**Mastra absorbed into api:**
- `@mastra/core` + `@mastra/pg` become deps of `apps/api`
- Agent runtime creation (`createRuntimeAgent()`) moves to `apps/api/src/agents/`
- Mastra's Drizzle schema moves to `packages/db`
- `mastra/` directory deleted entirely

**Database ownership (single Postgres, clear ownership):**
```
packages/db/src/schema/
├── agents.ts      # Owner: api
├── auth.ts        # Owner: api
├── tools.ts       # Owner: api
└── voice.ts       # Owner: agent (future)
```

## Reference Files

- `mastra/src/db/schema.ts` — Current Drizzle schema (moves to packages/db)
- `mastra/drizzle.config.ts` — Migration config (moves to packages/db)
- `mastra/src/scripts/seed.ts` — Seed script (moves to packages/db)
- `mastra/src/agents/runtime.ts` — Agent runtime factory (moves to apps/api)
- `mastra/src/mastra/index.ts` — Mastra instance (moves to apps/api)
- `backend/src/agents/agents.service.ts` — Raw SQL to replace with Drizzle
- `backend/src/auth/auth.ts` — Better Auth config (stays in apps/api)
- `ui-web/src/lib/types.ts` — Frontend types (moves to packages/shared)
- `Makefile` — Dev orchestration (replaced by turbo scripts)
- `docker-compose.dev.yml` — Dev infra (moves to deploy/)
- `docker-compose.staging.yml` — Staging config (moves to deploy/)
- `backend/src/app.module.ts` — NestJS module registry
- `backend/src/mastra/mastra-registry.service.ts` — Mastra HTTP client (deleted, replaced by in-process)

## Constraints

- All existing functionality must keep working after reorg (auth, agents CRUD, arena, live voice, agent worker)
- Drizzle migrations must be preserved — existing databases must not break
- pnpm workspace protocol (`workspace:*`) for internal package references
- Each app must remain independently Docker-buildable for k8s readiness
- Node >= 22 requirement stays (.nvmrc at root)
- ESM everywhere (`"type": "module"` in all packages)

## Non-Goals

- Splitting into separate databases per service (future, when k8s demands it)
- Rewriting NestJS to Hono (different plan)
- Adding new features (this is purely structural)
- Changing the frontend (no UI changes)
- Kubernetes manifests (future plan, this just makes the structure k8s-ready)

## Gotchas

- **NestJS module resolution**: NestJS uses `nodenext` module resolution with decorators. The root tsconfig must not break this — `packages/tsconfig/` provides separate bases for NestJS vs Next.js vs vanilla TS.
- **Drizzle migration meta/ directory**: Moving `mastra/drizzle/` to `packages/db/drizzle/` must include the `meta/` subdirectory with `_journal.json` and all snapshot JSON files. Without these, `drizzle-kit` cannot track migration state and will try to re-apply everything.
- **pnpm workspace hoisting**: NestJS relies on `reflect-metadata` being hoisted. Requires `.npmrc` with `shamefully-hoist=true`.
- **pnpm install timing**: After Phase 3 moves all services into apps/, a `pnpm install` from root is required BEFORE Phase 4 can build. Task 8 handles this explicitly.
- **Per-service lockfiles**: Each service currently has its own `pnpm-lock.yaml`. These must be deleted — the monorepo uses a single root lockfile.
- **Turbo dev vs Makefile**: The Makefile starts services with `sleep 3` delays and process management. Turbo `dev` tasks are `persistent: true` and run in parallel — no sleep needed, but startup order for migrations needs a `dependsOn` in turbo.json.
- **Backend's raw pg Pool**: Phase 4 replaces raw SQL with Drizzle queries. 5 files create Pool instances: agents.service, tools.service, agent-files.service, mastra-registry.service, auth.ts. All must be migrated.
- **MastraRegistryService has 5 consumers**: Not just agents.service — also agents.controller (listRegistered), agent-preview.service (getAgent), mastra.module (export), and app.module (import). All injection sites must be updated.
- **Docker build context**: With workspace packages, Dockerfiles need the monorepo root as build context (`context: ..`), not individual service dirs. COPY commands must include `packages/` and `pnpm-workspace.yaml`.
- **better-auth Drizzle instance**: Backend's auth.ts creates a separate Drizzle instance for Better Auth. After reorg, it should use the shared `@siestai/db` client.
- **nest-cli.json**: NestJS uses this for build config. After extending shared tsconfig, verify `nest build` still resolves the correct tsconfig path.
