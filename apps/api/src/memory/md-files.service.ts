import { Injectable, Logger } from '@nestjs/common';
import {
  db,
  agentMdFiles,
  teamMdFiles,
  agents,
  eq,
  and,
} from '@siestai/db';

const AGENT_FILE_KEYS = ['IDENTITY', 'INSTRUCTIONS', 'KNOWLEDGE'] as const;
const TEAM_FILE_KEYS = ['GOALS', 'CONTEXT', 'RULES'] as const;

export type AgentFileKey = (typeof AGENT_FILE_KEYS)[number];
export type TeamFileKey = (typeof TEAM_FILE_KEYS)[number];

@Injectable()
export class MdFilesService {
  private readonly logger = new Logger(MdFilesService.name);

  // ─── Agent MD Files ──────────────────────────────────────────────

  async getAgentMdFiles(agentId: string) {
    return db
      .select()
      .from(agentMdFiles)
      .where(eq(agentMdFiles.agentId, agentId));
  }

  async getAgentMdFile(agentId: string, fileKey: AgentFileKey) {
    const rows = await db
      .select()
      .from(agentMdFiles)
      .where(
        and(
          eq(agentMdFiles.agentId, agentId),
          eq(agentMdFiles.fileKey, fileKey),
        ),
      );
    return rows[0] ?? null;
  }

  async upsertAgentMdFile(
    agentId: string,
    fileKey: AgentFileKey,
    content: string,
    updatedBy: 'user' | 'system' = 'user',
  ) {
    const existing = await this.getAgentMdFile(agentId, fileKey);

    if (existing) {
      const [updated] = await db
        .update(agentMdFiles)
        .set({
          content,
          version: existing.version + 1,
          updatedAt: new Date(),
          updatedBy,
        })
        .where(eq(agentMdFiles.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(agentMdFiles)
      .values({ agentId, fileKey, content, updatedBy })
      .returning();
    return created;
  }

  async initAgentMdFiles(agentId: string, instructions?: string) {
    const existing = await this.getAgentMdFiles(agentId);
    if (existing.length > 0) return existing;

    const values = AGENT_FILE_KEYS.map((key) => ({
      agentId,
      fileKey: key,
      content: key === 'INSTRUCTIONS' && instructions ? instructions : '',
      updatedBy: 'system' as const,
    }));

    return db.insert(agentMdFiles).values(values).returning();
  }

  /**
   * Lazy migration: if no MD files exist, bootstrap from agent.instructions column.
   */
  async ensureAgentMdFiles(agentId: string) {
    const existing = await this.getAgentMdFiles(agentId);
    if (existing.length > 0) return existing;

    // Fetch agent instructions for migration
    const agentRows = await db
      .select({ instructions: agents.instructions })
      .from(agents)
      .where(eq(agents.id, agentId));

    const instructions = agentRows[0]?.instructions ?? '';
    return this.initAgentMdFiles(agentId, instructions);
  }

  // ─── Team MD Files ───────────────────────────────────────────────

  async getTeamMdFiles(teamId: string) {
    return db
      .select()
      .from(teamMdFiles)
      .where(eq(teamMdFiles.teamId, teamId));
  }

  async getTeamMdFile(teamId: string, fileKey: TeamFileKey) {
    const rows = await db
      .select()
      .from(teamMdFiles)
      .where(
        and(
          eq(teamMdFiles.teamId, teamId),
          eq(teamMdFiles.fileKey, fileKey),
        ),
      );
    return rows[0] ?? null;
  }

  async upsertTeamMdFile(
    teamId: string,
    fileKey: TeamFileKey,
    content: string,
    updatedBy: 'user' | 'system' = 'user',
  ) {
    const existing = await this.getTeamMdFile(teamId, fileKey);

    if (existing) {
      const [updated] = await db
        .update(teamMdFiles)
        .set({
          content,
          version: existing.version + 1,
          updatedAt: new Date(),
          updatedBy,
        })
        .where(eq(teamMdFiles.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(teamMdFiles)
      .values({ teamId, fileKey, content, updatedBy })
      .returning();
    return created;
  }

  async initTeamMdFiles(teamId: string) {
    const existing = await this.getTeamMdFiles(teamId);
    if (existing.length > 0) return existing;

    const values = TEAM_FILE_KEYS.map((key) => ({
      teamId,
      fileKey: key,
      content: '',
      updatedBy: 'system' as const,
    }));

    return db.insert(teamMdFiles).values(values).returning();
  }
}
