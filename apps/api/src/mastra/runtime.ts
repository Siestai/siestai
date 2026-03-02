import { Agent } from '@mastra/core/agent';
import type { ToolsInput } from '@mastra/core/agent';
import type { Memory } from '@mastra/memory';
import type { Agent as DbAgent } from '@siestai/db';

/**
 * Build a full system prompt that includes the agent's identity,
 * description, user-defined instructions, and available tools.
 */
function buildSystemPrompt(
  record: DbAgent,
  tools?: ToolsInput,
): string {
  const parts: string[] = [];

  parts.push(`You are "${record.name}".`);

  if (record.description) {
    parts.push(record.description);
  }

  if (record.instructions) {
    parts.push(record.instructions);
  }

  if (tools && Object.keys(tools).length > 0) {
    const toolList = Object.entries(tools)
      .map(([slug, tool]) => {
        const desc =
          typeof tool === 'object' && 'description' in tool
            ? ` — ${tool.description}`
            : '';
        return `- ${slug}${desc}`;
      })
      .join('\n');
    parts.push(
      `You have the following tools available. Use them when relevant:\n${toolList}`,
    );
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
  const instructions = buildSystemPrompt(record, tools);

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
