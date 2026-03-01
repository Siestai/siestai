import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
} from 'drizzle-orm/pg-core';
import { agents } from './agents.js';

export const agentFiles = pgTable('agent_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  filename: varchar('filename', { length: 255 }).notNull(),
  filePath: text('file_path').notNull(),
  mimeType: varchar('mime_type', { length: 100 }),
  fileSize: integer('file_size'),
  createdAt: timestamp('created_at').defaultNow(),
});
