import { Body, Controller, Get, HttpCode, Param, Post, Query, Res, UsePipes, ValidationPipe } from '@nestjs/common';
import type { Response } from 'express';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { ArenaService } from './arena.service';
import { InvitationService } from './invitation.service';
import { LivekitService } from '../livekit/livekit.service';
import { ArenaGateway } from './arena.gateway';
import { AgentsService } from '../agents/agents.service';
import { ToolsService } from '../tools/tools.service';
import { MemoryService } from '../memory/memory.service';
import { TeamsService } from '../teams/teams.service';
import { CreateArenaSessionDto } from './dto/create-arena-session.dto';
import { ListArenaSessionsDto } from './dto/list-arena-sessions.dto';
import { JoinArenaDto } from './dto/join-arena.dto';
import { PostTranscriptDto } from './dto/post-transcript.dto';

@Controller('arena')
export class ArenaController {
  constructor(
    private readonly arenaService: ArenaService,
    private readonly invitationService: InvitationService,
    private readonly livekitService: LivekitService,
    private readonly arenaGateway: ArenaGateway,
    private readonly agentsService: AgentsService,
    private readonly toolsService: ToolsService,
    private readonly memoryService: MemoryService,
    private readonly teamsService: TeamsService,
  ) {}

  @Post('sessions')
  async createSession(@Body() dto: CreateArenaSessionDto) {
    return this.arenaService.createSession(dto);
  }

  @Get('sessions')
  @UsePipes(new ValidationPipe({ transform: true }))
  async listSessions(@Query() dto: ListArenaSessionsDto) {
    return this.arenaService.listSessions(dto);
  }

  @Get('sessions/:id')
  async getSession(@Param('id') id: string) {
    return this.arenaService.getSession(id);
  }

  @Get('sessions/:id/transcript')
  async getSessionTranscripts(@Param('id') id: string) {
    await this.arenaService.getSession(id);
    return this.arenaService.getSessionTranscripts(id);
  }

  @Get('sessions/:id/memories')
  async getSessionMemories(@Param('id') id: string) {
    await this.arenaService.getSession(id);
    return this.arenaService.getSessionMemories(id);
  }

