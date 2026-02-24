# Create ADR

Create an Architecture Decision Record (ADR) by analyzing the codebase, evaluating trade-offs, and generating a well-structured document compatible with the `/create-prd-from-adr` pipeline.

**IMPORTANT: This command should execute end-to-end without pausing for intermediate confirmations. Explore the codebase, generate the ADR, write the file, and then show a summary — all in one flow. The only user interaction points are: (1) asking for the topic if none was provided, and (2) asking if the user wants to implement after the ADR is created.**

## Usage

```
/create-adr [topic description]
```

Examples:
```
/create-adr
/create-adr Add real-time agent communication via WebSocket
/create-adr Implement user authentication with NextAuth
/create-adr Add multi-language support for the frontend
```

## Instructions for Claude

When this command is invoked, follow these steps in order. **Do NOT pause between steps or ask for confirmation until Step 7.**

---

### Step 1: Determine the Topic

**If an argument is provided** (text after `/create-adr`), use it as the topic.

**If no argument is provided**, use `AskUserQuestion` to ask:
- "What architectural decision do you want to document?"
- Provide 2-3 example topics as option descriptions to guide the user

---

### Step 2: Determine the Next ADR Number

1. Read all filenames in `records/adr/` directory
2. Extract the numeric prefix from each file (e.g., `0007` from `0007-user-authentication.md`)
3. Find the highest number
4. Increment by 1, zero-padded to 4 digits (e.g., `0008`)

---

### Step 3: Explore the Codebase

Before writing anything, **explore the codebase** to understand the current state relevant to the topic. This is critical — ADRs must reflect reality, not assumptions.

**What to explore (select based on relevance to the topic):**

1. **Existing ADRs** — Read any ADRs in `records/adr/` related to the topic to avoid contradictions and build on prior decisions
2. **Frontend structure** — Scan `ui-web/src/app/` for relevant pages, layouts, components, API routes, configuration
3. **Components** — Check `ui-web/src/components/` for reusable UI components and patterns
4. **API routes** — Check `ui-web/src/app/api/` for existing API endpoints and patterns
5. **Configuration** — Read `ui-web/next.config.ts`, `ui-web/tsconfig.json`, `ui-web/tailwind.config.*`, `.env.example` as needed
6. **Shared utilities** — Check `ui-web/src/lib/`, `ui-web/src/utils/`, `ui-web/src/hooks/` for shared code
7. **Dependencies** — Check `ui-web/package.json` and `backend/package.json` for installed packages and scripts
8. **Backend** — If relevant, scan `backend/src/` for backend services, APIs, modules, and data models

**Goal:** Gather enough context to write an ADR with real file paths, real component names, and real architectural constraints — not generic placeholders.

---

### Step 4: Assess Complexity

Based on the topic and codebase exploration, classify the ADR as one of:

| Level | Criteria | Example |
|-------|----------|---------|
| **Small** | Single-component change, 1-3 files affected, no new dependencies, straightforward decision | "Add dark mode toggle" |
| **Medium** | Multi-component change, new service or integration, some trade-offs to evaluate | "State management strategy" |
| **Large** | System-wide change, new subsystem, multiple integration points, significant infrastructure | "Real-time data sync architecture" |

**Do NOT pause or announce the complexity level to the user.** Proceed directly to generating the ADR.

---

### Step 5: Generate the ADR

Write the ADR using the template below. Include only the sections required for the assessed complexity level.

#### Template

```markdown
# ADR-{NUMBER}: {Title}

## Status
Proposed ({YYYY-MM-DD})

## Context

{Describe the current situation and why a decision is needed.}

{For MEDIUM/LARGE: Add subsections for "User Need", "Technical Gap", or other relevant framing.}

{For LARGE: Include an overview of relevant technology or platform being adopted.}

### Current State
<!-- MEDIUM and LARGE only -->

{Describe the existing architecture/code relevant to this decision. Reference actual files and components from the codebase exploration.}

### Problem Analysis
<!-- MEDIUM and LARGE only -->

{Break down the specific problems. Use a table for multiple bottlenecks/issues:}

| # | Problem | Impact | Root Cause |
|---|---------|--------|------------|
| P1 | ... | **Critical/High/Medium/Low** | ... |

## Decision

{State the decision clearly. Start with a single-sentence summary, then elaborate.}

### Key Architectural Choices
<!-- MEDIUM and LARGE only -->

{Numbered list of specific choices made, with brief rationale for each.}

### High-Level Architecture
<!-- LARGE only -->

{ASCII diagram showing the system architecture. Use box-drawing characters. Show components, connections, and data flow directions.}

### Communication/Data Flow
<!-- LARGE only -->

{Numbered sequence showing how data moves through the system step by step.}

### Implementation Approach
<!-- MEDIUM and LARGE only -->

{Break into phases. Each phase should have:}
- Phase title with timeframe estimate
- Numbered list of concrete steps
- File paths where changes will be made

### Key Challenges
<!-- LARGE only -->

{For each major challenge, include:}
- Problem statement
- Solution approach
- Challenge details (what makes it hard)
- Performance targets or constraints (if applicable)

## Expected Impact
<!-- MEDIUM and LARGE only -->

{Table showing expected improvements per phase/change:}

| Phase/Change | Impact | Complexity |
|--------------|--------|------------|
| ... | ... | Low/Medium/High |

## Key Files
<!-- MEDIUM and LARGE only -->

| File | Role |
|------|------|
| `path/to/file` | Description of its role in this decision |

## Consequences

### Positive
- {Benefit 1}
- {Benefit 2}

### Negative
- {Trade-off 1}
- {Trade-off 2}

### Risks and Mitigations
<!-- MEDIUM and LARGE only -->

{Group by risk category (Technical, Infrastructure, UX). Each risk should have a mitigation.}

**Technical Risks:**
1. **{Risk}** — {description}
   - *Mitigation:* {how to address it}

## Alternatives Considered

{For SMALL: A simple table is sufficient.}
{For MEDIUM: Table with "Alternative | Why Rejected" columns.}
{For LARGE: Subsections for each alternative with Pros/Cons/Rejection reason.}

| Alternative | Why Rejected |
|-------------|-------------|
| ... | ... |

## Open Questions
<!-- LARGE only -->

{Numbered list of unresolved questions with recommendations.}

1. **{Question}** — {context}
   - Recommendation: {suggested answer}

## References
<!-- LARGE only -->

{Grouped by category with markdown links.}

## Glossary
<!-- LARGE only -->

{Define domain-specific terms used in the ADR.}

- **{Term}:** {Definition}
```

