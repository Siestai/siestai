export const DIRECT_PROVIDER_CONFIG = {
  sttModel: 'gpt-4o-transcribe',
  llmModel: 'gpt-4.1-mini',
  ttsModel: 'gpt-4o-mini-tts',
  singleAgentVoice: 'alloy',
} as const;

/**
 * Default intervention scoring thresholds.
 * These can be overridden per-session via room metadata.
 */
export const INTERVENTION_DEFAULTS = {
  vadWeight: 0.30,
  questionWeight: 0.25,
  turnWeight: 0.25,
  completenessWeight: 0.20,
  threshold: 0.45,
  cooldownMs: 2000,
  silenceCeilingMs: 5000,
} as const;
