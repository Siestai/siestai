export type LiveConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'failed';

export interface TranscriptMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  isFinal: boolean;
  timestamp: number;
  source?: 'livekit' | 'ws';
}

export type AgentState =
  | 'connecting'
  | 'initializing'
  | 'listening'
  | 'thinking'
  | 'speaking';

export interface LiveSessionState {
  roomName: string;
  token: string;
  serverUrl: string;
  agentName?: string;
  startedAt: number;
}

export interface ArenaLiveState {
  roomName: string;
  token: string;
  serverUrl: string;
}
