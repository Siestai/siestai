# Staging Setup

Staging is live at **https://staging.siestai.com** (ui-web) and **https://api-staging.siestai.com** (backend).

## Infrastructure

| Component | Detail |
|-----------|--------|
| Server | Hetzner VPS (Ubuntu 24.04) |
| Orchestration | Dokploy — manages Docker Compose deployments |
| Compose file | `docker-compose.staging.yml` |
| DNS / SSL | Cloudflare (proxied A records → Hetzner IP, SSL Full Strict) |

## Services (5)

All on a `siestai` bridge network. Only ui-web (:3000) and backend (:4200) are exposed via Dokploy reverse proxy.

| Service | Internal URL |
|---------|-------------|
| postgres | pgvector/pgvector:pg16, persisted via `pgdata` volume |
| mastra | http://mastra:4111 |
| backend | http://backend:4200 |
| ui-web | http://ui-web:3000 |
| agent | LiveKit worker (no HTTP port) |

## Env Vars

Secrets are configured directly in Dokploy (not committed). Required variables:

```
POSTGRES_PASSWORD
LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET
OPENAI_API_KEY
ARENA_INVITE_SECRET
```

ui-web receives `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_LIVEKIT_URL` as Docker build args (hardcoded in `docker-compose.staging.yml`).

## Deploy

Dokploy watches the GitHub repo. To trigger a redeploy: push to the tracked branch or click **Redeploy** in the Dokploy dashboard.

Start order (handled by `depends_on`): postgres → mastra → backend → ui-web / agent.
