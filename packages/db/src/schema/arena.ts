import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { user } from './auth.js';
import { agents } from './agents.js';
import { teams } from './teams.js';

export const arenaSessions = pgTable('arena_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  topic: text('topic'),
  mode: varchar('mode', { length: 50 }).notNull(),
  participationMode: varchar('participation_mode', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).default('waiting').notNull(),
  roomName: varchar('room_name', { length: 255 }),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
  createdBy: text('created_by').references(() => user.id),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const arenaSessionParticipants = pgTable('arena_session_participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => arenaSessions.id, { onDelete: 'cascade' }),
  agentId: uuid('agent_id').references(() => agents.id),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  instructions: text('instructions'),
  color: varchar('color', { length: 7 }).default('#3b82f6'),
  joinedAt: timestamp('joined_at').defaultNow(),
}, (table) => [
  index('arena_session_participants_agent_id_idx').on(table.agentId),
]);

export const arenaTranscripts = pgTable('arena_transcripts', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => arenaSessions.id, { onDelete: 'cascade' }),
  speakerName: varchar('speaker_name', { length: 100 }).notNull(),
  speakerType: varchar('speaker_type', { length: 20 }).notNull(),
  content: text('content').notNull(),
  source: varchar('source', { length: 10 }).notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
});

export type ArenaSessionRow = typeof arenaSessions.$inferSelect;
export type NewArenaSession = typeof arenaSessions.$inferInsert;
export type ArenaSessionParticipantRow =
  typeof arenaSessionParticipants.$inferSelect;
export type NewArenaSessionParticipant =
  typeof arenaSessionParticipants.$inferInsert;
export type ArenaTranscriptRow = typeof arenaTranscripts.$inferSelect;
export type NewArenaTranscript = typeof arenaTranscripts.$inferInsert;
