# Plan: Agent Chat Preview

**Status:** Proposed
**Date:** 2026-03-02
**Tasks:** records/tasks/0012-agent-chat-preview.json

## Problem
The agent detail page has no way to test-chat with an agent inline. The "Chat" button redirects to `/live` (voice-only via LiveKit). Users need a quick text-based chat to interact with agents directly on the detail page, including seeing tool calls in real-time.

## Decision
Add an inline chat panel to the agent detail page using Vercel AI SDK. Backend gets a new `POST /agents/:id/chat` endpoint that uses `@ai-sdk/anthropic` + `streamText()`, piped to the response via `pipeDataStreamToResponse()`. Frontend uses `useChat()` from `@ai-sdk/react` with a minimal, agentic-feeling chat UI that renders tool invocations inline.

## Architecture

```
┌─ Agent Detail Page ────────────────────────────────┐
│  ┌─ Config (left/top) ──┐  ┌─ ChatPanel (right) ─┐ │
│  │ AgentHeader           │  │ message list         │ │
│  │ InstructionsSection   │  │  - user bubbles      │ │
│  │ ModelSection          │  │  - assistant text     │ │
│  │ ToolsSection          │  │  - tool invocations   │ │
│  │ ...                   │  │ ────────────────────  │ │
│  │                       │  │ input + send button   │ │
│  └───────────────────────┘  └──────────────────────┘ │
└────────────────────────────────────────────────────────┘

Frontend (useChat)  ──POST──▶  NestJS /agents/:id/chat
                                  │
                                  ├─ Load agent config from DB (AgentsService.getAgent)
                                  ├─ Build tools via ToolRegistryService
                                  ├─ Convert tools: toAISDKTools() adapter
                                  ├─ streamText(@ai-sdk/anthropic, maxSteps: 5)
                                  └─ pipeDataStreamToResponse(res)
```

## Reference Files
- `apps/api/src/agents/preview/agent-preview.service.ts` — existing preview streaming pattern; uses Mastra `agent.stream()` with custom SSE. Chat endpoint will bypass Mastra Agent wrapper and use AI SDK `streamText()` directly instead
- `apps/api/src/agents/preview/agent-preview.controller.ts` — `@Res()` pattern for streaming; same approach for chat controller
- `apps/api/src/tools/tool-registry.service.ts` — `buildToolsForAgent(agentId, userId)` returns `ToolsInput` (Mastra format). Adapter needed to convert to AI SDK `tool()` format
- `apps/api/src/mastra/mastra.service.ts` — agent registry; NOT used directly by chat endpoint (we load from DB instead to get full config)
- `apps/api/src/agents/agents.service.ts` — `getAgent(id)` loads full agent row from DB
- `apps/api/src/main.ts` — `bodyParser: false` and `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` — see Gotchas
- `apps/web/src/app/(app)/agents/[id]/page.tsx` — agent detail page, will host ChatPanel
- `apps/web/src/lib/api.ts` — `API_BASE_URL` constant (`NEXT_PUBLIC_API_URL`), credential forwarding pattern
- `apps/web/src/components/agents/wizard/step-test-run.tsx` — existing chat UI pattern, reuse styling cues (cyan bubbles, bounce dots)

## Constraints
- Backend must return AI SDK Data Stream Protocol (not custom SSE) for `useChat()` compatibility
- Must forward auth cookies (`credentials: "include"`) since backend runs on :4200, frontend on :3000
- Mastra tool definitions use `inputSchema`; AI SDK `tool()` uses `parameters` — need adapter function
- Tool results must stream back so the model can reason over them (`maxSteps > 1`)
- `MastraModule` and `ActivityModule` are `@Global()` — no need to import them in the chat module

## Non-Goals
- Conversation persistence / chat history across page reloads
- Voice integration in this chat panel
- Multi-agent chat or arena-style interaction
- Replacing the existing `/live` voice flow

## Gotchas

### Backend
- **`bodyParser: false`** — `main.ts` disables the default Express body parser. Existing `@Body()` decorators work (likely via better-auth middleware or implicit registration). If body parsing fails on the chat endpoint, add `express.json()` middleware locally via `@UseInterceptors()` or a route-level middleware.
- **`forbidNonWhitelisted: true`** — Global `ValidationPipe` rejects unknown body properties. The `useChat` hook by default only sends `{ messages }`, but if the consumer passes extra `body` fields, the request will 400. The chat DTO should use `@Allow()` on a catch-all or skip strict validation for the messages array. Safest: accept `messages` as `@IsArray()` without nested DTO validation, let AI SDK parse the messages internally.
- **Model string format** — DB stores `anthropic/claude-sonnet-4-6` (Mastra format). The `@ai-sdk/anthropic` provider expects just `claude-sonnet-4-6`. Strip the `anthropic/` prefix: `const modelId = (agent.llmModel || 'anthropic/claude-sonnet-4-6').replace('anthropic/', '')`.
- **Use `pipeDataStreamToResponse(res)`** — NOT `toDataStreamResponse()`. The latter returns a web `Response` object that doesn't work with Express `res` directly. `pipeDataStreamToResponse(res)` from `ai` package writes directly to a Node.js writable stream.
- **Multiple controllers on `@Controller('agents')`** — Already established pattern (`AgentsController`, `AgentPreviewController`). Adding `AgentChatController` with the same prefix is fine; NestJS merges routes across controllers.
- **Mastra tool execute signature** — Mastra's `createTool` execute receives `(inputData)` directly (the parsed Zod object). AI SDK's `tool` execute receives `({ args })` — note the destructuring wrapper. The adapter must unwrap: `execute: async ({ ...args }) => mastraTool.execute(args)`. Actually verify the exact signatures at implementation time by checking the types.

### Frontend
- **`useChat` credentials** — The hook doesn't have a native `credentials` option. Use the `fetch` parameter: `fetch: (url, init) => fetch(url, { ...init, credentials: 'include' })`.
- **`NEXT_PUBLIC_API_URL`** — Must be used for the `api` URL in `useChat`. Import from `@/lib/api` or duplicate the env var access. The `api.ts` file exports `API_BASE_URL` but it's a private class field. Either export the constant separately or read `process.env.NEXT_PUBLIC_API_URL` directly.
- **`toolInvocations` on messages** — AI SDK `Message` type includes `toolInvocations?: ToolInvocation[]`. Each has `{ toolCallId, toolName, args, state, result? }`. State is `'partial-call' | 'call' | 'result'`. Render based on state.
