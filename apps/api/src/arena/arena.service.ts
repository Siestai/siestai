import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { MemoryExtractionService } from './memory-extraction.service';
import { CreateArenaSessionDto } from './dto/create-arena-session.dto';
import { MemoryService } from '../memory/memory.service';
import { ContextAssemblyService } from '../memory/context-assembly.service';
import { RedisService } from '../memory/redis.service';
import { DailyFileService } from '../memory/daily-file.service';
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
    private readonly memoryService: MemoryService,
    private readonly contextAssembly: ContextAssemblyService,
    private readonly redisService: RedisService,
    private readonly dailyFileService: DailyFileService,
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
        teamId: dto.teamId ?? null,
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

    // Clean up ephemeral participant data to prevent memory leak
    const participants = await this.getSessionParticipantRows(sessionId);
    for (const p of participants) {
      this.participantExtras.delete(p.id);
    }

    // Flush Redis working memory
    this.redisService.flushSession(sessionId).catch((err) => {
      this.logger.warn(`Redis flush failed for session ${sessionId}: ${err}`);
    });

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
    const startTime = Date.now();
    this.logger.log(`[extraction] Starting for session ${sessionId}`);

    const transcripts = await db
      .select()
      .from(arenaTranscripts)
      .where(eq(arenaTranscripts.sessionId, sessionId));

    if (transcripts.length === 0) {
      this.logger.log(`[extraction] No transcripts for session ${sessionId}, skipping`);
      return;
    }

    this.logger.log(`[extraction] Found ${transcripts.length} transcript entries`);

    const [participants, sessionRows] = await Promise.all([
      db
        .select()
        .from(arenaSessionParticipants)
        .where(eq(arenaSessionParticipants.sessionId, sessionId)),
      db
        .select()
        .from(arenaSessions)
        .where(eq(arenaSessions.id, sessionId)),
    ]);

    const sessionRow = sessionRows[0];
    const transcriptText =
      this.memoryExtraction.formatTranscriptForExtraction(transcripts);
    const agentNames = participants.map((p) => p.name);
    const nativeAgents = participants.filter(
      (p) => p.type === 'native_agent' && p.agentId,
    );
    const teamId = sessionRow?.teamId;
    const today = new Date().toISOString().split('T')[0];

    this.logger.log(`[extraction] ${nativeAgents.length} native agents, teamId=${teamId ?? 'none'}`);

    // Run ALL LLM extractions in parallel
    const briefPromise = this.extractBrief(sessionId, transcriptText, agentNames);
    const agentMemPromises = nativeAgents.map((agent) =>
      this.extractAndSaveAgentMemories(sessionId, agent, transcriptText),
    );
    const scopeMemPromise = this.extractScopeMemories(
      sessionId, sessionRow, transcriptText, nativeAgents, agentNames, teamId, today,
    );

    await Promise.all([briefPromise, ...agentMemPromises, scopeMemPromise]);

    // Daily files are cheap DB writes, run after
    await this.appendDailyFiles(sessionRow, nativeAgents, agentNames, teamId, today);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    this.logger.log(`[extraction] Completed for session ${sessionId} in ${elapsed}s`);
  }

  private async extractBrief(
    sessionId: string,
    transcriptText: string,
    agentNames: string[],
  ): Promise<void> {
    const t0 = Date.now();
    try {
      this.logger.log(`[brief] Starting extraction for session ${sessionId}`);
      const brief = await this.memoryExtraction.extractSessionBrief(
        transcriptText,
        agentNames,
      );
      this.logger.log(`[brief] LLM returned in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

      await db.insert(arenaSessionBriefs).values({
        sessionId,
        decisions: brief.decisions,
        actionItems: brief.actionItems,
        unresolved: brief.unresolved,
        nextSessionQuestions: brief.nextSessionQuestions,
      });

      this.logger.log(`[brief] Saved for session ${sessionId} (${((Date.now() - t0) / 1000).toFixed(1)}s total)`);
    } catch (err) {
      this.logger.error(`[brief] Failed after ${((Date.now() - t0) / 1000).toFixed(1)}s: ${err}`);
    }
  }

  private async extractAndSaveAgentMemories(
    sessionId: string,
    agent: ArenaSessionParticipantRow,
    transcriptText: string,
  ): Promise<void> {
    const t0 = Date.now();
    try {
      this.logger.log(`[agent-mem] Extracting for "${agent.name}"`);
      const memories = await this.memoryExtraction.extractAgentMemories(
        agent.name,
        transcriptText,
      );
      this.logger.log(`[agent-mem] "${agent.name}" LLM returned ${memories.length} memories in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

      if (memories.length > 0) {
        await db.insert(agentMemories).values(
          memories.map((m) => ({
            agentId: agent.agentId!,
            sourceSessionId: sessionId,
            memoryType: m.category,
            content: m.content,
            importance: m.confidence === 'high' ? 0.8 : m.confidence === 'medium' ? 0.5 : 0.3,
          })),
        );
      }

      this.logger.log(`[agent-mem] "${agent.name}" done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    } catch (err) {
      this.logger.error(`[agent-mem] "${agent.name}" failed after ${((Date.now() - t0) / 1000).toFixed(1)}s: ${err}`);
    }
  }

  private async extractScopeMemories(
    sessionId: string,
    sessionRow: ArenaSessionRow | undefined,
    transcriptText: string,
    nativeAgents: ArenaSessionParticipantRow[],
    agentNames: string[],
    teamId: string | null | undefined,
    today: string,
  ): Promise<void> {
    const t0 = Date.now();
    if (teamId) {
      try {
        this.logger.log(`[team-mem] Extracting team memories`);
        const teamInsights = await this.memoryExtraction.extractAgentMemories(
          'team',
          transcriptText,
        );
        this.logger.log(`[team-mem] LLM returned ${teamInsights.length} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

        await Promise.all(
          teamInsights.map((insight) =>
            this.memoryService.createTeamMemory({
              teamId,
              content: insight.content,
              memoryType: insight.category === 'decision' ? 'decision' : 'summary',
              sourceSessionId: sessionId,
              importance: insight.confidence === 'high' ? 0.8 : insight.confidence === 'medium' ? 0.5 : 0.3,
            }),
          ),
        );
        this.logger.log(`[team-mem] Done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      } catch (err) {
        this.logger.error(`[team-mem] Failed after ${((Date.now() - t0) / 1000).toFixed(1)}s: ${err}`);
      }
    } else if (sessionRow?.createdBy) {
      try {
        this.logger.log(`[adhoc-mem] Extracting adhoc memories`);
        const adhocInsights = await this.memoryExtraction.extractAgentMemories(
          'group',
          transcriptText,
        );
        this.logger.log(`[adhoc-mem] LLM returned ${adhocInsights.length} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

        const agentIds = nativeAgents.map((a) => a.agentId!).filter(Boolean);
        await Promise.all(
          adhocInsights.map((insight) =>
            this.memoryService.createAdhocMemory({
              userId: sessionRow.createdBy!,
              content: insight.content,
              memoryType: insight.category,
              sourceSessionId: sessionId,
              participantAgentIds: agentIds,
              importance: insight.confidence === 'high' ? 0.8 : 0.5,
            }),
          ),
        );
        this.logger.log(`[adhoc-mem] Done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      } catch (err) {
        this.logger.error(`[adhoc-mem] Failed after ${((Date.now() - t0) / 1000).toFixed(1)}s: ${err}`);
      }
    }
  }

  private async appendDailyFiles(
    sessionRow: ArenaSessionRow | undefined,
    nativeAgents: ArenaSessionParticipantRow[],
    agentNames: string[],
    teamId: string | null | undefined,
    today: string,
  ): Promise<void> {
    const topic = sessionRow?.topic || 'Untitled';
    const writes: Promise<void>[] = [];

    if (teamId) {
      const teamSummary = `Session "${topic}" with ${agentNames.join(', ')}`;
      writes.push(this.dailyFileService.appendToDaily('team', teamId, today, teamSummary));
    }

    for (const agent of nativeAgents) {
      if (agent.agentId) {
        writes.push(
          this.dailyFileService.appendToDaily('agent', agent.agentId, today, `Participated in session "${topic}"`),
        );
      }
    }

    await Promise.all(writes);
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
      .where(eq(agentMemories.sourceSessionId, sessionId));
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
