import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Agent } from '@mastra/core/agent';
import { db, agents, eq } from '@siestai/db';
import { mastra } from './instance';
import { createRuntimeAgent } from './runtime';

export interface AgentRow {
  id: string;
  name: string;
  instructions: string;
  llmModel: string | null;
  source: string | null;
}

@Injectable()
export class MastraService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MastraService.name);

  async onApplicationBootstrap() {
    const rows = await db
      .select({
        id: agents.id,
        name: agents.name,
        instructions: agents.instructions,
        llmModel: agents.llmModel,
        source: agents.source,
      })
      .from(agents)
      .where(eq(agents.source, 'mastra'));

    let loaded = 0;
    for (const row of rows) {
      try {
        this.registerAgent(row);
        loaded++;
      } catch (err) {
        this.logger.warn(`Failed to register agent ${row.id}: ${err}`);
      }
    }
    this.logger.log(`Mastra registry: loaded ${loaded}/${rows.length} agents`);
  }

  registerAgent(row: AgentRow): void {
    const agent = createRuntimeAgent(row as any);
    mastra.addAgent(agent, row.id);
    this.logger.debug(`Registered agent ${row.id} (${row.name})`);
  }

  unregisterAgent(id: string): boolean {
    const removed = mastra.removeAgent(id);
    if (removed) {
      this.logger.debug(`Unregistered agent ${id}`);
    }
    return removed;
  }

  getAgent(id: string): Agent | null {
    try {
      return mastra.getAgent(id as any);
    } catch {
      return null;
    }
  }

  listRegistered(): { count: number; agentIds: string[] } {
    const agentIds = Object.keys(mastra.listAgents());
    return { count: agentIds.length, agentIds };
  }
}
