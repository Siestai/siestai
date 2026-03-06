export type ArenaSessionStatus = 'waiting' | 'active' | 'ended';
export type ArenaParticipantType = 'human' | 'native_agent' | 'external_agent';
export type ArenaParticipantStatus =
  | 'invited'
  | 'joining'
  | 'connected'
  | 'disconnected';

export type ArenaMode = 'group' | 'moderated';
export type ParticipationMode = 'agent_only' | 'human_collab';

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
  roomName?: string;
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
