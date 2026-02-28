import { Mastra } from '@mastra/core';
import { PostgresStore } from '@mastra/pg';

import { defaultAgent } from './agents/default-agent.js';

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
