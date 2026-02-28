import { describe, expect, it } from 'vitest';
import { DIRECT_PROVIDER_CONFIG } from '../provider-config.js';

describe('DIRECT_PROVIDER_CONFIG', () => {
  it('uses direct OpenAI model names', () => {
    expect(DIRECT_PROVIDER_CONFIG.sttModel).toBe('gpt-4o-transcribe');
    expect(DIRECT_PROVIDER_CONFIG.llmModel).toBe('gpt-4.1-mini');
    expect(DIRECT_PROVIDER_CONFIG.ttsModel).toBe('gpt-4o-mini-tts');
  });

  it('does not use LiveKit inference-prefixed model IDs', () => {
    expect(DIRECT_PROVIDER_CONFIG.sttModel.startsWith('deepgram/')).toBe(false);
    expect(DIRECT_PROVIDER_CONFIG.llmModel.startsWith('openai/')).toBe(false);
    expect(DIRECT_PROVIDER_CONFIG.ttsModel.startsWith('cartesia/')).toBe(false);
  });
});
