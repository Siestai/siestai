// Schema tables and types
export {
  user,
  session,
  account,
  verification,
  agentSourceEnum,
  agents,
  agentFiles,
  tools,
  agentTools,
  type Agent,
  type NewAgent,
} from './schema/index.js';

// Drizzle client and raw pool (for better-auth compatibility)
export { db, pool } from './client.js';

// Re-export common drizzle-orm operators so consumers don't need a direct dep
export { eq, and, or, ilike, desc, asc, sql } from 'drizzle-orm';
