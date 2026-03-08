export interface ArenaAgentConfig {
  name: string;
  agentId?: string;
  instructions: string;
}

export type ArenaMode = 'group' | 'moderated';
export type ParticipationMode = 'agent_only' | 'human_collab';

export type ArenaSessionStatus = 'waiting' | 'active' | 'ended';
export type ArenaParticipantType = 'human' | 'native_agent' | 'external_agent';
export type ArenaParticipantStatus =
  | 'invited'
  | 'joining'
  | 'connected'
  | 'disconnected';

export interface ArenaParticipant {
  id: string;
  agentId?: string;
  name: string;
  type: ArenaParticipantType;
  platform?: string;
  model?: string;
  instructions?: string;
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
  startedAt?: string;
  endedAt?: string;
  teamId?: string;
  teamName?: string;
}

export interface ArenaInvite {
  token: string;
  sessionId: string;
  url: string;
  expiresAt: string;
}

// Arena WebSocket protocol -- server -> client
export type ArenaWsServerMessage =
  | {
      type: 'welcome';
      sessionId: string;
      participants: ArenaParticipant[];
    }
  | {
      type: 'transcript';
      speaker: string;
      text: string;
      timestamp: number;
    }
  | {
      type: 'agent_message';
      speaker: string;
      text: string;
      timestamp: number;
    }
  | {
      type: 'system';
      event: 'participant_joined' | 'participant_left';
      participant: ArenaParticipant;
    }
  | {
      type: 'system';
      event: 'session_started';
      roomName: string;
    }
  | {
      type: 'arena_action';
      action: ArenaAction;
    }
  | {
      type: 'session_ended';
    };

// Arena WebSocket protocol -- client -> server
export type ArenaWsClientMessage =
  | {
      type: 'message';
      text: string;
    }
  | {
      type: 'identify';
      name: string;
      platform?: string;
      model?: string;
      instructions?: string;
    };

// --- Arena Memory & Context Engineering types ---

export interface ArenaTranscriptEntry {
  id: string;
  sessionId: string;
  speakerName: string;
  speakerType: ArenaParticipantType;
  content: string;
  source: 'livekit' | 'websocket';
  timestamp: string;
}

export type MemoryCategory =
  | 'decision'
  | 'position'
  | 'task'
  | 'open_question'
  | 'learning';

export interface AgentMemory {
  id: string;
  agentId: string;
  sessionId: string;
  category: MemoryCategory;
  content: string;
  confidence: 'high' | 'medium' | 'low';
  createdAt: string;
  expiresAt?: string;
}

export interface ArenaSessionBrief {
  id: string;
  sessionId: string;
  decisions: { text: string; confidence: string }[];
  actionItems: { owner: string; task: string; deadline?: string }[];
  unresolved: { topic: string; positions: string[] }[];
  nextSessionQuestions: string[];
  createdAt: string;
}

// --- Arena Actions ---

/** All known arena action types. Extend this union to add new actions. */
export type ArenaActionType = 'team_first_meeting';

interface ArenaActionBase {
  type: ArenaActionType;
  label: string;
  description: string;
  timestamp: string;
}

export interface TeamFirstMeetingAction extends ArenaActionBase {
  type: 'team_first_meeting';
  meta: { teamId: string; teamName: string };
}

/**
 * Discriminated union of all arena actions.
 * To add a new action:
 *   1. Add the type literal to ArenaActionType
 *   2. Create an interface extending ArenaActionBase
 *   3. Add it to this union
 *   4. Add an evaluator in arena.service.ts → ACTION_EVALUATORS
 */
export type ArenaAction = TeamFirstMeetingAction;

// --- Arena History types ---

export interface ArenaSessionSummary {
  id: string;
  topic?: string;
  mode: ArenaMode;
  participationMode: ParticipationMode;
  status: ArenaSessionStatus;
  participantCount: number;
  participantNames: string[];
  teamId?: string;
  teamName?: string;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  durationMinutes?: number;
}

export interface PaginatedArenaSessions {
  data: ArenaSessionSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface ArenaHistoryFilters {
  search?: string;
  participationMode?: ParticipationMode;
  teamId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: ArenaSessionStatus;
}
