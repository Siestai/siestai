const TAVILY_API = 'https://api.tavily.com/search';
const MAX_CONTENT_LENGTH = 500;

function truncate(str: string, max = MAX_CONTENT_LENGTH): string {
  if (str.length <= max) return str;
  return str.substring(0, max - 3) + '...';
}

export class WebSearchExecutor {
  async execute(
    action: string,
    params: Record<string, unknown>,
    apiKey: string,
  ): Promise<unknown> {
    switch (action) {
      case 'search':
        return this.search(params, apiKey);
      default:
        throw new Error(`Unknown Web Search action: ${action}`);
    }
  }

  private async search(params: Record<string, unknown>, apiKey: string) {
    const query = String(params.query ?? '');
    if (!query) throw new Error('Missing required parameter: query');

    const maxResults =
      typeof params.maxResults === 'number' ? params.maxResults : 5;

    const res = await fetch(TAVILY_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        search_depth: 'basic',
      }),
    });

    if (!res.ok) {
      throw new Error(`Tavily API error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const results = (data.results ?? []).map((r: any) => ({
      title: r.title,
      url: r.url,
      content: r.content ? truncate(r.content) : '',
      score: r.score,
    }));

    return { results };
  }
}
