import { Injectable, NotFoundException } from '@nestjs/common';
import { db, agents, eq, and, or, ilike, desc, sql } from '@siestai/db';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { ActivityService } from '../activity/activity.service';
import { MastraService } from '../mastra/mastra.service';

@Injectable()
export class AgentsService {
  constructor(
    private readonly activityService: ActivityService,
    private readonly registry: MastraService,
  ) {}

  async listAgents(params?: {
    category?: string;
    search?: string;
    userId?: string;
  }) {
    const conditions: ReturnType<typeof eq>[] = [];

    if (params?.userId) {
      conditions.push(
        or(eq(agents.userId, params.userId), sql`${agents.userId} IS NULL`)!,
      );
    }
    if (params?.category) {
      conditions.push(eq(agents.category, params.category));
    }
    if (params?.search) {
      conditions.push(
        or(
          ilike(agents.name, `%${params.search}%`),
          ilike(agents.description, `%${params.search}%`),
        )!,
      );
    }

    return db
      .select()
      .from(agents)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(agents.createdAt));
  }

  async getAgent(id: string) {
    const rows = await db
      .select()
      .from(agents)
      .where(eq(agents.id, id));

    if (rows.length === 0) {
      throw new NotFoundException('Agent not found');
    }
    return rows[0];
  }

  async createAgent(dto: CreateAgentDto, userId: string) {
    const rows = await db
      .insert(agents)
      .values({
        name: dto.name,
        description: dto.description ?? '',
        instructions: dto.instructions,
        category: dto.category ?? 'conversational',
        tags: dto.tags ?? [],
        color: dto.color ?? '#3b82f6',
        icon: dto.icon ?? 'bot',
        source: (dto.source as 'mastra' | 'livekit' | 'external') ?? 'mastra',
        llmModel: dto.llmModel ?? null,
        userId,
      })
      .returning();

    const row = rows[0];

    if (row.source === 'mastra') {
      this.registry.registerAgent(row);
    }

    this.activityService.addEvent(userId, {
      type: 'agent_created',
      agentName: dto.name,
      timestamp: new Date().toISOString(),
    });

    return row;
  }

  async updateAgent(id: string, dto: UpdateAgentDto, userId: string) {
    const updates: Record<string, unknown> = {};

    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.instructions !== undefined) updates.instructions = dto.instructions;
    if (dto.category !== undefined) updates.category = dto.category;
    if (dto.tags !== undefined) updates.tags = dto.tags;
    if (dto.color !== undefined) updates.color = dto.color;
    if (dto.icon !== undefined) updates.icon = dto.icon;
    if (dto.source !== undefined) updates.source = dto.source;
    if (dto.llmModel !== undefined) updates.llmModel = dto.llmModel;

    if (Object.keys(updates).length === 0) {
      return this.getAgent(id);
    }

    updates.updatedAt = new Date();

    const rows = await db
      .update(agents)
      .set(updates)
      .where(
        and(
          eq(agents.id, id),
          or(eq(agents.userId, userId), sql`${agents.userId} IS NULL`),
        ),
      )
      .returning();

    if (rows.length === 0) {
      throw new NotFoundException('Agent not found');
    }

    const row = rows[0];
    this.registry.unregisterAgent(id);
    if (row.source === 'mastra') {
      this.registry.registerAgent(row);
    }

    return row;
  }

  async deleteAgent(id: string, userId: string) {
    this.registry.unregisterAgent(id);
    const rows = await db
      .delete(agents)
      .where(and(eq(agents.id, id), eq(agents.userId, userId)))
      .returning({ id: agents.id });

    if (rows.length === 0) {
      throw new NotFoundException('Agent not found');
    }
    return { ok: true };
  }
}
