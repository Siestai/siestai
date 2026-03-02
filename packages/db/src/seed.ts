import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
dotenv.config({ path: path.join(root, '.env.local') });
dotenv.config({ path: path.join(root, '.env') });
import { Pool } from 'pg';
import { tools } from './schema/tools.js';
import { sql } from 'drizzle-orm';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool);

const INITIAL_TOOLS = [
  {
    slug: 'github',
    name: 'GitHub',
    description:
      'Search repositories, list issues, and read file contents from GitHub.',
    type: 'oauth',
    icon: 'github',
    category: 'development',
    oauthProvider: 'github',
    requiredScopes: ['repo', 'read:user'],
  },
  {
    slug: 'gmail',
    name: 'Gmail',
    description: 'Send emails via your connected Gmail account.',
    type: 'oauth',
    icon: 'mail',
    category: 'communication',
    oauthProvider: 'google',
    requiredScopes: ['https://www.googleapis.com/auth/gmail.send'],
  },
  {
    slug: 'web_search',
    name: 'Web Search',
    description: 'Search the web for real-time information using Tavily.',
    type: 'api_key',
    icon: 'search',
    category: 'research',
  },
] as const;

async function seed() {
  console.log('Seeding tools...');

  for (const tool of INITIAL_TOOLS) {
    await db
      .insert(tools)
      .values(tool as typeof tools.$inferInsert)
      .onConflictDoUpdate({
        target: tools.slug,
        set: {
          name: sql`EXCLUDED.name`,
          description: sql`EXCLUDED.description`,
          type: sql`EXCLUDED.type`,
          icon: sql`EXCLUDED.icon`,
          category: sql`EXCLUDED.category`,
          oauthProvider: sql`EXCLUDED.oauth_provider`,
          requiredScopes: sql`EXCLUDED.required_scopes`,
        },
      });
    console.log(`  ✓ ${tool.name}`);
  }

  console.log('Seed complete.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
