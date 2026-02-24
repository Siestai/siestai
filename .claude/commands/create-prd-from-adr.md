# Create PRD from ADR

Convert an Architecture Decision Record (ADR) into a Product Requirements Document (PRD) with production-ready, actionable tasks in JSON format.

## Usage

```
/create-prd-from-adr
```

The command will:
1. Ask you to select an ADR from the `records/adr/` directory
2. Perform deep multi-angle analysis of the ADR
3. Generate a comprehensive, phased task breakdown ready for immediate implementation
4. Create a PRD file in `records/prd/` with the same number as the ADR

## Core Principle

The PRIMARY job of this command is **deep analysis and production-ready task generation**. Every task must be concrete enough that a developer can start implementing immediately without needing to ask clarifying questions. Analyze the ADR from every angle — architecture, security, performance, testing, deployment, edge cases, error handling, backwards compatibility — before generating any tasks.

## Task Format

Each task in the PRD follows this structure:

```json
{
  "phase": 1,
  "category": "setup|feature|integration|optimization|security|testing|e2e-testing|documentation",
  "description": "Clear description of what needs to be done",
  "steps": [
    "Specific step 1",
    "Specific step 2",
    "Specific step 3"
  ],
  "implemented": false,
  "improvements": [],
  "improvements_done": false
}
```

**Field Descriptions:**
- `phase`: **Required.** Integer indicating the implementation phase (1, 2, 3, etc.). Multiple tasks can share the same phase. Tasks within the same phase can be worked on in parallel. A higher phase number means the task depends on earlier phases being completed first.
- `category`: Type of task (setup, feature, integration, optimization, security, testing, documentation)
- `description`: Clear, specific description of what needs to be done — include the "what" AND "why"
- `steps`: Array of specific implementation steps with file paths, function names, and technical details
- `implemented`: Boolean indicating if the core task is complete
- `improvements`: Array of improvement notes for later optimization (populated after task completion)
- `improvements_done`: Boolean indicating if all improvements have been implemented

## Phase Design Principles

Phases represent **implementation waves** — groups of tasks that can be worked on together and must be completed before the next phase begins.

### How to assign phases:

1. **Phase 1** — Foundation: Environment setup, dependencies, configuration, scaffolding. Everything needed before real work begins.
2. **Phase 2** — Core Implementation: The primary feature or change described in the ADR. The "main event."
3. **Phase 3** — Integration & Wiring: Connecting the new code to existing systems, data flows, APIs, UI.
4. **Phase 4** — Hardening: Error handling, edge cases, validation, performance optimization.
5. **Phase 5** — Security Review: Dedicated security audit and hardening for the feature. See "Security Review Phase" below.
6. **Phase 6** — Testing & Quality: Comprehensive tests — unit, integration, benchmarks.
7. **Phase 7** — Documentation & Polish: User-facing docs, developer guides, configuration references.
8. **Phase 8** — E2E Testing (Final Phase): Browser-based end-to-end tests using the `agent-browser` skill. See "E2E Testing Phase" below.

Not every PRD needs all 8 phases. Use as many as the ADR requires. A simple feature may only need 3 phases. A complex system integration may need 8. The E2E Testing phase is always the **last phase** if included.

### Phase rules:
- Tasks in the **same phase** should be parallelizable (no dependencies on each other)
- Tasks in phase N+1 may depend on tasks in phase N (or earlier)
- Testing tasks can appear in the same phase as the code they test, OR in a later phase — use judgment based on whether the tests validate a single task or an entire phase
- Cross-cutting concerns (metrics, logging, monitoring) should be in a later phase, after core functionality works

### Security Review Phase

**Every PRD that touches any of the following MUST include a dedicated Security Review phase** (with `"category": "security"` tasks):

- User input (text, forms, file uploads, API parameters)
- Authentication or authorization (tokens, API keys, sessions, roles)
- External services or APIs (network calls, webhooks, third-party integrations)
- Data storage (database writes, file system access, caching user data)
- Secrets or credentials (env vars, config files, key management)
- Real-time connections (WebSocket, SSE, streaming)
- Code execution or dynamic evaluation (eval, dynamic imports)

