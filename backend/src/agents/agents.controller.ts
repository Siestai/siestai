import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  listAgents(
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.agentsService.listAgents({ category, search });
  }

  @Get(':id')
  getAgent(@Param('id') id: string) {
    return this.agentsService.getAgent(id);
  }

  @Post()
  createAgent(@Body() dto: CreateAgentDto) {
    return this.agentsService.createAgent(dto);
  }

  @Put(':id')
  updateAgent(@Param('id') id: string, @Body() dto: UpdateAgentDto) {
    return this.agentsService.updateAgent(id, dto);
  }

  @Delete(':id')
  deleteAgent(@Param('id') id: string) {
    return this.agentsService.deleteAgent(id);
  }

  @Post(':id/stream')
  async streamAgent(
    @Param('id') id: string,
    @Body() body: { messages: { role: string; content: string }[] },
    @Res() res: Response,
  ) {
    const stream = await this.agentsService.streamAgent(id, body.messages);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    stream.pipe(res);
  }
}
