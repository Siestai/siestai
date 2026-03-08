import { log } from '@livekit/agents';

const getLogger = () => log();

/**
 * Configuration for the intervention scoring system.
 * All weights should sum to roughly 1.0 for the score to be interpretable.
 */
export interface InterventionConfig {
  /** Weight for VAD-based signal (human speaking state) */
  vadWeight: number;
  /** Weight for question detection */
  questionWeight: number;
  /** Weight for turn dynamics (decay with consecutive turns) */
  turnWeight: number;
  /** Weight for conversation completeness (e.g. [DONE] signals) */
  completenessWeight: number;
  /** Score threshold — intervene only if score > this value */
  threshold: number;
  /** Minimum ms between agent turns */
  cooldownMs: number;
  /** After this many ms of silence, VAD signal maxes out */
  silenceCeilingMs: number;
}

export const DEFAULT_INTERVENTION_CONFIG: InterventionConfig = {
  vadWeight: 0.30,
  questionWeight: 0.25,
  turnWeight: 0.25,
  completenessWeight: 0.20,
  threshold: 0.45,
  cooldownMs: 2000,
  silenceCeilingMs: 5000,
};

export interface InterventionSignals {
  /** Is the human currently speaking (VAD active)? */
  humanSpeaking: boolean;
  /** Milliseconds since human last stopped speaking (0 if currently speaking) */
  silenceDurationMs: number;
  /** Number of consecutive agent turns without human input */
  consecutiveAgentTurns: number;
  /** The last assistant response text */
  lastAssistantText: string;
  /** Whether the last text contains a question mark or question-like pattern */
  questionDetected?: boolean;
  /** Whether the conversation point seems complete ([DONE] or similar) */
  conversationComplete?: boolean;
  /** Timestamp of last agent turn */
  lastAgentTurnMs: number;
}

export interface InterventionDecision {
  shouldIntervene: boolean;
  score: number;
  components: {
    vad: number;
    question: number;
    turn: number;
    completeness: number;
  };
  reason: string;
  cooldownActive: boolean;
}

/**
 * Simple question detection heuristics.
 * Detects direct questions, question marks, and question-initiating patterns.
 */
function detectQuestion(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();

  // Explicit question mark
  if (trimmed.endsWith('?')) return true;

  // Common question starters (after stripping speaker tag)
  const cleaned = trimmed.replace(/^\[[^\]]+\]:\s*/, '').toLowerCase();
  const questionStarters = [
    'what ', 'how ', 'why ', 'when ', 'where ', 'who ',
    'which ', 'could ', 'would ', 'should ', 'can ', 'do ',
    'does ', 'is ', 'are ', 'will ', 'don\'t you think',
    'what do you', 'what about', 'thoughts on',
  ];

  return questionStarters.some((s) => cleaned.startsWith(s));
}

/**
 * Detect if the conversation point seems exhausted.
 * Looks for agreement patterns, repetition indicators, and short responses.
 */
function detectCompleteness(text: string, consecutiveTurns: number): boolean {
  if (!text) return false;
  const cleaned = text.replace(/^\[[^\]]+\]:\s*/, '').toLowerCase().trim();

  // Explicit completion signal
  if (cleaned.includes('[done]')) return true;

  // Very short response after multiple turns suggests exhaustion
  if (consecutiveTurns >= 3 && cleaned.length < 50) return true;

  // Agreement patterns that signal convergence
  const agreementPatterns = [
    'i agree', 'exactly', 'that\'s right', 'well said',
    'good point', 'absolutely', 'that sums it up',
    'nothing to add', 'i think we\'re aligned',
  ];
  if (consecutiveTurns >= 2 && agreementPatterns.some((p) => cleaned.includes(p))) {
    return true;
  }

  return false;
}

/**
 * Rule-based intervention scorer inspired by GroupGPT's intervention judge.
 * 
 * Instead of using an LLM to decide "should the agent speak?", this uses
 * a weighted score from real-time signals:
 * 
 * - VAD state: never interrupt a speaking human
 * - Question detection: respond when asked something
 * - Turn dynamics: decay enthusiasm with consecutive turns
 * - Completeness: stop when the point is made
 * 
 * Siestai's advantage over GroupGPT: LiveKit VAD provides real-time voice
 * activity detection that no text framework has access to.
 */
export class InterventionScorer {
  private config: InterventionConfig;
  private humanSpeaking = false;
  private lastSpeechEndMs = 0;
  private lastAgentTurnMs = 0;
  private consecutiveAgentTurns = 0;
  private lastAssistantText = '';
  private decisionCount = 0;

  constructor(config?: Partial<InterventionConfig>) {
    this.config = { ...DEFAULT_INTERVENTION_CONFIG, ...config };
  }

