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
  arenaSessions,
  arenaSessionParticipants,
  arenaTranscripts,
  type ArenaSessionRow,
  type NewArenaSession,
  type ArenaSessionParticipantRow,
  type NewArenaSessionParticipant,
  type ArenaTranscriptRow,
  type NewArenaTranscript,
  agentMemories,
  arenaSessionBriefs,
  type AgentMemoryRow,
  type NewAgentMemory,
  type ArenaSessionBriefRow,
  type NewArenaSessionBrief,
} from './schema/index';

// Drizzle client and raw pool (for better-auth compatibility)
export { db, pool } from './client';

// Re-export common drizzle-orm operators so consumers don't need a direct dep
export { eq, and, or, ilike, desc, asc, sql } from 'drizzle-orm';
