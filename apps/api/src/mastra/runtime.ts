import { Agent } from '@mastra/core/agent';
import type { ToolsInput } from '@mastra/core/agent';
import type { Memory } from '@mastra/memory';
import type { Agent as DbAgent } from '@siestai/db';

/**
 * Build a system prompt from the agent's identity, description, and instructions.
 * Tools are not listed here — they are passed via the `tools` config and
 * surfaced to the model through the tool-calling API automatically.
 */
function buildSystemPrompt(record: DbAgent): string {
  const parts: string[] = [];

  parts.push(`You are "${record.name}".`);

  if (record.description) {
    parts.push(record.description);
  }

  if (record.instructions) {
    parts.push(record.instructions);
  }

  return parts.join('\n\n');
}

/**
 * Create a Mastra Agent instance from a database agent record.
 * Used for dynamic streaming — each request loads config from DB
 * and spins up a throwaway Agent with that config.
 */
export function createRuntimeAgent(
  record: DbAgent,
  tools?: ToolsInput,
  memory?: Memory,
): Agent {
  const instructions = buildSystemPrompt(record);

  return new Agent({
    id: record.id,
    name: record.name,
    description: record.description ?? undefined,
    instructions,
    model: record.llmModel || 'anthropic/claude-sonnet-4-6',
    ...(tools && Object.keys(tools).length > 0 ? { tools } : {}),
    ...(memory ? { memory } : {}),
  });
}
