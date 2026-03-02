import { tool, type ToolSet } from 'ai';
import type { ToolsInput } from '@mastra/core/agent';

/**
 * Convert Mastra ToolsInput (from ToolRegistryService) to AI SDK ToolSet
 * for use with streamText().
 *
 * Mastra tools (from createTool) use `inputSchema` + `execute(input, context)`.
 * AI SDK tools use `inputSchema` + `execute(input, options)`.
 */
export function toAISDKTools(mastraTools: ToolsInput): ToolSet {
  const result: ToolSet = {};

  for (const [name, entry] of Object.entries(mastraTools)) {
    const mt = entry as Record<string, any>;
    if (!mt.execute || !mt.inputSchema) continue;

    result[name] = tool({
      description: mt.description ?? '',
      inputSchema: mt.inputSchema,
      execute: async (input) => mt.execute(input, {}),
    });
  }

  return result;
}
