import { Injectable, NotFoundException } from '@nestjs/common';
import {
  db,
  teams,
  teamAgents,
  agents,
  eq,
  and,
  desc,
} from '@siestai/db';
import { MdFilesService } from '../memory/md-files.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

@Injectable()
export class TeamsService {
  constructor(private readonly mdFiles: MdFilesService) {}

  async createTeam(userId: string, dto: CreateTeamDto) {
    const [team] = await db
      .insert(teams)
      .values({
        userId,
        name: dto.name,
        description: dto.description ?? '',
      })
      .returning();

    await this.mdFiles.initTeamMdFiles(team.id);
    return team;
  }

  async listTeams(userId: string) {
    return db
      .select()
      .from(teams)
      .where(eq(teams.userId, userId))
      .orderBy(desc(teams.createdAt));
  }

  async getTeam(id: string) {
    const rows = await db.select().from(teams).where(eq(teams.id, id));
    if (rows.length === 0) throw new NotFoundException('Team not found');
    return rows[0];
  }

  async updateTeam(id: string, userId: string, dto: UpdateTeamDto) {
    const updates: Record<string, unknown> = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.description !== undefined) updates.description = dto.description;

    if (Object.keys(updates).length === 0) return this.getTeam(id);

    updates.updatedAt = new Date();

    const rows = await db
      .update(teams)
      .set(updates)
      .where(and(eq(teams.id, id), eq(teams.userId, userId)))
      .returning();

    if (rows.length === 0) throw new NotFoundException('Team not found');
    return rows[0];
  }

  async deleteTeam(id: string, userId: string) {
    const rows = await db
      .delete(teams)
      .where(and(eq(teams.id, id), eq(teams.userId, userId)))
      .returning({ id: teams.id });

    if (rows.length === 0) throw new NotFoundException('Team not found');
    return { ok: true };
  }

  async addAgent(teamId: string, agentId: string, role = 'member') {
    const [row] = await db
      .insert(teamAgents)
      .values({ teamId, agentId, role })
      .returning();
    return row;
  }

  async removeAgent(teamId: string, agentId: string) {
    const rows = await db
      .delete(teamAgents)
      .where(
        and(eq(teamAgents.teamId, teamId), eq(teamAgents.agentId, agentId)),
      )
      .returning({ id: teamAgents.id });

    if (rows.length === 0) throw new NotFoundException('Team agent not found');
    return { ok: true };
  }

  async getTeamAgents(teamId: string) {
    return db
      .select({
        id: teamAgents.id,
        teamId: teamAgents.teamId,
        agentId: teamAgents.agentId,
        role: teamAgents.role,
        joinedAt: teamAgents.joinedAt,
        agent: {
          id: agents.id,
          name: agents.name,
          description: agents.description,
          category: agents.category,
          color: agents.color,
          icon: agents.icon,
          isOnline: agents.isOnline,
        },
      })
      .from(teamAgents)
      .innerJoin(agents, eq(teamAgents.agentId, agents.id))
      .where(eq(teamAgents.teamId, teamId));
  }
}
