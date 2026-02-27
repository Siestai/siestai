# Plan: Arena LiveKit Live Session

**Status:** Proposed
**Date:** 2026-02-27
**Tasks:** records/tasks/0002-arena-livekit-live-session.json

## Problem
The arena page transitions to a "live" state that is purely visual — no LiveKit room is created, no voice connection established, and no audio rendered. Users click "Start Call" and see static placeholder tiles with no actual conversation happening. The entire voice pipeline (room creation, token generation, agent dispatch, audio rendering, speaker detection) is missing from the arena flow.

## Decision
Wire the arena's "Start Call" action to a full LiveKit voice flow: backend creates a LiveKit room with arena metadata via `RoomServiceClient.createRoom()`, generates a participant JWT, frontend mounts `<LiveKitRoom>` with `<RoomAudioRenderer>`, and a multi-persona agent reads room metadata to orchestrate conversation across configured personas. Follow the voice project's arena implementation patterns. External agent ↔ LiveKit bridging is explicitly out of scope (future plan).

## Architecture
```
"Start Call" clicked
  → POST /arena/sessions/:id/start
  → Backend creates LiveKit room via RoomServiceClient.createRoom() with metadata:
      { type: "arena", agents: [...], mode, topic, participationMode }
  → Backend generates JWT token (canPublish based on participationMode)
  → Agent dispatched via RoomConfiguration (agentName: "siestai-agent")
  → Returns { token, serverUrl, roomName }
  → Frontend mounts <LiveKitRoom> + <RoomAudioRenderer>
  → Agent joins room, reads room.metadata JSON
  → Agent orchestrates multi-persona conversation
  → Frontend parses transcripts for [AgentName]: prefix → highlights tile
```

## Reference Files
- `backend/src/livekit/livekit.service.ts` — existing token generation (AccessToken only), extend with RoomServiceClient for arena
- `backend/src/arena/arena.service.ts` — session management, add startSession method
- `backend/src/arena/arena.controller.ts` — add start endpoint, currently has no LivekitService injection
- `backend/src/arena/arena.module.ts` — must import LivekitModule to access LivekitService
- `backend/src/livekit/livekit.module.ts` — must export LivekitService for cross-module use
- `ui-web/src/app/arena/page.tsx` — live state UI (lines 533-602), mount LiveKitRoom here
- `ui-web/src/lib/livekit.ts` — fetchToken helper, add fetchArenaToken
- `ui-web/src/lib/arena-session-context.tsx` — add LiveKit state fields (liveState, startCall)
- `ui-web/src/lib/types.ts` — add ArenaTokenResponse, ArenaLiveState, extend ArenaWsServerMessage
- `ui-web/src/components/arena/external-participant-tile.tsx` — speaking ring pattern to reuse for native tiles
- `ui-web/src/hooks/use-conversation-transcript.ts` — existing transcript hook, extend for speaker parsing
- `agent/src/main.ts` — entry point, add room metadata reading + conditional ArenaAgent
- `agent/src/agent.ts` — base Agent class
- Voice project reference: `/Users/orhanors/Desktop/voice/voice-be-v2/src/livekit/livekit.service.ts` (lines 34-42 for RoomServiceClient init, 348-364 for createRoom with metadata)

## Constraints
- LiveKit Cloud: `wss://siestai-qk2c7bgk.livekit.cloud` (already provisioned)
- Room metadata must stay under 64KB (LiveKit limit) — validate before createRoom
- Room metadata is set at creation time via `RoomServiceClient.createRoom()`, not via token — the current service only uses `AccessToken`, need to add `RoomServiceClient`
- `RoomServiceClient` needs HTTP URL, not WebSocket — convert `wss://` → `https://` (see voice project pattern)
- Agent process is a single participant in the room — multi-persona is orchestrated within one agent
- `canPublish` must be false for `agent_only` participation mode
- Frontend `.env.local` has placeholder LIVEKIT_URL — must fix before any LiveKit connection works
- The `system` variant in `ArenaWsServerMessage` is a discriminated union on `event` — adding `session_started` must extend the event union, not add a new type variant

## Non-Goals
- External agent ↔ LiveKit voice bridge (text-only agents hearing/speaking via TTS/STT)
- Persistent session storage (sessions remain in-memory for now)
- Moderator UI controls (mode field exists but no admin actions)
- Agent selection from database in setup wizard step 1

## Gotchas
- **RoomServiceClient required:** The current LivekitService only uses `AccessToken` for JWT generation. Arena needs `RoomServiceClient` from `livekit-server-sdk` to call `createRoom()` with metadata. Without this, the agent has no way to know it's an arena session. The voice project initializes RoomServiceClient in the constructor with HTTP-converted URL.
- **URL conversion:** `RoomServiceClient` requires `https://` URL, not `wss://`. Convert with `.replace('wss://', 'https://').replace('ws://', 'http://')`.
- The agent `agentName` must match between `RoomConfiguration` dispatch and `cli.runApp` ServerOptions — currently both use `siestai-agent`
- Room metadata is set at room creation time and read by the agent on join — if metadata format changes, agent code must update in lockstep
- `LiveKitRoom` from `@livekit/components-react` auto-connects when `connect={true}` — make sure token is ready before rendering (conditionally render `<LiveKitRoom>` only when `liveState` is non-null)
- The arena WebSocket (text relay) must stay alive alongside the LiveKit room — they serve different purposes (invitation coordination vs voice)
- `useVoiceAssistant` hook gives agent state + transcripts — same hook used on live page
- Multi-persona agent uses `[AgentName]: text` prefix convention — frontend must parse this from transcript text content
- The `RoomAudioRenderer` must be inside the `LiveKitRoom` provider tree
- **DTO for start endpoint is unnecessary** — the session ID comes from the URL param `:id`, no request body needed. Removed task 3.
- **ArenaTokenResponse vs TokenResponse:** The existing `TokenResponse` in `livekit.ts` already has `{ token, serverUrl, roomName }` — same shape. Can reuse it instead of creating a new type, or alias it for clarity.
- **ArenaController injection:** Currently only injects `ArenaService` + `InvitationService`. Adding `LivekitService` requires `ArenaModule` to import `LivekitModule`, which must export `LivekitService`.