  // ─── Signal Updates ─────────────────────────────────────────────

  /** Called when VAD detects human speech start */
  onHumanSpeechStart(): void {
    this.humanSpeaking = true;
  }

  /** Called when VAD detects human speech end */
  onHumanSpeechEnd(): void {
    this.humanSpeaking = false;
    this.lastSpeechEndMs = Date.now();
    // Human spoke — reset consecutive agent turns
    this.consecutiveAgentTurns = 0;
  }

  /** Called when an agent turn completes */
  onAgentTurn(text: string): void {
    this.consecutiveAgentTurns++;
    this.lastAgentTurnMs = Date.now();
    this.lastAssistantText = text;
  }

  /** Called when human provides text input (non-voice) */
  onHumanInput(): void {
    this.consecutiveAgentTurns = 0;
  }

  // ─── Scoring ────────────────────────────────────────────────────

  /**
   * Compute the intervention score and decide whether an agent should speak.
   * 
   * Returns a detailed decision object with score breakdown for logging.
   */
  evaluate(): InterventionDecision {
    this.decisionCount++;
    const now = Date.now();

    // ── Hard veto: human is speaking ──
    if (this.humanSpeaking) {
      return this.makeDecision(false, 0, { vad: 0, question: 0, turn: 0, completeness: 0 }, 'Human is speaking (VAD active)');
    }

    // ── Cooldown check ──
    const sinceLastAgent = now - this.lastAgentTurnMs;
    if (sinceLastAgent < this.config.cooldownMs) {
      return this.makeDecision(false, 0, { vad: 0, question: 0, turn: 0, completeness: 0 }, `Cooldown active (${sinceLastAgent}ms < ${this.config.cooldownMs}ms)`, true);
    }

    // ── VAD signal: 0.0 if just stopped, ramps to 1.0 with silence ──
    const silenceMs = this.lastSpeechEndMs > 0 ? now - this.lastSpeechEndMs : this.config.silenceCeilingMs;
    const vadSignal = Math.min(silenceMs / this.config.silenceCeilingMs, 1.0);

    // ── Question signal ──
    const questionDetected = detectQuestion(this.lastAssistantText);
    const questionSignal = questionDetected ? 1.0 : 0.0;

    // ── Turn decay: enthusiasm drops with consecutive turns ──
    // 1.0 for first turn, decays exponentially
    const turnSignal = Math.max(0, 1.0 - (this.consecutiveAgentTurns * 0.2));

    // ── Completeness: negative signal when conversation is exhausted ──
    const isComplete = detectCompleteness(this.lastAssistantText, this.consecutiveAgentTurns);
    const completenessSignal = isComplete ? 0.0 : 1.0;

    // ── Weighted score ──
    const components = {
      vad: vadSignal * this.config.vadWeight,
      question: questionSignal * this.config.questionWeight,
      turn: turnSignal * this.config.turnWeight,
      completeness: completenessSignal * this.config.completenessWeight,
    };

    const score = components.vad + components.question + components.turn + components.completeness;
    const shouldIntervene = score > this.config.threshold;

    const reason = shouldIntervene
      ? `Score ${score.toFixed(3)} > threshold ${this.config.threshold} (vad=${vadSignal.toFixed(2)}, q=${questionSignal}, turns=${this.consecutiveAgentTurns}, complete=${isComplete})`
      : `Score ${score.toFixed(3)} ≤ threshold ${this.config.threshold} (vad=${vadSignal.toFixed(2)}, q=${questionSignal}, turns=${this.consecutiveAgentTurns}, complete=${isComplete})`;

    return this.makeDecision(shouldIntervene, score, components, reason);
  }

  private makeDecision(
    shouldIntervene: boolean,
    score: number,
    components: InterventionDecision['components'],
    reason: string,
    cooldownActive = false,
  ): InterventionDecision {
    const decision: InterventionDecision = {
      shouldIntervene,
      score,
      components,
      reason,
      cooldownActive,
    };

    // Log every decision for future ML training data
    getLogger().info(
      {
        decision: shouldIntervene ? 'INTERVENE' : 'SKIP',
        score: score.toFixed(3),
        ...components,
        consecutiveAgentTurns: this.consecutiveAgentTurns,
        humanSpeaking: this.humanSpeaking,
        cooldownActive,
        decisionNumber: this.decisionCount,
      },
      `[SIT] ${reason}`,
    );

    return decision;
  }

  // ─── Accessors ──────────────────────────────────────────────────

  get isHumanSpeaking(): boolean {
    return this.humanSpeaking;
  }

  get currentConsecutiveTurns(): number {
    return this.consecutiveAgentTurns;
  }

  get totalDecisions(): number {
    return this.decisionCount;
  }
}
