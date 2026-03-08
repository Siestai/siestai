# Plan: Smart Intervention Timing (SIT)

**Status:** In Progress
**Date:** 2026-03-08
**Tasks:** records/tasks/0014-smart-intervention-timing.json
**Research:** Hermes Nightly Research March 8 — GroupGPT (arXiv:2603.01059)

## Problem

Arena agents currently speak on a dumb follow-up timer: after every assistant turn, a system prompt fires asking "another character may respond." This leads to:

1. **Token waste** — agents respond even when the conversation point is exhausted
2. **Unnatural pacing** — no awareness of whether the human is about to speak
3. **No context gating** — every turn triggers a follow-up regardless of whether agents have something meaningful to add

GroupGPT (March 2026) solves this for text with a small-large model split: a lightweight "Intervention Judge" decides *when* to speak, then the large model generates the response. They report 3× token savings.

Siestai has a unique advantage: **LiveKit VAD (Voice Activity Detection)** — a real-time signal for whether the human is speaking, about to speak, or silent. No text-based framework has this.

## Decision

Implement a **lightweight intervention scoring system** that gates agent follow-up turns. Instead of always prompting the next agent to speak, compute an intervention score based on:

1. **VAD state** — Is the human speaking? About to speak? Silent for how long?
2. **Conversation context** — Was a question asked? Is there disagreement? Is the topic exhausted?
3. **Turn dynamics** — How many consecutive agent turns? Same speaker repeating?
4. **Topic relevance** — Does this agent have something specific to contribute based on their persona/memories?

The score determines whether to trigger a follow-up, wait, or stay silent.

### Architecture

```
LiveKit VAD ──────────┐
                      ▼
              ┌──────────────┐
              │  Intervention │
              │    Scorer     │  (lightweight, no LLM call)
              │               │
              │  Inputs:      │
              │  - VAD state  │
              │  - turn count │
              │  - silence ms │
              │  - last text  │
              └──────┬───────┘
                     │
          score > threshold?
           │              │
          YES             NO
           │              │
    generateReply()    wait / skip
```

### Scoring Model (rule-based first, ML later)

```
interventionScore = 
    vadWeight       * vadSignal          // 0.0 if human speaking, 0.5 if recent, 1.0 if long silence
  + questionWeight  * questionDetected   // 1.0 if question directed at agents
  + noveltyWeight   * hasNovelContent    // 1.0 if agent has relevant memory/expertise
  + turnWeight      * turnDecay          // decays with consecutive agent turns
  - repetitionPen   * sameTopicPenalty   // penalize rehashing
```

**Threshold:** score > 0.5 → intervene, else wait
**Cooldown:** minimum 2s between agent turns
**VAD override:** if human VAD active, score = 0 (never interrupt)

### Phase 1: Rule-based (this PR)
- Implement `InterventionScorer` class in `apps/agent/src/`
- Wire VAD events into scorer
- Replace blind follow-up logic in `setupFollowUpTurns`
- Add configurable thresholds via room metadata
- Log intervention decisions for analysis

### Phase 2: LLM-assisted (future)
- Use a small/fast model (gpt-4.1-nano or similar) to classify intervention need
- Train on logged intervention decisions from Phase 1
- GroupGPT's Qwen-3-4B intervention judge as reference architecture

## Files Changed

- `apps/agent/src/intervention-scorer.ts` — NEW: scoring engine
- `apps/agent/src/main.ts` — Wire VAD events, replace follow-up logic
- `apps/agent/src/arena-agent.ts` — Add intervention config to metadata
- `apps/agent/src/provider-config.ts` — Add intervention thresholds

## Impact

- **Token savings:** Skip ~40-60% of unnecessary agent turns (based on GroupGPT findings)
- **Better UX:** Agents feel more natural — they speak when they have something to say
- **Foundation:** Scoring data enables future ML-based intervention judge
