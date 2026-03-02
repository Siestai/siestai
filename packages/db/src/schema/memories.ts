import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  unique,
} from 'drizzle-orm/pg-core';
import { agents } from './agents';
import { arenaSessions } from './arena';

export const agentMemories = pgTable('agent_memories', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => arenaSessions.id, { onDelete: 'cascade' }),
  category: varchar('category', { length: 30 }).notNull(),
  content: text('content').notNull(),
  confidence: varchar('confidence', { length: 10 }).default('medium'),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at'),
});

export const arenaSessionBriefs = pgTable(
  'arena_session_briefs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => arenaSessions.id, { onDelete: 'cascade' }),
    decisions: jsonb('decisions')
      .$type<{ text: string; confidence: string }[]>()
      .default([]),
    actionItems: jsonb('action_items')
      .$type<{ owner: string; task: string; deadline?: string }[]>()
      .default([]),
    unresolved: jsonb('unresolved')
      .$type<{ topic: string; positions: string[] }[]>()
      .default([]),
    nextSessionQuestions: jsonb('next_session_questions')
      .$type<string[]>()
      .default([]),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [unique('arena_session_briefs_session_id_unique').on(table.sessionId)],
);

export type AgentMemoryRow = typeof agentMemories.$inferSelect;
export type NewAgentMemory = typeof agentMemories.$inferInsert;
export type ArenaSessionBriefRow = typeof arenaSessionBriefs.$inferSelect;
export type NewArenaSessionBrief = typeof arenaSessionBriefs.$inferInsert;