  @Post('sessions/:id/start')
  async startSession(@Param('id') id: string) {
    const session = await this.arenaService.getSession(id);
    await this.arenaService.validateCanStart(id);

    // Load agent memories, tool definitions, and team memberships for each native_agent participant
    const agentMemories = new Map<string, string>();
    const agentToolDefs = new Map<string, { slug: string; name: string; description: string }[]>();
    const agentTeamNames = new Map<string, string[]>();
    const participantRows =
      await this.arenaService.getSessionParticipantRows(id);
    const nativeAgentParticipants = participantRows.filter(
      (p) => p.type === 'native_agent' && p.agentId,
    );

    await Promise.all(
      nativeAgentParticipants.map(async (p) => {
        const searchQuery = session.topic || p.name;
        const [memories, toolRows, teamNames] = await Promise.all([
          this.memoryService.searchAgentMemories(p.agentId!, searchQuery, 10),
          this.toolsService.getAgentToolsWithDefinitions(p.agentId!),
          this.teamsService.getAgentTeamNames(p.agentId!),
        ]);

        if (memories.length > 0) {
          // Drop whole items to stay under 1500 chars — never slice mid-sentence
          const items = memories.map(
            (m: any) => `- [${m.memory_type}|${m.importance > 0.6 ? 'high' : m.importance > 0.3 ? 'medium' : 'low'}] ${m.content}`,
          );
          let formatted = '';
          for (const item of items) {
            if ((formatted + '\n' + item).length > 1500) break;
            formatted += (formatted ? '\n' : '') + item;
          }
          if (formatted) {
            agentMemories.set(p.name, formatted);
          }
        }

        if (toolRows.length > 0) {
          agentToolDefs.set(
            p.name,
            toolRows.map((t) => ({
              slug: t.slug!,
              name: t.toolName!,
              description: t.toolDescription ?? '',
            })),
          );
        }

        if (teamNames.length > 0) {
          agentTeamNames.set(p.name, teamNames);
        }
      }),
    );

    // Load previous session briefs for continuity
    const agentIds = participantRows
      .filter((p) => p.type === 'native_agent' && p.agentId)
      .map((p) => p.agentId!);
    const previousBriefs = await this.arenaService.getPreviousSessionBriefs(
      id,
      session.teamId,
      agentIds,
    );

    let sessionContinuity: string | undefined;
    if (previousBriefs.length > 0) {
      const parts: string[] = [];
      previousBriefs.forEach((prev, idx) => {
        const date = prev.endedAt ? new Date(prev.endedAt).toLocaleDateString() : 'unknown date';
        if (idx === 0) {
          // Most recent: full detail
          parts.push(`Most recent session (${date}) — "${prev.topic}":`);
          const decisions = prev.brief.decisions.slice(0, 3).map((d: any) => d.text || d).filter(Boolean);
          if (decisions.length > 0) parts.push(`  Decisions: ${decisions.join('; ')}`);
          const unresolved = prev.brief.unresolved.slice(0, 3).map((u: any) => u.topic || u).filter(Boolean);
          if (unresolved.length > 0) parts.push(`  Unresolved: ${unresolved.join('; ')}`);
          const questions = prev.brief.nextSessionQuestions.slice(0, 3);
          if (questions.length > 0) parts.push(`  Questions for next session: ${questions.join('; ')}`);
        } else {
          // Older sessions: brief summary
          const decisions = prev.brief.decisions.slice(0, 2).map((d: any) => d.text || d).filter(Boolean);
          parts.push(`Earlier session (${date}) — "${prev.topic}": ${decisions.length > 0 ? `Decided: ${decisions.join('; ')}` : 'No key decisions recorded'}`);
        }
      });
      const continuityText = parts.join('\n');
      // Cap at ~2000 chars
      sessionContinuity = continuityText.length > 2000 ? continuityText.substring(0, 1997) + '...' : continuityText;
    }

    const result = await this.livekitService.generateArenaToken(
      session,
      agentMemories.size > 0 ? agentMemories : undefined,
      agentToolDefs.size > 0 ? agentToolDefs : undefined,
      sessionContinuity,
      agentTeamNames.size > 0 ? agentTeamNames : undefined,
    );
    await this.arenaService.startSession(id, result.roomName);
    this.arenaGateway.broadcastSessionStarted(id, result.roomName);
    return {
      token: result.token,
      serverUrl: result.serverUrl,
      roomName: result.roomName,
    };
  }

  @Post('sessions/:id/transcript')
  @AllowAnonymous()
  @HttpCode(204)
  async postTranscript(
    @Param('id') id: string,
    @Body() dto: PostTranscriptDto,
  ): Promise<void> {
    await this.arenaService.getSession(id);
    this.arenaGateway.broadcastTranscript(
      id,
      dto.speaker,
      dto.text,
      dto.timestamp ?? Date.now(),
    );
    // Persist transcript (fire-and-forget — don't block the 204 response)
    const speakerType = dto.speaker === 'You' ? 'human' : 'native_agent';
    this.arenaService
      .saveTranscript(id, dto.speaker, speakerType, dto.text, 'livekit')
      .catch(() => {});
  }

  @Post('join')
  @AllowAnonymous()
  async join(@Body() dto: JoinArenaDto) {
    const { sessionId } = this.invitationService.validateInvite(dto.token);
    const participant = await this.arenaService.addExternalParticipant(
      sessionId,
      dto.agentName,
      dto.platform,
      dto.model,
    );
    // Notify WS clients (host) so the waiting room UI updates
    this.arenaGateway.broadcastParticipantJoined(sessionId, participant);
    return {
      sessionId,
      wsUrl: `/arena/ws?token=${dto.token}`,
      participant,
    };
  }

  @Post('sessions/:id/end')
  @HttpCode(204)
  async endSession(@Param('id') id: string): Promise<void> {
    await this.arenaService.endSession(id);
    this.arenaGateway.broadcastSessionEnded(id);
  }

  @Get('sessions/:id/brief')
  async getSessionBrief(@Param('id') id: string, @Res() res: Response) {
    // Validate session exists
    await this.arenaService.getSession(id);

    const brief = await this.arenaService.getSessionBrief(id);
    if (!brief) {
      return res.status(202).json({ status: 'processing' });
    }
    return res.json(brief);
  }
}
