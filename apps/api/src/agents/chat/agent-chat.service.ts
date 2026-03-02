import { Injectable, Logger } from '@nestjs/common';
import type { UIMessage } from 'ai';
import type { MastraModelOutput } from '@mastra/core/stream';
import { AgentsService } from '../agents.service';
import { ToolRegistryService } from '../../tools/tool-registry.service';
import { MastraService } from '../../mastra/mastra.service';
import { createRuntimeAgent } from '../../mastra/runtime';

export interface ChatStreamResult {
  output: MastraModelOutput<any>;
  ephemeralKey: string;
}

@Injectable()
export class AgentChatService {
  private readonly logger = new Logger(AgentChatService.name);

  constructor(
    private readonly agentsService: AgentsService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly mastraService: MastraService,
  ) {}

  async streamChat(
    agentId: string,
    messages: UIMessage[],
    userId: string,
  ): Promise<ChatStreamResult> {
    const agentRecord = await this.agentsService.getAgent(agentId);

    let tools = {};
    try {
      tools = await this.toolRegistry.buildToolsForAgent(agentId, userId);
    } catch (err) {
      this.logger.warn(
        `Failed to build tools for agent ${agentId}: ${err}`,
      );
    }

    const agent = createRuntimeAgent(agentRecord as any, tools);
    const ephemeralKey = this.mastraService.registerEphemeralAgent(agent);

    const conversationId = `${userId}:${agentId}`;

    const output = await agent.stream(messages as any, {
      maxSteps: 5,
      tracingOptions: {
        metadata: {
          userId,
          agentId,
          conversationId,
        },
        tags: [`user:${userId}`, `agent:${agentId}`],
      },
    });

    return { output, ephemeralKey };
  }

  cleanupEphemeral(key: string): void {
    this.mastraService.unregisterEphemeralAgent(key);
  }
}
