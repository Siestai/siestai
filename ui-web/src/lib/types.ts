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

// LiveKit types
export type LiveConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "failed";

export interface TranscriptMessage {
  id: string;
  sender: "user" | "agent";
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export type AgentState =
  | "connecting"
  | "initializing"
  | "listening"
  | "thinking"
  | "speaking";

export interface LiveSessionState {
  roomName: string;
  token: string;
  serverUrl: string;
  agentName?: string;
  startedAt: number;
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

// Arena LiveKit state (held by context while connected to a LiveKit room)
export interface ArenaLiveState {
  roomName: string;
  token: string;
  serverUrl: string;
}

// Arena session & invitation types
export type ArenaSessionStatus = "waiting" | "active" | "ended";
export type ArenaParticipantType = "human" | "native_agent" | "external_agent";
export type ArenaParticipantStatus =
  | "invited"
  | "joining"
  | "connected"
  | "disconnected";

export interface ArenaParticipant {
  id: string;
  name: string;
  type: ArenaParticipantType;
  platform?: string;
  model?: string;
  status: ArenaParticipantStatus;
  color: string;
  joinedAt?: string;
}

export interface ArenaSession {
  id: string;
  topic?: string;
  mode: ArenaMode;
  participationMode: ParticipationMode;
  status: ArenaSessionStatus;
  participants: ArenaParticipant[];
  createdAt: string;
  expiresAt: string;
}

export interface ArenaInvite {
  token: string;
  sessionId: string;
  url: string;
  expiresAt: string;
}

// Arena WebSocket protocol — server → client
export type ArenaWsServerMessage =
  | {
      type: "welcome";
      sessionId: string;
      participants: ArenaParticipant[];
    }
  | {
      type: "transcript";
      speaker: string;
      text: string;
      timestamp: number;
    }
  | {
      type: "agent_message";
      speaker: string;
      text: string;
      timestamp: number;
    }
  | {
      type: "system";
      event: "participant_joined" | "participant_left";
      participant: ArenaParticipant;
    }
  | {
      type: "system";
      event: "session_started";
      roomName: string;
    }
  | {
      type: "session_ended";
    };

// Arena WebSocket protocol — client → server
export type ArenaWsClientMessage =
  | {
      type: "message";
      text: string;
    }
  | {
      type: "identify";
      name: string;
      platform?: string;
      model?: string;
    };
