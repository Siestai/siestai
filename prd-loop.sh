#!/usr/bin/env bash
#
# prd-loop.sh — Automated PRD implementation loop using Claude Code CLI
#
# Usage:
#   ./prd-loop.sh <prd-number> [options]
#
# Examples:
#   ./prd-loop.sh 0004                      # Default: phase style
#   ./prd-loop.sh 0004 --style task         # Task-by-task
#   ./prd-loop.sh 0007 --delay 30           # 30s between cycles
#   ./prd-loop.sh 0004 --max-cycles 5       # Stop after 5 cycles
#
set -euo pipefail

# ── Defaults ────────────────────────────────────────────────────────────────
STYLE="phase"
DELAY=10
MAX_CYCLES=0  # 0 = unlimited
DEBUG=false
PRD_NUMBER=""

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ── jq Filters ────────────────────────────────────────────────────────────
# Extract streaming text from assistant messages for live display
JQ_STREAM='select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'
# Extract the final result text
JQ_RESULT='select(.type == "result").result // empty'

# ── Helpers ─────────────────────────────────────────────────────────────────
usage() {
  cat <<EOF
${BOLD}prd-loop.sh${NC} — Automated PRD implementation loop

${BOLD}USAGE:${NC}
  ./prd-loop.sh <prd-number> [options]

${BOLD}ARGUMENTS:${NC}
  prd-number    PRD number prefix (e.g., 0004, 0007)

${BOLD}OPTIONS:${NC}
  --style <task|phase>   Implementation style (default: phase)
  --delay <seconds>      Delay between cycles (default: 10)
  --max-cycles <n>       Maximum cycles to run, 0=unlimited (default: 0)
  --debug                Print prompt, task selection details, and jq output
  -h, --help             Show this help message

${BOLD}EXAMPLES:${NC}
  ./prd-loop.sh 0004                      # Phase-by-phase (default)
  ./prd-loop.sh 0004 --style task         # Task-by-task
  ./prd-loop.sh 0007 --delay 30           # 30s between cycles
  ./prd-loop.sh 0004 --max-cycles 5       # Stop after 5 cycles
EOF
  exit 0
}

log() {
  echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $1"
}

error() {
  echo -e "${RED}[ERROR]${NC} $1" >&2
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

success() {
  echo -e "${GREEN}[OK]${NC} $1"
}

debug() {
  if [[ "$DEBUG" == true ]]; then
    echo -e "${YELLOW}[DEBUG]${NC} $1"
  fi
}

extract_tasks_json() {
  sed -n '/^```json$/,/^```$/p' "$1" | sed '1d;$d'
}

# ── Argument Parsing ────────────────────────────────────────────────────────
if [[ $# -lt 1 ]]; then
  usage
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      ;;
    --style)
      STYLE="$2"
      shift 2
      ;;
    --delay)
      DELAY="$2"
      shift 2
      ;;
    --max-cycles)
      MAX_CYCLES="$2"
      shift 2
      ;;
    --debug)
      DEBUG=true
      shift
      ;;
    *)
      if [[ -z "$PRD_NUMBER" ]]; then
        PRD_NUMBER="$1"
      else
        error "Unknown argument: $1"
        exit 1
      fi
      shift
      ;;
  esac
done

# ── Validate Inputs ─────────────────────────────────────────────────────────
if [[ -z "$PRD_NUMBER" ]]; then
  error "PRD number is required"
  usage
fi

if [[ "$STYLE" != "task" && "$STYLE" != "phase" ]]; then
  error "Invalid style: $STYLE (must be 'task' or 'phase')"
  exit 1
fi

if ! [[ "$DELAY" =~ ^[0-9]+$ ]]; then
  error "Delay must be a positive integer"
  exit 1
fi

if ! [[ "$MAX_CYCLES" =~ ^[0-9]+$ ]]; then
  error "Max cycles must be a non-negative integer"
  exit 1
fi

