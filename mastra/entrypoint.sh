#!/bin/sh
set -e

# Run Drizzle migrations via drizzle-orm's migrator (no drizzle-kit needed)
node -e "
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);
await migrate(db, { migrationsFolder: './drizzle' });
await pool.end();
console.log('Migrations complete');
" && echo "DB ready" || echo "Migration failed, continuing anyway..."

# Start the server
exec node .mastra/output/index.mjs
