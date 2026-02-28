import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { Pool } from 'pg';

/** Minimal shape of a raw pg agent row — only fields needed for Agent construction */
export interface AgentRow {
  id: string;
  name: string;
  instructions: string;
  llm_model: string | null;
  source: string;
}

@Injectable()
export class MastraRegistryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MastraRegistryService.name);
  private readonly mastra: Mastra;

  constructor(private readonly config: ConfigService) {
    this.mastra = new Mastra({ agents: {} });
  }

  async onApplicationBootstrap() {
    const pool = new Pool({
      connectionString: this.config.get('DATABASE_URL'),
    });
    try {
      const { rows } = await pool.query<AgentRow>(
        `SELECT id, name, instructions, llm_model, source FROM agents WHERE source = 'mastra'`,
      );
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
    } finally {
      await pool.end();
    }
  }

  /**
   * Register a Mastra Agent from a DB row.
   * `addAgent()` silently skips if the key already exists —
   * callers must `unregisterAgent()` first for updates.
   */
  registerAgent(row: AgentRow): void {
    const agent = new Agent({
      id: row.id,
      name: row.name,
      instructions: row.instructions,
      model: row.llm_model || 'anthropic/claude-sonnet-4-6',
    });
    this.mastra.addAgent(agent, row.id);
    this.logger.debug(`Registered agent ${row.id} (${row.name})`);
  }

  /** Remove an agent from the registry. Safe to call if not found (returns false). */
  unregisterAgent(id: string): boolean {
    const removed = this.mastra.removeAgent(id);
    if (removed) {
      this.logger.debug(`Unregistered agent ${id}`);
    }
    return removed;
  }

  /**
   * Get a registered agent by ID.
   * Returns null if not found — wraps `mastra.getAgent()` which throws on missing.
   */
  getAgent(id: string): Agent | null {
    try {
      return this.mastra.getAgent(id);
    } catch {
      return null;
    }
  }

  /** List all registered agent IDs and count. */
  listRegistered(): { count: number; agentIds: string[] } {
    const agentIds = Object.keys(this.mastra.listAgents());
    return { count: agentIds.length, agentIds };
  }
}
