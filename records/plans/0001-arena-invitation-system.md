# Plan: Arena Invitation System & External Agent Integration

**Status:** Proposed
**Date:** 2026-02-27
**Tasks:** records/tasks/0001-arena-invitation-system.json

## Problem
Siestai's arena currently only works with native agents built inside the platform. There's no way to bring in agents from external platforms like OpenClaw. We need a "meeting link" model — like Google Meet — where an external agent installs a Siestai SKILL, receives an invitation link, and joins the arena over a simple text WebSocket. Siestai handles all voice infrastructure (STT/TTS), so external agents only deal with text.

## Decision
Build an arena invitation system with JWT-based invite tokens, a WebSocket text relay for external agent participation, and a voice bridge that converts between room audio and text for WebSocket-connected agents. The frontend gets an invite link UI and external participant tiles (inspired by the VoiceForge arena grid). We'll also create an OpenClaw SKILL.md as the first integration. The backend uses NestJS WebSocket gateway (`@nestjs/websockets` + `ws`) alongside the existing LiveKit setup.

## Architecture

```
Human (browser)                          External Agent (OpenClaw)
     │                                          │
     │ WebRTC (LiveKit)                         │ WebSocket (text only)
     │                                          │
     ▼                                          ▼
┌──────────────────────────────────────────────────┐
│                 Siestai Backend                   │
│                                                   │
│  ArenaModule                                      │
│  ├── ArenaController        POST /arena/sessions  │
│  │                          POST /arena/join       │
│  │                          GET  /arena/:id        │
│  │                                                │
│  ├── ArenaService           Session CRUD, tokens   │
│  │                                                │
│  ├── InvitationService      JWT invite generation  │
│  │                          & validation           │
│  │                                                │
│  └── ArenaGateway (WS)      /arena/ws?token=xxx   │
│       ├── Receives text from external agents      │
│       ├── Broadcasts room transcripts to agents   │
│       └── Voice bridge: agent text → TTS → room   │
│                            room audio → STT → agent│
│                                                   │
│  LivekitModule (existing)                         │
│  └── Token generation for human participants      │
└──────────────────────────────────────────────────┘
```

**WebSocket Protocol (external agent ↔ Siestai):**
```
// Server → Agent/Host
{ "type": "welcome", "sessionId": "...", "participants": [...] }
{ "type": "transcript", "speaker": "Human", "text": "...", "timestamp": ... }
{ "type": "agent_message", "speaker": "Atlas", "text": "...", "timestamp": ... }
{ "type": "system", "event": "participant_joined|participant_left", "participant": {...} }
{ "type": "session_ended" }

// Agent → Server
{ "type": "message", "text": "Here's my perspective..." }
{ "type": "identify", "name": "MyAgent", "platform": "openclaw", "model": "..." }
```

**Two JWT roles connect to the same WebSocket endpoint:**
- `role: "agent"` — external agent, can send messages, gets broadcast to others
- `role: "host"` — frontend waiting room, receives participant events only (read-only)

## Reference Files
- `backend/src/livekit/livekit.service.ts` — Existing token generation pattern; new ArenaService follows same JWT approach
- `backend/src/livekit/livekit.controller.ts` — Controller pattern to follow for ArenaController
- `backend/src/app.module.ts` — Where to register the new ArenaModule
- `backend/src/main.ts` — CORS config, may need WebSocket adapter setup
- `ui-web/src/app/arena/page.tsx` — Current arena wizard; needs invite link section added
- `ui-web/src/lib/types.ts` — Add new types for arena sessions, invitations, external participants
- `ui-web/src/lib/livekit.ts` — API_URL constant and fetch pattern to follow for new arena API calls
- `/Users/orhanors/Desktop/voice/voice-fe/components/arena/arena-room.tsx` — VoiceForge's Google Meet-like grid UI; inspiration for participant tiles, volume rings, speaker detection

## Constraints
- External agents communicate via text only — no WebRTC or audio from their side
- Voice bridge (STT/TTS for external agents) is a later phase — Phase 1 establishes the text relay, Phase 2 would add STT/TTS bridging via LiveKit agent worker
- Invite tokens expire after 1 hour by default
- Max 6 external agents per arena session
- WebSocket connections require valid invite JWT — no unauthenticated access
- Keep backend stateless where possible — arena sessions stored in-memory for MVP (no database yet)

## Non-Goals
- Database persistence for arena sessions (in-memory Map for MVP)
- Full STT/TTS voice bridge for external agents (future plan, documented but not built)
- Agent-to-agent direct messaging outside arena
- OpenClaw Gateway RPC integration (the SKILL approach replaces this)
- Authentication/user accounts

## Gotchas
- NestJS WebSocket gateway needs `@nestjs/platform-ws` (not socket.io) since external agents use plain WebSocket — the `WsAdapter` must be set in `main.ts` via `app.useWebSocketAdapter(new WsAdapter(app))`
- The existing `main.ts` CORS config applies to HTTP only — WebSocket connections bypass CORS (the `ws://` protocol doesn't enforce same-origin), but token validation in the gateway serves as the auth gate
- Invite JWT signing must use a different secret (`ARENA_INVITE_SECRET`) than LiveKit tokens to avoid confusion — both are JWT but serve different purposes
- The arena room grid layout from VoiceForge uses a single shared agent audio track with speaker detection via `[AgentName]:` prefix parsing — external agents won't use this pattern, so we need a separate `ExternalParticipantTile` that shows status based on WebSocket events, not audio analysis
- Frontend needs its own WebSocket connection to the backend (as "host" role) to receive real-time participant join/leave events in the waiting room — this is separate from the LiveKit connection which comes later
- Backend types (ArenaSession, ArenaParticipant) must be defined locally in `backend/src/arena/arena.interfaces.ts` since there's no shared types package between frontend and backend — keep shapes aligned manually
- The backend uses `"module": "nodenext"` in tsconfig but existing code omits `.js` extensions in imports — NestJS's `nest build` handles this via tsc, so follow the same extensionless import pattern as `livekit.service.ts`
- The ArenaGateway's `handleConnection` receives the raw `IncomingMessage` as the second arg (not a decorated DTO) — parse the token from `request.url` using `new URL()` or `URLSearchParams`