**When to place the Security Review phase:**
- It comes AFTER integration & hardening (the code must exist before you can audit it) and BEFORE the final testing phase (so security fixes are covered by tests).
- If the ADR has minimal security surface (e.g., a pure refactor with no new inputs/outputs), the Security Review phase can be omitted — but you MUST explicitly note in the Implementation Notes why it was skipped.

**What Security Review tasks should cover:**
1. **Input Validation & Sanitization**: Validate all user-facing inputs. Check for injection vectors (SQL, command, path traversal, XSS). Enforce type/length/range constraints.
2. **Authentication & Authorization**: Verify auth is enforced on all new endpoints/routes. Check token validation, expiration, and scope. Ensure least-privilege access.
3. **Secrets Management**: Audit that no secrets are hardcoded or logged. Verify secrets come from env vars / secure config. Check that secrets are excluded from error messages and stack traces.
4. **Data Privacy & Exposure**: Ensure user data is not leaked in logs, errors, or responses. Validate data access is scoped to the authenticated user.
5. **Dependency & Supply Chain**: Audit new dependencies for known vulnerabilities. Pin versions. Check license compatibility.
6. **Attack Surface Review**: Identify new network-exposed endpoints or services. Review rate limiting, CORS, and request size limits. Check for denial-of-service vectors (large uploads, expensive operations without limits).

**Example security tasks:**
```json
{
  "phase": 5,
  "category": "security",
  "description": "Audit and validate all user inputs in the new agent communication API routes",
  "steps": [
    "Review backend/src/agents/agents.controller.ts for request body validation — enforce schema with zod or class-validator, reject malformed payloads",
    "Add input sanitization for user-provided text fields — prevent XSS and injection",
    "Validate session tokens and ensure API routes check authentication before processing",
    "Add rate limiting to prevent abuse of data submission endpoints",
    "Test with malformed inputs: oversized payloads, wrong content types, injection payloads, path traversal strings"
  ],
  "implemented": false,
  "improvements": [],
  "improvements_done": false
}
```

## E2E Testing Phase

**Every PRD that involves user-facing changes (UI, API endpoints, real-time features, or flows that can be validated in a browser) MUST include an E2E Testing phase as the final phase.** This phase uses the `agent-browser` skill to run browser-based end-to-end tests with screenshot evidence.

### When to include:
- New or modified frontend pages/components
- New API endpoints that have UI consumers
- Real-time features (WebSocket, SSE flows)
- User-facing workflows (onboarding, dashboards, settings)
- Any feature where visual or functional regression can be caught in a browser

### When to skip:
- Pure backend refactors with no user-facing changes
- Internal tooling or developer-only scripts
- Configuration-only changes
- If skipped, you MUST explicitly note in Implementation Notes why E2E testing was omitted

### Screenshots folder structure:
All screenshots taken during E2E testing are stored in a PRD-specific folder under the project root:
```
screenshots/{adr-slug}/
```
Where `{adr-slug}` is the ADR filename without the `.md` extension. For example:
- ADR `0003-agent-communication.md` → `screenshots/0003-agent-communication/`
- ADR `0005-user-authentication.md` → `screenshots/0005-user-authentication/`

Screenshots should be named descriptively: `01-homepage-loaded.png`, `02-dashboard-rendered.png`, `03-form-submitted.png`, etc.

### Example E2E testing task:
```json
{
  "phase": 8,
  "category": "testing",
  "description": "E2E browser tests: Validate the complete user flow for [feature] using agent-browser with screenshot evidence",
  "steps": [
    "Create screenshots directory: screenshots/{adr-slug}/",
    "Use agent-browser skill to navigate to the application",
    "Test the primary user flow: [describe the flow]",
    "Take screenshots at each critical step and save to screenshots/{adr-slug}/",
    "Verify visual correctness: elements render properly, no layout breaks",
    "Test error states: [describe error scenarios to test]",
    "Verify all screenshots are saved and document results in the implementation log"
  ],
  "implemented": false,
  "improvements": [],
  "improvements_done": false
}
```

---

## Categories