---

### Step 6: Writing Rules

Follow these rules when writing the ADR content:

1. **Be concrete, not abstract.** Reference actual files, classes, functions, and endpoints from the codebase.
   - Good: "Modify `ui-web/src/app/api/agents/route.ts` to add streaming support to the `POST` handler"
   - Bad: "Update the agents API to support streaming"

2. **State decisions, not possibilities.** An ADR records what was decided, not what could be decided.
   - Good: "Use Zustand for client-side state management"
   - Bad: "We could use Zustand or Redux for state management"

3. **Quantify when possible.** Use numbers, percentages, time estimates.
   - Good: "Reduces initial bundle size from ~450KB to ~280KB"
   - Bad: "Significantly reduces bundle size"

4. **Keep sections focused.** Each section has one job. Don't repeat information across sections.

5. **Use ASCII diagrams for architecture.** Box-drawing characters (`┌ ─ ┐ │ └ ┘ ├ ┤ ┬ ┴ ┼ ▼ ▲ ◄ ►`) for diagrams, not code blocks with plain text arrows.

6. **Alternatives must have real rejection reasons.** Not just "too complex" — explain specifically why.

7. **Write for the `/create-prd-from-adr` pipeline.** The ADR will be consumed by the PRD generator. Ensure it contains:
   - A clear problem statement (Context section)
   - Concrete decisions with file paths (Decision section)
   - Phased implementation approach (Implementation Approach section, for Medium/Large)
   - Consequences with both positive and negative (Consequences section)
   - Alternatives with rejection reasons (Alternatives Considered section)

---

### Step 7: Save and Present Summary

1. **Generate the filename:** `records/adr/{NUMBER}-{kebab-case-title}.md`
   - Convert the title to kebab-case (lowercase, hyphens instead of spaces)
   - Remove articles (a, an, the) and prepositions if they make the name too long
   - Target 3-5 words in the filename
   - Examples: `0008-realtime-agent-communication.md`, `0009-nextauth-integration.md`

2. **Write the file** to `records/adr/{filename}`

3. **Show a summary in the chat** with the following format:

   ```
   ## ADR-{NUMBER}: {Title}

   **File:** `records/adr/{filename}`
   **Complexity:** {Small/Medium/Large}
   **Status:** Proposed

   ### Decision Summary
   {2-3 sentence summary of what was decided and why}

   ### Key Changes
   - {Bullet list of the main architectural changes/additions}

   ### Impact
   - **Positive:** {1-2 key benefits}
   - **Trade-offs:** {1-2 key trade-offs}
   ```

4. **Ask to implement:** After showing the summary, use `AskUserQuestion` to ask:
   - Question: "Would you like to implement this ADR?"
   - Options:
     - "Yes, create PRD and implement" — description: "Generate a PRD from this ADR and start implementing tasks"
     - "Yes, create PRD only" — description: "Generate a PRD with implementation tasks, but don't start implementing yet"
     - "No, just keep the ADR" — description: "The ADR is saved in records/adr/, you can implement later with /create-prd-from-adr"

5. **Handle the response:**
   - If "Yes, create PRD and implement": Invoke `/create-prd-from-adr` with the ADR file path, and after the PRD is created, invoke `/implement-prd`
   - If "Yes, create PRD only": Invoke `/create-prd-from-adr` with the ADR file path
   - If "No, just keep the ADR": Acknowledge and finish

---

## PRD Compatibility Checklist

Before saving, verify the ADR has everything `/create-prd-from-adr` needs:

- [ ] **Clear problem statement** in Context section — the PRD generator uses this to understand "why"
- [ ] **Concrete decisions** with specific file paths and component names — the PRD generator uses these to create targeted tasks
- [ ] **Phased implementation** (for Medium/Large) — the PRD generator maps these to task phases
- [ ] **Consequences** with both positive and negative — the PRD generator creates hardening and risk-mitigation tasks from negatives
- [ ] **Alternatives with rejection reasons** — the PRD generator may reference these to avoid revisiting rejected approaches

If any item is missing, add it before saving.

## Related Commands

- `/create-prd-from-adr` — Convert this ADR into a PRD with actionable tasks (offered automatically after ADR creation)
- `/implement-prd` — Implement tasks from a PRD one by one (offered automatically after PRD creation)
