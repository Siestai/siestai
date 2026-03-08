import type {
  ArenaMode,
  ArenaInvite,
  ArenaParticipant,
  ArenaSession,
  ArenaSessionBrief,
  ArenaTranscriptEntry,
  PaginatedArenaSessions,
  ArenaHistoryFilters,
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

export async function deleteArenaSession(sessionId: string): Promise<void> {
  const response = await fetch(`${API_URL}/arena/sessions/${sessionId}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Failed to delete arena session: ${response.status} ${errorText}`,
    );
  }
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

export async function listArenaSessions(
  filters: ArenaHistoryFilters & { page?: number; limit?: number } = {},
): Promise<PaginatedArenaSessions> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.participationMode) params.set("participationMode", filters.participationMode);
  if (filters.teamId) params.set("teamId", filters.teamId);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.status) params.set("status", filters.status);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));

  const qs = params.toString();
  const response = await fetch(`${API_URL}/arena/sessions${qs ? `?${qs}` : ""}`, {
    credentials: "include",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Failed to list arena sessions: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<PaginatedArenaSessions>;
}

export async function getArenaSessionTranscripts(
  sessionId: string,
): Promise<ArenaTranscriptEntry[]> {
  const response = await fetch(`${API_URL}/arena/sessions/${sessionId}/transcript`, {
    credentials: "include",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Failed to fetch transcripts: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<ArenaTranscriptEntry[]>;
}

export async function getArenaSessionMemories(
  sessionId: string,
): Promise<any[]> {
  const response = await fetch(`${API_URL}/arena/sessions/${sessionId}/memories`, {
    credentials: "include",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Failed to fetch memories: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<any[]>;
}

export function buildWsUrl(hostToken: string): string {
  const wsBase = API_URL.replace(/^http/, "ws");
  return `${wsBase}/arena/ws?token=${hostToken}`;
}