- **setup**: Infrastructure, dependencies, environment configuration, scaffolding
- **feature**: New functionality or capabilities — the core "what" being built
- **integration**: Connecting systems, wiring components, data flow between subsystems
- **optimization**: Performance improvements, caching, resource management, refactoring
- **security**: Authentication, authorization, input validation, secrets management, data privacy, attack surface hardening
- **testing**: Unit tests, integration tests, benchmarks, validation
- **e2e-testing**: Browser-based end-to-end tests using agent-browser skill with screenshot evidence
- **documentation**: User guides, API docs, configuration references, READMEs

## Instructions for Claude

When this command is invoked:

### Step 1: List Available ADRs

- Read all files from `records/adr/` directory
- Display a numbered list of ADRs with their titles
- Ask user which ADR to convert

### Step 2: Deep Multi-Angle Analysis

Read the selected ADR completely, then analyze it from **every angle** before generating tasks:

#### Architecture Analysis
- What components need to be created or modified?
- What are the interfaces/contracts between components?
- What design patterns are called for?
- Are there architectural constraints or decisions already made?
- What existing code will be impacted?

#### Dependency & Sequencing Analysis
- What must be built first before other things can work?
- What can be built in parallel?
- Are there external dependencies (APIs, libraries, services)?
- What configuration or environment setup is needed?

#### Data Flow Analysis
- How does data move through the system?
- What data transformations are needed?
- What are the input/output formats?
- Where does state live and how is it managed?

#### Error & Edge Case Analysis
- What can go wrong at each step?
- What happens when external services are down?
- What are the boundary conditions?
- How should errors propagate and be handled?

#### Performance & Scalability Analysis
- What are the performance-critical paths?
- Where could bottlenecks occur?
- What needs to be cached, pooled, or optimized?
- What are the resource constraints (memory, CPU, network)?

#### Security & Safety Analysis
- Are there authentication/authorization concerns?
- Is there user input that needs validation/sanitization?
- Are secrets or credentials involved?
- Are there privacy considerations?

#### Testing & Validation Analysis
- What are the critical paths that must be tested?
- What types of tests are needed (unit, integration, e2e, benchmark)?
- How can correctness be verified?
- What are the acceptance criteria?

#### Backwards Compatibility & Migration
- Does this break existing functionality?
- Is there a migration path needed?
- Can this be feature-flagged for gradual rollout?
- What happens to existing data/state?

### Step 3: Generate Production-Ready Task Breakdown

Based on the analysis, generate 15-30 concrete tasks:

- **Assign a phase** to every task — group by implementation wave
- **Order tasks** within each phase logically
- Each task must be:
  - **Specific**: Exact files, functions, components, routes named
  - **Measurable**: Clear "done" criteria — what does success look like?
  - **Actionable**: A developer can start immediately from the steps
  - **Scoped**: Completable in 2-8 hours of focused work
  - **Complete**: Includes error handling, validation, edge cases within the task scope

### Step 4: Create Detailed Steps

Each task should have 3-8 steps that are:
- Technical and specific — include file paths, function signatures, component names
- Sequenced logically — step 1 before step 2
- Verifiable — include "verify by..." or "test with..." where appropriate
- Self-contained — a developer reading only this task can complete it

### Step 5: Generate PRD File

- Extract ADR number (e.g., "0003" from "0003-agent-communication.md")
- Create file: `records/prd/{ADR_NUMBER}-{name}-prd.md`
- Use the template below

## PRD Template

