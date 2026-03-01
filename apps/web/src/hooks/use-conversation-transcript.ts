"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  useTranscriptions,
  useVoiceAssistant,
  useLocalParticipant,
} from "@livekit/components-react";
import type { TranscriptMessage } from "@/lib/types";

export function useConversationTranscript(maxMessages: number = 100) {
  const { localParticipant } = useLocalParticipant();
  const { agentTranscriptions } = useVoiceAssistant();
  const allTranscriptions = useTranscriptions();

  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const messageMapRef = useRef<Map<string, TranscriptMessage>>(new Map());

  // Process user transcriptions
  useEffect(() => {
    const userIdentity = localParticipant.identity;
    let changed = false;

    for (const stream of allTranscriptions) {
      const isUser = stream.participantInfo.identity === userIdentity;
      if (!isUser) continue;

      const messageId = `user-${stream.streamInfo.id}`;
      const existing = messageMapRef.current.get(messageId);
      const text = stream.text;

      if (!text?.trim()) continue;

      if (existing) {
        if (existing.text !== text) {
          messageMapRef.current.set(messageId, { ...existing, text, isFinal: true });
          changed = true;
        }
      } else {
        messageMapRef.current.set(messageId, {
          id: messageId,
          sender: "user",
          text,
          isFinal: true,
          timestamp: Date.now(),
          source: "livekit",
        });
        changed = true;
      }
    }

    if (changed) {
      const sorted = Array.from(messageMapRef.current.values())
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-maxMessages);
      setMessages(sorted);
    }
  }, [allTranscriptions, localParticipant.identity, maxMessages]);

  // Process agent transcriptions
  useEffect(() => {
    let changed = false;

    for (const segment of agentTranscriptions) {
      const messageId = `agent-${segment.id}`;
      const existing = messageMapRef.current.get(messageId);
      const text = segment.text;

      if (!text?.trim()) continue;

      if (existing) {
        if (existing.text !== text || existing.isFinal !== segment.final) {
          messageMapRef.current.set(messageId, {
            ...existing,
            text,
            isFinal: segment.final,
          });
          changed = true;
        }
      } else {
        messageMapRef.current.set(messageId, {
          id: messageId,
          sender: "agent",
          text,
          isFinal: segment.final,
          timestamp: segment.firstReceivedTime ?? Date.now(),
          source: "livekit",
        });
        changed = true;
      }
    }

    if (changed) {
      const sorted = Array.from(messageMapRef.current.values())
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-maxMessages);
      setMessages(sorted);
    }
  }, [agentTranscriptions, maxMessages]);

  const clearMessages = useCallback(() => {
    messageMapRef.current.clear();
    setMessages([]);
  }, []);

  return { messages, clearMessages };
}
