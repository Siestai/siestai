# Plan: Mastra Agents Service

**Status:** Proposed (v2 — revised after voice project review)
**Date:** 2026-02-27
**Tasks:** records/tasks/0003-mastra-agents-service.json

## Problem
The Agents page is entirely mock data — hardcoded agents in `ui-web/src/lib/api.ts` with no backend persistence. Users can't create, edit, or delete agents. The arena setup wizard Step 1 (agent selection) is non-functional. There's no structured agent runtime framework.

## Decision
Add a **Mastra service** (`mastra/`) to the monorepo as the agent runtime and management layer. Use **PostgreSQL + Drizzle** for agent persistence. Mastra agents support `stream()` for real-time responses. The NestJS backend proxies agent CRUD to the Mastra service. The arena agent picker (modeled after the `voice` project's `AgentPicker` component) fetches real agents and passes them to session creation.

## Voice Project Reference
The `Siestai/voice` repo has a mature arena implementation we should align with:
- **`AgentPicker`** — fetches agents from API, toggle-select UI with max 4, shows voice/category
- **`AgentConfigPanel`** — manual mode: name + voice + instructions per agent
- **`ArenaRoom`** — volume visualization, speaker detection, call timer, transcript sidebar
- **Arena page flow** — config mode toggle (agents vs manual), participation mode, duration picker, moderator option, topic input, provider settings

Our siestai arena should mirror this pattern but simplified for the current scope.

## Architecture
```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Frontend   │────▶│  Backend     │────▶│  Mastra Service  │
│  (Next.js)  │     │  (NestJS)    │     │  (Mastra Server) │
│  :3000      │     │  :4200       │     │  :4111           │
└─────────────┘     └──────────────┘     └──────────────────┘
                                                  │
                                          ┌───────▼────────┐
                                          │  PostgreSQL     │
                                          │  (Drizzle ORM)  │
                                          └────────────────┘
```

## Agent Schema (Core Fields — Day 1)

```typescript
enum AgentSource {
  MASTRA = 'mastra',      // Mastra runtime agent (internal)
  LIVEKIT = 'livekit',    // LiveKit voice agent
  EXTERNAL = 'external',  // External agent (OpenClaw, third-party)
}

interface Agent {
  id: string;               // uuid
  name: string;             // max 100 chars
  description: string;      // short description
  instructions: string;     // system prompt
  category: string;         // conversational, creative, technical, debate
  tags: string[];           // labels
  color: string;            // hex color for UI
  icon: string;             // icon name
  source: AgentSource;      // where this agent runs
  llm_model: string | null; // e.g. openai/gpt-4.1-mini
  is_online: boolean;       // availability flag
  created_at: string;
  updated_at: string;
}
```

Voice config fields (voice_id, tts_provider, stt_provider, etc.) deferred to a future plan.

## Mastra Agent Runtime
Mastra agents are registered as runtime instances that support `agent.stream()` for real-time text generation. The Mastra service exposes streaming endpoints so the backend can proxy streamed responses to the frontend. This enables:
- Chat with individual agents (Live page)
- Arena multi-agent conversations where each agent streams responses
- Future: tool use, MCP integration, workflows

## Phases

### Phase 1: Mastra Service Setup
Scaffold Mastra service, Drizzle schema with core fields + AgentSource, CRUD routes, streaming endpoint.

### Phase 2: Backend Agent Module
NestJS proxy module for agent CRUD + stream passthrough.

### Phase 3: Frontend — Replace Mock Data
Real API client, create/edit/delete agents, AgentPicker component (modeled after voice project).

### Phase 4: Arena Agent Selection
Wire AgentPicker into arena setup Step 1. Selected agents → `nativeAgents` with instructions to `createSession`.

### Phase 5: Infrastructure
Seed agents, PostgreSQL in docker-compose, dev setup.

## Reference Files
- `ui-web/src/app/agents/page.tsx` — agents list (mock data)
- `ui-web/src/lib/api.ts` — mock API client
- `ui-web/src/lib/types.ts` — Agent interface
- `ui-web/src/app/arena/page.tsx` — arena setup (non-functional Step 1)
- `voice-fe/components/arena/agent-picker.tsx` — reference AgentPicker from voice project
- `voice-fe/app/arena/page.tsx` — reference arena flow from voice project
- `backend/src/arena/arena.service.ts` — createSession

## Non-Goals
- Voice config (TTS/STT provider, voice selection) — future plan
- Agent tool execution, MCP, workflows — future plan
- Agent analytics/call tracking — future
- Agent versioning — future
- Authentication — no auth for staging