```markdown
# PRD-{NUMBER}: {Title}

**Source ADR:** [ADR-{NUMBER}](../adr/{ADR_FILE})
**Status:** Not Started
**Created:** {DATE}

## Overview

{2-3 paragraphs: What is being built, why it matters, and the high-level approach. Include the key architectural decisions from the ADR and the expected outcomes.}

## Implementation Tasks

The tasks below are organized by phase and priority. Each phase builds on the previous one. Tasks within the same phase can be worked on in parallel.

\`\`\`json
[
  {
    "phase": 1,
    "category": "setup",
    "description": "Set up development environment and dependencies",
    "steps": [
      "Install required packages: pnpm add package-name",
      "Create configuration in next.config.ts or environment files",
      "Add environment variables to .env.example with documentation comments",
      "Verify setup with: pnpm dev"
    ],
    "implemented": false,
    "improvements": [],
    "improvements_done": false
  },
  {
    "phase": 2,
    "category": "feature",
    "description": "Implement core feature X with full error handling",
    "steps": [
      "Create ui-web/src/app/feature/page.tsx with FeaturePage component",
      "Implement data fetching with proper loading and error states",
      "Add proper error handling: catch specific errors, show user-friendly messages",
      "Create ui-web/src/components/feature/FeatureCard.tsx following existing component patterns"
    ],
    "implemented": false,
    "improvements": [],
    "improvements_done": false
  }
]
\`\`\`

## Progress Tracking

- Total Tasks: {COUNT}
- Completed: 0
- In Progress: 0
- Not Started: {COUNT}

### Phase Breakdown

- **Phase 1 — {Phase Title}** (Tasks 1-N): 0/N completed
- **Phase 2 — {Phase Title}** (Tasks N-M): 0/M completed
- **Phase 3 — {Phase Title}** (Tasks M-P): 0/P completed

## Implementation Notes

### Prerequisites
- {List any prerequisites — existing code, services, accounts, API keys}

### Key Decisions
- {Important technical decisions made during analysis}

### Testing Strategy
- {How to test each phase — what types of tests, what tools}

### Deployment Considerations
- {Feature flags, rollout strategy, rollback plan}

### Risk Assessment
- {What could go wrong, mitigation strategies}

## References
- {Link to ADR}
- {Link to relevant external docs, libraries, APIs}
```

## Important Guidelines

1. **Analyze Before Generating**: Spend the majority of effort on analysis. Read the ADR multiple times. Cross-reference with existing codebase. The task list should be the OUTPUT of thorough analysis, not a quick skim.

2. **Every Task Gets a Phase**: No task should be missing a `phase` field. This is mandatory.

3. **Be Specific**: Avoid vague tasks like "Implement feature X". Instead: "Create `ui-web/src/app/dashboard/page.tsx` with DashboardPage component using the AgentChart and StatsGrid components"

4. **Break Down Complexity**: If a task seems large (>8 hours), split it into smaller tasks within the same or adjacent phases.

5. **Include Verification**: Add verification steps where possible ("Test with: ...", "Verify by checking...", "Expected output: ...")

6. **File Paths**: Include specific file paths in steps (e.g., "Create `ui-web/src/components/agents/AgentCard.tsx`" or "Modify `backend/src/agents/agents.service.ts`")

7. **Technical Details**: Include function names, component names, API endpoints, TypeScript types where relevant

8. **Preserve Context**: Include WHY a task is needed (in description), not just WHAT to do (in steps)

9. **Error Handling in Tasks**: Don't leave error handling as a separate task at the end. Include it within each feature task's steps.

10. **Config Flags**: New features should be gated behind configuration flags. Include the config setup in the task steps.

## After PRD Creation

After generating the PRD, inform the user:

1. Where the PRD file was saved
2. Total task count and phase breakdown (e.g., "22 tasks across 5 phases")
3. Summary of what each phase covers
4. Suggest starting with Phase 1 tasks
5. Mention they can edit the JSON directly to add/modify tasks
6. Remind them to mark `implemented: true` as they complete tasks
7. Explain the improvements tracking workflow:
   - After completing each task, identify potential improvements
   - Add improvements to the `improvements` array for future optimization
   - Mark `improvements_done: true` when all improvements are implemented

## Regeneration

If the user wants to regenerate a PRD:
- Read the existing PRD JSON
- Preserve `implemented: true` tasks (keep their phase, steps, improvements intact)
- Preserve `improvements` and `improvements_done` fields for all tasks
- Only regenerate incomplete tasks — may reassign phases if the overall structure changed
- Merge old and new JSON
- Maintain phase numbering consistency

## Improvements Tracking

When generating PRD tasks, always include these fields:

```json
{
  "improvements": [],
  "improvements_done": false
}
```

**Purpose:**
- After completing a task, the developer identifies potential improvements
- These improvements are tracked in the `improvements` array
- The `improvements_done` flag indicates if improvements have been implemented

**Workflow:**
1. Implement core task functionality
2. Identify improvements (performance, code quality, testing, security, etc.)
3. Add improvements to the array
4. Continue with next task
5. Return later to implement improvements
6. Mark `improvements_done: true` when complete
