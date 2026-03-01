import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { PostgresStore } from '@mastra/pg';

const defaultAgent = new Agent({
  id: 'default-agent',
  name: 'Default Agent',
  instructions:
    'You are a helpful AI assistant. Respond clearly and concisely.',
  model: 'anthropic/claude-sonnet-4-6',
});

export const mastra = new Mastra({
  agents: {
    defaultAgent,
  },
  storage: new PostgresStore({
    id: 'siestai-storage',
    connectionString: process.env.DATABASE_URL!,
  }),
});

export default mastra;
