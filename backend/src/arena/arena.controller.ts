import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ArenaService } from './arena.service';
import { InvitationService } from './invitation.service';
import { CreateArenaSessionDto } from './dto/create-arena-session.dto';
import { JoinArenaDto } from './dto/join-arena.dto';

@Controller('arena')
export class ArenaController {
  constructor(
    private readonly arenaService: ArenaService,
    private readonly invitationService: InvitationService,
  ) {}

  @Post('sessions')
  createSession(@Body() dto: CreateArenaSessionDto) {
    return this.arenaService.createSession(dto);
  }

  @Get('sessions/:id')
  getSession(@Param('id') id: string) {
    return this.arenaService.getSession(id);
  }

  @Post('join')
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
