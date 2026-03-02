import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { user } from './auth';

export const agentSourceEnum = pgEnum('agent_source', [
  'mastra',
  'livekit',
  'external',
]);

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description').default(''),
  instructions: text('instructions').notNull(),
  category: varchar('category', { length: 50 }).default('conversational'),
  tags: jsonb('tags').$type<string[]>().default([]),
  color: varchar('color', { length: 7 }).default('#3b82f6'),
  icon: varchar('icon', { length: 50 }).default('bot'),
  source: agentSourceEnum('source').default('mastra'),
  llmModel: varchar('llm_model', { length: 100 }),
  isOnline: boolean('is_online').default(true),
  userId: text('user_id').references(() => user.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
