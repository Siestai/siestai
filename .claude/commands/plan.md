# Plan

Create an implementation plan and task list for a feature or architectural change. Explores the codebase, makes decisions, and produces two files: a human-readable plan and a machine-readable task JSON.

**Interaction points: (1) asking for the topic if none provided, (2) clarifying questions about scope and requirements, (3) asking if the user wants to implement after the plan is created.**

## Usage

```
/plan [topic description]
```

## Instructions

### Step 1: Determine the Topic

If an argument is provided, use it. Otherwise, use `AskUserQuestion` to ask:
- "What do you want to build or change?"

### Step 2: Clarify If Needed

Only if the topic is ambiguous or could go in meaningfully different directions, use `AskUserQuestion` to clarify. Skip this step entirely if the topic is clear enough to plan.

**Ask when:**
- The scope could reasonably be interpreted in very different ways
- There's a genuine either/or decision that changes the plan significantly
- A key constraint is unknown and can't be inferred from the codebase

**Don't ask when:**
- The topic is specific enough to act on
- The codebase exploration will answer the question
- You can make a reasonable architectural decision yourself

### Step 3: Determine the Next Plan Number

Read filenames in `records/plans/`. Find the highest numeric prefix. Increment by 1, zero-padded to 4 digits.

### Step 4: Explore the Codebase

Before writing anything, explore the codebase to understand the current state **relevant to the topic**. Only explore what's needed — don't scan everything.

**Select based on relevance:**
- Existing plans in `records/plans/` related to the topic
- Frontend: `ui-web/src/app/`, `ui-web/src/components/`, `ui-web/src/lib/`
- Backend: `backend/src/`
- Config: `package.json`, `tsconfig.json`, `.env.example`
- Dependencies: relevant `package.json` files

**Goal:** Real file paths, real component names, real constraints — not generic placeholders.

### Step 5: Write the Plan

Create `records/plans/{NUMBER}-{slug}.md` using the template below. Keep it **short and dense** — 30-60 lines for small features, up to 100 for large ones.

```markdown
# Plan: {Title}

**Status:** Proposed
**Date:** {YYYY-MM-DD}
**Tasks:** records/tasks/{NUMBER}-{slug}.json

## Problem
{2-3 sentences: what's wrong or missing, and why it matters.}

## Decision
{2-3 sentences: what we're building and the key technical choice.}

## Architecture
<!-- Include ONLY for medium/large changes. Delete for small ones. -->
{ASCII diagram or bullet list of components and how they connect.}

## Reference Files
{Files the implementing agent MUST read before coding. Include why.}
- `path/to/file` — why this file matters

## Constraints
- {Hard technical or product constraint}

## Non-Goals
- {What this plan explicitly does NOT include}

## Gotchas
- {Known pitfall or edge case the agent should watch for}
```

### Step 6: Generate the Task JSON

Create `records/tasks/{NUMBER}-{slug}.json`. Analyze the plan and produce concrete, implementable tasks.

**Task sizing rule:** Each task should be completable in 1-3 files and verifiable with a single command. If a task touches more than 4 files, split it.

**Phase assignment:**
- Tasks in the same phase can run in parallel (no dependencies on each other)
- Phase N+1 depends on phase N being complete
- Use as few phases as needed — don't force a structure

```json
{
  "title": "Feature Title",
  "plan": "records/plans/{NUMBER}-{slug}.md",
  "tasks": [
    {
      "id": 1,
      "phase": 1,
      "description": "What to build and why, in one sentence",
      "steps": [
        "Specific action with exact file path",
        "Another action referencing real functions/components"
      ],
      "files": ["path/to/create-or-modify.ts"],
      "verify": "cd backend && pnpm build",
      "done": false
    }
  ]
}
```

**Field rules:**
- `description`: What + why. Not just "create X" — explain the purpose.
- `steps`: 2-6 specific actions. Include file paths, function names, package names. One real code snippet beats a paragraph of description.
- `files`: Exhaustive list of files this task creates or modifies. This is the scope boundary.
- `verify`: A runnable shell command that proves the task works. Every task must have one. Examples: `pnpm build`, `pnpm test -- --grep "livekit"`, `cd backend && pnpm lint`.
- `done`: Always `false` when generated. Only the implement command or loop script sets `true`.

**How many tasks:** 5-25 depending on scope. Each task = one logical change. Err toward more granular.

### Step 7: Add E2E Verification Tasks (When Needed)

After generating implementation tasks, decide whether the plan needs **e2e verification tasks** using `agent-browser`. These tasks open the app in a real browser, walk through user flows, and capture screenshots as proof.

**When to add e2e tasks:**
- New pages, routes, or navigation changes — user can reach them
- Forms, modals, dropdowns, or any interactive component — user can operate them
- Auth flows, onboarding, or multi-step wizards — critical paths users depend on
- Layout or styling changes — visual regressions are only caught visually
- API integration that changes what users see — data actually renders correctly

**When to skip:**
- Pure backend/config/type changes with no user-facing effect
- Internal refactors that don't change behavior
- Adding utilities, helpers, or libraries not yet consumed by UI

**E2e task rules:**
- Place in the **final phase** (all code must be built first)
- Screenshots go to `screenshots/{NUMBER}-{slug}/`
- Name files descriptively: `{page}-{state}.png` (e.g., `arena-empty.png`, `settings-form-filled.png`)
- One task per page or flow — don't cram unrelated pages into one task
- Steps must use `agent-browser` commands: `open`, `wait`, `snapshot -i`, `click`, `fill`, `screenshot`, `close`
- Verify by checking screenshot files exist

**Short agent-browser guide for e2e steps:**
```bash
# 1. Navigate and wait
agent-browser open http://localhost:3000/page && agent-browser wait --load networkidle

# 2. Capture default state
agent-browser screenshot --full screenshots/{slug}/page-default.png

# 3. Discover interactive elements
agent-browser snapshot -i
# Output: @e1 [button] "Create", @e2 [input] "Search", ...

# 4. Interact using refs
agent-browser click @e1                      # click
agent-browser fill @e2 "search term"         # fill input
agent-browser wait --load networkidle        # wait after action

# 5. Capture resulting state
agent-browser screenshot screenshots/{slug}/page-after-action.png

# 6. Always close when done
agent-browser close
```

### Step 8: Writing Rules

1. **Be concrete.** Reference actual files, functions, and endpoints from the codebase exploration.
2. **State decisions.** "Use Zustand" not "We could use Zustand or Redux."
3. **Reference, don't inline.** Put file paths in Reference Files. Don't paste entire file contents into the plan.
4. **Keep the plan scannable.** A developer should grasp the full picture in under 2 minutes.
5. **Include gotchas.** Known pitfalls prevent first-pass failures. One good gotcha saves an entire failed cycle.

### Step 9: Present Summary and Ask to Implement

Show a summary:

```
## Plan-{NUMBER}: {Title}

**Plan:** `records/plans/{filename}`
**Tasks:** `records/tasks/{filename}`
**Task count:** {N} tasks across {M} phases

### What we're building
{2-3 sentences}

### Phases
- Phase 1: {description} ({N} tasks)
- Phase 2: {description} ({N} tasks)
- Phase N: E2E verification ({N} tasks, screenshots → `screenshots/{slug}/`)  ← if applicable
```

Then use `AskUserQuestion`:
- "Ready to implement?"
- Options:
  - "Yes, start implementing" — Invoke `/implement` with the task file
  - "No, just keep the plan" — Acknowledge and finish

## Related Commands

- `/implement` — Implement tasks from a plan
