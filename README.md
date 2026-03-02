# Siestai

> Requires: **Node.js >= 22**, **pnpm 10+**, **Docker**

## Setup

```bash
nvm use 22
pnpm install
cp .env.example .env.local
```

Edit `.env.local` and fill in your keys (`OPENAI_API_KEY`, `LIVEKIT_*`, `GOOGLE_CLIENT_*`).

Start the database and run migrations:

```bash
pnpm dev:db
pnpm db:setup
```

## Run

```bash
pnpm dev
```

Open **http://localhost:3000**

Run a single app:

```bash
pnpm dev:web     # frontend only
pnpm dev:api     # backend only
pnpm dev:agent   # voice agent only
```

## Other commands

```
pnpm build       # build all packages and apps
pnpm test        # run all tests
pnpm lint        # lint all packages
pnpm stop:db     # stop postgres
pnpm db:reset    # wipe and recreate database
pnpm clean       # remove build artifacts
```

## Project structure

```
apps/web/        # Next.js frontend (:3000)
apps/api/        # NestJS backend  (:4200)
apps/agent/      # LiveKit voice agent
packages/db/     # Drizzle schema, migrations, seed
packages/shared/ # Shared TypeScript types
```
