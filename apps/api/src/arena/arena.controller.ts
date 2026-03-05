import { Body, Controller, Get, HttpCode, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { ArenaService } from './arena.service';
import { InvitationService } from './invitation.service';
import { LivekitService } from '../livekit/livekit.service';
import { ArenaGateway } from './arena.gateway';
import { AgentsService } from '../agents/agents.service';
import { ToolsService } from '../tools/tools.service';
import { MemoryService } from '../memory/memory.service';
import { CreateArenaSessionDto } from './dto/create-arena-session.dto';
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
  ) {}

  @Post('sessions')
  async createSession(@Body() dto: CreateArenaSessionDto) {
    return this.arenaService.createSession(dto);
  }

  @Get('sessions/:id')
  async getSession(@Param('id') id: string) {
    return this.arenaService.getSession(id);
  }

  @Post('sessions/:id/start')
  async startSession(@Param('id') id: string) {
    const session = await this.arenaService.getSession(id);
    await this.arenaService.validateCanStart(id);

    // Load agent memories and tool definitions for each native_agent participant with an agentId
    const agentMemories = new Map<string, string>();
    const agentToolDefs = new Map<string, { slug: string; name: string; description: string }[]>();
    const participantRows =
      await this.arenaService.getSessionParticipantRows(id);
    for (const p of participantRows) {
      if (p.type === 'native_agent' && p.agentId) {
        // Use vector search with session topic for relevance-ranked memories
        const searchQuery = session.topic || p.name;
        const memories = await this.memoryService.searchAgentMemories(
          p.agentId,
          searchQuery,
          10,
        );
        if (memories.length > 0) {
          // Drop whole items to stay under 500 chars — never slice mid-sentence
          const items = memories.map(
            (m: any) => `- [${m.memory_type}|${m.importance > 0.6 ? 'high' : m.importance > 0.3 ? 'medium' : 'low'}] ${m.content}`,
          );
          let formatted = '';
          for (const item of items) {
            if ((formatted + '\n' + item).length > 500) break;
            formatted += (formatted ? '\n' : '') + item;
          }
          if (formatted) {
            agentMemories.set(p.name, formatted);
          }
        }

        // Fetch connected tool definitions for this agent
        const toolRows = await this.toolsService.getAgentToolsWithDefinitions(p.agentId);
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
      }
    }

    const result = await this.livekitService.generateArenaToken(
      session,
      agentMemories.size > 0 ? agentMemories : undefined,
      agentToolDefs.size > 0 ? agentToolDefs : undefined,
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
    this.arenaService
      .saveTranscript(id, dto.speaker, 'native_agent', dto.text, 'livekit')
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
