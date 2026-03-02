import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const agentChatStep = createStep({
  id: 'agent-chat',
  inputSchema: z.object({
    agentKey: z.string(),
    messages: z.array(z.any()),
    userId: z.string(),
    agentId: z.string(),
    threadId: z.string(),
  }),
  outputSchema: z.object({ text: z.string() }),
  execute: async ({ inputData, mastra, writer }) => {
    const agent = mastra!.getAgent(inputData.agentKey as any);
    const response = await agent.stream(inputData.messages as any, {
      maxSteps: 5,
      memory: {
        thread: {
          id: inputData.threadId,
          metadata: { agentId: inputData.agentId },
        },
        resource: inputData.userId,
      },
    });

    await response.fullStream.pipeTo(writer!);
    return { text: await response.text };
  },
});

export const agentChatWorkflow = createWorkflow({
  id: 'agent-chat-workflow',
  inputSchema: z.object({
    agentKey: z.string(),
    messages: z.array(z.any()),
    userId: z.string(),
    agentId: z.string(),
    threadId: z.string(),
  }),
  outputSchema: z.object({ text: z.string() }),
})
  .then(agentChatStep)
  .commit();
