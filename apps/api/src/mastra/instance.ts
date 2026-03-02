import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';
import { Observability, DefaultExporter } from '@mastra/observability';
import { agentChatWorkflow } from './workflows/agent-chat.workflow';

const defaultAgent = new Agent({
  id: 'default-agent',
  name: 'Default Agent',
  instructions:
    'You are a helpful AI assistant. Respond clearly and concisely.',
  model: 'anthropic/claude-sonnet-4-6',
});

const storage = new PostgresStore({
  id: 'siestai-storage',
  connectionString: process.env.DATABASE_URL!,
});

export const chatMemory = new Memory({
  storage,
  options: {
    lastMessages: 20,
  },
});

export const mastra = new Mastra({
  agents: {
    defaultAgent,
  },
  workflows: {
    agentChatWorkflow,
  },
  server: {
    port: 4111,
  },
  storage,
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'siestai',
        exporters: [new DefaultExporter()],
      },
    },
  }),
});

export default mastra;
