import { Agent } from '@mastra/core/agent';

export const defaultAgent = new Agent({
  id: 'default-agent',
  name: 'Default Agent',
  instructions:
    'You are a helpful AI assistant. Respond clearly and concisely.',
  model: 'openai/gpt-4.1-mini',
});