# ── Pre-flight Checks ───────────────────────────────────────────────────────
log "Running pre-flight checks..."

# Check claude CLI exists
if ! command -v claude &>/dev/null; then
  error "claude CLI not found. Install it: npm install -g @anthropic-ai/claude-code"
  exit 1
fi
success "claude CLI found"

# Check jq exists
if ! command -v jq &>/dev/null; then
  error "jq not found. Install it: brew install jq"
  exit 1
fi
success "jq found"

# Resolve PRD file
PRD_DIR="records/prd"
PRD_FILE=$(find "$PRD_DIR" -maxdepth 1 -name "${PRD_NUMBER}-*-prd.md" -type f 2>/dev/null | head -1)

if [[ -z "$PRD_FILE" ]]; then
  error "No PRD file found matching pattern: ${PRD_DIR}/${PRD_NUMBER}-*-prd.md"
  echo "  Available PRDs:"
  find "$PRD_DIR" -maxdepth 1 -name "*-prd.md" -type f 2>/dev/null | sort | while read -r f; do
    echo "    $(basename "$f")"
  done
  exit 1
fi

PRD_BASENAME=$(basename "$PRD_FILE")
success "Found PRD: $PRD_BASENAME"

# Check for incomplete tasks
INCOMPLETE_COUNT=$(grep -c '"implemented": false' "$PRD_FILE" 2>/dev/null || true)
TOTAL_COUNT=$(grep -c '"implemented":' "$PRD_FILE" 2>/dev/null || true)
COMPLETE_COUNT=$((TOTAL_COUNT - INCOMPLETE_COUNT))

if [[ "$INCOMPLETE_COUNT" -eq 0 ]]; then
  success "All $TOTAL_COUNT tasks are already complete. Nothing to do."
  exit 0
fi

log "Tasks: ${COMPLETE_COUNT}/${TOTAL_COUNT} complete, ${INCOMPLETE_COUNT} remaining"

# ── Resolve Log File ────────────────────────────────────────────────────────
# Single log file per PRD in records/logs/
# Naming: derive from PRD filename (e.g., 0003-agent-comm-prd.md → 0003-agent-comm-log.md)
LOG_DIR="records/logs"
mkdir -p "$LOG_DIR"

# Derive log filename from PRD filename: replace -prd.md with -log.md
LOG_BASENAME="${PRD_BASENAME%-prd.md}-log.md"
LOG_FILE="${LOG_DIR}/${LOG_BASENAME}"

if [[ -f "$LOG_FILE" ]]; then
  success "Found existing log: $LOG_BASENAME"
else
  log "Creating new log: $LOG_BASENAME"
  {
    echo "# Implementation Log: ${PRD_BASENAME%-prd.md}"
    echo ""
    echo "**PRD:** [${PRD_BASENAME}](../records/prd/${PRD_BASENAME})"
    echo "**Created:** $(date '+%Y-%m-%d %H:%M')"
    echo ""
    echo "---"
    echo ""
  } > "$LOG_FILE"
fi

