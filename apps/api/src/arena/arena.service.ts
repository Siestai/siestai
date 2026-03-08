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
  teams,
  eq,
  and,
  desc,
  asc,
  ilike,
  gte,
  lte,
  count,
  inArray,
  sql,
  type ArenaSessionRow,
  type ArenaSessionParticipantRow,
} from '@siestai/db';
import type { ArenaSessionSummary, PaginatedArenaSessions } from '@siestai/shared';
import { ListArenaSessionsDto } from './dto/list-arena-sessions.dto';

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
    const participantValues: {
      sessionId: string;
      agentId: string | null;
      name: string;
      type: string;
      instructions: string | null;
      color: string;
    }[] = [];

    // Add human host as participant in human_collab mode
    if (dto.participationMode !== 'agent_only') {
      participantValues.push({
        sessionId: sessionRow.id,
        agentId: null,
        name: 'You',
        type: 'human',
        instructions: null,
        color: '#ffffff',
      });
    }

    // Add native agents
    for (let i = 0; i < nativeAgents.length; i++) {
      const agent = nativeAgents[i];
      participantValues.push({
        sessionId: sessionRow.id,
        agentId: agent.agentId ?? null,
        name: agent.name,
        type: 'native_agent',
        instructions: agent.instructions ?? null,
        color: AGENT_COLORS[i % AGENT_COLORS.length],
      });
    }

    let participantRows: ArenaSessionParticipantRow[] = [];
    if (participantValues.length > 0) {
      participantRows = await db
        .insert(arenaSessionParticipants)
        .values(participantValues)
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

  async deleteSession(id: string): Promise<void> {
    const sessionRows = await db
      .select()
      .from(arenaSessions)
      .where(eq(arenaSessions.id, id));

    if (sessionRows.length === 0) {
      throw new NotFoundException(`Arena session ${id} not found`);
    }

    // Clean up ephemeral in-memory data
    const participants = await this.getSessionParticipantRows(id);
    for (const p of participants) {
      this.participantExtras.delete(p.id);
    }
    this.invalidateCache(id);

    // Delete session — participants, transcripts, briefs cascade; memories set null
    await db.delete(arenaSessions).where(eq(arenaSessions.id, id));
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

    const sessionRow = sessionRows[0];

    const [participantRows, teamName] = await Promise.all([
      db
        .select()
        .from(arenaSessionParticipants)
        .where(eq(arenaSessionParticipants.sessionId, id)),
      sessionRow.teamId
        ? db
            .select({ name: teams.name })
            .from(teams)
            .where(eq(teams.id, sessionRow.teamId))
            .then((rows) => rows[0]?.name)
        : Promise.resolve(undefined),
    ]);

    const session = this.mapToSession(sessionRow, participantRows, teamName);
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

    const [briefResult] = await Promise.all([briefPromise, ...agentMemPromises, scopeMemPromise]);

    // Daily files are cheap DB writes, run after — pass brief for richer entries
    await this.appendDailyFiles(sessionRow, nativeAgents, agentNames, teamId, today, briefResult);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    this.logger.log(`[extraction] Completed for session ${sessionId} in ${elapsed}s`);
  }

  private async extractBrief(
    sessionId: string,
    transcriptText: string,
    agentNames: string[],
  ): Promise<{ decisions: any[]; actionItems: any[]; unresolved: any[]; nextSessionQuestions: string[] } | null> {
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
      return brief;
    } catch (err) {
      this.logger.error(`[brief] Failed after ${((Date.now() - t0) / 1000).toFixed(1)}s: ${err}`);
      return null;
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
        await Promise.all(
          memories.map((m) =>
            this.memoryService.createAgentMemory({
              agentId: agent.agentId!,
              content: m.content,
              memoryType: m.category,
              sourceSessionId: sessionId,
              importance: m.confidence === 'high' ? 0.8 : m.confidence === 'medium' ? 0.5 : 0.3,
            }),
          ),
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
    brief?: { decisions: any[]; actionItems: any[]; unresolved: any[]; nextSessionQuestions: string[] } | null,
  ): Promise<void> {
    const topic = sessionRow?.topic || 'Untitled';
    const writes: Promise<void>[] = [];

    const decisionTexts = (brief?.decisions || []).slice(0, 3).map((d: any) => d.text || d).filter(Boolean);
    const unresolvedTexts = (brief?.unresolved || []).slice(0, 3).map((u: any) => u.topic || u).filter(Boolean);

    if (teamId) {
      let teamSummary = `Team session "${topic}" (${agentNames.join(', ')}).`;
      if (decisionTexts.length > 0) teamSummary += ` Decisions: ${decisionTexts.join('; ')}.`;
      if (unresolvedTexts.length > 0) teamSummary += ` Open: ${unresolvedTexts.join('; ')}.`;
      writes.push(this.dailyFileService.appendToDaily('team', teamId, today, teamSummary));
    }

    for (const agent of nativeAgents) {
      if (agent.agentId) {
        const agentTasks = (brief?.actionItems || [])
          .filter((a: any) => a.owner === agent.name)
          .slice(0, 3)
          .map((a: any) => a.task || a)
          .filter(Boolean);

        let agentEntry = `Session "${topic}":`;
        if (decisionTexts.length > 0) agentEntry += ` Decisions: ${decisionTexts.join('; ')}.`;
        if (agentTasks.length > 0) agentEntry += ` My tasks: ${agentTasks.join('; ')}.`;
        if (unresolvedTexts.length > 0) agentEntry += ` Unresolved: ${unresolvedTexts.join('; ')}.`;
        if (!brief) agentEntry = `Participated in session "${topic}"`;

        writes.push(
          this.dailyFileService.appendToDaily('agent', agent.agentId, today, agentEntry),
        );
      }
    }

    await Promise.all(writes);
  }

  // ─── List / History Methods ──────────────────────────────────────

  async listSessions(dto: ListArenaSessionsDto): Promise<PaginatedArenaSessions> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const offset = (page - 1) * limit;

    // Build dynamic filters
    const conditions: ReturnType<typeof eq>[] = [];
    if (dto.status) conditions.push(eq(arenaSessions.status, dto.status));
    if (dto.participationMode) conditions.push(eq(arenaSessions.participationMode, dto.participationMode));
    if (dto.teamId) conditions.push(eq(arenaSessions.teamId, dto.teamId));
    if (dto.search) {
      const escaped = dto.search.replace(/[%_]/g, '\\$&');
      conditions.push(ilike(arenaSessions.topic, `%${escaped}%`));
    }
    if (dto.dateFrom) conditions.push(gte(arenaSessions.createdAt, new Date(dto.dateFrom)));
    if (dto.dateTo) conditions.push(lte(arenaSessions.createdAt, new Date(dto.dateTo)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult, sessionRows] = await Promise.all([
      db.select({ value: count() }).from(arenaSessions).where(whereClause),
      db
        .select()
        .from(arenaSessions)
        .where(whereClause)
        .orderBy(desc(arenaSessions.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = totalResult[0]?.value ?? 0;

    if (sessionRows.length === 0) {
      return { data: [], total, page, limit };
    }

    // Batch-fetch participants and team names
    const sessionIds = sessionRows.map((s) => s.id);
    const teamIds = [...new Set(sessionRows.map((s) => s.teamId).filter(Boolean))] as string[];

    const [allParticipants, teamRows] = await Promise.all([
      db
        .select()
        .from(arenaSessionParticipants)
        .where(inArray(arenaSessionParticipants.sessionId, sessionIds)),
      teamIds.length > 0
        ? db
            .select({ id: teams.id, name: teams.name })
            .from(teams)
            .where(inArray(teams.id, teamIds))
        : Promise.resolve([]),
    ]);

    const participantsBySession = new Map<string, ArenaSessionParticipantRow[]>();
    for (const p of allParticipants) {
      const list = participantsBySession.get(p.sessionId) ?? [];
      list.push(p);
      participantsBySession.set(p.sessionId, list);
    }

    const teamNameMap = new Map<string, string>();
    for (const t of teamRows) {
      teamNameMap.set(t.id, t.name);
    }

    const data: ArenaSessionSummary[] = sessionRows.map((row) => {
      const participants = participantsBySession.get(row.id) ?? [];
      const createdAt = row.createdAt ?? new Date();
      let durationMinutes: number | undefined;
      if (row.startedAt && row.endedAt) {
        durationMinutes = Math.max(
          1,
          Math.round((row.endedAt.getTime() - row.startedAt.getTime()) / 60_000),
        );
      }
      return {
        id: row.id,
        topic: row.topic ?? undefined,
        mode: row.mode as ArenaSessionSummary['mode'],
        participationMode: row.participationMode as ArenaSessionSummary['participationMode'],
        status: row.status as ArenaSessionSummary['status'],
        participantCount: participants.length,
        participantNames: participants.map((p) => p.name),
        teamId: row.teamId ?? undefined,
        teamName: row.teamId ? teamNameMap.get(row.teamId) : undefined,
        startedAt: row.startedAt?.toISOString(),
        endedAt: row.endedAt?.toISOString(),
        createdAt: createdAt.toISOString(),
        durationMinutes,
      };
    });

    return { data, total, page, limit };
  }

  async getSessionTranscripts(sessionId: string) {
    return db
      .select()
      .from(arenaTranscripts)
      .where(eq(arenaTranscripts.sessionId, sessionId))
      .orderBy(asc(arenaTranscripts.timestamp));
  }

  async getSessionMemories(sessionId: string) {
    return db
      .select()
      .from(agentMemories)
      .where(eq(agentMemories.sourceSessionId, sessionId))
      .orderBy(desc(agentMemories.createdAt));
  }

  // ─── Session Continuity ─────────────────────────────────────────

  async getPreviousSessionBriefs(
    currentSessionId: string,
    teamId?: string,
    agentIds?: string[],
    limit = 3,
  ): Promise<Array<{ topic: string; endedAt: string; brief: { decisions: any[]; actionItems: any[]; unresolved: any[]; nextSessionQuestions: string[] } }>> {
    if (!teamId && (!agentIds || agentIds.length === 0)) return [];

    let rows: Array<{ topic: string | null; endedAt: Date | null; decisions: any; actionItems: any; unresolved: any; nextSessionQuestions: any }>;

    if (teamId) {
      rows = await db
        .select({
          topic: arenaSessions.topic,
          endedAt: arenaSessions.endedAt,
          decisions: arenaSessionBriefs.decisions,
          actionItems: arenaSessionBriefs.actionItems,
          unresolved: arenaSessionBriefs.unresolved,
          nextSessionQuestions: arenaSessionBriefs.nextSessionQuestions,
        })
        .from(arenaSessions)
        .innerJoin(arenaSessionBriefs, eq(arenaSessionBriefs.sessionId, arenaSessions.id))
        .where(
          and(
            eq(arenaSessions.teamId, teamId),
            eq(arenaSessions.status, 'ended'),
            sql`${arenaSessions.id} != ${currentSessionId}`,
          ),
        )
        .orderBy(desc(arenaSessions.endedAt))
        .limit(limit);
    } else {
      // Ad-hoc: find sessions with overlapping agent participants (use subquery to avoid duplicates)
      const agentIdList = agentIds!;
      const matchingSessionIds = db
        .selectDistinct({ sessionId: arenaSessionParticipants.sessionId })
        .from(arenaSessionParticipants)
        .where(inArray(arenaSessionParticipants.agentId, agentIdList));

      rows = await db
        .select({
          topic: arenaSessions.topic,
          endedAt: arenaSessions.endedAt,
          decisions: arenaSessionBriefs.decisions,
          actionItems: arenaSessionBriefs.actionItems,
          unresolved: arenaSessionBriefs.unresolved,
          nextSessionQuestions: arenaSessionBriefs.nextSessionQuestions,
        })
        .from(arenaSessions)
        .innerJoin(arenaSessionBriefs, eq(arenaSessionBriefs.sessionId, arenaSessions.id))
        .where(
          and(
            eq(arenaSessions.status, 'ended'),
            sql`${arenaSessions.id} != ${currentSessionId}`,
            inArray(arenaSessions.id, matchingSessionIds),
          ),
        )
        .orderBy(desc(arenaSessions.endedAt))
        .limit(1);
    }

    return rows.map((r) => ({
      topic: r.topic || 'Untitled',
      endedAt: r.endedAt?.toISOString() || '',
      brief: {
        decisions: (r.decisions as any[]) || [],
        actionItems: (r.actionItems as any[]) || [],
        unresolved: (r.unresolved as any[]) || [],
        nextSessionQuestions: (r.nextSessionQuestions as string[]) || [],
      },
    }));
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
    teamName?: string,
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
      startedAt: row.startedAt?.toISOString(),
      endedAt: row.endedAt?.toISOString(),
      teamId: row.teamId ?? undefined,
      teamName,
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
      agentId: row.agentId ?? undefined,
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
