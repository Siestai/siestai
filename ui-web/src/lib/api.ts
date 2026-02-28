/**
 * API client for Siestai Agent Platform
 */

import type {
  Agent,
  CreateAgentData,
  UpdateAgentData,
  HealthResponse,
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
