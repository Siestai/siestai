import { Module } from '@nestjs/common';
import { AgentPreviewController } from './agent-preview.controller.js';
import { AgentPreviewService } from './agent-preview.service.js';

@Module({
  controllers: [AgentPreviewController],
  providers: [AgentPreviewService],
  exports: [AgentPreviewService],
})
export class AgentPreviewModule {}
