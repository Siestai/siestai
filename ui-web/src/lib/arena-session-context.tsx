"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type {
  ArenaInvite,
  ArenaParticipant,
  ArenaSession,
  ArenaWsServerMessage,
} from "./types";
import {
  createArenaSession,
  buildWsUrl,
  type CreateArenaSessionParams,
} from "./arena-api";

type ConnectionStatus = "disconnected" | "connecting" | "connected";

interface ArenaSessionContextValue {
  session: ArenaSession | null;
  invite: ArenaInvite | null;
  participants: ArenaParticipant[];
  connectionStatus: ConnectionStatus;
  createSession: (params: CreateArenaSessionParams) => Promise<void>;
  startListening: () => void;
  endSession: () => void;
}

const ArenaSessionContext = createContext<ArenaSessionContextValue | null>(null);

export function ArenaSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ArenaSession | null>(null);
  const [invite, setInvite] = useState<ArenaInvite | null>(null);
  const hostTokenRef = useRef<string | null>(null);
  const [participants, setParticipants] = useState<ArenaParticipant[]>([]);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionStatus("disconnected");
  }, []);

  const handleCreateSession = useCallback(
    async (params: CreateArenaSessionParams) => {
      const result = await createArenaSession(params);
      setSession(result.session);
      setInvite(result.invite);
      hostTokenRef.current = result.hostToken;
      setParticipants(result.session.participants);
    },
    [],
  );

  const startListening = useCallback(() => {
    const token = hostTokenRef.current;
    if (!token) return;
    cleanup();

    setConnectionStatus("connecting");
    const ws = new WebSocket(buildWsUrl(token));
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus("connected");
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string) as ArenaWsServerMessage;

      switch (msg.type) {
        case "welcome":
          setParticipants(msg.participants);
          break;
        case "system":
          if (msg.event === "participant_joined") {
            setParticipants((prev) => {
              if (prev.some((p) => p.id === msg.participant.id)) return prev;
              return [...prev, msg.participant];
            });
          } else if (msg.event === "participant_left") {
            setParticipants((prev) =>
              prev.map((p) =>
                p.id === msg.participant.id
                  ? { ...p, status: "disconnected" as const }
                  : p,
              ),
            );
          }
          break;
        case "session_ended":
          setSession((prev) =>
            prev ? { ...prev, status: "ended" as const } : prev,
          );
          cleanup();
          break;
      }
    };

    ws.onclose = () => {
      setConnectionStatus("disconnected");
    };

    ws.onerror = () => {
      setConnectionStatus("disconnected");
    };
  }, [cleanup]);

  const endSession = useCallback(() => {
    cleanup();
    setSession(null);
    setInvite(null);
    hostTokenRef.current = null;
    setParticipants([]);
  }, [cleanup]);

  // Close WS on unmount
  useEffect(() => cleanup, [cleanup]);

  return (
    <ArenaSessionContext.Provider
      value={{
        session,
        invite,
        participants,
        connectionStatus,
        createSession: handleCreateSession,
        startListening,
        endSession,
      }}
    >
      {children}
    </ArenaSessionContext.Provider>
  );
}

export function useArenaSession(): ArenaSessionContextValue {
  const ctx = useContext(ArenaSessionContext);
  if (!ctx) {
    throw new Error(
      "useArenaSession must be used within an ArenaSessionProvider",
    );
  }
  return ctx;
}
