import { Injectable, Logger } from '@nestjs/common';
import type { UIMessage } from 'ai';
import { AgentsService } from '../agents.service';
import { ToolRegistryService } from '../../tools/tool-registry.service';
import { MastraService } from '../../mastra/mastra.service';
import { mastra, chatMemory } from '../../mastra/instance';
import { createRuntimeAgent } from '../../mastra/runtime';

export interface ChatStreamResult {
  workflowStream: ReturnType<
    Awaited<ReturnType<ReturnType<typeof mastra.getWorkflow>['createRun']>>['stream']
  >;
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

    const agent = createRuntimeAgent(agentRecord as any, tools, chatMemory);
    const ephemeralKey = this.mastraService.registerEphemeralAgent(agent);

    const workflow = mastra.getWorkflow('agentChatWorkflow');
    const run = await workflow.createRun();
    const workflowStream = run.stream({
      inputData: {
        agentKey: ephemeralKey,
        messages,
        userId,
        agentId,
        threadId: `${userId}:${agentId}`,
      },
    });

    return { workflowStream, ephemeralKey };
  }

  cleanupEphemeral(key: string): void {
    this.mastraService.unregisterEphemeralAgent(key);
  }
}
