import { Body, Controller, Post, Res } from '@nestjs/common';
import {
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';
import { AgentPreviewService } from './agent-preview.service.js';
import { AgentPreviewDto } from './agent-preview.dto.js';

@Controller('agents')
export class AgentPreviewController {
  constructor(private readonly agentPreviewService: AgentPreviewService) {}

  @Post('preview/stream')
  async streamPreview(
    @Session() session: UserSession,
    @Body() dto: AgentPreviewDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    await this.agentPreviewService.streamPreview(
      dto,
      session.user.id,
      res,
    );
  }
}
