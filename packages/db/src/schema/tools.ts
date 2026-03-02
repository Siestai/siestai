import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  unique,
} from 'drizzle-orm/pg-core';
import { agents } from './agents';

export const tools = pgTable('tools', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description').default(''),
  icon: varchar('icon', { length: 50 }).default('wrench'),
  category: varchar('category', { length: 50 }).default('utility'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const agentTools = pgTable(
  'agent_tools',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),
    config: jsonb('config').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [unique().on(t.agentId, t.toolId)],
);
