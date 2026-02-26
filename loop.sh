#!/usr/bin/env bash
#
# loop.sh — Automated task implementation loop using Claude Code CLI
#
# Reads tasks from records/tasks/*.json (pure JSON, no markdown extraction).
# Passes minimal per-cycle prompts to /implement for maximum token efficiency.
#
# Usage:
#   ./loop.sh <plan-number> [options]
#
# Examples:
#   ./loop.sh 0003                        # Phase-by-phase (default)
#   ./loop.sh 0003 --style task           # One task per cycle
#   ./loop.sh 0003 --delay 15            # 15s between cycles
#   ./loop.sh 0003 --max-cycles 10       # Stop after 10 cycles
#
set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────
STYLE="phase"
DELAY=10
MAX_CYCLES=0          # 0 = unlimited
MAX_STALE=2           # Stop after N consecutive no-progress cycles
MAX_PHASE_BATCH=4     # Sub-split phases with more tasks than this
DEBUG=false
PLAN_NUMBER=""

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# ── jq Filters ────────────────────────────────────────────────────────────────
JQ_STREAM='select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'
JQ_RESULT='select(.type == "result").result // empty'

# ── Helpers ───────────────────────────────────────────────────────────────────
usage() {
  cat <<EOF
${BOLD}loop.sh${NC} — Automated task implementation loop

${BOLD}USAGE:${NC}
  ./loop.sh <plan-number> [options]

${BOLD}ARGUMENTS:${NC}
  plan-number    Plan number prefix (e.g., 0003, 0007)

${BOLD}OPTIONS:${NC}
  --style <task|phase>   task = one per cycle, phase = all in current phase (default: phase)
  --delay <seconds>      Delay between cycles (default: 10)
  --max-cycles <n>       Max cycles, 0 = unlimited (default: 0)
  --max-turns <n>        Max agent turns per cycle (default: none)
  --debug                Print prompts and jq debug output
  -h, --help             Show this help

${BOLD}EXAMPLES:${NC}
  ./loop.sh 0003                        # Phase-by-phase
  ./loop.sh 0003 --style task           # One task at a time
  ./loop.sh 0003 --max-cycles 5         # Cap at 5 cycles
  CLAUDE_MODEL=sonnet ./loop.sh 0003    # Use specific model
EOF
  exit 0
}

log()     { echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1" >&2; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
debug()   { [[ "$DEBUG" == true ]] && echo -e "${YELLOW}[DEBUG]${NC} $1" || true; }

# ── Argument Parsing ──────────────────────────────────────────────────────────
MAX_TURNS=""

if [[ $# -lt 1 ]]; then usage; fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)      usage ;;
    --style)        STYLE="$2";      shift 2 ;;
    --delay)        DELAY="$2";      shift 2 ;;
    --max-cycles)   MAX_CYCLES="$2"; shift 2 ;;
    --max-turns)    MAX_TURNS="$2";  shift 2 ;;
    --debug)        DEBUG=true;      shift ;;
    *)
      if [[ -z "$PLAN_NUMBER" ]]; then PLAN_NUMBER="$1"
      else error "Unknown argument: $1"; exit 1; fi
      shift ;;
  esac
done

# ── Validate ──────────────────────────────────────────────────────────────────
[[ -z "$PLAN_NUMBER" ]] && { error "Plan number is required"; usage; }
[[ "$STYLE" != "task" && "$STYLE" != "phase" ]] && { error "Invalid style: $STYLE"; exit 1; }
[[ ! "$DELAY" =~ ^[0-9]+$ ]] && { error "Delay must be a positive integer"; exit 1; }
[[ ! "$MAX_CYCLES" =~ ^[0-9]+$ ]] && { error "Max cycles must be a non-negative integer"; exit 1; }

# ── Pre-flight ────────────────────────────────────────────────────────────────
log "Pre-flight checks..."
command -v claude &>/dev/null || { error "claude CLI not found"; exit 1; }
command -v jq    &>/dev/null || { error "jq not found. Install: brew install jq"; exit 1; }

# Resolve task file (pure JSON)
TASKS_DIR="records/tasks"
TASK_FILE=$(find "$TASKS_DIR" -maxdepth 1 -name "${PLAN_NUMBER}-*.json" -type f 2>/dev/null | head -1)

if [[ -z "$TASK_FILE" ]]; then
  error "No task file found: ${TASKS_DIR}/${PLAN_NUMBER}-*.json"
  echo "  Available:"
  find "$TASKS_DIR" -maxdepth 1 -name "*.json" -type f 2>/dev/null | sort | while read -r f; do
    echo "    $(basename "$f")"
  done
  exit 1
fi

TASK_BASENAME=$(basename "$TASK_FILE")
success "Tasks: $TASK_BASENAME"

# Resolve plan file from the JSON
PLAN_FILE=$(jq -r '.plan' "$TASK_FILE")
if [[ ! -f "$PLAN_FILE" ]]; then
  error "Plan file not found: $PLAN_FILE (referenced in $TASK_BASENAME)"
  exit 1
fi
success "Plan: $(basename "$PLAN_FILE")"

