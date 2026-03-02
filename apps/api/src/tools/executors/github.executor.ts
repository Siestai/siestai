const GITHUB_API = 'https://api.github.com';
const MAX_RESPONSE_LENGTH = 4000;

function truncate(str: string, max = MAX_RESPONSE_LENGTH): string {
  if (str.length <= max) return str;
  return str.substring(0, max - 3) + '...';
}

export class GitHubExecutor {
  async execute(
    action: string,
    params: Record<string, unknown>,
    accessToken: string,
  ): Promise<unknown> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    switch (action) {
      case 'search_repos':
        return this.searchRepos(params, headers);
      case 'list_issues':
        return this.listIssues(params, headers);
      case 'get_file':
        return this.getFile(params, headers);
      default:
        throw new Error(`Unknown GitHub action: ${action}`);
    }
  }

  private async searchRepos(
    params: Record<string, unknown>,
    headers: Record<string, string>,
  ) {
    const query = String(params.query ?? '');
    if (!query) throw new Error('Missing required parameter: query');

    const url = `${GITHUB_API}/search/repositories?q=${encodeURIComponent(query)}&per_page=5`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const items = (data.items ?? []).slice(0, 5).map((r: any) => ({
      name: r.name,
      full_name: r.full_name,
      description: r.description ? truncate(r.description, 200) : null,
      url: r.html_url,
      stars: r.stargazers_count,
    }));

    return { items };
  }

  private async listIssues(
    params: Record<string, unknown>,
    headers: Record<string, string>,
  ) {
    const owner = String(params.owner ?? '');
    const repo = String(params.repo ?? '');
    if (!owner || !repo)
      throw new Error('Missing required parameters: owner, repo');

    const url = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=open&per_page=10`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const items = (data as any[]).slice(0, 10).map((i: any) => ({
      number: i.number,
      title: truncate(i.title, 200),
      state: i.state,
      labels: (i.labels ?? []).map((l: any) => l.name),
      created_at: i.created_at,
    }));

    return { items };
  }

  private async getFile(
    params: Record<string, unknown>,
    headers: Record<string, string>,
  ) {
    const owner = String(params.owner ?? '');
    const repo = String(params.repo ?? '');
    const path = String(params.path ?? '');
    if (!owner || !repo || !path)
      throw new Error('Missing required parameters: owner, repo, path');

    const url = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    let content = '';
    if (data.content && data.encoding === 'base64') {
      content = Buffer.from(data.content, 'base64').toString('utf-8');
    }

    return {
      content: truncate(content),
      path: data.path,
      sha: data.sha,
    };
  }
}
