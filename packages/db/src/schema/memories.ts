import {
  pgTable,
  uuid,
  varchar,
  text,
  real,
  integer,
  date,
  timestamp,
  jsonb,
  unique,
  index,
  customType,
} from 'drizzle-orm/pg-core';
import { agents } from './agents.js';
import { arenaSessions } from './arena.js';
import { teams } from './teams.js';
import { user } from './auth.js';

// pgvector column type
const vector = customType<{ data: number[]; driverParam: string }>({
  dataType() {
    return 'vector(1536)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: unknown): number[] {
    if (typeof value === 'string') {
      return value.replace(/[\[\]]/g, '').split(',').map(Number);
    }
    return value as number[];
  },
});

// --- Agent Memories (vector-backed) ---

export const agentMemories = pgTable(
  'agent_memories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    embedding: vector('embedding'),
    memoryType: varchar('memory_type', { length: 30 }).notNull(), // fact | preference | skill | insight
    sourceSessionId: uuid('source_session_id').references(() => arenaSessions.id, {
      onDelete: 'set null',
    }),
    importance: real('importance').default(0.5),
    createdAt: timestamp('created_at').defaultNow(),
    lastAccessedAt: timestamp('last_accessed_at').defaultNow(),
  },
  (table) => [
    index('agent_memories_agent_id_idx').on(table.agentId),
  ],
);

// --- Team Memories ---

export const teamMemories = pgTable(
  'team_memories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    embedding: vector('embedding'),
    memoryType: varchar('memory_type', { length: 30 }).notNull(), // decision | summary | context | knowledge
    sourceSessionId: uuid('source_session_id').references(() => arenaSessions.id, {
      onDelete: 'set null',
    }),
    createdByAgentId: uuid('created_by_agent_id').references(() => agents.id, {
      onDelete: 'set null',
    }),
    importance: real('importance').default(0.5),
    createdAt: timestamp('created_at').defaultNow(),
    lastAccessedAt: timestamp('last_accessed_at').defaultNow(),
  },
  (table) => [
    index('team_memories_team_id_idx').on(table.teamId),
  ],
);

// --- Ad-hoc Memories (sessions without a team) ---

export const adhocMemories = pgTable(
  'adhoc_memories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    embedding: vector('embedding'),
    memoryType: varchar('memory_type', { length: 30 }).notNull(),
    sourceSessionId: uuid('source_session_id').references(() => arenaSessions.id, {
      onDelete: 'set null',
    }),
    participantAgentIds: jsonb('participant_agent_ids').$type<string[]>().default([]),
    importance: real('importance').default(0.5),
    createdAt: timestamp('created_at').defaultNow(),
    lastAccessedAt: timestamp('last_accessed_at').defaultNow(),
  },
  (table) => [
    index('adhoc_memories_user_id_idx').on(table.userId),
  ],
);

// --- Daily Memory Files ---

export const dailyMemoryFiles = pgTable(
  'daily_memory_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scopeType: varchar('scope_type', { length: 10 }).notNull(), // 'agent' | 'team'
    scopeId: uuid('scope_id').notNull(),
    date: date('date').notNull(),
    content: text('content').notNull().default(''),
    embedding: vector('embedding'),
    status: varchar('status', { length: 10 }).default('active').notNull(), // active | warm | archived
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    unique('daily_memory_files_scope_date_unique').on(table.scopeType, table.scopeId, table.date),
    index('daily_memory_files_scope_idx').on(table.scopeType, table.scopeId),
  ],
);

// --- Arena Session Briefs (kept from original) ---

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

// Type exports
export type AgentMemoryRow = typeof agentMemories.$inferSelect;
export type NewAgentMemory = typeof agentMemories.$inferInsert;
export type TeamMemoryRow = typeof teamMemories.$inferSelect;
export type NewTeamMemory = typeof teamMemories.$inferInsert;
export type AdhocMemoryRow = typeof adhocMemories.$inferSelect;
export type NewAdhocMemory = typeof adhocMemories.$inferInsert;
export type DailyMemoryFileRow = typeof dailyMemoryFiles.$inferSelect;
export type NewDailyMemoryFile = typeof dailyMemoryFiles.$inferInsert;
export type ArenaSessionBriefRow = typeof arenaSessionBriefs.$inferSelect;
export type NewArenaSessionBrief = typeof arenaSessionBriefs.$inferInsert;
