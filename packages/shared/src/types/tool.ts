export interface Tool {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  isActive: boolean;
  createdAt: string;
}

export interface AgentTool {
  id: string;
  agentId: string;
  toolId: string;
  config: Record<string, unknown>;
  createdAt: string;
}
