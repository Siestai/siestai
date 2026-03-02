import { Module } from '@nestjs/common';
import { AgentPreviewController } from './agent-preview.controller.js';
import { AgentPreviewService } from './agent-preview.service.js';
import { ToolsModule } from '../../tools/tools.module';

@Module({
  imports: [ToolsModule],
  controllers: [AgentPreviewController],
  providers: [AgentPreviewService],
  exports: [AgentPreviewService],
})
export class AgentPreviewModule {}
