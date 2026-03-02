import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents.module';
import { ToolsModule } from '../../tools/tools.module';
import { AgentChatController } from './agent-chat.controller';
import { AgentChatService } from './agent-chat.service';

@Module({
  imports: [AgentsModule, ToolsModule],
  controllers: [AgentChatController],
  providers: [AgentChatService],
})
export class AgentChatModule {}
