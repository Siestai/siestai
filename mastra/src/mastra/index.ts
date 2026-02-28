import { Mastra } from '@mastra/core';
import { registerApiRoute } from '@mastra/core/server';
import { PostgresStore } from '@mastra/pg';

import {
  listAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
} from '../agents/agent-crud.js';
import { createRuntimeAgent } from '../agents/runtime.js';
import { defaultAgent } from './agents/default-agent.js';

export const mastra = new Mastra({
  agents: {
    defaultAgent,
  },
  storage: new PostgresStore({
    id: 'siestai-storage',
    connectionString: process.env.DATABASE_URL!,
  }),
  server: {
    apiRoutes: [
      registerApiRoute('/custom/agents', {
        method: 'GET',
        handler: async (c) => {
          const category = c.req.query('category');
          const search = c.req.query('search');
          const result = await listAgents({ category, search });
          return c.json(result);
        },
      }),

      registerApiRoute('/custom/agents/:id', {
        method: 'GET',
        handler: async (c) => {
          const id = c.req.param('id');
          try {
            const agent = await getAgent(id);
            return c.json(agent);
          } catch {
            return c.json({ error: 'Agent not found' }, 404);
          }
        },
      }),

      registerApiRoute('/custom/agents', {
        method: 'POST',
        handler: async (c) => {
          const body = await c.req.json();
          try {
            const agent = await createAgent(body);
            return c.json(agent, 201);
          } catch (err) {
            const message =
              err instanceof Error ? err.message : 'Failed to create agent';
            return c.json({ error: message }, 400);
          }
        },
      }),

      registerApiRoute('/custom/agents/:id', {
        method: 'PUT',
        handler: async (c) => {
          const id = c.req.param('id');
          const body = await c.req.json();
          try {
            const agent = await updateAgent(id, body);
            return c.json(agent);
          } catch {
            return c.json({ error: 'Agent not found' }, 404);
          }
        },
      }),

      registerApiRoute('/custom/agents/:id', {
        method: 'DELETE',
        handler: async (c) => {
          const id = c.req.param('id');
          try {
            await deleteAgent(id);
            return c.json({ ok: true });
          } catch {
            return c.json({ error: 'Agent not found' }, 404);
          }
        },
      }),

      registerApiRoute('/custom/agents/:id/stream', {
        method: 'POST',
        handler: async (c) => {
          const id = c.req.param('id');

          let agentRecord;
          try {
            agentRecord = await getAgent(id);
          } catch {
            return c.json({ error: 'Agent not found' }, 404);
          }

          const body = await c.req.json<{
            messages: { role: string; content: string }[];
          }>();

          const agent = createRuntimeAgent(agentRecord);
          const result = await agent.stream(
            body.messages as Parameters<typeof agent.stream>[0],
          );

          const encoder = new TextEncoder();
          const readable = new ReadableStream({
            async start(controller) {
              try {
                for await (const chunk of result.textStream) {
                  controller.enqueue(encoder.encode(chunk));
                }
                controller.close();
              } catch (err) {
                controller.error(err);
              }
            },
          });

          return new Response(readable, {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
            },
          });
        },
      }),
    ],
  },
});

export default mastra;
