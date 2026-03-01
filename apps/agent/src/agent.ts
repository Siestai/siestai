import { voice } from '@livekit/agents';

const SYSTEM_INSTRUCTIONS = [
  'You are a concise conversational assistant.',
  'Respond using natural spoken language — no complex formatting, no emojis, no markdown.',
  'Keep your answers short and to the point.',
  'Be helpful and friendly.',
].join(' ');

export class Agent extends voice.Agent {
  constructor() {
    super({ instructions: SYSTEM_INSTRUCTIONS });
  }
}
