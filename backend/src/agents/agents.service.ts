import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { ActivityService } from '../activity/activity.service';
import { MastraRegistryService } from '../mastra/mastra-registry.service';

@Injectable()
export class AgentsService implements OnModuleInit {
  private pool: Pool;

  constructor(
    private readonly config: ConfigService,
    private readonly activityService: ActivityService,
    private readonly registry: MastraRegistryService,
  ) {}

  onModuleInit() {
    this.pool = new Pool({
      connectionString: this.config.get('DATABASE_URL'),
    });
  }

  async listAgents(params?: {
    category?: string;
    search?: string;
    userId?: string;
  }) {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params?.userId) {
      conditions.push(`(user_id = $${idx} OR user_id IS NULL)`);
      values.push(params.userId);
      idx++;
    }
    if (params?.category) {
      conditions.push(`category = $${idx++}`);
      values.push(params.category);
    }
    if (params?.search) {
      conditions.push(`(name ILIKE $${idx} OR description ILIKE $${idx})`);
      values.push(`%${params.search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.pool.query(
      `SELECT * FROM agents ${where} ORDER BY created_at DESC`,
      values,
    );
    return rows;
  }

  async getAgent(id: string) {
    const { rows } = await this.pool.query(
      'SELECT * FROM agents WHERE id = $1',
      [id],
    );
    if (rows.length === 0) {
      throw new NotFoundException('Agent not found');
    }
    return rows[0];
  }

  async createAgent(dto: CreateAgentDto, userId: string) {
    const { rows } = await this.pool.query(
      `INSERT INTO agents (name, description, instructions, category, tags, color, icon, source, llm_model, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        dto.name,
        dto.description ?? '',
        dto.instructions,
        dto.category ?? 'conversational',
        JSON.stringify(dto.tags ?? []),
        dto.color ?? '#3b82f6',
        dto.icon ?? 'bot',
        dto.source ?? 'mastra',
        dto.llmModel ?? null,
        userId,
      ],
    );

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
    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const fields: [string, any][] = [
      ['name', dto.name],
      ['description', dto.description],
      ['instructions', dto.instructions],
      ['category', dto.category],
      ['tags', dto.tags ? JSON.stringify(dto.tags) : undefined],
      ['color', dto.color],
      ['icon', dto.icon],
      ['source', dto.source],
      ['llm_model', dto.llmModel],
    ];

    for (const [col, val] of fields) {
      if (val !== undefined) {
        sets.push(`${col} = $${idx++}`);
        values.push(val);
      }
    }

    if (sets.length === 0) {
      return this.getAgent(id);
    }

    sets.push(`updated_at = now()`);
    values.push(id);
    values.push(userId);

    const { rows } = await this.pool.query(
      `UPDATE agents SET ${sets.join(', ')} WHERE id = $${idx++} AND (user_id = $${idx} OR user_id IS NULL) RETURNING *`,
      values,
    );
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
    const { rows } = await this.pool.query(
      'DELETE FROM agents WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId],
    );
    if (rows.length === 0) {
      throw new NotFoundException('Agent not found');
    }
    return { ok: true };
  }
}
