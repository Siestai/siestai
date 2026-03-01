import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

const SEED_TOOLS = [
  {
    name: 'Web Search',
    description: 'Search the web for real-time information and current events.',
    icon: 'globe',
    category: 'search',
  },
  {
    name: 'Calculator',
    description: 'Perform mathematical calculations and unit conversions.',
    icon: 'calculator',
    category: 'utility',
  },
  {
    name: 'Code Interpreter',
    description: 'Execute code snippets in a sandboxed environment.',
    icon: 'code-2',
    category: 'developer',
  },
  {
    name: 'Image Generator',
    description: 'Generate images from text descriptions using AI.',
    icon: 'image',
    category: 'creative',
  },
  {
    name: 'Calendar',
    description: 'Manage calendar events and scheduling.',
    icon: 'calendar',
    category: 'productivity',
  },
  {
    name: 'Email',
    description: 'Send and read emails on behalf of the user.',
    icon: 'mail',
    category: 'productivity',
  },
];

@Injectable()
export class ToolsService implements OnModuleInit {
  private pool: Pool;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    this.pool = new Pool({
      connectionString: this.config.get('DATABASE_URL'),
    });
    await this.seedTools();
  }

  private async seedTools() {
    for (const tool of SEED_TOOLS) {
      await this.pool.query(
        `INSERT INTO tools (name, description, icon, category)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (name) DO NOTHING`,
        [tool.name, tool.description, tool.icon, tool.category],
      );
    }
  }

  async listTools() {
    const { rows } = await this.pool.query(
      'SELECT * FROM tools WHERE is_active = true ORDER BY name',
    );
    return rows;
  }

  async getTool(id: string) {
    const { rows } = await this.pool.query(
      'SELECT * FROM tools WHERE id = $1',
      [id],
    );
    if (rows.length === 0) throw new NotFoundException('Tool not found');
    return rows[0];
  }

  async listAgentTools(agentId: string) {
    const { rows } = await this.pool.query(
      `SELECT at.*, t.name as tool_name, t.description as tool_description, t.icon as tool_icon, t.category as tool_category
       FROM agent_tools at
       JOIN tools t ON t.id = at.tool_id
       WHERE at.agent_id = $1
       ORDER BY at.created_at`,
      [agentId],
    );
    return rows;
  }

  async connectTool(agentId: string, toolId: string) {
    const { rows } = await this.pool.query(
      `INSERT INTO agent_tools (agent_id, tool_id)
       VALUES ($1, $2)
       ON CONFLICT (agent_id, tool_id) DO NOTHING
       RETURNING *`,
      [agentId, toolId],
    );
    if (rows.length === 0) {
      const { rows: existing } = await this.pool.query(
        'SELECT * FROM agent_tools WHERE agent_id = $1 AND tool_id = $2',
        [agentId, toolId],
      );
      return existing[0];
    }
    return rows[0];
  }

  async disconnectTool(agentId: string, toolId: string) {
    const { rows } = await this.pool.query(
      'DELETE FROM agent_tools WHERE agent_id = $1 AND tool_id = $2 RETURNING id',
      [agentId, toolId],
    );
    if (rows.length === 0) throw new NotFoundException('Connection not found');
    return { ok: true };
  }
}
