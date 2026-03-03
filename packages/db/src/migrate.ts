import { readMigrationFiles } from 'drizzle-orm/migrator';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const folder = new URL('../drizzle', import.meta.url).pathname;
console.log('Running migrations from:', folder);

const migrations = readMigrationFiles({ migrationsFolder: folder });

try {
  // Create journal table if not exists (matches Drizzle's built-in schema)
  await pool.query('CREATE SCHEMA IF NOT EXISTS "drizzle"');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL,
      created_at BIGINT
    )
  `);

  // Get already-applied migration hashes
  const { rows: applied } = await pool.query(
    'SELECT hash FROM "drizzle"."__drizzle_migrations"',
  );
  const appliedSet = new Set(applied.map((r: { hash: string }) => r.hash));

  for (const m of migrations) {
    if (appliedSet.has(m.hash)) continue;

    console.log(`Applying migration (${m.sql.length} statements)...`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const stmt of m.sql) {
        await client.query(stmt);
      }
      await client.query(
        'INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)',
        [m.hash, Date.now()],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  console.log('Migrations completed successfully.');
} catch (err) {
  console.error('Migration failed:', (err as Error).message);
  process.exit(1);
} finally {
  await pool.end();
}
