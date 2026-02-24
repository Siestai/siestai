/**
 * TypeScript interfaces for Siestai AI Agent Platform
 */

// Agent types
export interface Agent {
  id: string;
  name: string;
  description: string;
  instructions: string;
  tags: string[];
  color: string;
  icon: string;
  category: string;
  voice_id: string | null;
  preset_voice: string | null;
  stt_provider: string | null;
  llm_provider: string | null;
  tts_provider: string | null;
  tts_engine: string | null;
  tts_cloud_provider: string | null;
  llm_model: string | null;
  is_online: boolean;
  voice_name: string | null;
  call_count: number;
  created_at: string;
  updated_at: string;
}

export interface AgentResponse {
  success: boolean;
  agent: Agent;
}

export interface AgentListResponse {
  success: boolean;
  agents: Agent[];
  total: number;
}

// Arena types
export interface ArenaAgentConfig {
  name: string;
  agentId?: string;
  instructions: string;
}

export type ArenaMode = "group" | "moderated";
export type ParticipationMode = "agent_only" | "human_collab";

// Session types
export interface ConversationSession {
  id: string;
  agent_id: string;
  room_name: string;
  status: string;
  duration: number | null;
  mode: string;
  started_at: string;
  ended_at: string | null;
}

export interface SessionListResponse {
  success: boolean;
  sessions: ConversationSession[];
  total: number;
}

// Health types
export interface HealthResponse {
  status: string;
  service: string;
}

// API error type
export interface ApiError {
  detail: string;
}

// Constants
export const AGENT_CATEGORIES = [
  { value: "conversational", label: "Conversational" },
  { value: "creative", label: "Creative" },
  { value: "technical", label: "Technical" },
  { value: "debate", label: "Debate" },
] as const;

export const AGENT_CARD_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
] as const;
