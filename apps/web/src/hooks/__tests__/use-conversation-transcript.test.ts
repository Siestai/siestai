import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useConversationTranscript } from "../use-conversation-transcript";

// Mock the LiveKit hooks
const mockLocalParticipant = { identity: "local-user" };
let mockAllTranscriptions: Array<{
  participantInfo: { identity: string };
  streamInfo: { id: string };
  text: string;
}> = [];
let mockAgentTranscriptions: Array<{
  id: string;
  text: string;
  final: boolean;
  firstReceivedTime?: number;
}> = [];

vi.mock("@livekit/components-react", () => ({
  useLocalParticipant: () => ({ localParticipant: mockLocalParticipant }),
  useTranscriptions: () => mockAllTranscriptions,
  useVoiceAssistant: () => ({
    agentTranscriptions: mockAgentTranscriptions,
  }),
}));

describe("useConversationTranscript", () => {
  beforeEach(() => {
    mockAllTranscriptions = [];
    mockAgentTranscriptions = [];
  });

  it("should return empty messages initially", () => {
    const { result } = renderHook(() => useConversationTranscript());
    expect(result.current.messages).toEqual([]);
  });

  it("should process user transcriptions from useTranscriptions", () => {
    mockAllTranscriptions = [
      {
        participantInfo: { identity: "local-user" },
        streamInfo: { id: "stream-1" },
        text: "Hello",
      },
    ];

    const { result } = renderHook(() => useConversationTranscript());

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toMatchObject({
      id: "user-stream-1",
      sender: "user",
      text: "Hello",
      isFinal: true,
    });
  });

  it("should process agent transcriptions from useVoiceAssistant", () => {
    mockAgentTranscriptions = [
      {
        id: "agent-seg-1",
        text: "Hi there",
        final: true,
        firstReceivedTime: 1000,
      },
    ];

    const { result } = renderHook(() => useConversationTranscript());

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toMatchObject({
      id: "agent-agent-seg-1",
      sender: "agent",
      text: "Hi there",
      isFinal: true,
      timestamp: 1000,
    });
  });

  it("should filter out non-local-user transcriptions", () => {
    mockAllTranscriptions = [
      {
        participantInfo: { identity: "other-user" },
        streamInfo: { id: "stream-1" },
        text: "From another participant",
      },
    ];

    const { result } = renderHook(() => useConversationTranscript());

    expect(result.current.messages).toHaveLength(0);
  });

  it("should merge user and agent messages sorted chronologically", () => {
    mockAllTranscriptions = [
      {
        participantInfo: { identity: "local-user" },
        streamInfo: { id: "stream-1" },
        text: "User message",
      },
    ];
    mockAgentTranscriptions = [
      {
        id: "agent-seg-1",
        text: "Agent message",
        final: true,
        firstReceivedTime: 500,
      },
    ];

    const { result } = renderHook(() => useConversationTranscript());

    expect(result.current.messages).toHaveLength(2);
    // Agent message has timestamp 500, user message has Date.now() (much larger)
    expect(result.current.messages[0].sender).toBe("agent");
    expect(result.current.messages[1].sender).toBe("user");
  });

  it("should deduplicate interim to final agent updates", () => {
    // Start with interim message
    mockAgentTranscriptions = [
      { id: "seg-1", text: "Hel", final: false, firstReceivedTime: 1000 },
    ];

    const { result, rerender } = renderHook(() =>
      useConversationTranscript(),
    );

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].text).toBe("Hel");
    expect(result.current.messages[0].isFinal).toBe(false);

    // Update to final
    mockAgentTranscriptions = [
      { id: "seg-1", text: "Hello!", final: true, firstReceivedTime: 1000 },
    ];

    rerender();

    // Should still be 1 message, not duplicated
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].text).toBe("Hello!");
    expect(result.current.messages[0].isFinal).toBe(true);
  });

  it("should respect maxMessages limit", () => {
    // Create many transcriptions
    mockAgentTranscriptions = Array.from({ length: 10 }, (_, i) => ({
      id: `seg-${i}`,
      text: `Message ${i}`,
      final: true,
      firstReceivedTime: i * 100,
    }));

    const { result } = renderHook(() => useConversationTranscript(5));

    expect(result.current.messages).toHaveLength(5);
    // Should keep the latest 5
    expect(result.current.messages[0].text).toBe("Message 5");
    expect(result.current.messages[4].text).toBe("Message 9");
  });

  it("should clear all messages when clearMessages is called", () => {
    mockAgentTranscriptions = [
      { id: "seg-1", text: "Hello", final: true, firstReceivedTime: 1000 },
    ];

    const { result } = renderHook(() => useConversationTranscript());

    expect(result.current.messages).toHaveLength(1);

    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toHaveLength(0);
  });

  it("should skip empty text transcriptions", () => {
    mockAllTranscriptions = [
      {
        participantInfo: { identity: "local-user" },
        streamInfo: { id: "stream-1" },
        text: "   ",
      },
    ];
    mockAgentTranscriptions = [
      { id: "seg-1", text: "", final: true, firstReceivedTime: 1000 },
    ];

    const { result } = renderHook(() => useConversationTranscript());

    expect(result.current.messages).toHaveLength(0);
  });
});
