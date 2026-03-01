import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ToolsService } from './tools.service';

@Controller()
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Get('tools')
  listTools() {
    return this.toolsService.listTools();
  }

  @Get('tools/:id')
  getTool(@Param('id') id: string) {
    return this.toolsService.getTool(id);
  }

  @Get('agents/:agentId/tools')
  listAgentTools(@Param('agentId') agentId: string) {
    return this.toolsService.listAgentTools(agentId);
  }

  @Post('agents/:agentId/tools')
  connectTool(
    @Param('agentId') agentId: string,
    @Body('toolId') toolId: string,
  ) {
    return this.toolsService.connectTool(agentId, toolId);
  }

  @Delete('agents/:agentId/tools/:toolId')
  disconnectTool(
    @Param('agentId') agentId: string,
    @Param('toolId') toolId: string,
  ) {
    return this.toolsService.disconnectTool(agentId, toolId);
  }
}
