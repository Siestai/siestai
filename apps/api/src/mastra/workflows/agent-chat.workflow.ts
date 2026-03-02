import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const chatInputSchema = z.object({
  agentKey: z.string(),
  messages: z.array(z.record(z.unknown())),
  userId: z.string(),
  agentId: z.string(),
  threadId: z.string(),
});

const chatOutputSchema = z.object({ text: z.string() });

const agentChatStep = createStep({
  id: 'agent-chat',
  inputSchema: chatInputSchema,
  outputSchema: chatOutputSchema,
  execute: async ({ inputData, mastra, writer }) => {
    if (!mastra) {
      throw new Error('Mastra instance not available in workflow step');
    }

    const agent = mastra.getAgent(inputData.agentKey as any);
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
  inputSchema: chatInputSchema,
  outputSchema: chatOutputSchema,
})
  .then(agentChatStep)
  .commit();
