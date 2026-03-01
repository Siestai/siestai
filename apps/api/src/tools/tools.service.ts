import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { db, tools, agentTools, eq, and } from '@siestai/db';

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
  async onModuleInit() {
    await this.seedTools();
  }

  private async seedTools() {
    await db
      .insert(tools)
      .values(SEED_TOOLS)
      .onConflictDoNothing({ target: tools.name });
  }

  async listTools() {
    return db
      .select()
      .from(tools)
      .where(eq(tools.isActive, true))
      .orderBy(tools.name);
  }

  async getTool(id: string) {
    const rows = await db
      .select()
      .from(tools)
      .where(eq(tools.id, id));

    if (rows.length === 0) throw new NotFoundException('Tool not found');
    return rows[0];
  }

  async listAgentTools(agentId: string) {
    return db
      .select({
        id: agentTools.id,
        agentId: agentTools.agentId,
        toolId: agentTools.toolId,
        config: agentTools.config,
        createdAt: agentTools.createdAt,
        toolName: tools.name,
        toolDescription: tools.description,
        toolIcon: tools.icon,
        toolCategory: tools.category,
      })
      .from(agentTools)
      .innerJoin(tools, eq(tools.id, agentTools.toolId))
      .where(eq(agentTools.agentId, agentId))
      .orderBy(agentTools.createdAt);
  }

  async connectTool(agentId: string, toolId: string) {
    const rows = await db
      .insert(agentTools)
      .values({ agentId, toolId })
      .onConflictDoNothing()
      .returning();

    if (rows.length === 0) {
      const existing = await db
        .select()
        .from(agentTools)
        .where(and(eq(agentTools.agentId, agentId), eq(agentTools.toolId, toolId)));
      return existing[0];
    }
    return rows[0];
  }

  async disconnectTool(agentId: string, toolId: string) {
    const rows = await db
      .delete(agentTools)
      .where(and(eq(agentTools.agentId, agentId), eq(agentTools.toolId, toolId)))
      .returning({ id: agentTools.id });

    if (rows.length === 0) throw new NotFoundException('Connection not found');
    return { ok: true };
  }
}
