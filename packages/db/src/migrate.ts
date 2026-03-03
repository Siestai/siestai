import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

try {
  await migrate(db, { migrationsFolder: new URL('../drizzle', import.meta.url).pathname });
  console.log('Drizzle migrations completed successfully.');
} catch (err) {
  console.error('Migration failed:', (err as Error).message);
  process.exit(1);
} finally {
  await pool.end();
}
