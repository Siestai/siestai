import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { ArenaService } from './arena.service';
import { InvitationService } from './invitation.service';
import { LivekitService } from '../livekit/livekit.service';
import { ArenaGateway } from './arena.gateway';
import { CreateArenaSessionDto } from './dto/create-arena-session.dto';
import { JoinArenaDto } from './dto/join-arena.dto';

@Controller('arena')
export class ArenaController {
  constructor(
    private readonly arenaService: ArenaService,
    private readonly invitationService: InvitationService,
    private readonly livekitService: LivekitService,
    private readonly arenaGateway: ArenaGateway,
  ) {}

  @Post('sessions')
  createSession(@Body() dto: CreateArenaSessionDto) {
    return this.arenaService.createSession(dto);
  }

  @Get('sessions/:id')
  getSession(@Param('id') id: string) {
    return this.arenaService.getSession(id);
  }

  @Post('sessions/:id/start')
  async startSession(@Param('id') id: string) {
    const session = this.arenaService.getSession(id);
    // Validate status before creating room to prevent orphan LiveKit rooms on double-click
    this.arenaService.validateCanStart(id);
    const result = await this.livekitService.generateArenaToken(session);
    this.arenaService.startSession(id, result.roomName);
    this.arenaGateway.broadcastSessionStarted(id, result.roomName);
    return {
      token: result.token,
      serverUrl: result.serverUrl,
      roomName: result.roomName,
    };
  }

  @Post('join')
  @AllowAnonymous()
  join(@Body() dto: JoinArenaDto) {
    const { sessionId } = this.invitationService.validateInvite(dto.token);
    const participant = this.arenaService.addExternalParticipant(
      sessionId,
      dto.agentName,
      dto.platform,
      dto.model,
    );
    return {
      sessionId,
      wsUrl: `/arena/ws?token=${dto.token}`,
      participant,
    };
  }
}
