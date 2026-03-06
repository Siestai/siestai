import type {
  ArenaMode,
  ArenaInvite,
  ArenaParticipant,
  ArenaSession,
  ArenaSessionBrief,
  ParticipationMode,
} from "./types";
import { API_URL } from "./livekit";

// --- Request / Response shapes ---

export interface CreateArenaSessionParams {
  topic: string;
  mode: ArenaMode;
  participationMode: ParticipationMode;
  nativeAgents?: { name: string; agentId?: string; instructions?: string }[];
  teamId?: string;
}

export interface CreateArenaSessionResponse {
  session: ArenaSession;
  invite: ArenaInvite;
  hostToken: string;
}

export interface JoinArenaParams {
  token: string;
  agentName: string;
  platform?: string;
  model?: string;
}

export interface JoinArenaResponse {
  sessionId: string;
  wsUrl: string;
  participant: ArenaParticipant;
}

// --- API functions ---

export async function createArenaSession(
  params: CreateArenaSessionParams,
): Promise<CreateArenaSessionResponse> {
  const response = await fetch(`${API_URL}/arena/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    credentials: "include",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Failed to create arena session: ${response.status} ${errorText}`,
    );
  }

  return response.json() as Promise<CreateArenaSessionResponse>;
}

export async function getArenaSession(id: string): Promise<ArenaSession> {
  const response = await fetch(`${API_URL}/arena/sessions/${id}`, {
    credentials: "include",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Failed to fetch arena session: ${response.status} ${errorText}`,
    );
  }

  return response.json() as Promise<ArenaSession>;
}

export async function joinArena(
  params: JoinArenaParams,
): Promise<JoinArenaResponse> {
  const response = await fetch(`${API_URL}/arena/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Failed to join arena: ${response.status} ${errorText}`,
    );
  }

  return response.json() as Promise<JoinArenaResponse>;
}

export async function getArenaSessionBrief(
  sessionId: string,
): Promise<ArenaSessionBrief | null> {
  const response = await fetch(`${API_URL}/arena/sessions/${sessionId}/brief`, {
    credentials: "include",
  });

  // 202 means extraction is still processing
  if (response.status === 202) {
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Failed to fetch session brief: ${response.status} ${errorText}`,
    );
  }

  return response.json() as Promise<ArenaSessionBrief>;
}

export async function endArenaSession(sessionId: string): Promise<void> {
  const response = await fetch(`${API_URL}/arena/sessions/${sessionId}/end`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Failed to end arena session: ${response.status} ${errorText}`,
    );
  }
}

export function buildWsUrl(hostToken: string): string {
  const wsBase = API_URL.replace(/^http/, "ws");
  return `${wsBase}/arena/ws?token=${hostToken}`;
}
