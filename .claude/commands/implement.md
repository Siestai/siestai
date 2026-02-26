# Implement

Implement tasks from a plan's task JSON file. Supports interactive single-cycle mode and automated loop mode driven by `loop.sh`.

## Usage

```
/implement
```

Or called by `loop.sh` with structured parameters:
```
/implement
PLAN=records/plans/0001-livekit-integration.md
TASKS=records/tasks/0001-livekit-integration.json
TASK_IDS=3,4,5
PHASE=2
```

## Instructions

### Detect Mode

Check whether the prompt contains structured parameters (`PLAN=`, `TASKS=`, `TASK_IDS=`, `PHASE=`).

---

### Loop Mode (structured parameters present)

1. **Read the plan file** (`PLAN=`) for architectural context — understand the problem, decision, reference files, constraints, and gotchas.
2. **Read the task JSON** (`TASKS=`) and find the tasks matching `TASK_IDS`.
3. **Read the Reference Files** listed in the plan before implementing.
4. **Implement each task:**
   - Follow the steps exactly
   - Only create/modify files listed in the task's `files` array
   - Run the task's `verify` command after completing it
   - If verify fails, fix the issue before moving on
5. **Mark each completed task** as `"done": true` in the JSON file.
6. **Run global checks:** `pnpm lint` and `pnpm build` (in the relevant package directory).
7. **Print completion signal** as the LAST line of your response:
   - `ALL_TASKS_COMPLETE` — every task in the JSON has `"done": true`
   - `CYCLE_COMPLETE` — this cycle's tasks are done, more remain

**Scope constraint:** Implement ONLY the tasks specified by `TASK_IDS`. Do not look ahead to future phases or implement unassigned tasks.

---

### Interactive Mode (no structured parameters)

1. **List available task files** from `records/tasks/*.json`
2. For each, show: `{title} ({done}/{total} tasks — {percent}%) | Phase {current} of {max}`
3. **Ask which task file** to work on using `AskUserQuestion`
4. **Read the corresponding plan** (from the JSON's `plan` field) for context
5. **Find the next incomplete phase** — lowest phase number with `"done": false` tasks
6. **Implement all incomplete tasks in that phase** (if >4, split into groups of 3-4 and do the first group)
7. **Mark tasks done**, run verification, show progress summary
8. **Ask if user wants to continue** with the next phase/group

---

## Marking Tasks Done

1. Read the JSON file
2. Find the task by `id`
3. Set `"done": true`
4. Write the JSON back (preserve formatting, validate JSON before writing)

## Edge Cases

- **All tasks done:** In interactive mode, show completion summary. In loop mode, print `ALL_TASKS_COMPLETE`.
- **No task files found:** Tell the user to run `/plan` first.
- **Verify command fails:** Fix the issue. Do not mark the task done until verify passes.

## Related Commands

- `/plan` — Create a new plan with tasks