# ── Terminal Logs Directory ─────────────────────────────────────────────────
# Temp files (JSON streams, stderr) go to .terminal-logs/ (gitignored)
TERMINAL_LOG_DIR=".terminal-logs"
mkdir -p "$TERMINAL_LOG_DIR"

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  PRD Implementation Loop${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  PRD:        ${CYAN}${PRD_BASENAME}${NC}"
echo -e "  Style:      ${CYAN}${STYLE}${NC}"
echo -e "  Delay:      ${CYAN}${DELAY}s${NC} between cycles"
echo -e "  Max cycles: ${CYAN}$([ "$MAX_CYCLES" -eq 0 ] && echo "unlimited" || echo "$MAX_CYCLES")${NC}"
echo -e "  Log:        ${CYAN}${LOG_FILE}${NC}"
echo -e "  Debug:      ${CYAN}${DEBUG}${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── Main Loop ────────────────────────────────────────────────────────────────
CYCLE=0
PREV_INCOMPLETE=-1
PREV_COMPLETE=0
STALE_CYCLES=0
MAX_STALE=2  # Stop after this many consecutive cycles with no progress

while true; do
  CYCLE=$((CYCLE + 1))

  # Check max cycles
  if [[ "$MAX_CYCLES" -gt 0 && "$CYCLE" -gt "$MAX_CYCLES" ]]; then
    warn "Reached max cycles ($MAX_CYCLES). Stopping."
    break
  fi

  echo ""
  log "${BOLD}━━━ Cycle $CYCLE ━━━${NC}"

  # ── Task Selection via jq ──────────────────────────────────────────────
  TASKS_JSON=$(extract_tasks_json "$PRD_FILE")
  if ! echo "$TASKS_JSON" | jq '.' >/dev/null 2>&1; then
    error "Failed to parse task JSON from PRD"; exit 1
  fi

  NEXT_PHASE=$(echo "$TASKS_JSON" | jq '[.[] | select(.implemented == false)] | [.[].phase] | unique | sort | first')
  if [[ "$NEXT_PHASE" == "null" ]]; then
    success "All tasks complete!"; break
  fi

  # Get incomplete tasks for this phase (with array indices)
  PHASE_TASKS=$(echo "$TASKS_JSON" | jq --argjson p "$NEXT_PHASE" \
    '[to_entries[] | select(.value.phase == $p and .value.implemented == false) | {index: .key, description: .value.description, steps: .value.steps}]')

  # Style=task → only first task; Style=phase → all (sub-split if >4)
  if [[ "$STYLE" == "task" ]]; then
    PHASE_TASKS=$(echo "$PHASE_TASKS" | jq '.[0:1]')
  elif [[ $(echo "$PHASE_TASKS" | jq 'length') -gt 4 ]]; then
    PHASE_TASKS=$(echo "$PHASE_TASKS" | jq '.[0:4]')
  fi

  TASK_COUNT=$(echo "$PHASE_TASKS" | jq 'length')
  TASK_INDICES=$(echo "$PHASE_TASKS" | jq -r '[.[].index] | map(tostring) | join(",")')
  TASK_LIST=$(echo "$PHASE_TASKS" | jq -r '.[] | "- Task[\(.index)]: \(.description)"')
  TASK_DETAILS=$(echo "$PHASE_TASKS" | jq -r '.[] | "### Task[\(.index)]: \(.description)\nSteps:\n" + (.steps | map("  - " + .) | join("\n")) + "\n"')

  log "Phase ${NEXT_PHASE}: ${TASK_COUNT} task(s) selected [indices: ${TASK_INDICES}]"

  debug "NEXT_PHASE=${NEXT_PHASE}"
  debug "TASK_COUNT=${TASK_COUNT}"
  debug "TASK_INDICES=${TASK_INDICES}"
  debug "PHASE_TASKS=$(echo "$PHASE_TASKS" | jq -c '.')"

  # ── Build Dynamic Scoped Prompt ──────────────────────────────────────────
  PROMPT="/implement-prd
PRD_FILE=${PRD_BASENAME}
METHOD=loop
STYLE=${STYLE}
CYCLE=${CYCLE}
PHASE=${NEXT_PHASE}
TASK_INDICES=${TASK_INDICES}
TASK_COUNT=${TASK_COUNT}

## SCOPE CONSTRAINT — READ THIS FIRST
You MUST implement ONLY the following ${TASK_COUNT} task(s) from Phase ${NEXT_PHASE}.
Do NOT implement any other tasks. Do NOT look ahead to future phases.
After completing these tasks, mark them as implemented, update the log, output CYCLE_COMPLETE, and stop.

## Tasks for this cycle:
${TASK_LIST}

## Detailed steps:
${TASK_DETAILS}"

  if [[ "$DEBUG" == true ]]; then
    echo -e "${YELLOW}[DEBUG] ── Prompt ──────────────────────────────────${NC}"
    echo "$PROMPT"
    echo -e "${YELLOW}[DEBUG] ── End Prompt ──────────────────────────────${NC}"
  fi

  # Temp files go to .terminal-logs/ (gitignored)
  CYCLE_JSON="${TERMINAL_LOG_DIR}/${PRD_NUMBER}_cycle${CYCLE}.json"
  CYCLE_STDERR="${TERMINAL_LOG_DIR}/${PRD_NUMBER}_cycle${CYCLE}.stderr"

  # Run claude CLI with streaming JSON output
  log "Running claude with ${STYLE} style..."
  CYCLE_START=$(date +%s)

  # Build claude command args (supports optional CLAUDE_MODEL env var)
  CLAUDE_ARGS=(-p --verbose --dangerously-skip-permissions --output-format stream-json)
  if [[ -n "${CLAUDE_MODEL:-}" ]]; then
    CLAUDE_ARGS+=(--model "$CLAUDE_MODEL")
  fi

  set +e
  claude "${CLAUDE_ARGS[@]}" \
    "$PROMPT" 2>"$CYCLE_STDERR" \
    | grep --line-buffered '^{' \
    | tee "$CYCLE_JSON" \
    | jq --unbuffered -rj "$JQ_STREAM"
  EXIT_CODE=${PIPESTATUS[0]}
  set -e

  # Extract final result text from the stream JSON
  OUTPUT=$(jq -r "$JQ_RESULT" "$CYCLE_JSON")

  CYCLE_END=$(date +%s)
  CYCLE_DURATION=$((CYCLE_END - CYCLE_START))

  # ── Check PRD state (ground truth, independent of model signals) ─────────
  INCOMPLETE_COUNT=$(grep -c '"implemented": false' "$PRD_FILE" 2>/dev/null || true)
  TOTAL_COUNT=$(grep -c '"implemented":' "$PRD_FILE" 2>/dev/null || true)
  COMPLETE_COUNT=$((TOTAL_COUNT - INCOMPLETE_COUNT))

  # ── Stale cycle detection ──────────────────────────────────────────────
  if [[ "$PREV_INCOMPLETE" -ge 0 && "$INCOMPLETE_COUNT" -eq "$PREV_INCOMPLETE" ]]; then
    STALE_CYCLES=$((STALE_CYCLES + 1))
  else
    STALE_CYCLES=0
  fi
  PREV_INCOMPLETE=$INCOMPLETE_COUNT

  # ── Validate assigned tasks were marked done ────────────────────────────
  POST_JSON=$(extract_tasks_json "$PRD_FILE")
  for idx in $(echo "$TASK_INDICES" | tr ',' ' '); do
    IS_DONE=$(echo "$POST_JSON" | jq --argjson i "$idx" '.[$i].implemented')
    if [[ "$IS_DONE" != "true" ]]; then
      warn "Task[$idx] was assigned but NOT marked as implemented"
    fi
  done

  # Overreach detection
  NEW_COMPLETE=$((TOTAL_COUNT - INCOMPLETE_COUNT))
  EXPECTED=$((PREV_COMPLETE + TASK_COUNT))
  debug "Overreach check: PREV_COMPLETE=${PREV_COMPLETE} TASK_COUNT=${TASK_COUNT} EXPECTED=${EXPECTED} NEW_COMPLETE=${NEW_COMPLETE}"
  if [[ "$NEW_COMPLETE" -gt "$EXPECTED" ]]; then
    warn "Agent completed more tasks than assigned (expected ${EXPECTED}, got ${NEW_COMPLETE})"
  fi
  PREV_COMPLETE=$NEW_COMPLETE

  # Phase progress
  log "Phase ${NEXT_PHASE}: $(echo "$POST_JSON" | jq --argjson p "$NEXT_PHASE" \
    '[.[] | select(.phase == $p and .implemented == true)] | length')/$(echo "$POST_JSON" | jq --argjson p "$NEXT_PHASE" \
    '[.[] | select(.phase == $p)] | length') tasks done"

  # ── Append cycle summary to log (skip if stale) ────────────────────────
  if [[ "$STALE_CYCLES" -eq 0 ]]; then
    {
      echo "## Session $(date '+%Y-%m-%d') — Cycle $CYCLE"
      echo ""
      echo "- **Start:** $(date -r "$CYCLE_START" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date '+%Y-%m-%d %H:%M:%S')"
      echo "- **Duration:** ${CYCLE_DURATION}s"
      echo "- **Style:** ${STYLE}"
      echo "- **Exit code:** $EXIT_CODE"
      echo ""
      echo "$OUTPUT"
      echo ""
      echo "---"
      echo ""
    } >> "$LOG_FILE"
  else
    log "Skipping log append (no progress since last cycle)"
  fi

  if [[ $EXIT_CODE -ne 0 ]]; then
    error "Claude CLI exited with code $EXIT_CODE"
    error "Check stderr: $CYCLE_STDERR"
    warn "Continuing to next cycle despite error..."
    continue
  fi

  log "Cycle $CYCLE completed in ${CYCLE_DURATION}s"
  log "Progress: ${COMPLETE_COUNT}/${TOTAL_COUNT} tasks complete"

  # ── Exit condition 1: PRD says all tasks are done ──────────────────────
  if [[ "$INCOMPLETE_COUNT" -eq 0 ]]; then
    echo ""
    success "${BOLD}All tasks complete! (verified from PRD file)${NC}"
    log "PRD $PRD_BASENAME is fully implemented."
    break
  fi

  # ── Exit condition 2: stale — no progress for MAX_STALE consecutive cycles
  if [[ "$STALE_CYCLES" -ge "$MAX_STALE" ]]; then
    echo ""
    warn "No progress for $STALE_CYCLES consecutive cycles. Stopping."
    warn "Remaining: $INCOMPLETE_COUNT/$TOTAL_COUNT tasks incomplete."
    warn "The model may not be following the loop protocol correctly."
    break
  fi

  # ── Check for completion signals (informational) ───────────────────────
  LAST_LINES=$(echo "$OUTPUT" | tail -5)

  if echo "$LAST_LINES" | grep -q "ALL_TASKS_COMPLETE"; then
    # Signal says done but PRD disagrees (we already checked above)
    warn "Model signaled ALL_TASKS_COMPLETE but $INCOMPLETE_COUNT tasks remain."
    warn "Continuing..."
  elif echo "$LAST_LINES" | grep -q "CYCLE_COMPLETE"; then
    success "Cycle $CYCLE done. More tasks remain."
  else
    warn "No completion signal detected in output (model may not support loop protocol)."
  fi

  # ── Delay before next cycle ────────────────────────────────────────────
  if [[ "$DELAY" -gt 0 ]]; then
    log "Waiting ${DELAY}s before next cycle... (Ctrl+C to stop)"
    sleep "$DELAY"
  fi
done

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  Session Summary${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  PRD:           ${CYAN}${PRD_BASENAME}${NC}"
echo -e "  Cycles run:    ${CYAN}${CYCLE}${NC}"
echo -e "  Style:         ${CYAN}${STYLE}${NC}"
echo -e "  Log:           ${CYAN}${LOG_FILE}${NC}"

# Final progress
INCOMPLETE_COUNT=$(grep -c '"implemented": false' "$PRD_FILE" 2>/dev/null || true)
TOTAL_COUNT=$(grep -c '"implemented":' "$PRD_FILE" 2>/dev/null || true)
COMPLETE_COUNT=$((TOTAL_COUNT - INCOMPLETE_COUNT))
echo -e "  Final status:  ${CYAN}${COMPLETE_COUNT}/${TOTAL_COUNT} tasks complete${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
