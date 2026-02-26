/**
 * API client stub for Siestai Agent Platform
 * Uses mock data until backend is connected
 */

import type {
  Agent,
  AgentListResponse,
  AgentResponse,
  ConversationSession,
  HealthResponse,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4200";

// Mock agents data
const MOCK_AGENTS: Agent[] = [
  {
    id: "1",
    name: "Atlas",
    description: "A knowledgeable research assistant that can help you explore complex topics and synthesize information.",
    instructions: "You are Atlas, a research assistant. Help users explore topics thoroughly.",
    tags: ["research", "analysis"],
    color: "#3b82f6",
    icon: "brain",
    category: "technical",
    voice_id: null,
    preset_voice: "alloy",
    stt_provider: "cloud",
    llm_provider: "cloud",
    tts_provider: "cloud",
    tts_engine: null,
    tts_cloud_provider: null,
    llm_model: "gpt-4o",
    is_online: true,
    voice_name: "Alloy",
    call_count: 24,
    created_at: "2025-01-15T10:00:00Z",
    updated_at: "2025-02-20T14:30:00Z",
  },
  {
    id: "2",
    name: "Nova",
    description: "A creative storyteller and brainstorming partner for generating ideas and narratives.",
    instructions: "You are Nova, a creative assistant. Help users brainstorm and create.",
    tags: ["creative", "storytelling"],
    color: "#8b5cf6",
    icon: "sparkles",
    category: "creative",
    voice_id: null,
    preset_voice: "shimmer",
    stt_provider: "cloud",
    llm_provider: "cloud",
    tts_provider: "cloud",
    tts_engine: null,
    tts_cloud_provider: null,
    llm_model: "gpt-4o",
    is_online: true,
    voice_name: "Shimmer",
    call_count: 18,
    created_at: "2025-01-20T08:00:00Z",
    updated_at: "2025-02-19T11:00:00Z",
  },
  {
    id: "3",
    name: "Sage",
    description: "A calm conversational companion for thoughtful discussions and reflective dialogue.",
    instructions: "You are Sage, a thoughtful conversationalist. Engage in deep, meaningful conversations.",
    tags: ["conversation", "philosophy"],
    color: "#22c55e",
    icon: "leaf",
    category: "conversational",
    voice_id: null,
    preset_voice: "echo",
    stt_provider: "cloud",
    llm_provider: "cloud",
    tts_provider: "cloud",
    tts_engine: null,
    tts_cloud_provider: null,
    llm_model: "gpt-4o",
    is_online: false,
    voice_name: "Echo",
    call_count: 12,
    created_at: "2025-02-01T12:00:00Z",
    updated_at: "2025-02-18T09:00:00Z",
  },
  {
    id: "4",
    name: "Axiom",
    description: "A sharp debater who can argue multiple sides of any topic with evidence and logic.",
    instructions: "You are Axiom, a skilled debater. Present arguments with clarity and evidence.",
    tags: ["debate", "logic"],
    color: "#ef4444",
    icon: "scale",
    category: "debate",
    voice_id: null,
    preset_voice: "onyx",
    stt_provider: "cloud",
    llm_provider: "cloud",
    tts_provider: "cloud",
    tts_engine: null,
    tts_cloud_provider: null,
    llm_model: "gpt-4o",
    is_online: true,
    voice_name: "Onyx",
    call_count: 31,
    created_at: "2025-01-10T15:00:00Z",
    updated_at: "2025-02-21T16:00:00Z",
  },
  {
    id: "5",
    name: "Cipher",
    description: "A coding assistant that helps with software development, debugging, and architecture.",
    instructions: "You are Cipher, a coding assistant. Help users write, debug, and architect software.",
    tags: ["coding", "architecture"],
    color: "#eab308",
    icon: "code",
    category: "technical",
    voice_id: null,
    preset_voice: "fable",
    stt_provider: "cloud",
    llm_provider: "cloud",
    tts_provider: "cloud",
    tts_engine: null,
    tts_cloud_provider: null,
    llm_model: "gpt-4o",
    is_online: true,
    voice_name: "Fable",
    call_count: 45,
    created_at: "2025-01-05T09:00:00Z",
    updated_at: "2025-02-22T10:00:00Z",
  },
  {
    id: "6",
    name: "Luna",
    description: "A mindfulness and wellness guide for relaxation exercises and positive affirmations.",
    instructions: "You are Luna, a wellness guide. Help users relax and practice mindfulness.",
    tags: ["wellness", "mindfulness"],
    color: "#ec4899",
    icon: "moon",
    category: "conversational",
    voice_id: null,
    preset_voice: "nova",
    stt_provider: "cloud",
    llm_provider: "cloud",
    tts_provider: "cloud",
    tts_engine: null,
    tts_cloud_provider: null,
    llm_model: "gpt-4o",
    is_online: false,
    voice_name: "Nova",
    call_count: 8,
    created_at: "2025-02-10T14:00:00Z",
    updated_at: "2025-02-17T08:00:00Z",
  },
];

const MOCK_SESSIONS: ConversationSession[] = [
  {
    id: "s1",
    agent_id: "1",
    room_name: "room-atlas-001",
    status: "completed",
    duration: 320,
    mode: "live",
    started_at: "2025-02-22T14:00:00Z",
    ended_at: "2025-02-22T14:05:20Z",
  },
  {
    id: "s2",
    agent_id: "4",
    room_name: "room-axiom-001",
    status: "completed",
    duration: 180,
    mode: "arena",
    started_at: "2025-02-21T10:00:00Z",
    ended_at: "2025-02-21T10:03:00Z",
  },
  {
    id: "s3",
    agent_id: "5",
    room_name: "room-cipher-001",
    status: "completed",
    duration: 600,
    mode: "live",
    started_at: "2025-02-20T16:00:00Z",
    ended_at: "2025-02-20T16:10:00Z",
  },
];

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // Health
  async checkHealth(): Promise<HealthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      if (!response.ok) throw new Error("API not reachable");
      return response.json();
    } catch {
      return { status: "error", service: "siestai-api" };
    }
  }

  // Agents
  async listAgents(params?: {
    category?: string;
    search?: string;
  }): Promise<AgentListResponse> {
    // Mock implementation
    let filtered = [...MOCK_AGENTS];
    if (params?.category) {
      filtered = filtered.filter((a) => a.category === params.category);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return { success: true, agents: filtered, total: filtered.length };
  }

  async getAgent(id: string): Promise<AgentResponse> {
    const agent = MOCK_AGENTS.find((a) => a.id === id);
    if (!agent) throw new Error("Agent not found");
    return { success: true, agent };
  }

  // Sessions
  async listSessions(): Promise<{ sessions: ConversationSession[]; total: number }> {
    return { sessions: MOCK_SESSIONS, total: MOCK_SESSIONS.length };
  }

  // Resolve agent name from session
  getAgentName(agentId: string): string {
    return MOCK_AGENTS.find((a) => a.id === agentId)?.name || "Unknown Agent";
  }

}

export const api = new ApiClient();
export { ApiClient };
