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
import { agents } from './agents.js';
import { user } from './auth.js';

export const tools = pgTable('tools', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description').default(''),
  icon: varchar('icon', { length: 50 }).default('wrench'),
  category: varchar('category', { length: 50 }).default('utility'),
  type: varchar('type', { length: 20 }).notNull().default('builtin'),
  slug: varchar('slug', { length: 50 }).notNull().unique(),
  oauthProvider: varchar('oauth_provider', { length: 50 }),
  requiredScopes: jsonb('required_scopes').$type<string[]>().default([]),
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

export const toolCredentials = pgTable(
  'tool_credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at'),
    scope: text('scope'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [unique().on(t.toolId, t.userId)],
);

export type ToolRow = typeof tools.$inferSelect;
export type NewTool = typeof tools.$inferInsert;
export type ToolCredentialRow = typeof toolCredentials.$inferSelect;
export type NewToolCredential = typeof toolCredentials.$inferInsert;
