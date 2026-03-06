import { Injectable, Logger } from '@nestjs/common';
import type { UIMessage } from 'ai';
import { AgentsService } from '../agents.service';
import { ToolRegistryService } from '../../tools/tool-registry.service';
import { MastraService } from '../../mastra/mastra.service';
import { ContextAssemblyService } from '../../memory/context-assembly.service';
import { createRuntimeAgent } from '../../mastra/runtime';

export interface ChatStreamResult {
  workflowStream: AsyncIterable<unknown>;
  ephemeralKey: string;
}

@Injectable()
export class AgentChatService {
  private readonly logger = new Logger(AgentChatService.name);

  constructor(
    private readonly agentsService: AgentsService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly mastraService: MastraService,
    private readonly contextAssembly: ContextAssemblyService,
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
      this.logger.log(
        `Built ${Object.keys(tools).length} tools for agent ${agentId}: [${Object.keys(tools).join(', ')}]`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to build tools for agent ${agentId}: ${err}`,
      );
    }

    // Assemble memory-aware context
    let assembledContext: string | undefined;
    try {
      const lastMessage = messages[messages.length - 1];
      const topic = lastMessage?.parts
        ?.filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join(' ') || undefined;
      assembledContext = await this.contextAssembly.assembleContext(agentId, {
        sessionTopic: topic,
      });
    } catch (err) {
      this.logger.warn(`Context assembly failed for agent ${agentId}: ${err}`);
    }

    const memory = this.mastraService.getChatMemory();
    const agent = createRuntimeAgent(agentRecord as any, tools, memory, assembledContext);
    const ephemeralKey = this.mastraService.registerEphemeralAgent(agent);

    const threadId = `${userId}:${agentId}`;
    const workflow = this.mastraService.getWorkflow('agentChatWorkflow');
    const run = await workflow.createRun({
      resourceId: userId,
      runId: `${agentRecord.name}:${threadId}:${Date.now()}`,
    });
    const workflowStream = run.stream({
      inputData: {
        agentKey: ephemeralKey,
        messages: messages as unknown[],
        userId,
        agentId,
        threadId,
      },
    });

    return { workflowStream, ephemeralKey };
  }

  cleanupEphemeral(key: string): void {
    this.mastraService.unregisterEphemeralAgent(key);
  }
}
