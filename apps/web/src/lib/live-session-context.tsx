"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";

interface LiveSessionContextValue {
  isInSession: boolean;
  sessionRoomName: string | null;
  setSession: (roomName: string | null) => void;
}

const LiveSessionContext = createContext<LiveSessionContextValue>({
  isInSession: false,
  sessionRoomName: null,
  setSession: () => {},
});

export function LiveSessionProvider({ children }: { children: ReactNode }) {
  const [sessionRoomName, setSessionRoomName] = useState<string | null>(null);

  const setSession = useCallback((roomName: string | null) => {
    setSessionRoomName(roomName);
  }, []);

  return (
    <LiveSessionContext.Provider
      value={{
        isInSession: sessionRoomName !== null,
        sessionRoomName,
        setSession,
      }}
    >
      {children}
    </LiveSessionContext.Provider>
  );
}

export function useLiveSession() {
  return useContext(LiveSessionContext);
}
