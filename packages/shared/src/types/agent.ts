export type AgentSource = 'mastra' | 'livekit' | 'external';

export interface Agent {
  id: string;
  name: string;
  description: string;
  instructions: string;
  tags: string[];
  color: string;
  icon: string;
  category: string;
  source: AgentSource;
  llmModel: string | null;
  isOnline: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateAgentData = {
  name: string;
  instructions: string;
  description?: string;
  category?: string;
  source?: AgentSource;
  tags?: string[];
  color?: string;
  icon?: string;
  llmModel?: string;
};

export type UpdateAgentData = Partial<CreateAgentData>;

export interface AgentFile {
  id: string;
  agentId: string;
  filename: string;
  filePath: string;
  mimeType: string | null;
  fileSize: number | null;
  createdAt: string;
}

export const AGENT_CATEGORIES = [
  { value: 'conversational', label: 'Conversational' },
  { value: 'creative', label: 'Creative' },
  { value: 'technical', label: 'Technical' },
  { value: 'debate', label: 'Debate' },
] as const;

export const AGENT_CARD_COLORS = [
  '#3b82f6',
  '#22c55e',
  '#eab308',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
] as const;
