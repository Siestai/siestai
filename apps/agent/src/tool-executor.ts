import { log } from '@livekit/agents';

/**
 * Executes tool calls by proxying them to the backend API.
 * The voice worker cannot import @mastra/core, so all tool
 * execution goes through the POST /tools/execute endpoint.
 */
export class ToolExecutor {
  constructor(
    private readonly backendUrl: string,
    private readonly toolSecret: string,
  ) {}

  async execute(
    slug: string,
    action: string,
    params: Record<string, unknown>,
  ): Promise<string> {
    try {
      const res = await fetch(`${this.backendUrl}/tools/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Secret': this.toolSecret,
        },
        body: JSON.stringify({ toolSlug: slug, action, params }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        log().warn(
          { status: res.status, slug, action },
          `Tool execution failed: ${text}`,
        );
        return `Error: Tool execution failed (HTTP ${res.status})`;
      }

      const data = (await res.json()) as { result?: unknown; error?: string };
      if (data.error) {
        return `Error: ${data.error}`;
      }
      // Stringify the result for injection back into the LLM conversation
      const resultStr =
        typeof data.result === 'string'
          ? data.result
          : JSON.stringify(data.result);
      // Truncate to avoid bloating the conversation context
      if (resultStr.length > 4000) {
        return resultStr.substring(0, 3997) + '...';
      }
      return resultStr;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log().warn(
        { error: msg, slug, action },
        'Tool execution request failed',
      );
      return `Error: ${msg}`;
    }
  }
}
