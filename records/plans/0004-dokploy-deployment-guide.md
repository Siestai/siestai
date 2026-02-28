# Plan: Dokploy Deployment Guide

**Status:** Proposed
**Date:** 2026-02-28
**Tasks:** records/tasks/0004-dokploy-deployment-guide.json

## Problem
There is no deployment documentation. The project has 4 services (ui-web, backend, agent, mastra) with a working `docker-compose.staging.yml` but no guide for deploying via Dokploy on Hetzner with Cloudflare DNS. Only the mastra service has a Dockerfile — the other 3 need Dockerfiles created first, then the guide needs to cover the full Dokploy project setup.

## Decision
Create `docs/DOKPLOY-GUIDE.md` — a step-by-step operational guide covering: Hetzner server prep, Dokploy installation, Cloudflare DNS config, and per-service setup (build context, env vars, domains, health checks). Also create the 3 missing Dockerfiles (ui-web, backend, agent) since the guide references them and they're needed for deployment.

## Architecture
```
Dokploy Project: siestai
├── postgres        (database, internal only, pgvector/pgvector:pg16)
├── mastra          (port 4111, internal only, depends on postgres)
│   └── api.siestai.com (future, not in v1)
├── backend         (port 4200, api.siestai.com)
│   └── depends on mastra + postgres
├── agent           (no port exposed, LiveKit worker)
│   └── depends on backend
└── ui-web          (port 3000, app.siestai.com)

Cloudflare DNS:
  app.siestai.com  → A record → Hetzner IP
  api.siestai.com  → A record → Hetzner IP
```

## Reference Files
- `docker-compose.staging.yml` — existing service definitions, ports, env vars, dependencies
- `mastra/Dockerfile` — only existing Dockerfile, pattern for others
- `ui-web/.env.example` — build args needed for Next.js
- `backend/.env.example` — runtime env vars for NestJS
- `agent/.env.example` — runtime env vars for LiveKit agent
- `mastra/.env.example` — runtime env vars for Mastra

## Constraints
- Node 22 required for all services (`.nvmrc`)
- pnpm is the package manager (corepack)
- ui-web needs `NEXT_PUBLIC_*` vars at **build time** (not runtime)
- Agent service has no HTTP port — it's a LiveKit worker that connects outbound
- PostgreSQL needs pgvector extension (`pgvector/pgvector:pg16` image)
- Database port should NOT be exposed publicly in production

## Non-Goals
- Kubernetes migration (mentioned as future, not covered here)
- CI/CD pipeline setup (GitHub Actions, etc.)
- SSL certificate management (Dokploy + Cloudflare handle this)
- Monitoring/logging setup
- Custom domain email

## Gotchas
- Cloudflare proxy (orange cloud) can conflict with WebSocket connections (LiveKit). The guide must note to use DNS-only (gray cloud) for WebSocket-dependent subdomains or configure Cloudflare WebSocket support.
- Next.js `NEXT_PUBLIC_*` env vars are baked at build time, not runtime. Changing them requires a rebuild.
- Dokploy uses Traefik for routing — the guide must configure Traefik labels or Dokploy's UI domain settings, not manual nginx.
- The `agent` service needs `network_mode` or shared Docker network to reach `backend` by container name.
- Mastra Dockerfile copies `.mastra/output/` — the build step must run `pnpm build` which generates this directory.
