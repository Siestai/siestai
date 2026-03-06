import { Injectable, Logger } from '@nestjs/common';
import {
  db,
  agentMemories,
  teamMemories,
  adhocMemories,
  eq,
  and,
  desc,
  sql,
} from '@siestai/db';
import { EmbeddingService } from './embedding.service';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(private readonly embeddingService: EmbeddingService) {}

  // ─── Agent Memories ──────────────────────────────────────────────

  async createAgentMemory(params: {
    agentId: string;
    content: string;
    memoryType: string;
    sourceSessionId?: string;
    importance?: number;
  }) {
    let embedding: number[] | undefined;
    try {
      embedding = await this.embeddingService.embed(params.content);
    } catch (err) {
      this.logger.warn(`Failed to embed agent memory: ${err}`);
    }

    const [row] = await db
      .insert(agentMemories)
      .values({
        agentId: params.agentId,
        content: params.content,
        embedding: embedding ?? null,
        memoryType: params.memoryType,
        sourceSessionId: params.sourceSessionId ?? null,
        importance: params.importance ?? 0.5,
      })
      .returning();

    return row;
  }

  async searchAgentMemories(agentId: string, query: string, topK = 5) {
    const queryEmbedding = await this.embeddingService.embed(query);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const results = await db.execute(sql`
      SELECT
        id, agent_id, content, memory_type, importance, created_at, last_accessed_at,
        (0.5 * (1 - (embedding <=> ${embeddingStr}::vector)))
        + (0.3 * importance)
        + (0.2 * exp(-0.05 * EXTRACT(EPOCH FROM (now() - last_accessed_at)) / 86400))
        AS score
      FROM agent_memories
      WHERE agent_id = ${agentId}
        AND embedding IS NOT NULL
      ORDER BY score DESC
      LIMIT ${topK}
    `);

    return results.rows;
  }

  async getRecentAgentMemories(agentId: string, limit = 10) {
    return db
      .select()
      .from(agentMemories)
      .where(eq(agentMemories.agentId, agentId))
      .orderBy(desc(agentMemories.createdAt))
      .limit(limit);
  }

  async touchMemory(id: string, table: 'agent' | 'team' | 'adhoc' = 'agent') {
    const target =
      table === 'team' ? teamMemories :
      table === 'adhoc' ? adhocMemories :
      agentMemories;

    await db
      .update(target)
      .set({ lastAccessedAt: new Date() })
      .where(eq(target.id, id));
  }

  // ─── Team Memories ───────────────────────────────────────────────

  async createTeamMemory(params: {
    teamId: string;
    content: string;
    memoryType: string;
    sourceSessionId?: string;
    createdByAgentId?: string;
    importance?: number;
  }) {
    let embedding: number[] | undefined;
    try {
      embedding = await this.embeddingService.embed(params.content);
    } catch (err) {
      this.logger.warn(`Failed to embed team memory: ${err}`);
    }

    const [row] = await db
      .insert(teamMemories)
      .values({
        teamId: params.teamId,
        content: params.content,
        embedding: embedding ?? null,
        memoryType: params.memoryType,
        sourceSessionId: params.sourceSessionId ?? null,
        createdByAgentId: params.createdByAgentId ?? null,
        importance: params.importance ?? 0.5,
      })
      .returning();

    return row;
  }

  async searchTeamMemories(teamId: string, query: string, topK = 5) {
    const queryEmbedding = await this.embeddingService.embed(query);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const results = await db.execute(sql`
      SELECT
        id, team_id, content, memory_type, importance, created_at, last_accessed_at,
        (0.5 * (1 - (embedding <=> ${embeddingStr}::vector)))
        + (0.3 * importance)
        + (0.2 * exp(-0.05 * EXTRACT(EPOCH FROM (now() - last_accessed_at)) / 86400))
        AS score
      FROM team_memories
      WHERE team_id = ${teamId}
        AND embedding IS NOT NULL
      ORDER BY score DESC
      LIMIT ${topK}
    `);

    return results.rows;
  }

  async getRecentTeamMemories(teamId: string, limit = 10) {
    return db
      .select()
      .from(teamMemories)
      .where(eq(teamMemories.teamId, teamId))
      .orderBy(desc(teamMemories.createdAt))
      .limit(limit);
  }

  // ─── Ad-hoc Memories ─────────────────────────────────────────────

  async createAdhocMemory(params: {
    userId: string;
    content: string;
    memoryType: string;
    sourceSessionId?: string;
    participantAgentIds?: string[];
    importance?: number;
  }) {
    let embedding: number[] | undefined;
    try {
      embedding = await this.embeddingService.embed(params.content);
    } catch (err) {
      this.logger.warn(`Failed to embed adhoc memory: ${err}`);
    }

    const [row] = await db
      .insert(adhocMemories)
      .values({
        userId: params.userId,
        content: params.content,
        embedding: embedding ?? null,
        memoryType: params.memoryType,
        sourceSessionId: params.sourceSessionId ?? null,
        participantAgentIds: params.participantAgentIds ?? [],
        importance: params.importance ?? 0.5,
      })
      .returning();

    return row;
  }

  async searchAdhocMemories(userId: string, query: string, topK = 5) {
    const queryEmbedding = await this.embeddingService.embed(query);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const results = await db.execute(sql`
      SELECT
        id, user_id, content, memory_type, importance, created_at, last_accessed_at,
        (0.5 * (1 - (embedding <=> ${embeddingStr}::vector)))
        + (0.3 * importance)
        + (0.2 * exp(-0.05 * EXTRACT(EPOCH FROM (now() - last_accessed_at)) / 86400))
        AS score
      FROM adhoc_memories
      WHERE user_id = ${userId}
        AND embedding IS NOT NULL
      ORDER BY score DESC
      LIMIT ${topK}
    `);

    return results.rows;
  }
}
