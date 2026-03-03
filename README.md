# Siestai

> Requires: **Node.js >= 22**, **pnpm 10+**, **Docker**

## Quick start

```bash
nvm use 22
pnpm install
cp .env.example .env.local
```

Edit `.env.local` and fill in your keys (`OPENAI_API_KEY`, `LIVEKIT_*`, `GOOGLE_CLIENT_*`).

Start the database, run migrations, then launch all services:

```bash
pnpm dev:db          # start postgres container
pnpm db:setup        # run migrations + seed
pnpm dev             # start all apps via turbo
```

Open **http://localhost:3000**

Run a single app:

```bash
pnpm dev:web         # Next.js frontend  (:3000)
pnpm dev:api         # NestJS backend    (:4200)
pnpm dev:agent       # LiveKit voice agent
```

## Database & migrations

The database lives in `packages/db/` and uses **Drizzle ORM** with **PostgreSQL 16** (pgvector).

### Schema

Schema files are in `packages/db/src/schema/`. Each domain has its own file (agents, auth, arena, etc.) and they are re-exported from `packages/db/src/schema/index.ts`.

### Running migrations

```bash
pnpm db:migrate      # apply pending migrations
pnpm db:setup        # run migrations + seed data
```

### Creating a new migration

1. Edit or add schema files in `packages/db/src/schema/`
2. Generate a migration SQL file:

```bash
cd packages/db
pnpm generate        # runs drizzle-kit generate
```

This creates a new `.sql` file in `packages/db/drizzle/` (e.g. `0004_my_change.sql`).

3. Apply it:

```bash
pnpm db:migrate      # from root
```

### Resetting the database

```bash
pnpm db:reset        # tears down the container, restarts, and re-runs setup
```

### Configuration

Drizzle Kit config is at `packages/db/drizzle.config.ts`. It reads `DATABASE_URL` from the environment and outputs migrations to `packages/db/drizzle/`.

## Other commands

```
pnpm build           # build all packages and apps
pnpm test            # run all tests
pnpm lint            # lint all packages
pnpm stop:db         # stop postgres container
pnpm clean           # remove build artifacts
```

## Project structure

```
apps/web/            # Next.js frontend (:3000)
apps/api/            # NestJS backend  (:4200)
apps/agent/          # LiveKit voice agent
packages/db/         # Drizzle schema, migrations, seed
packages/shared/     # Shared TypeScript types
```
