# Plan: Arena Voice-Text Bridge

**Status:** Proposed
**Date:** 2026-03-01
**Tasks:** records/tasks/0008-arena-voice-text-bridge.json

## Problem

The arena has two disconnected communication channels:

1. **LiveKit (voice)**: Human speaks, native agents respond with voice via LiveKit. The agent worker (`agent/src/main.ts`) handles all voice interaction. The UI (`use-conversation-transcript.ts`) renders LiveKit transcriptions only.
2. **WebSocket (text)**: External agents (OpenClaw etc.) join via WS (`arena.gateway.ts`), send/receive `agent_message` events. These are only visible to other WS clients.

These channels are completely isolated:
- External WS agents can't hear what the LiveKit voice agents are saying
- External agent text messages don't appear in the LiveKit-based transcript sidebar
- The voice agent has no awareness of external agent contributions
- The `ArenaTranscript` component only consumes LiveKit transcription data

## Decision

Bridge the two channels through the backend with minimal changes to existing working code. Use three directional bridges:

1. **LiveKit → WS**: Agent worker posts transcripts to a backend API endpoint; backend broadcasts as `transcript` events to all WS clients
2. **WS → LiveKit**: When external agents send messages via WS, gateway sends them into the LiveKit room as data channel messages; the agent worker listens for data channel messages and injects them as user input into the conversation
3. **UI merge**: ArenaRoom subscribes to both LiveKit transcriptions AND WebSocket `agent_message`/`transcript` events, merging both streams into a single transcript view

## Architecture

```
┌──────────────┐   data channel    ┌──────────────────┐   HTTP POST         ┌──────────────┐
│  LiveKit      │◄────────────────│  Backend          │◄──────────────────│  Agent Worker  │
│  Room         │────────────────▶│  (NestJS)         │                    │  (LiveKit)     │
│               │   transcription  │  ArenaGateway     │                    │               │
└──────┬───────┘                  │  ArenaController  │                    └───────────────┘
       │                          └────────┬──────────┘
       │                                   │ WS broadcast
       │                          ┌────────▼──────────┐
       │                          │  External Agents   │
       │                          │  (WS clients)      │
       │                          └───────────────────┘
       │
┌──────▼───────┐
│  UI (Next.js) │  ← merges LiveKit transcriptions + WS agent_message events
│  ArenaRoom    │
└──────────────┘
```

### Direction 1: LiveKit → WS (voice agent speaks → external agents hear)

The agent worker already has access to `ConversationItemAdded` events with the assistant's text content. After each assistant turn, the worker posts the transcript to a new backend endpoint:

- **New endpoint**: `POST /arena/sessions/:id/transcript` — accepts `{ speaker, text, timestamp }`
- **Backend**: `ArenaGateway.broadcastTranscript()` sends `{ type: 'transcript', speaker, text, timestamp }` to all WS clients in that session
- **Agent worker**: Makes HTTP POST to the backend after each assistant response. Requires knowing the backend URL and session ID (passed via room metadata)

### Direction 2: WS → LiveKit (external agent sends text → voice agent hears)

When an external agent sends a `message` via WS:

- **Gateway**: In addition to broadcasting `agent_message` to other WS clients (existing), also sends a LiveKit data channel message into the room via `RoomServiceClient.sendData()`
- **Agent worker**: Listens for `RoomEvent.DataReceived` on the room. When a data message arrives, it calls `session.generateReply({ userInput: '[ExternalAgent] AgentName: message text' })` to inject the external message into the LLM conversation

This approach uses LiveKit's built-in data channel API so no new polling or HTTP endpoints are needed for this direction.

### Direction 3: UI merge (transcript shows both channels)

The `ArenaSessionContext` already establishes a WS connection and receives `agent_message` events. Currently these events are not surfaced in the transcript.

- **New state**: `ArenaSessionContext` accumulates WS `agent_message` and `transcript` events into a `wsMessages` array exposed via context
- **ArenaRoom**: Merges `useConversationTranscript()` messages with `wsMessages` from context, deduplicating by content+timestamp proximity
- **TranscriptMessage type**: Add optional `source: 'livekit' | 'ws'` field to distinguish origins

## Constraints

- **Don't break voice-only flow**: All changes are additive. If the agent worker can't reach the backend for transcript posting, it logs a warning and continues.
- **Don't break WS-only flow**: External agents continue to work exactly as before. The data channel injection is a new addition.
- **Agent worker is a separate process**: Communicates with backend only via HTTP or LiveKit data channels. No direct module imports.
- **Room metadata carries session context**: The arena metadata already includes `topic`, `agents`, `mode`. We add `sessionId` and `backendUrl` to it so the agent worker knows where to post transcripts.
- **Data channel message format**: JSON `{ type: 'external_agent_message', speaker: string, text: string }` — the agent worker parses this and injects it as context.

## Phases

### Phase 1: Backend Bridge Infrastructure
Add transcript posting endpoint, gateway broadcast method, LiveKit data channel sending from gateway. Extend room metadata with sessionId/backendUrl.

### Phase 2: Agent Worker Integration
Agent worker posts transcripts to backend after each assistant turn. Agent worker listens for data channel messages and injects them into the conversation.

### Phase 3: UI Transcript Merge
ArenaSessionContext accumulates WS messages. ArenaRoom merges LiveKit + WS transcript streams. Deduplication for transcript events that the host UI sees from both channels.

## Reference Files

- `backend/src/arena/arena.gateway.ts` — WS gateway, `broadcastToSession()`, message handling
- `backend/src/arena/arena.controller.ts` — REST endpoints, `startSession()` creates room
- `backend/src/arena/arena.service.ts` — in-memory session store
- `backend/src/livekit/livekit.service.ts` — `generateArenaToken()`, room metadata, `RoomServiceClient`
- `agent/src/main.ts` — agent entry point, `setupFollowUpTurns()`, `ConversationItemAdded` event
- `agent/src/arena-agent.ts` — `ArenaMetadata` interface, system prompt construction
- `ui-web/src/hooks/use-conversation-transcript.ts` — LiveKit-only transcript hook
- `ui-web/src/components/arena/arena-room.tsx` — arena UI, consumes transcript
- `ui-web/src/components/arena/arena-transcript.tsx` — transcript sidebar, parses `[Name]:` tags
- `ui-web/src/lib/arena-session-context.tsx` — WS connection, session state
- `ui-web/src/lib/types.ts` — `TranscriptMessage`, `ArenaWsServerMessage`

## Non-Goals

- Real-time audio streaming to external agents (they get text only)
- External agent voice synthesis (they remain text-only participants)
- Persistent transcript storage (in-memory only, same as current sessions)
- Moderated turn-taking between voice and text agents (free-form for now)
- Authentication for the transcript endpoint (same auth model as existing arena endpoints)
