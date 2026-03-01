#!/usr/bin/env bash
set -euo pipefail

# Start the dev PostgreSQL container
docker compose -f deploy/docker-compose.dev.yml up -d

echo "Waiting for PostgreSQL..."
until docker compose -f deploy/docker-compose.dev.yml exec -T postgres pg_isready -U postgres -p 5432 > /dev/null 2>&1; do
  sleep 1
done
echo "PostgreSQL is ready."
