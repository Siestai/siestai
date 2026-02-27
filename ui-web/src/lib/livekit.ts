import type { RoomOptions } from "livekit-client";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4200";

export function generateRoomName(): string {
  return `siestai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function generateParticipantIdentity(): string {
  return `user-${Math.random().toString(36).slice(2, 9)}`;
}

export interface TokenResponse {
  token: string;
  serverUrl: string;
  roomName: string;
}

export interface FetchTokenParams {
  roomName: string;
  identity: string;
  participantName?: string;
}

export async function fetchToken(
  params: FetchTokenParams,
): Promise<TokenResponse> {
  const response = await fetch(`${API_URL}/livekit/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Failed to fetch LiveKit token: ${response.status} ${errorText}`,
    );
  }

  return response.json() as Promise<TokenResponse>;
}

export async function fetchArenaToken(
  sessionId: string,
): Promise<TokenResponse> {
  const response = await fetch(`${API_URL}/arena/sessions/${sessionId}/start`, {
    method: "POST",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Failed to start arena session: ${response.status} ${errorText}`,
    );
  }

  return response.json() as Promise<TokenResponse>;
}

export const ROOM_OPTIONS: RoomOptions = {
  audioCaptureDefaults: {
    autoGainControl: true,
    echoCancellation: true,
    noiseSuppression: true,
  },
  adaptiveStream: true,
  dynacast: true,
};
