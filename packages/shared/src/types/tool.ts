export type ToolType = 'oauth' | 'api_key' | 'builtin';

export interface Tool {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  type: ToolType;
  slug: string;
  oauthProvider: string | null;
  requiredScopes: string[];
  isActive: boolean;
  createdAt: string;
}

export interface ToolWithStatus extends Tool {
  connected: boolean;
}

export interface ToolCredentialStatus {
  connected: boolean;
  scope?: string;
  expiresAt?: string;
}

export const TOOL_SLUGS = {
  GITHUB: 'github',
  GMAIL: 'gmail',
  WEB_SEARCH: 'web_search',
} as const;

export type ToolSlug = (typeof TOOL_SLUGS)[keyof typeof TOOL_SLUGS];

export const TOOL_CAPABILITIES: Record<string, string[]> = {
  [TOOL_SLUGS.GITHUB]: [
    'Search repositories',
    'List and create issues',
    'Read file contents',
    'List pull requests',
    'Access user profile',
  ],
  [TOOL_SLUGS.GMAIL]: [
    'Read emails',
    'Send emails',
    'Search inbox',
    'Manage labels',
    'Create drafts',
  ],
  [TOOL_SLUGS.WEB_SEARCH]: [
    'Search the web',
    'Fetch page content',
    'Summarize search results',
  ],
} as const;

export interface AgentTool {
  id: string;
  agentId: string;
  toolId: string;
  config: Record<string, unknown>;
  createdAt: string;
}
