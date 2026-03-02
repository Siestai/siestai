import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Agent } from '@mastra/core/agent';
import type { Memory } from '@mastra/memory';
import { randomUUID } from 'crypto';
import { db, agents, eq } from '@siestai/db';
import { mastra, chatMemory } from './instance';
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

  /**
   * Register a per-request agent with Mastra under a unique ephemeral key.
   * This wires the agent into observability/storage for the duration of the stream.
   */
  registerEphemeralAgent(agent: Agent): string {
    const key = `ephemeral-${agent.id}-${randomUUID().slice(0, 8)}`;
    mastra.addAgent(agent, key);
    this.logger.debug(`Registered ephemeral agent ${key}`);
    return key;
  }

  /**
   * Remove an ephemeral agent registration after the stream completes.
   */
  unregisterEphemeralAgent(key: string): void {
    mastra.removeAgent(key);
    this.logger.debug(`Unregistered ephemeral agent ${key}`);
  }

  getChatMemory(): Memory {
    return chatMemory;
  }

  getWorkflow(name: string) {
    return mastra.getWorkflow(name);
  }

  listRegistered(): { count: number; agentIds: string[] } {
    const agentIds = Object.keys(mastra.listAgents());
    return { count: agentIds.length, agentIds };
  }
}
