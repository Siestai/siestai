import { describe, it, expect, vi } from 'vitest';

// Mock the @livekit/agents module before importing Agent
vi.mock('@livekit/agents', () => ({
  voice: {
    Agent: class MockAgent {
      instructions: string;
      constructor(opts: { instructions: string }) {
        this.instructions = opts.instructions;
      }
    },
  },
}));

import { Agent } from '../agent.js';

describe('Agent', () => {
  it('should instantiate without errors', () => {
    const agent = new Agent();
    expect(agent).toBeDefined();
  });

  it('should set instructions string on construction', () => {
    const agent = new Agent();
    expect(typeof agent.instructions).toBe('string');
    expect(agent.instructions.length).toBeGreaterThan(0);
  });

  it('should include "concise" in instructions', () => {
    const agent = new Agent();
    expect(agent.instructions.toLowerCase()).toContain('concise');
  });

  it('should include "no emojis" in instructions', () => {
    const agent = new Agent();
    expect(agent.instructions.toLowerCase()).toContain('no emojis');
  });

  it('should include "no markdown" in instructions', () => {
    const agent = new Agent();
    expect(agent.instructions.toLowerCase()).toContain('no markdown');
  });

  it('should include "natural spoken language" in instructions', () => {
    const agent = new Agent();
    expect(agent.instructions.toLowerCase()).toContain('natural spoken language');
  });

  it('should include "helpful" and "friendly" in instructions', () => {
    const agent = new Agent();
    const lower = agent.instructions.toLowerCase();
    expect(lower).toContain('helpful');
    expect(lower).toContain('friendly');
  });
});
