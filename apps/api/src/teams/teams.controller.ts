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
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { AddTeamAgentDto } from './dto/add-team-agent.dto';
import { MdFilesService } from '../memory/md-files.service';
import { MemoryService } from '../memory/memory.service';
import { DailyFileService } from '../memory/daily-file.service';

@Controller('teams')
export class TeamsController {
  constructor(
    private readonly teamsService: TeamsService,
    private readonly mdFiles: MdFilesService,
    private readonly memoryService: MemoryService,
    private readonly dailyFiles: DailyFileService,
  ) {}

  @Post()
  createTeam(@Session() session: UserSession, @Body() dto: CreateTeamDto) {
    return this.teamsService.createTeam(session.user.id, dto);
  }

  @Get()
  listTeams(@Session() session: UserSession) {
    return this.teamsService.listTeams(session.user.id);
  }

  @Get(':id')
  getTeam(@Param('id') id: string) {
    return this.teamsService.getTeam(id);
  }

  @Put(':id')
  updateTeam(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.teamsService.updateTeam(id, session.user.id, dto);
  }

  @Delete(':id')
  deleteTeam(@Session() session: UserSession, @Param('id') id: string) {
    return this.teamsService.deleteTeam(id, session.user.id);
  }

  @Post(':id/agents')
  addAgent(@Param('id') id: string, @Body() dto: AddTeamAgentDto) {
    return this.teamsService.addAgent(id, dto.agentId, dto.role);
  }

  @Get(':id/agents')
  getTeamAgents(@Param('id') id: string) {
    return this.teamsService.getTeamAgents(id);
  }

  @Delete(':id/agents/:agentId')
  removeAgent(@Param('id') id: string, @Param('agentId') agentId: string) {
    return this.teamsService.removeAgent(id, agentId);
  }

  // ─── Team MD Files ───────────────────────────────────────────────

  @Get(':id/md-files')
  getTeamMdFiles(@Param('id') id: string) {
    return this.mdFiles.getTeamMdFiles(id);
  }

  @Put(':id/md-files/:fileKey')
  updateTeamMdFile(
    @Param('id') id: string,
    @Param('fileKey') fileKey: string,
    @Body('content') content: string,
  ) {
    return this.mdFiles.upsertTeamMdFile(id, fileKey as any, content);
  }

  // ─── Team Memory Search ──────────────────────────────────────────

  @Get(':id/memories/search')
  searchTeamMemories(
    @Param('id') id: string,
    @Query('q') q: string,
    @Query('topK') topK?: string,
  ) {
    return this.memoryService.searchTeamMemories(id, q || '', topK ? parseInt(topK) : 5);
  }

  // ─── Team Daily Files ────────────────────────────────────────────

  @Get(':id/daily-files')
  getTeamDailyFiles(
    @Param('id') id: string,
    @Query('days') days?: string,
  ) {
    return this.dailyFiles.getActiveDailyFiles('team', id, days ? parseInt(days) : 30);
  }
}
