import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { user } from './auth.js';
import { agents } from './agents.js';

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description').default(''),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const teamAgents = pgTable(
  'team_agents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 50 }).default('member'),
    joinedAt: timestamp('joined_at').defaultNow(),
  },
  (table) => [unique('team_agents_team_agent_unique').on(table.teamId, table.agentId)],
);

export type TeamRow = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamAgentRow = typeof teamAgents.$inferSelect;
export type NewTeamAgent = typeof teamAgents.$inferInsert;
