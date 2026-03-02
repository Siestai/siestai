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

export interface AgentTool {
  id: string;
  agentId: string;
  toolId: string;
  config: Record<string, unknown>;
  createdAt: string;
}
