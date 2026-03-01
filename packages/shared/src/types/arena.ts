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
