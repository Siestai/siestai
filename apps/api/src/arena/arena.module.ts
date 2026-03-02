import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ArenaController } from './arena.controller';
import { ArenaService } from './arena.service';
import { InvitationService } from './invitation.service';
import { ArenaGateway } from './arena.gateway';
import { MemoryExtractionService } from './memory-extraction.service';
import { LivekitModule } from '../livekit/livekit.module';
import { AgentsModule } from '../agents/agents.module';
import { ToolsModule } from '../tools/tools.module';

@Module({
  imports: [LivekitModule, ConfigModule, AgentsModule, ToolsModule],
  controllers: [ArenaController],
  providers: [ArenaService, InvitationService, ArenaGateway, MemoryExtractionService],
})
export class ArenaModule {}