# Count tasks
INCOMPLETE=$(jq '[.tasks[] | select(.done == false)] | length' "$TASK_FILE")
TOTAL=$(jq '.tasks | length' "$TASK_FILE")
COMPLETE=$((TOTAL - INCOMPLETE))

if [[ "$INCOMPLETE" -eq 0 ]]; then
  success "All $TOTAL tasks already complete."
  exit 0
fi

log "Tasks: ${COMPLETE}/${TOTAL} complete, ${INCOMPLETE} remaining"

# ── Temp directory ────────────────────────────────────────────────────────────
TMP_DIR=".terminal-logs"
mkdir -p "$TMP_DIR"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  Implementation Loop${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Plan:       ${CYAN}$(basename "$PLAN_FILE")${NC}"
echo -e "  Tasks:      ${CYAN}${TASK_BASENAME}${NC}"
echo -e "  Style:      ${CYAN}${STYLE}${NC}"
echo -e "  Delay:      ${CYAN}${DELAY}s${NC}"
echo -e "  Max cycles: ${CYAN}$([ "$MAX_CYCLES" -eq 0 ] && echo "unlimited" || echo "$MAX_CYCLES")${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── Main Loop ─────────────────────────────────────────────────────────────────
CYCLE=0
PREV_INCOMPLETE=-1
PREV_COMPLETE=0
STALE_CYCLES=0

while true; do
  CYCLE=$((CYCLE + 1))

  # Max cycles check
  if [[ "$MAX_CYCLES" -gt 0 && "$CYCLE" -gt "$MAX_CYCLES" ]]; then
    warn "Reached max cycles ($MAX_CYCLES). Stopping."
    break
  fi

  echo ""
  log "${BOLD}━━━ Cycle $CYCLE ━━━${NC}"

  # ── Select tasks directly from JSON ───────────────────────────────────────
  NEXT_PHASE=$(jq '[.tasks[] | select(.done == false)] | [.[].phase] | unique | sort | first' "$TASK_FILE")
  if [[ "$NEXT_PHASE" == "null" ]]; then
    success "All tasks complete!"
    break
  fi

  # Get incomplete tasks for this phase (using task id)
  PHASE_TASKS=$(jq --argjson p "$NEXT_PHASE" \
    '[.tasks[] | select(.phase == $p and .done == false)]' "$TASK_FILE")

  # Style=task → first task only; Style=phase → all (sub-split if > MAX_PHASE_BATCH)
  if [[ "$STYLE" == "task" ]]; then
    PHASE_TASKS=$(echo "$PHASE_TASKS" | jq '.[0:1]')
  elif [[ $(echo "$PHASE_TASKS" | jq 'length') -gt $MAX_PHASE_BATCH ]]; then
    PHASE_TASKS=$(echo "$PHASE_TASKS" | jq --argjson n "$MAX_PHASE_BATCH" '.[0:$n]')
  fi

  TASK_COUNT=$(echo "$PHASE_TASKS" | jq 'length')
  TASK_IDS=$(echo "$PHASE_TASKS" | jq -r '[.[].id] | map(tostring) | join(",")')
  TASK_SUMMARY=$(echo "$PHASE_TASKS" | jq -r '.[] | "- Task \(.id): \(.description)"')

  log "Phase ${NEXT_PHASE}: ${TASK_COUNT} task(s) [ids: ${TASK_IDS}]"
  debug "PHASE_TASKS=$(echo "$PHASE_TASKS" | jq -c '.')"

  # ── Build minimal prompt ────────────────────────────────────────────────────
  PROMPT="/implement
PLAN=${PLAN_FILE}
TASKS=${TASK_FILE}
TASK_IDS=${TASK_IDS}
PHASE=${NEXT_PHASE}

Implement ONLY these ${TASK_COUNT} task(s) from Phase ${NEXT_PHASE}:
${TASK_SUMMARY}

Do NOT implement other tasks. Do NOT look ahead to future phases.
Mark each done, run verify, then output CYCLE_COMPLETE or ALL_TASKS_COMPLETE."

  debug "Prompt size: $(echo "$PROMPT" | wc -c | tr -d ' ') bytes"

  if [[ "$DEBUG" == true ]]; then
    echo -e "${YELLOW}[DEBUG] ── Prompt ──${NC}"
    echo "$PROMPT"
    echo -e "${YELLOW}[DEBUG] ── End ──${NC}"
  fi

  # ── Run Claude ──────────────────────────────────────────────────────────────
  CYCLE_JSON="${TMP_DIR}/${PLAN_NUMBER}_cycle${CYCLE}.json"
  CYCLE_STDERR="${TMP_DIR}/${PLAN_NUMBER}_cycle${CYCLE}.stderr"

  log "Running claude..."
  CYCLE_START=$(date +%s)

  CLAUDE_ARGS=(-p --verbose --dangerously-skip-permissions --output-format stream-json)
  [[ -n "${CLAUDE_MODEL:-}" ]] && CLAUDE_ARGS+=(--model "$CLAUDE_MODEL")
  [[ -n "$MAX_TURNS" ]]        && CLAUDE_ARGS+=(--max-turns "$MAX_TURNS")

  set +e
  claude "${CLAUDE_ARGS[@]}" \
    "$PROMPT" 2>"$CYCLE_STDERR" \
    | grep --line-buffered '^{' \
    | tee "$CYCLE_JSON" \
    | jq --unbuffered -rj "$JQ_STREAM"
  EXIT_CODE=${PIPESTATUS[0]}
  set -e

  OUTPUT=$(jq -r "$JQ_RESULT" "$CYCLE_JSON" 2>/dev/null || echo "")

  CYCLE_END=$(date +%s)
  CYCLE_DURATION=$((CYCLE_END - CYCLE_START))

  # ── Check ground truth from JSON ─────────────────────────────────────────
  INCOMPLETE=$(jq '[.tasks[] | select(.done == false)] | length' "$TASK_FILE")
  TOTAL=$(jq '.tasks | length' "$TASK_FILE")
  COMPLETE=$((TOTAL - INCOMPLETE))

  # ── Stale detection ─────────────────────────────────────────────────────────
  if [[ "$PREV_INCOMPLETE" -ge 0 && "$INCOMPLETE" -eq "$PREV_INCOMPLETE" ]]; then
    STALE_CYCLES=$((STALE_CYCLES + 1))
  else
    STALE_CYCLES=0
  fi
  PREV_INCOMPLETE=$INCOMPLETE

  # ── Validate assigned tasks ─────────────────────────────────────────────────
  for tid in $(echo "$TASK_IDS" | tr ',' ' '); do
    IS_DONE=$(jq --argjson id "$tid" '[.tasks[] | select(.id == $id)][0].done' "$TASK_FILE")
    if [[ "$IS_DONE" != "true" ]]; then
      warn "Task $tid was assigned but NOT marked done"
    fi
  done

  # ── Overreach detection ─────────────────────────────────────────────────────
  NEW_COMPLETE=$((TOTAL - INCOMPLETE))
  EXPECTED=$((PREV_COMPLETE + TASK_COUNT))
  if [[ "$NEW_COMPLETE" -gt "$EXPECTED" ]]; then
    warn "Agent completed more tasks than assigned (expected ${EXPECTED}, got ${NEW_COMPLETE})"
  fi
  PREV_COMPLETE=$NEW_COMPLETE

  # Phase progress
  PHASE_DONE=$(jq --argjson p "$NEXT_PHASE" '[.tasks[] | select(.phase == $p and .done == true)] | length' "$TASK_FILE")
  PHASE_TOTAL=$(jq --argjson p "$NEXT_PHASE" '[.tasks[] | select(.phase == $p)] | length' "$TASK_FILE")
  log "Phase ${NEXT_PHASE}: ${PHASE_DONE}/${PHASE_TOTAL} done"

  # ── Error handling ──────────────────────────────────────────────────────────
  if [[ $EXIT_CODE -ne 0 ]]; then
    error "Claude exited with code $EXIT_CODE (stderr: $CYCLE_STDERR)"
    warn "Continuing to next cycle..."
    continue
  fi

  log "Cycle $CYCLE completed in ${CYCLE_DURATION}s | Progress: ${COMPLETE}/${TOTAL}"

  # ── Exit: all done ──────────────────────────────────────────────────────────
  if [[ "$INCOMPLETE" -eq 0 ]]; then
    echo ""
    success "${BOLD}All tasks complete!${NC}"
    break
  fi

  # ── Exit: stale ─────────────────────────────────────────────────────────────
  if [[ "$STALE_CYCLES" -ge "$MAX_STALE" ]]; then
    echo ""
    warn "No progress for $STALE_CYCLES cycles. Stopping."
    warn "Remaining: $INCOMPLETE/$TOTAL tasks."
    break
  fi

  # ── Completion signal check (informational) ─────────────────────────────────
  LAST_LINES=$(echo "$OUTPUT" | tail -5)
  if echo "$LAST_LINES" | grep -q "ALL_TASKS_COMPLETE"; then
    warn "Model signaled ALL_TASKS_COMPLETE but $INCOMPLETE tasks remain."
  elif echo "$LAST_LINES" | grep -q "CYCLE_COMPLETE"; then
    success "Cycle done. More tasks remain."
  else
    warn "No completion signal detected."
  fi

  # ── Delay ───────────────────────────────────────────────────────────────────
  if [[ "$DELAY" -gt 0 ]]; then
    log "Waiting ${DELAY}s... (Ctrl+C to stop)"
    sleep "$DELAY"
  fi
done

# ── Final Summary ─────────────────────────────────────────────────────────────
INCOMPLETE=$(jq '[.tasks[] | select(.done == false)] | length' "$TASK_FILE")
TOTAL=$(jq '.tasks | length' "$TASK_FILE")
COMPLETE=$((TOTAL - INCOMPLETE))

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  Summary${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Plan:        ${CYAN}$(basename "$PLAN_FILE")${NC}"
echo -e "  Tasks:       ${CYAN}${TASK_BASENAME}${NC}"
echo -e "  Cycles:      ${CYAN}${CYCLE}${NC}"
echo -e "  Status:      ${CYAN}${COMPLETE}/${TOTAL} tasks complete${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
