# Siestai

> Requires: **Node.js >= 22**, **pnpm**, **Docker**

## Setup

```bash
nvm use 22
make setup
```

Edit your API keys in the generated `.env` files:
- `mastra/.env` — set `OPENAI_API_KEY`
- `backend/.env` — set `LIVEKIT_*` credentials

## Run

```bash
make dev
```

Open **http://localhost:3000**

Press `Ctrl+C` to stop.

## Other commands

```
make stop       # stop everything
make db-reset   # wipe and recreate database
make test       # run all tests
make clean      # remove node_modules
make nuke       # full reset (stop + clean + wipe db)
make help       # list all commands
```
