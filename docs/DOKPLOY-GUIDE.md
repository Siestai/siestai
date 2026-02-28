# Siestai — Dokploy Deployment Guide

Deploy Siestai on a Hetzner VPS using Dokploy with Cloudflare DNS.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Setup (Hetzner)](#server-setup-hetzner)
3. [Dokploy Installation](#dokploy-installation)
4. [Cloudflare DNS Configuration](#cloudflare-dns-configuration)
5. [Project Setup in Dokploy](#project-setup-in-dokploy)
6. [Service Configuration](#service-configuration)
   - [1. PostgreSQL](#1-postgresql)
   - [2. Mastra](#2-mastra)
   - [3. Backend](#3-backend)
   - [4. Agent](#4-agent)
   - [5. UI-Web](#5-ui-web)
7. [Domain & SSL Setup](#domain--ssl-setup)
8. [Deploy Order](#deploy-order)
9. [Health Checks](#health-checks)
10. [Environment Variables Reference](#environment-variables-reference)
11. [Troubleshooting](#troubleshooting)
12. [Future: Kubernetes Migration](#future-kubernetes-migration)

---

## Prerequisites

- **Hetzner Cloud account** with a VPS (minimum CX31: 4 vCPU, 8 GB RAM, 80 GB disk)
- **Cloudflare account** with your domain (`siestai.com`) added
- **GitHub repository** — Dokploy pulls source from GitHub for builds
- **LiveKit Cloud project** — provides `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- **Anthropic API key** — for the Mastra AI agent runtime
- SSH key configured for Hetzner access

## Server Setup (Hetzner)

1. Create a new **CX31** (or larger) server in Hetzner Cloud:
   - Image: **Ubuntu 24.04**
   - Location: pick the region closest to your users
   - SSH key: add your public key
   - Networking: enable public IPv4

2. SSH into the server:
   ```bash
   ssh root@<HETZNER_IP>
   ```

3. Update the system:
   ```bash
   apt update && apt upgrade -y
   ```

4. (Optional) Set the hostname:
   ```bash
   hostnamectl set-hostname siestai
   ```

5. Configure the firewall (Hetzner Cloud Firewall or ufw):
   ```bash
   ufw allow 22/tcp    # SSH
   ufw allow 80/tcp    # HTTP (Traefik)
   ufw allow 443/tcp   # HTTPS (Traefik)
   ufw enable
   ```

   > **Do NOT** expose port 5432 (PostgreSQL). It should only be reachable within Docker's internal network.

## Dokploy Installation

Run the Dokploy one-line installer on the server:

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

Once installed:

1. Open `http://<HETZNER_IP>:3000` to access the Dokploy dashboard
2. Create your admin account
3. Go to **Settings → Server** and verify Docker is running
4. Connect your **GitHub account** under **Settings → Git Providers** (grant access to the siestai repo)

> After ui-web is deployed on port 3000, Dokploy's own dashboard moves to a different port or you access it via its Traefik domain. Plan accordingly — you may want to set up a Dokploy subdomain (e.g., `deploy.siestai.com`) first.

## Cloudflare DNS Configuration

In Cloudflare, add A records pointing to your Hetzner server IP:

| Type | Name     | Content        | Proxy  |
|------|----------|----------------|--------|
| A    | `app`    | `<HETZNER_IP>` | DNS only (gray cloud) |
| A    | `api`    | `<HETZNER_IP>` | DNS only (gray cloud) |

This gives you:
- `app.siestai.com` → ui-web (port 3000)
- `api.siestai.com` → backend (port 4200)

> **WebSocket Warning:** The `agent` service uses LiveKit, which relies on WebSocket connections. If you enable Cloudflare Proxy (orange cloud), WebSocket connections may fail unless you explicitly enable WebSocket support in Cloudflare. **Recommendation: use DNS-only mode (gray cloud)** for all records to avoid issues. If you want Cloudflare's CDN/DDoS protection, enable the proxy but go to **Network → WebSockets → On** in the Cloudflare dashboard.

## Project Setup in Dokploy

1. In the Dokploy dashboard, create a new **Project** named `siestai`
2. Inside the project, you will create **5 services** (see below)
3. All services share the same Docker network created by Dokploy, so they can reference each other by container/service name

## Service Configuration

### Architecture Overview

```
Dokploy Project: siestai
├── postgres        (Docker image, internal only)
├── mastra          (GitHub build, port 4111, internal only)
├── backend         (GitHub build, port 4200, api.siestai.com)
├── agent           (GitHub build, no port, LiveKit worker)
└── ui-web          (GitHub build, port 3000, app.siestai.com)

Deploy order: postgres → mastra → backend → agent + ui-web
```

---

### 1. PostgreSQL

PostgreSQL with pgvector for Mastra's vector storage.

| Setting         | Value                          |
|-----------------|--------------------------------|
| Service type    | **Docker Image**               |
| Image           | `pgvector/pgvector:pg16`       |
| Internal port   | `5432`                         |
| External port   | **None** (do not expose)       |
| Volume          | `/var/lib/postgresql/data` → named volume `pgdata` |

**Environment variables:**

```env
POSTGRES_DB=siestai
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<STRONG_PASSWORD>
```

**Health check:**

```
pg_isready -U postgres
```

Interval: 5s, timeout: 3s, retries: 5.

> **Important:** Generate a strong password for `POSTGRES_PASSWORD`. This value is referenced in `DATABASE_URL` by both mastra and backend.

---

### 2. Mastra

AI agent runtime (serves internal API on port 4111).

| Setting         | Value                          |
|-----------------|--------------------------------|
| Service type    | **GitHub Repository**          |
| Repository      | `your-org/siestai`             |
| Branch          | `main`                         |
| Build context   | `/mastra`                      |
| Dockerfile path | `/mastra/Dockerfile`           |
| Internal port   | `4111`                         |
| External domain | None (internal only)           |

**Environment variables:**

```env
DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@postgres:5432/siestai
ANTHROPIC_API_KEY=sk-ant-...
```

**Depends on:** postgres (must be healthy before mastra starts)

> **Build note:** The Dockerfile runs `pnpm build` which generates `.mastra/output/`. The build copies this into the final image.

---

### 3. Backend

NestJS API server — the main API gateway.

| Setting         | Value                          |
|-----------------|--------------------------------|
| Service type    | **GitHub Repository**          |
| Repository      | `your-org/siestai`             |
| Branch          | `main`                         |
| Build context   | `/backend`                     |
| Dockerfile path | `/backend/Dockerfile`          |
| Internal port   | `4200`                         |
| External domain | `api.siestai.com`              |

**Environment variables:**

```env
PORT=4200
MASTRA_URL=http://mastra:4111
DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@postgres:5432/siestai
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=<LIVEKIT_API_KEY>
LIVEKIT_API_SECRET=<LIVEKIT_API_SECRET>
ARENA_INVITE_SECRET=<RANDOM_32_CHAR_SECRET>
FRONTEND_URL=https://app.siestai.com
```

**Depends on:** mastra, postgres

> `MASTRA_URL` uses the Docker service name `mastra` — Dokploy's internal network resolves it automatically.

---

### 4. Agent

LiveKit voice agent worker. Connects outbound to LiveKit Cloud — no HTTP port exposed.

| Setting         | Value                          |
|-----------------|--------------------------------|
| Service type    | **GitHub Repository**          |
| Repository      | `your-org/siestai`             |
| Branch          | `main`                         |
| Build context   | `/agent`                       |
| Dockerfile path | `/agent/Dockerfile`            |
| Internal port   | **None**                       |
| External domain | None                           |

**Environment variables:**

```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=<LIVEKIT_API_KEY>
LIVEKIT_API_SECRET=<LIVEKIT_API_SECRET>
```

**Depends on:** backend

> This service has no HTTP endpoint. It connects outbound to LiveKit Cloud as a worker. Verify it's running by checking container logs in Dokploy.

---

### 5. UI-Web

Next.js frontend (standalone output).

| Setting         | Value                          |
|-----------------|--------------------------------|
| Service type    | **GitHub Repository**          |
| Repository      | `your-org/siestai`             |
| Branch          | `main`                         |
| Build context   | `/ui-web`                      |
| Dockerfile path | `/ui-web/Dockerfile`           |
| Internal port   | `3000`                         |
| External domain | `app.siestai.com`              |

**Build arguments** (set in Dokploy's build config, NOT environment variables):

```env
NEXT_PUBLIC_API_URL=https://api.siestai.com
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
```

> **Critical:** `NEXT_PUBLIC_*` variables are baked into the JavaScript bundle at **build time**. They are Dockerfile `ARG`s, not runtime `ENV`s. If you change these values, you must **rebuild** the image.

---

## Domain & SSL Setup

Dokploy uses **Traefik** as its reverse proxy and handles SSL automatically via Let's Encrypt.

For each service that needs a public domain:

1. In the service settings, go to **Domains**
2. Add the domain (e.g., `api.siestai.com`)
3. Set the container port (e.g., `4200` for backend, `3000` for ui-web)
4. Enable **HTTPS** — Dokploy/Traefik will automatically provision a Let's Encrypt certificate

| Service  | Domain              | Container Port | HTTPS |
|----------|---------------------|----------------|-------|
| backend  | `api.siestai.com`   | 4200           | Yes   |
| ui-web   | `app.siestai.com`   | 3000           | Yes   |

> If using Cloudflare Proxy (orange cloud), set Cloudflare SSL mode to **Full (Strict)** so it trusts the Let's Encrypt certificate on your origin server.

## Deploy Order

Services must be deployed in dependency order:

```
1. postgres     ← start first, wait for health check
2. mastra       ← needs postgres
3. backend      ← needs mastra + postgres
4. agent        ← needs backend (can deploy in parallel with ui-web)
5. ui-web       ← independent (can deploy in parallel with agent)
```

In Dokploy, deploy them one by one in this order. Once postgres and mastra are healthy, backend can start. After backend is up, deploy agent and ui-web simultaneously.

## Health Checks

| Service    | Method               | Endpoint / Command           | Expected |
|------------|----------------------|------------------------------|----------|
| postgres   | Docker health check  | `pg_isready -U postgres`     | exit 0   |
| mastra     | HTTP                 | `GET http://localhost:4111/`  | 200      |
| backend    | HTTP                 | `GET http://localhost:4200/`  | 200      |
| agent      | Container logs       | Check for "connected" message | Running  |
| ui-web     | HTTP                 | `GET http://localhost:3000/`  | 200      |

Configure health checks in Dokploy's service settings under **Advanced → Health Check**.

## Environment Variables Reference

### Shared secrets (set once, used by multiple services)

| Variable             | Used by            | Description                                |
|----------------------|--------------------|--------------------------------------------|
| `POSTGRES_PASSWORD`  | postgres           | Database password                          |
| `DATABASE_URL`       | mastra, backend    | Full connection string (use Docker hostname `postgres`) |
| `LIVEKIT_URL`        | backend, agent     | LiveKit Cloud WebSocket URL                |
| `LIVEKIT_API_KEY`    | backend, agent     | LiveKit API key                            |
| `LIVEKIT_API_SECRET` | backend, agent     | LiveKit API secret                         |

### Per-service variables

| Service  | Variable               | Description                                         |
|----------|------------------------|-----------------------------------------------------|
| postgres | `POSTGRES_DB`          | Database name (`siestai`)                           |
| postgres | `POSTGRES_USER`        | Database user (`postgres`)                          |
| mastra   | `ANTHROPIC_API_KEY`    | Anthropic API key for AI agents                     |
| backend  | `PORT`                 | HTTP port (`4200`)                                  |
| backend  | `MASTRA_URL`           | Internal URL to mastra (`http://mastra:4111`)       |
| backend  | `ARENA_INVITE_SECRET`  | Random secret for arena invite links                |
| backend  | `FRONTEND_URL`         | Public frontend URL (`https://app.siestai.com`)     |

### Build-time arguments (ui-web only)

| Variable                 | Description                                      |
|--------------------------|--------------------------------------------------|
| `NEXT_PUBLIC_API_URL`    | Public backend URL (`https://api.siestai.com`)   |
| `NEXT_PUBLIC_LIVEKIT_URL`| LiveKit Cloud WebSocket URL                      |

## Troubleshooting

### Container can't connect to postgres

- Verify all services are on the same Docker network (Dokploy handles this by default within a project)
- Check that `DATABASE_URL` uses the Docker service name `postgres` as hostname, not `localhost`
- Ensure postgres is healthy before dependent services start

### ui-web shows wrong API URL

- `NEXT_PUBLIC_*` vars are baked at build time. You must **rebuild** ui-web after changing them
- Check Dokploy's **Build Arguments** section (not Environment Variables)

### WebSocket connections failing

- If using Cloudflare Proxy (orange cloud), ensure **Network → WebSockets** is enabled in Cloudflare
- Alternatively, switch to DNS-only mode (gray cloud)
- Verify LiveKit URL starts with `wss://`

### Agent service keeps restarting

- Check container logs: the agent connects outbound to LiveKit, so network issues cause restarts
- Verify `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` are correct
- Ensure the LiveKit Cloud project is active and the API key hasn't been rotated

### Mastra build fails

- The Dockerfile runs `pnpm build` which generates `.mastra/output/`. If the build fails, check that all source files are committed and pushed
- Verify `ANTHROPIC_API_KEY` is set (some build steps may validate config)

### Dokploy can't pull from GitHub

- Re-authorize the GitHub integration in **Settings → Git Providers**
- Ensure the repository is accessible to the connected GitHub account
- Check that the branch name matches (default: `main`)

### SSL certificate not provisioning

- Ensure DNS records point to the correct Hetzner IP
- If using Cloudflare Proxy, set SSL mode to **Full (Strict)**
- Check Traefik logs in Dokploy for Let's Encrypt errors
- Ensure ports 80 and 443 are open in the firewall

## Future: Kubernetes Migration

This Dokploy setup is designed as a stepping stone. When traffic or complexity warrants it, the services can be migrated to Kubernetes:

- Each service already has a Dockerfile, so Kubernetes `Deployment` manifests are straightforward
- PostgreSQL would move to a managed database (e.g., Hetzner Managed PostgreSQL or Neon)
- Traefik can be replaced with an ingress controller (nginx-ingress, Traefik Operator, etc.)
- LiveKit agent workers scale horizontally as Kubernetes pods
- Consider Helm charts or Kustomize for templating the manifests

This is a future consideration and not covered in this guide.
