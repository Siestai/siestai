import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { MemoryExtractionService } from './memory-extraction.service';
import { CreateArenaSessionDto } from './dto/create-arena-session.dto';
import {
  ArenaSession,
  ArenaParticipant,
  ArenaParticipantStatus,
  ArenaParticipantType,
  ArenaMode,
  ParticipationMode,
} from './arena.interfaces';
import {
  db,
  arenaSessions,
  arenaSessionParticipants,
  arenaTranscripts,
  agentMemories,
  arenaSessionBriefs,
  eq,
  and,
  desc,
  type ArenaSessionRow,
  type ArenaSessionParticipantRow,
} from '@siestai/db';

const AGENT_COLORS = [
  '#3b82f6',
  '#22c55e',
  '#eab308',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
];

const CACHE_TTL_MS = 30_000;

interface ParticipantExtras {
  status: ArenaParticipantStatus;
  platform?: string;
  model?: string;
}

@Injectable()
export class ArenaService {
  private readonly logger = new Logger(ArenaService.name);

  /** Short-lived cache to avoid DB round-trips on gateway hot path (30s TTL) */
  private sessionCache = new Map<
    string,
    { session: ArenaSession; cachedAt: number }
  >();

  /** Ephemeral participant data not stored in DB (status, platform, model) */
  private participantExtras = new Map<string, ParticipantExtras>();

  constructor(
    private readonly invitationService: InvitationService,
    private readonly memoryExtraction: MemoryExtractionService,
  ) {}

  async createSession(dto: CreateArenaSessionDto): Promise<{
    session: ArenaSession;
    invite: { token: string; url: string; expiresAt: string };
    hostToken: string;
  }> {
    const [sessionRow] = await db
      .insert(arenaSessions)
      .values({
        topic: dto.topic,
        mode: dto.mode || 'group',
        participationMode: dto.participationMode || 'human_collab',
        status: 'waiting',
      })
      .returning();

    const nativeAgents = dto.nativeAgents || [];
    let participantRows: ArenaSessionParticipantRow[] = [];

    if (nativeAgents.length > 0) {
      participantRows = await db
        .insert(arenaSessionParticipants)
        .values(
          nativeAgents.map((agent, i) => ({
            sessionId: sessionRow.id,
            agentId: agent.agentId ?? null,
            name: agent.name,
            type: 'native_agent',
            instructions: agent.instructions ?? null,
            color: AGENT_COLORS[i % AGENT_COLORS.length],
          })),
        )
        .returning();
    }

    for (const p of participantRows) {
      this.participantExtras.set(p.id, { status: 'invited' });
    }

    const session = this.mapToSession(sessionRow, participantRows);

    const invite = this.invitationService.generateInvite(sessionRow.id);
    const url = this.invitationService.buildInviteUrl(invite.token);
    const hostToken = this.invitationService.generateHostToken(sessionRow.id);

    return {
      session,
      invite: { token: invite.token, url, expiresAt: invite.expiresAt },
      hostToken,
    };
  }

  async getSession(id: string): Promise<ArenaSession> {
    const cached = this.getCached(id);
    if (cached) return cached;

    const sessionRows = await db
      .select()
      .from(arenaSessions)
      .where(eq(arenaSessions.id, id));

    if (sessionRows.length === 0) {
      throw new NotFoundException(`Arena session ${id} not found`);
    }

    const participantRows = await db
      .select()
      .from(arenaSessionParticipants)
      .where(eq(arenaSessionParticipants.sessionId, id));

    const session = this.mapToSession(sessionRows[0], participantRows);
    this.sessionCache.set(id, { session, cachedAt: Date.now() });

    return session;
  }

  async addExternalParticipant(
    sessionId: string,
    name: string,
    platform?: string,
    model?: string,
  ): Promise<ArenaParticipant> {
    const existing = await db
      .select()
      .from(arenaSessionParticipants)
      .where(eq(arenaSessionParticipants.sessionId, sessionId));

    const colorIndex = existing.length % AGENT_COLORS.length;

    const [row] = await db
      .insert(arenaSessionParticipants)
      .values({
        sessionId,
        name,
        type: 'external_agent',
        color: AGENT_COLORS[colorIndex],
      })
      .returning();

    this.participantExtras.set(row.id, {
      status: 'connected',
      platform,
      model,
    });

    this.invalidateCache(sessionId);

    return this.mapToParticipant(row);
  }

  async updateParticipantStatus(
    sessionId: string,
    participantId: string,
    status: ArenaParticipantStatus,
  ): Promise<void> {
    const extras = this.participantExtras.get(participantId);
    if (extras) {
      extras.status = status;
    } else {
      this.participantExtras.set(participantId, { status });
    }
    this.invalidateCache(sessionId);
  }

  async updateParticipantInfo(
    sessionId: string,
    participantId: string,
    data: { name?: string; platform?: string; model?: string },
  ): Promise<void> {
    if (data.name) {
      await db
        .update(arenaSessionParticipants)
        .set({ name: data.name })
        .where(eq(arenaSessionParticipants.id, participantId));
    }

    const extras = this.participantExtras.get(participantId);
    if (extras) {
      if (data.platform) extras.platform = data.platform;
      if (data.model) extras.model = data.model;
    }

    this.invalidateCache(sessionId);
  }

