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
import { MdFilesService } from '../memory/md-files.service';
import { MemoryService } from '../memory/memory.service';
import { DailyFileService } from '../memory/daily-file.service';

@Controller('agents')
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly registry: MastraService,
    private readonly mdFiles: MdFilesService,
    private readonly memoryService: MemoryService,
    private readonly dailyFiles: DailyFileService,
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

  // ─── Agent MD Files ──────────────────────────────────────────────

  @Get(':id/md-files')
  getAgentMdFiles(@Param('id') id: string) {
    return this.mdFiles.ensureAgentMdFiles(id);
  }

  @Get(':id/md-files/:fileKey')
  async getAgentMdFile(
    @Param('id') id: string,
    @Param('fileKey') fileKey: string,
  ) {
    await this.mdFiles.ensureAgentMdFiles(id);
    return this.mdFiles.getAgentMdFile(id, fileKey as any);
  }

  @Put(':id/md-files/:fileKey')
  updateAgentMdFile(
    @Param('id') id: string,
    @Param('fileKey') fileKey: string,
    @Body('content') content: string,
  ) {
    return this.mdFiles.upsertAgentMdFile(id, fileKey as any, content);
  }

  // ─── Agent Memory Search ─────────────────────────────────────────

  @Get(':id/memories/search')
  searchAgentMemories(
    @Param('id') id: string,
    @Query('q') q: string,
    @Query('topK') topK?: string,
  ) {
    return this.memoryService.searchAgentMemories(id, q || '', topK ? parseInt(topK) : 5);
  }

  // ─── Agent Daily Files ───────────────────────────────────────────

  @Get(':id/daily-files')
  getAgentDailyFiles(
    @Param('id') id: string,
    @Query('days') days?: string,
  ) {
    return this.dailyFiles.getActiveDailyFiles('agent', id, days ? parseInt(days) : 30);
  }
}
