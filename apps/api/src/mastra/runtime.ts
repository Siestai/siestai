import { Agent } from '@mastra/core/agent';
import type { Agent as DbAgent } from '@siestai/db';

/**
 * Create a Mastra Agent instance from a database agent record.
 * Used for dynamic streaming — each request loads config from DB
 * and spins up a throwaway Agent with that config.
 */
export function createRuntimeAgent(record: DbAgent): Agent {
  return new Agent({
    id: record.id,
    name: record.name,
    instructions: record.instructions,
    model: record.llmModel || 'anthropic/claude-sonnet-4-6',
  });
}
