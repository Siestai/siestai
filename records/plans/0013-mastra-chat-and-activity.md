# Plan: Mastra Chat and Activity

**Status:** Done
**Date:** 2026-03-02
**Tasks:** records/tasks/0013-mastra-chat-and-activity.json

## Problem

Agent text chat needed to run through Mastra with tool support and memory, and the dashboard had no activity feed. The tools marketplace needed a richer UI (detail dialog, connection status, OAuth/API key flows).

## Decision

- **Mastra in-process:** Keep Mastra inside the NestJS API (no separate Mastra server). Single `Mastra` instance in `instance.ts` with PostgresStore, Memory, default agent, and `agentChatWorkflow`. `MastraService` loads DB agents on bootstrap and supports ephemeral agent registration for per-request chat.
- **Agent chat via workflow:** `POST /agents/:id/chat` uses `AgentChatService`: build tools (ToolRegistryService, userId-aware), create runtime agent with memory, register ephemeral agent, run `agentChatWorkflow` with `run.stream()`, convert workflow stream to AI SDK UI message stream via `toAISdkStream` + `createUIMessageStream` + `pipeUIMessageStreamToResponse`.
- **Activity:** In-memory `ActivityService` with events `agent_created` and `agent_tested`. `GET /activity` returns the current user's events. AgentsService (on create) and AgentPreviewService (on test) call `activityService.addEvent()`.
- **Tools UI:** Tools marketplace page uses `listToolsWithStatus()`, status badges (Connected / Not Connected / API Key Required), and a `ToolDetailDialog` for capabilities, OAuth status, and connect/disconnect/configure actions. Shared types extended with `TOOL_CAPABILITIES` and `ActivityEvent` export.

## Architecture

```
Frontend (agent detail chat)  ──POST /agents/:id/chat──▶  AgentChatController
                                                              │
                                                         AgentChatService
                                                              │
         ┌──────────────────────────────────────────────────┼────────────────────────────────────┐
         │                                                    │                                    │
         ▼                                                    ▼                                    ▼
  ToolRegistryService.buildToolsForAgent(agentId, userId)   createRuntimeAgent(record, tools, memory)   MastraService
         │                                                    │                                    │
         │                                                    ▼                                    │
         │                                              registerEphemeralAgent(agent)               │
         │                                                    │                                    │
         │                                                    ▼                                    ▼
         │                                              workflow.createRun().stream()          getWorkflow('agentChatWorkflow')
         │                                                    │                                    │
         │                                                    ▼                                    │
         │                                              agentChatStep: mastra.getAgent(key).stream(messages, memory)
         │                                                    │
         │                                                    ▼
         │                                              toAISdkStream(workflowStream) → pipeUIMessageStreamToResponse
         │
  GET /activity  ──▶  ActivityController  ──▶  ActivityService.getEvents(userId)
  agent_created from AgentsService.create(); agent_tested from AgentPreviewService.stream()
```

## Key Files

- `apps/api/src/mastra/instance.ts` — Mastra instance, PostgresStore, Memory, agentChatWorkflow, observability
- `apps/api/src/mastra/mastra.service.ts` — Bootstrap load from DB, register/unregister, ephemeral agents, getWorkflow, getChatMemory
- `apps/api/src/mastra/runtime.ts` — createRuntimeAgent with system prompt, tools, memory
- `apps/api/src/mastra/workflows/agent-chat.workflow.ts` — Single step: getAgent(agentKey), agent.stream(messages, memory), pipeTo(writer)
- `apps/api/src/agents/chat/agent-chat.service.ts` — streamChat, cleanupEphemeral
- `apps/api/src/agents/chat/agent-chat.controller.ts` — POST :id/chat, UI message stream
- `apps/api/src/tools/tool-registry.service.ts` — buildToolsForAgent(agentId, userId)
- `apps/api/src/activity/` — ActivityService, ActivityController, ActivityModule
- `apps/web/src/app/(app)/tools/page.tsx` — listToolsWithStatus, ToolDetailDialog, status badges
- `apps/web/src/components/tools/tool-detail-dialog.tsx` — Tool detail modal, OAuth status, connect/disconnect/configure
- `packages/shared/src/types/tool.ts` — TOOL_CAPABILITIES; `types/api.ts` — ActivityEvent; re-export in index

## Constraints

- Ephemeral agent key must be removed after stream ends (controller `finally` calls cleanupEphemeral).
- buildToolsForAgent requires userId for per-user OAuth/API key lookup.
- Activity is in-memory only (no DB); resets on API restart.

## Non-Goals

- Persisting activity to DB
- Chat history persistence (handled by Mastra memory per thread)
- Replacing preview stream with workflow (preview remains separate path)
