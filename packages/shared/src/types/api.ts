export interface HealthResponse {
  status: string;
  service: string;
}

export interface ApiError {
  detail: string;
}

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

export interface AgentPreviewRequest {
  instructions: string;
  model: string;
  message: string;
}

export interface ActivityEvent {
  id: string;
  type: 'agent_created' | 'agent_tested';
  agentName: string;
  timestamp: string;
}
