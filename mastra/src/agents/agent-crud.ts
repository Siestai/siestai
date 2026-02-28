import { eq, ilike, or, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import type { NewAgent } from '../db/schema.js';

const { agents } = schema;

export async function listAgents(params?: {
  category?: string;
  search?: string;
}) {
  let query = db.select().from(agents).$dynamic();

  if (params?.category) {
    query = query.where(eq(agents.category, params.category));
  }

  if (params?.search) {
    const pattern = `%${params.search}%`;
    query = query.where(
      or(ilike(agents.name, pattern), ilike(agents.description, pattern)),
    );
  }

  return query;
}

export async function getAgent(id: string) {
  const rows = await db.select().from(agents).where(eq(agents.id, id));
  if (rows.length === 0) {
    throw new Error(`Agent not found: ${id}`);
  }
  return rows[0];
}

export async function createAgent(
  data: Omit<NewAgent, 'id' | 'createdAt' | 'updatedAt'>,
) {
  const rows = await db.insert(agents).values(data).returning();
  return rows[0];
}

export async function updateAgent(
  id: string,
  data: Partial<Omit<NewAgent, 'id' | 'createdAt' | 'updatedAt'>>,
) {
  const rows = await db
    .update(agents)
    .set({ ...data, updatedAt: sql`now()` })
    .where(eq(agents.id, id))
    .returning();
  if (rows.length === 0) {
    throw new Error(`Agent not found: ${id}`);
  }
  return rows[0];
}

export async function deleteAgent(id: string) {
  const rows = await db
    .delete(agents)
    .where(eq(agents.id, id))
    .returning({ id: agents.id });
  if (rows.length === 0) {
    throw new Error(`Agent not found: ${id}`);
  }
  return rows[0];
}
