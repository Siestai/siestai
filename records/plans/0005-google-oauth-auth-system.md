# Plan: Google OAuth Auth System with Better Auth

**Status:** Proposed
**Date:** 2026-02-28
**Tasks:** records/tasks/0005-google-oauth-auth-system.json

## Problem
Siestai has no authentication system. All routes and API endpoints are publicly accessible. Users cannot own agents or sessions. We need Google OAuth signup/login so users can create accounts, own their agents, and participate in arena/live sessions under their identity.

## Decision
Use **Better Auth** with the Drizzle adapter for Google OAuth (one-click login/signup). Use the community `@thallesp/nestjs-better-auth` package for NestJS integration — it handles route mounting, body parser conflicts, and provides built-in `AuthGuard`, `@Session()`, and `@AllowAnonymous()` decorators. The frontend uses `better-auth/react` for session hooks and `signIn.social({ provider: "google" })`. The existing `agents` table gets a `user_id` FK. Better Auth manages its own tables (user, session, account, verification). Profile editing happens on a new `/profile` page.

## Architecture

```
                    Google OAuth
                        |
  ui-web (Next.js)      |     backend (NestJS :4200)
  ┌──────────────┐      |     ┌──────────────────────────┐
  │ /auth/login  │──────┼────►│ /api/auth/*              │
  │              │      |     │ (@thallesp/nestjs-better- │
  │ /profile     │      |     │  auth handles mounting)   │
  │              │      |     │                           │
  │ authClient   │◄─────┼────│ Built-in AuthGuard        │
  │ (react)      │      |     │ on /agents, /arena        │
  └──────────────┘      |     └──────────────────────────┘
  middleware.ts          |            │
  (session check)        |            ▼
                              PostgreSQL (:5433)
                         ┌────────────────┐
                         │ user           │ ← Better Auth managed
                         │ session        │ ← Better Auth managed
                         │ account        │ ← Better Auth managed
                         │ verification   │ ← Better Auth managed
                         │ agents (+ FK)  │ ← user_id added
                         └────────────────┘
```

## Reference Files
- `backend/src/main.ts` — Disable body parser (`bodyParser: false`) for Better Auth compatibility
- `backend/src/app.module.ts` — Register `AuthModule.forRoot({ auth })` from `@thallesp/nestjs-better-auth`
- `backend/src/agents/agents.service.ts` — Add user_id filtering to all queries
- `backend/src/agents/agents.controller.ts` — Use `@Session()` decorator from nestjs-better-auth, `@AllowAnonymous()` where needed
- `mastra/src/db/schema.ts` — Add Better Auth tables + user_id column to agents table
- `mastra/drizzle.config.ts` — Generate migration for schema changes
- `ui-web/src/app/layout.tsx` — Restructure with route groups for auth vs app layouts
- `ui-web/src/lib/api.ts` — Add `credentials: "include"` to all fetch calls
- `ui-web/src/components/layout/nav-bar.tsx` — Add user avatar/menu
- `ui-web/src/app/settings/page.tsx` — Reference for profile page styling patterns
- `.claude/skills/better-auth-best-practices/SKILL.md` — Better Auth patterns

## Constraints
- Google OAuth only (no email/password for now)
- Better Auth manages its own tables (user, session, account, verification) — do NOT hand-write these
- Better Auth CLI generates the Drizzle schema; run `npx @better-auth/cli generate --output ./path` then `drizzle-kit generate` + `drizzle-kit migrate`
- Backend port 4200, frontend port 3000 — cross-origin cookie setup required
- user_id on agents is nullable initially (existing agents have no owner)
- `credentials: "include"` required on all frontend fetch calls for cookies to work cross-origin
- `bodyParser: false` required in `NestFactory.create()` — nestjs-better-auth re-adds parsers automatically
- Google OAuth callback URL in Google Cloud Console must point to backend: `http://localhost:4200/api/auth/callback/google`

## Non-Goals
- Email/password login
- Role-based access control (RBAC)
- Admin panel
- Multi-factor authentication
- Email verification flow (Google already verifies)
- Team/org features

## Gotchas
- **Body parser conflict**: NestJS built-in body parser must be disabled (`bodyParser: false` in `NestFactory.create()`). The nestjs-better-auth package re-adds body parsers automatically. Without this, Better Auth requests will hang.
- **BETTER_AUTH_URL**: Must be set to the backend URL (`http://localhost:4200`), NOT the frontend URL. This controls the OAuth callback redirect.
- **trustedOrigins**: Must include `http://localhost:3000` (the frontend) so cross-origin cookies and CSRF work. Different ports = different origins.
- **Drizzle adapter**: The backend currently uses raw `pg` queries, not Drizzle. Better Auth needs a Drizzle instance. Install `drizzle-orm` in the backend and create a dedicated Drizzle instance for the auth config only. The rest of the backend continues using raw `pg`.
- **Better Auth user.id type**: Better Auth uses `text` type for user IDs (storing UUIDs as text). The `user_id` FK on agents must also be `text`, not `uuid`.
- **Schema generation**: Run `npx @better-auth/cli generate --config ./src/auth/auth.ts --output ./generated-schema.ts` in the backend dir, then manually merge the generated tables into `mastra/src/db/schema.ts`. The CLI outputs a Drizzle schema file — do NOT copy it blindly, merge it with the existing agents table definition.
- **Task 2 depends on Task 1**: The user_id FK references `user.id` which must exist first. Task 2 must run after the Better Auth tables are created.
- **Middleware session check**: The Next.js middleware calls the backend `/api/auth/get-session` endpoint on every navigation. This adds latency. Use `credentials: "include"` and forward the cookie header from the incoming request.
- **Auth layout**: The login page must NOT render inside the main layout (NavBar/StatusBar). Use Next.js route groups: `(app)/` for authenticated pages with NavBar, `(auth)/` for login without NavBar. This requires restructuring `src/app/`.
