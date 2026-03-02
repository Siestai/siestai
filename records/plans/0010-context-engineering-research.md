# Context Engineering & Multi-Agent Memory — Research Findings

**Date:** 2026-03-02
**Related Plan:** records/plans/0010-arena-memory-context-engineering.md
**Input Sources:** Hermes Research Report (2026-03-02), arXiv papers, Mastra docs, industry research

---

## 1. Context Engineering vs. Prompt Engineering

**Context engineering** is the discipline of designing the complete information environment an LLM sees during inference. Prompt engineering is a subset — it's about crafting instructions. Context engineering encompasses the entire pipeline:

```
Context = System Prompt + Memory + Retrieved Knowledge + Tool Results + Conversation History
```

**Key insight (Anthropic engineering blog):** Most agent failures aren't prompt failures — they're **context failures**. The agent had the wrong information, not the wrong instructions.

For multi-agent systems, context engineering becomes critical because:
- Each agent needs different context (a marketing agent doesn't need architecture decisions)
- Context grows multiplicatively (N agents × M messages per turn)
- Memory scoping must be explicit (what's private vs. shared)

---

## 2. The Four Types of Agentic Memory

Source: arXiv:2602.19320 — "Anatomy of Agentic Memory: Taxonomy and Empirical Analysis"

| Type | What It Stores | Persistence | Implementation |
|------|---------------|-------------|----------------|
| **Working** | Current conversation context, active task state | Session-scoped | Context window (every framework has this) |
| **Episodic** | Past events — what happened in previous sessions | Long-term, structured | **Most under-implemented** — highest value gap |
| **Semantic** | Facts, knowledge, learned information | Long-term, retrievable | Vector DB RAG (common but overused) |
| **Procedural** | Behavioral patterns, skills, decision logic | Persistent | Agent instructions, tool definitions |

**Critical finding:** Episodic memory is the highest-value, lowest-implemented type. Most frameworks only have working memory. Vector DB RAG is a common but underperforming substitute for real episodic memory in meeting/session contexts.

**Why episodic beats RAG for meetings:** Meeting context is temporal and relational — "Agent A argued X, then Agent B countered with Y, and the group decided Z." Vector similarity search retrieves semantically similar chunks but loses this temporal and relational structure. Structured episodic extraction preserves it.

---

## 3. Multi-Agent Memory Architectures Across Frameworks

### Mastra (our runtime)
- **Model:** Thread/Resource with 4 processors (MessageHistory, WorkingMemory, SemanticRecall, ObservationalMemory)
- **Multi-agent:** Supervisor delegates to subagents; each gets isolated thread
- **Memory isolation enforced** — subagents see context needed for their task but don't pollute shared memory
- **Storage:** PostgreSQL, MongoDB, libSQL + 17 vector store options
- **`@mastra/memory` package** exists but is NOT installed in our project

### LangGraph
- **Model:** Shared state graph with checkpointing at each step
- **Multi-agent:** State flows through nodes; each agent reads/writes a shared state object
- **Reducer pattern** handles parallel updates to same state key

### CrewAI
- **Model:** Unified Memory class (short-term + long-term + entity + external)
- **Multi-agent:** Shared crew memory by default, scoped views for agent-private context
- **LLM-analyzed storage** — infers scope and categories when saving

### AutoGen
- **Model:** Team-level `save_state()`/`load_state()` — serializable to file/DB
- **Multi-agent:** State dictionary across all agents, serializable for stateless web endpoints

---

## 4. Memory Scoping: Private vs. Shared

The recommended pattern for multi-agent systems is a **two-tier architecture**:

```
SHARED MEMORY (all agents in session/org)
  → Session decisions, consensus outcomes
  → Cross-agent action items
  → Unresolved topics with positions

PRIVATE MEMORY (per agent)
  → Its positions and arguments
  → Tasks assigned to it
  → Learnings specific to its role
```

**Write policy:** Projects raw logs into structured fragments; allocates to private or shared tier
**Read policy:** Dynamically constructs a memory view per agent's permissions
**Access control:** Distinct read/write policies per memory segment

### Consistency Models
- **Working memory:** Eventual consistency (scoped to one agent's execution)
- **Shared memory:** Strong consistency (multiple agents depend on it)

---

## 5. Context Window Management for Multi-Agent

In multi-agent conversations, token accumulation is the primary constraint. Strategies:

| Strategy | How | When to Use |
|----------|-----|-------------|
| **Role-based filtering** | Route only relevant messages to each agent | Always — baseline |
| **Summarization triggers** | At 70-80% capacity, compress older exchanges | Long sessions |
| **Sliding window** | Keep recent detailed, older as summaries | Default approach |
| **Token budgeting** | Hard limit per agent (e.g., 4K tokens max) | Multi-agent with many participants |
| **Sub-agent offloading** | Main agent coordinates; sub-agents return condensed summaries | Complex tasks |

**For Siestai arena:** The ArenaAgent already has a 16K char limit. Memory injection must stay within budget. Cap memory blocks at ~2000 chars, leaving room for agent instructions.

---

## 6. Agent State Serialization (Freeze/Resume)

Source: arXiv (Feb 2026) — "Architecting AgentOS: From Token-Level Context to Emergent System-Level Intelligence"

**Core pattern:** Agent handoff between sessions should work like OS process state serialization — freeze at session end, resume at next session.

```
Session End → Serialize(agent_state) → Store in DB
Session Start → Load from DB → Deserialize(agent_state) → Resume
```

**Practical implementation:**
- Store only essential state (not full message history) — structured summaries
- Tag with session IDs for isolation
- Include schema version for future migrations
- Implement TTL policies for old state

**For Siestai:** We use structured episodic extraction (not raw state serialization) — more robust across model changes and cheaper to store.

---

## 7. Structured Episodic Memory vs. Vector DB RAG

| Dimension | Structured Episodic | Vector DB RAG |
|-----------|-------------------|---------------|
| **Best for** | Meeting context, session history | Large knowledge bases, document retrieval |
| **Preserves** | Temporal order, relationships, decisions | Semantic similarity |
| **Query pattern** | "What happened in session 3?" | "Find content similar to X" |
| **Storage cost** | Low (structured JSON/text) | Higher (embeddings + index) |
| **Implementation** | LLM extraction + SQL | Embedding model + vector store |
| **Accuracy** | High for specific recall | Can miss context, retrieve irrelevant |

**Recommendation for Siestai:** Start with structured episodic extraction. Add vector semantic recall later only if users need cross-session search ("What did we discuss about pricing across all sessions?").

---

## 8. Mastra Memory Deep Dive (What We Can Use)

### Available in @mastra/memory (not yet installed)

1. **MessageHistory** — Auto-saves/loads recent messages per thread. Configurable `lastMessages` (default: 10).

2. **WorkingMemory** — Two scopes: resource-scoped (persists across all threads) or thread-scoped. Two formats: Markdown template or JSON schema with merge semantics. Agents update via `updateWorkingMemory` tool.

3. **SemanticRecall** — RAG via vector embeddings. Configurable `topK`, `messageRange`, scope. Requires vector store + embedder. pgvector is our natural fit.

4. **ObservationalMemory** (v1.1.0+) — Three-tier: Recent messages → Observations → Reflections. 5-40x compression. Useful for long sessions.

### Thread/Resource Model
```typescript
// Maps perfectly to Siestai's arena model:
const response = await agent.generate('message', {
  memory: {
    thread: 'arena-session-abc-123',   // session ID
    resource: 'agent-atlas-uuid',       // agent ID
  },
});
```

### Integration Path (Future)
1. Install `@mastra/memory`
2. Configure per-agent `WorkingMemory` with role-specific JSON schema
3. Use `MessageHistory` for in-session context management
4. Add `SemanticRecall` with pgvector for cross-session search
5. The `PostgresStore` in `instance.ts` already provides the foundation

---

## 9. Production Best Practices (2025-2026)

- **Session-based memory** — Model conversations as sessions with resource + thread IDs
- **ACID transactions** — Memory updates (vector + graph + relational) as atomic operations
- **Audit logging** — Log all memory operations (EU AI Act requires 10-year audit trails for high-risk systems, deadline Aug 2026)
- **TTL policies** — Clean up expired memories automatically
- **Token budget monitoring** — Track per-agent token usage in real-time
- **Compression triggers** — Auto-summarize when context approaches 70-80% capacity
- **Memory versioning** — Schema version for migrations as memory format evolves

### Market Direction
- Contextual memory surpassing RAG for agentic AI (VentureBeat 2026)
- Products like Mem0, MemMachine, MemoryStack gaining traction
- Shift from retrieval-augmented to memory-augmented generation

---

## 10. Key Decisions for Siestai

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Memory type first | Structured episodic | Highest value per research; meetings are temporal/relational |
| Storage | Direct Drizzle (PostgreSQL) | Already have it; no new infra needed |
| Skip vector DB initially | Yes | Research shows structured episodic beats generic RAG for meeting context |
| Mastra memory integration | Design-compatible but defer | Ship value now; integrate later for advanced features |
| Memory scoping | Private per-agent + shared session brief | Two-tier per industry best practice |
| Extraction model | Fast/cheap (haiku/gpt-4.1-mini) | N+1 calls per session end; cost control |
| Memory injection method | Room metadata or HTTP fetch | Agent worker is separate process |
| External agent support | Same schema, deferred extraction | Focus on internal agents first per user requirement |

---

## References

1. Jiang, D. et al. (2026). *Anatomy of Agentic Memory: Taxonomy and Empirical Analysis.* arXiv:2602.19320
2. Roy, R. et al. (2026). *PersonaPlex: Voice and Role Control for Full Duplex Conversational Speech Models.* arXiv:2602.06053
3. Li, C. et al. (2026). *Architecting AgentOS: From Token-Level Context to Emergent System-Level Intelligence.* arXiv
4. Anthropic. *Effective context engineering for AI agents.* anthropic.com/engineering
5. Microsoft. *Multi-agent Reference Architecture: Memory.* microsoft.github.io
6. Mastra. *Agent Memory Documentation.* mastra.ai/docs/agents/agent-memory
7. Google. *Architecting efficient context-aware multi-agent framework for production.* developers.googleblog.com
