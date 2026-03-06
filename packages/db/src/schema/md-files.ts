import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { agents } from './agents.js';
import { teams } from './teams.js';

export const agentMdFiles = pgTable(
  'agent_md_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    fileKey: varchar('file_key', { length: 20 }).notNull(), // IDENTITY | KNOWLEDGE | INSTRUCTIONS
    content: text('content').notNull().default(''),
    version: integer('version').notNull().default(1),
    updatedAt: timestamp('updated_at').defaultNow(),
    updatedBy: varchar('updated_by', { length: 10 }).default('system'), // 'user' | 'system'
  },
  (table) => [unique('agent_md_files_agent_key_unique').on(table.agentId, table.fileKey)],
);

export const teamMdFiles = pgTable(
  'team_md_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    fileKey: varchar('file_key', { length: 20 }).notNull(), // GOALS | CONTEXT | RULES
    content: text('content').notNull().default(''),
    version: integer('version').notNull().default(1),
    updatedAt: timestamp('updated_at').defaultNow(),
    updatedBy: varchar('updated_by', { length: 10 }).default('system'),
  },
  (table) => [unique('team_md_files_team_key_unique').on(table.teamId, table.fileKey)],
);

export type AgentMdFileRow = typeof agentMdFiles.$inferSelect;
export type NewAgentMdFile = typeof agentMdFiles.$inferInsert;
export type TeamMdFileRow = typeof teamMdFiles.$inferSelect;
export type NewTeamMdFile = typeof teamMdFiles.$inferInsert;
