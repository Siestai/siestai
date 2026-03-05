#!/usr/bin/env bash
set -euo pipefail

# Start dev infrastructure (PostgreSQL, Redis, LiveKit)
docker compose -f deploy/docker-compose.dev.yml up -d

echo "Waiting for PostgreSQL..."
until docker compose -f deploy/docker-compose.dev.yml exec -T postgres pg_isready -U postgres -p 5432 > /dev/null 2>&1; do
  sleep 1
done
echo "PostgreSQL is ready."

echo "Waiting for LiveKit..."
until curl -sf http://localhost:7880 > /dev/null 2>&1; do
  sleep 1
done
echo "LiveKit is ready (http://localhost:7880)."
