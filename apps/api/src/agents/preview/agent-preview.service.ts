import { Injectable } from '@nestjs/common';
import { Agent } from '@mastra/core/agent';
import type { Response } from 'express';
import { AgentPreviewDto } from './agent-preview.dto.js';
import { ActivityService } from '../../activity/activity.service.js';
import { MastraService } from '../../mastra/mastra.service';

@Injectable()
export class AgentPreviewService {
  constructor(
    private readonly activityService: ActivityService,
    private readonly registry: MastraService,
  ) {}

  async streamPreview(dto: AgentPreviewDto, userId: string, res: Response) {
    this.activityService.addEvent(userId, {
      type: 'agent_tested',
      agentName: 'Preview',
      timestamp: new Date().toISOString(),
    });

    // For saved agents, use the registry instance; for wizard previews, create throwaway
    let agent: Agent;
    if (dto.agentId) {
      const registered = this.registry.getAgent(dto.agentId);
      agent =
        registered ??
        new Agent({
          id: 'preview',
          name: 'preview',
          instructions: dto.instructions,
          model: dto.model || 'anthropic/claude-sonnet-4-6',
        });
    } else {
      agent = new Agent({
        id: 'preview',
        name: 'preview',
        instructions: dto.instructions,
        model: dto.model || 'anthropic/claude-sonnet-4-6',
      });
    }

    try {
      const result = await agent.stream(dto.message);
      const reader = result.textStream.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(`data: ${JSON.stringify({ text: value })}\n\n`);
      }

      res.write('data: {"done":true}\n\n');
    } catch (err) {
      res.write(
        `data: ${JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' })}\n\n`,
      );
    } finally {
      res.end();
    }
  }
}
