# ──────────────────────────────────────────────────────────
#  Siestai — Local Development Makefile
# ──────────────────────────────────────────────────────────
#  Usage:
#    make setup      # first-time setup (env files + install + db)
#    make dev        # start everything (db + all services)
#    make stop       # stop everything
# ──────────────────────────────────────────────────────────

.PHONY: help setup env install db dev dev-db dev-mastra dev-backend dev-web dev-agent \
        stop stop-db stop-services logs-db test test-web test-backend clean nuke

SHELL := /bin/zsh

# Ensure correct Node version (>= 22) — auto-switch via nvm if available
NODE_MAJOR := $(shell node -v 2>/dev/null | sed 's/v\([0-9]*\).*/\1/')
CHECK_NODE = @if [ "$(NODE_MAJOR)" -lt 22 ] 2>/dev/null; then \
	echo "$(RED)✘ Node.js >= 22 required (found v$(NODE_MAJOR))$(RESET)"; \
	echo "  Run: $(CYAN)nvm use 22$(RESET)"; \
	exit 1; \
fi

# Colors
CYAN  := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED   := \033[31m
RESET := \033[0m

help: ## Show this help
	@echo ""
	@echo "$(CYAN)Siestai$(RESET) — Local Development"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-16s$(RESET) %s\n", $$1, $$2}'
	@echo ""

# ──────────────────────── First-time Setup ────────────────────────

setup: env install db ## First-time setup (env + install + db)
	$(CHECK_NODE)
	@echo "\n$(GREEN)✔ Setup complete!$(RESET) Run $(CYAN)make dev$(RESET) to start.\n"

env: ## Copy .env.example files (won't overwrite existing)
	@echo "$(CYAN)→ Setting up env files...$(RESET)"
	@cp -n mastra/.env.example mastra/.env 2>/dev/null || true
	@cp -n backend/.env.example backend/.env 2>/dev/null || true
	@cp -n ui-web/.env.example ui-web/.env.local 2>/dev/null || true
	@cp -n agent/.env.example agent/.env.local 2>/dev/null || true
	@echo "$(GREEN)✔ Env files ready$(RESET) (edit them with your API keys)"

install: ## Install dependencies for all services
	@echo "$(CYAN)→ Installing dependencies...$(RESET)"
	@cd mastra  && pnpm install --frozen-lockfile 2>/dev/null || pnpm install
	@cd backend && pnpm install --frozen-lockfile 2>/dev/null || pnpm install
	@cd ui-web  && pnpm install --frozen-lockfile 2>/dev/null || pnpm install
	@cd agent   && pnpm install --frozen-lockfile 2>/dev/null || pnpm install
	@echo "$(GREEN)✔ All dependencies installed$(RESET)"

db: dev-db ## Run database migrations + seed
	@echo "$(CYAN)→ Waiting for PostgreSQL...$(RESET)"
	@until docker compose -f docker-compose.dev.yml exec -T postgres pg_isready -U postgres -p 5432 > /dev/null 2>&1; do \
		sleep 1; \
	done
	@echo "$(CYAN)→ Running migrations + seed...$(RESET)"
	@cd mastra && pnpm run db:setup
	@echo "$(GREEN)✔ Database ready$(RESET)"

# ──────────────────────── Development ────────────────────────

dev: dev-db ## Start all services (db + mastra + backend + web)
	$(CHECK_NODE)
	@echo "$(CYAN)→ Starting all services...$(RESET)"
	@until docker compose -f docker-compose.dev.yml exec -T postgres pg_isready -U postgres -p 5432 > /dev/null 2>&1; do \
		sleep 1; \
	done
	@trap 'make stop-services; exit 0' INT TERM; \
	(cd mastra  && pnpm run dev) &      \
	sleep 3;                            \
	(cd backend && pnpm run start:dev) & \
	(cd ui-web  && pnpm run dev) &      \
	echo "";                            \
	echo "$(GREEN)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"; \
	echo "$(GREEN)  Siestai is running!$(RESET)";                              \
	echo "";                                                                   \
	echo "  $(CYAN)Frontend$(RESET)  http://localhost:3000";                    \
	echo "  $(CYAN)Backend$(RESET)   http://localhost:4200";                    \
	echo "  $(CYAN)Mastra$(RESET)    http://localhost:4111";                    \
	echo "  $(CYAN)Postgres$(RESET)  localhost:5433";                           \
	echo "";                                                                   \
	echo "  Press $(YELLOW)Ctrl+C$(RESET) to stop all services";               \
	echo "$(GREEN)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"; \
	wait

dev-db: ## Start PostgreSQL container
	@docker compose -f docker-compose.dev.yml up -d

dev-mastra: dev-db ## Start only Mastra (:4111)
	@cd mastra && pnpm run dev

dev-backend: ## Start only Backend (:4200)
	@cd backend && pnpm run start:dev

dev-web: ## Start only Frontend (:3000)
	@cd ui-web && pnpm run dev

dev-agent: ## Start only LiveKit Agent
	@cd agent && pnpm run dev

# ──────────────────────── Stopping ────────────────────────

stop: stop-services stop-db ## Stop everything (services + db)
	@echo "$(GREEN)✔ All stopped$(RESET)"

stop-db: ## Stop PostgreSQL container
	@docker compose -f docker-compose.dev.yml down

stop-services: ## Kill running dev services
	@echo "$(CYAN)→ Stopping services...$(RESET)"
	@-pkill -f "next dev" 2>/dev/null || true
	@-pkill -f "nest start" 2>/dev/null || true
	@-pkill -f "mastra dev" 2>/dev/null || true

# ──────────────────────── Testing ────────────────────────

test: test-web test-backend ## Run all tests

test-web: ## Run frontend tests
	@cd ui-web && pnpm test

test-backend: ## Run backend tests
	@cd backend && pnpm test

# ──────────────────────── Database ────────────────────────

db-migrate: ## Run database migrations only
	@cd mastra && pnpm run generate && pnpm run migrate

db-seed: ## Run database seed only
	@cd mastra && pnpm run seed

db-reset: stop-db ## Reset database (destroy + recreate)
	@docker compose -f docker-compose.dev.yml down -v
	@$(MAKE) db
	@echo "$(GREEN)✔ Database reset$(RESET)"

logs-db: ## Tail PostgreSQL logs
	@docker compose -f docker-compose.dev.yml logs -f postgres

# ──────────────────────── Cleanup ────────────────────────

clean: ## Remove node_modules from all services
	@echo "$(CYAN)→ Cleaning node_modules...$(RESET)"
	@rm -rf mastra/node_modules backend/node_modules ui-web/node_modules agent/node_modules
	@echo "$(GREEN)✔ Cleaned$(RESET)"

nuke: stop clean ## Stop everything + clean node_modules + remove db volume
	@docker compose -f docker-compose.dev.yml down -v
	@echo "$(GREEN)✔ Nuked$(RESET) — run $(CYAN)make setup$(RESET) to start fresh"
