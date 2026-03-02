import { Injectable, Logger } from '@nestjs/common';
import {
  streamText,
  stepCountIs,
  convertToModelMessages,
  type UIMessage,
  type StreamTextResult,
} from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { AgentsService } from '../agents.service';
import { ToolRegistryService } from '../../tools/tool-registry.service';
import { toAISDKTools } from './tool-adapter';

@Injectable()
export class AgentChatService {
  private readonly logger = new Logger(AgentChatService.name);

  constructor(
    private readonly agentsService: AgentsService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  async streamChat(
    agentId: string,
    messages: UIMessage[],
    userId: string,
  ): Promise<StreamTextResult<any, any>> {
    const agent = await this.agentsService.getAgent(agentId);

    let tools = {};
    try {
      const mastraTools = await this.toolRegistry.buildToolsForAgent(
        agentId,
        userId,
      );
      tools = toAISDKTools(mastraTools);
    } catch (err) {
      this.logger.warn(
        `Failed to build tools for agent ${agentId}: ${err}`,
      );
    }

    const modelId = (agent.llmModel || 'anthropic/claude-sonnet-4-6').replace(
      'anthropic/',
      '',
    );
    const anthropic = createAnthropic();
    const model = anthropic(modelId);

    return streamText({
      model,
      system: agent.instructions,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(5),
    });
  }
}
