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
      return await this.request<HealthResponse>("/api/health");
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
