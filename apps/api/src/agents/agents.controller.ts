import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { MastraService } from '../mastra/mastra.service';

@Controller('agents')
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly registry: MastraService,
  ) {}

  @Get()
  listAgents(
    @Session() session: UserSession,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.agentsService.listAgents({
      category,
      search,
      userId: session.user.id,
    });
  }

  @Get('registry/status')
  getRegistryStatus() {
    return this.registry.listRegistered();
  }

  @Get(':id')
  getAgent(@Param('id') id: string) {
    return this.agentsService.getAgent(id);
  }

  @Get(':id/memories')
  getAgentMemories(@Param('id') id: string) {
    return this.agentsService.getAgentMemories(id);
  }

  @Post()
  createAgent(@Session() session: UserSession, @Body() dto: CreateAgentDto) {
    return this.agentsService.createAgent(dto, session.user.id);
  }

  @Put(':id')
  updateAgent(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body() dto: UpdateAgentDto,
  ) {
    return this.agentsService.updateAgent(id, dto, session.user.id);
  }

  @Delete(':id')
  deleteAgent(@Session() session: UserSession, @Param('id') id: string) {
    return this.agentsService.deleteAgent(id, session.user.id);
  }
}
