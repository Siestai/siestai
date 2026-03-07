/**
 * API client for Siestai Agent Platform
 */

import type {
  Agent,
  CreateAgentData,
  UpdateAgentData,
  HealthResponse,
  AgentPreviewRequest,
  ActivityEvent,
  AgentFile,
  AgentMemory,
  Tool,
  ToolWithStatus,
  ToolCredentialStatus,
  AgentTool,
  Team,
  TeamAgent,
  CreateTeamData,
  UpdateTeamData,
  MdFile,
  DailyMemoryFile,
  MemorySearchResult,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4200";

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      credentials: "include" as RequestCredentials,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || body.error || `Request failed (${res.status})`);
    }
    return res.json();
  }

  // Health
  async checkHealth(): Promise<HealthResponse> {
    try {
      return await this.request<HealthResponse>("/health");
    } catch {
      return { status: "error", service: "siestai-api" };
    }
  }

  // Agents
  async listAgents(params?: {
    category?: string;
    search?: string;
  }): Promise<Agent[]> {
    const qs = new URLSearchParams();
    if (params?.category) qs.set("category", params.category);
    if (params?.search) qs.set("search", params.search);
    const query = qs.toString();
    return this.request<Agent[]>(`/agents${query ? `?${query}` : ""}`);
  }

  async getAgent(id: string): Promise<Agent> {
    return this.request<Agent>(`/agents/${id}`);
  }

  async createAgent(data: CreateAgentData): Promise<Agent> {
    return this.request<Agent>("/agents", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateAgent(id: string, data: UpdateAgentData): Promise<Agent> {
    return this.request<Agent>(`/agents/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteAgent(id: string): Promise<void> {
    await this.request(`/agents/${id}`, { method: "DELETE" });
  }

  // Agent files
  async listAgentFiles(agentId: string): Promise<AgentFile[]> {
    return this.request<AgentFile[]>(`/agents/${agentId}/files`);
  }

  async uploadAgentFile(agentId: string, file: File): Promise<AgentFile> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${this.baseUrl}/agents/${agentId}/files`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `Upload failed (${res.status})`);
    }
    return res.json();
  }

  async deleteAgentFile(agentId: string, fileId: string): Promise<void> {
    await this.request(`/agents/${agentId}/files/${fileId}`, {
      method: "DELETE",
    });
  }

  // Tools
  async listTools(): Promise<Tool[]> {
    return this.request<Tool[]>("/tools");
  }

  async listToolsWithStatus(): Promise<ToolWithStatus[]> {
    return this.request<ToolWithStatus[]>("/tools");
  }

  async getToolOAuthStatus(slug: string): Promise<ToolCredentialStatus> {
    return this.request<ToolCredentialStatus>(`/tools/${slug}/oauth/status`);
  }

  async disconnectToolOAuth(slug: string): Promise<void> {
    await this.request(`/tools/${slug}/oauth/disconnect`, { method: "DELETE" });
  }

  async configureTool(slug: string, config: { apiKey: string }): Promise<void> {
    await this.request(`/tools/${slug}/configure`, {
      method: "POST",
      body: JSON.stringify(config),
    });
  }

  getOAuthConnectUrl(slug: string): string {
    return `${this.baseUrl}/tools/${slug}/oauth/connect`;
  }

  async listAgentTools(agentId: string): Promise<AgentTool[]> {
    return this.request<AgentTool[]>(`/agents/${agentId}/tools`);
  }

  async connectAgentTool(agentId: string, toolId: string): Promise<AgentTool> {
    return this.request<AgentTool>(`/agents/${agentId}/tools`, {
      method: "POST",
      body: JSON.stringify({ toolId }),
    });
  }

  async disconnectAgentTool(agentId: string, toolId: string): Promise<void> {
    await this.request(`/agents/${agentId}/tools/${toolId}`, {
      method: "DELETE",
    });
  }

  // Chat history
  async getChatHistory(agentId: string) {
    return this.request<any[]>(`/agents/${agentId}/chat/history`);
  }

  // Agent preview
  async previewStream(payload: AgentPreviewRequest): Promise<Response> {
    return fetch(`${this.baseUrl}/agents/preview/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
  }

  // Activity
  async getActivity(): Promise<ActivityEvent[]> {
    return this.request<ActivityEvent[]>("/activity");
  }

  // Agent memories
  async getAgentMemories(agentId: string): Promise<AgentMemory[]> {
    return this.request<AgentMemory[]>(`/agents/${agentId}/memories`);
  }

  // ─── Teams ──────────────────────────────────────────────────────

  async listTeams(): Promise<Team[]> {
    return this.request<Team[]>("/teams");
  }

  async getTeam(id: string): Promise<Team> {
    return this.request<Team>(`/teams/${id}`);
  }

  async createTeam(data: CreateTeamData): Promise<Team> {
    return this.request<Team>("/teams", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateTeam(id: string, data: UpdateTeamData): Promise<Team> {
    return this.request<Team>(`/teams/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteTeam(id: string): Promise<void> {
    await this.request(`/teams/${id}`, { method: "DELETE" });
  }

  async getTeamAgents(teamId: string): Promise<TeamAgent[]> {
    return this.request<TeamAgent[]>(`/teams/${teamId}/agents`);
  }

  async addTeamAgent(teamId: string, agentId: string, role?: string): Promise<TeamAgent> {
    return this.request<TeamAgent>(`/teams/${teamId}/agents`, {
      method: "POST",
      body: JSON.stringify({ agentId, role }),
    });
  }

  async removeTeamAgent(teamId: string, agentId: string): Promise<void> {
    await this.request(`/teams/${teamId}/agents/${agentId}`, { method: "DELETE" });
  }

  // ─── MD Files ──────────────────────────────────────────────────

  async getAgentMdFiles(agentId: string): Promise<MdFile[]> {
    return this.request<MdFile[]>(`/agents/${agentId}/md-files`);
  }

  async updateAgentMdFile(agentId: string, fileKey: string, content: string): Promise<MdFile> {
    return this.request<MdFile>(`/agents/${agentId}/md-files/${fileKey}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
  }

  async getTeamMdFiles(teamId: string): Promise<MdFile[]> {
    return this.request<MdFile[]>(`/teams/${teamId}/md-files`);
  }

  async updateTeamMdFile(teamId: string, fileKey: string, content: string): Promise<MdFile> {
    return this.request<MdFile>(`/teams/${teamId}/md-files/${fileKey}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
  }

  // ─── Memory Search ─────────────────────────────────────────────

  async searchAgentMemories(agentId: string, query: string, topK = 5): Promise<MemorySearchResult[]> {
    return this.request<MemorySearchResult[]>(
      `/agents/${agentId}/memories/search?q=${encodeURIComponent(query)}&topK=${topK}`
    );
  }

  async getAgentDailyFiles(agentId: string, days = 30): Promise<DailyMemoryFile[]> {
    return this.request<DailyMemoryFile[]>(`/agents/${agentId}/daily-files?days=${days}`);
  }

  async searchTeamMemories(teamId: string, query: string, topK = 5): Promise<MemorySearchResult[]> {
    return this.request<MemorySearchResult[]>(
      `/teams/${teamId}/memories/search?q=${encodeURIComponent(query)}&topK=${topK}`
    );
  }

  async getTeamDailyFiles(teamId: string, days = 30): Promise<DailyMemoryFile[]> {
    return this.request<DailyMemoryFile[]>(`/teams/${teamId}/daily-files?days=${days}`);
  }

  // Resolve agent name
  async getAgentName(agentId: string): Promise<string> {
    try {
      const agent = await this.getAgent(agentId);
      return agent.name;
    } catch {
      return "Unknown Agent";
    }
  }
}

export const api = new ApiClient();
export { ApiClient };