  async validateCanStart(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session.status !== 'waiting') {
      throw new BadRequestException(
        `Session ${sessionId} is not in 'waiting' status`,
      );
    }
  }

  async startSession(sessionId: string, roomName: string): Promise<void> {
    const result = await db
      .update(arenaSessions)
      .set({
        status: 'active',
        startedAt: new Date(),
        roomName,
      })
      .where(
        and(
          eq(arenaSessions.id, sessionId),
          eq(arenaSessions.status, 'waiting'),
        ),
      )
      .returning();

    if (result.length === 0) {
      throw new BadRequestException(
        `Session ${sessionId} is not in 'waiting' status`,
      );
    }

    this.invalidateCache(sessionId);
  }

  async endSession(sessionId: string): Promise<void> {
    const result = await db
      .update(arenaSessions)
      .set({
        status: 'ended',
        endedAt: new Date(),
      })
      .where(
        and(
          eq(arenaSessions.id, sessionId),
          eq(arenaSessions.status, 'active'),
        ),
      )
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(
        `Arena session ${sessionId} not found or not active`,
      );
    }

    this.invalidateCache(sessionId);

    // Fire-and-forget: trigger async LLM extraction
    this.triggerSessionEndExtraction(sessionId);
  }

  async saveTranscript(
    sessionId: string,
    speakerName: string,
    speakerType: string,
    content: string,
    source: string,
  ): Promise<void> {
    await db.insert(arenaTranscripts).values({
      sessionId,
      speakerName,
      speakerType,
      content,
      source,
    });
  }

  async getSessionParticipantRows(sessionId: string) {
    return db
      .select()
      .from(arenaSessionParticipants)
      .where(eq(arenaSessionParticipants.sessionId, sessionId));
  }

  // ─── Extraction Pipeline ───────────────────────────────────────────

  private triggerSessionEndExtraction(sessionId: string): void {
    this.runExtraction(sessionId).catch((err) => {
      this.logger.error(
        `Memory extraction failed for session ${sessionId}: ${err.message}`,
        err.stack,
      );
    });
  }

  private async runExtraction(sessionId: string): Promise<void> {
    const transcripts = await db
      .select()
      .from(arenaTranscripts)
      .where(eq(arenaTranscripts.sessionId, sessionId));

    if (transcripts.length === 0) {
      this.logger.log(`No transcripts for session ${sessionId}, skipping extraction`);
      return;
    }

    const participants = await db
      .select()
      .from(arenaSessionParticipants)
      .where(eq(arenaSessionParticipants.sessionId, sessionId));

    const transcriptText =
      this.memoryExtraction.formatTranscriptForExtraction(transcripts);

    const agentNames = participants.map((p) => p.name);

    // Extract per-agent memories (only for native agents with an agentId)
    const nativeAgents = participants.filter(
      (p) => p.type === 'native_agent' && p.agentId,
    );

    for (const agent of nativeAgents) {
      try {
        const memories = await this.memoryExtraction.extractAgentMemories(
          agent.name,
          transcriptText,
        );

        if (memories.length > 0) {
          await db.insert(agentMemories).values(
            memories.map((m) => ({
              agentId: agent.agentId!,
              sessionId,
              category: m.category,
              content: m.content,
              confidence: m.confidence,
            })),
          );
        }

        this.logger.log(
          `Extracted ${memories.length} memories for agent "${agent.name}" in session ${sessionId}`,
        );
      } catch (err) {
        this.logger.error(
          `Agent memory extraction failed for "${agent.name}": ${err}`,
        );
      }
    }

    // Extract session brief
    try {
      const brief = await this.memoryExtraction.extractSessionBrief(
        transcriptText,
        agentNames,
      );

      await db.insert(arenaSessionBriefs).values({
        sessionId,
        decisions: brief.decisions,
        actionItems: brief.actionItems,
        unresolved: brief.unresolved,
        nextSessionQuestions: brief.nextSessionQuestions,
      });

      this.logger.log(`Extracted session brief for session ${sessionId}`);
    } catch (err) {
      this.logger.error(`Session brief extraction failed: ${err}`);
    }
  }

  // ─── Query Methods ────────────────────────────────────────────────

  async getSessionBrief(sessionId: string) {
    const rows = await db
      .select()
      .from(arenaSessionBriefs)
      .where(eq(arenaSessionBriefs.sessionId, sessionId));

    return rows.length > 0 ? rows[0] : null;
  }

  async getAgentMemoriesForSession(sessionId: string) {
    return db
      .select()
      .from(agentMemories)
      .where(eq(agentMemories.sessionId, sessionId));
  }

  private mapToSession(
    row: ArenaSessionRow,
    participants: ArenaSessionParticipantRow[],
  ): ArenaSession {
    const createdAt = row.createdAt ?? new Date();
    return {
      id: row.id,
      topic: row.topic ?? undefined,
      mode: row.mode as ArenaMode,
      participationMode: row.participationMode as ParticipationMode,
      status: row.status as ArenaSession['status'],
      participants: participants.map((p) => this.mapToParticipant(p)),
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + 3600 * 1000).toISOString(),
      roomName: row.roomName ?? undefined,
    };
  }

  private mapToParticipant(
    row: ArenaSessionParticipantRow,
  ): ArenaParticipant {
    const extras = this.participantExtras.get(row.id);
    const defaultStatus: ArenaParticipantStatus =
      row.type === 'external_agent' ? 'connected' : 'invited';

    return {
      id: row.id,
      name: row.name,
      type: row.type as ArenaParticipantType,
      instructions: row.instructions ?? undefined,
      status: extras?.status ?? defaultStatus,
      color: row.color ?? '#3b82f6',
      platform: extras?.platform,
      model: extras?.model,
      joinedAt: row.joinedAt?.toISOString(),
    };
  }

  private getCached(id: string): ArenaSession | null {
    const entry = this.sessionCache.get(id);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      this.sessionCache.delete(id);
      return null;
    }
    return entry.session;
  }

  private invalidateCache(sessionId: string): void {
    this.sessionCache.delete(sessionId);
  }
}
