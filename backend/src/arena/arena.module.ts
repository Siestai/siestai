import { Module } from '@nestjs/common';
import { ArenaController } from './arena.controller';
import { ArenaService } from './arena.service';
import { InvitationService } from './invitation.service';
import { ArenaGateway } from './arena.gateway';

@Module({
  controllers: [ArenaController],
  providers: [ArenaService, InvitationService, ArenaGateway],
})
export class ArenaModule {}
