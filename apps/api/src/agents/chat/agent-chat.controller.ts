import { Body, Controller, Param, Post, Res } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';
import { createUIMessageStream, pipeUIMessageStreamToResponse } from 'ai';
import { toAISdkStream } from '@mastra/ai-sdk';
import { AgentChatService } from './agent-chat.service';
import { AgentChatDto } from './agent-chat.dto';

@Controller('agents')
export class AgentChatController {
  constructor(private readonly chatService: AgentChatService) {}

  @Post(':id/chat')
  async chat(
    @Param('id') id: string,
    @Session() session: UserSession,
    @Body() dto: AgentChatDto,
    @Res() res: Response,
  ) {
    const { workflowStream, ephemeralKey } = await this.chatService.streamChat(
      id,
      dto.messages,
      session.user.id,
    );

    const uiStream = createUIMessageStream({
      originalMessages: dto.messages,
      execute: async ({ writer }) => {
        try {
          for await (const part of toAISdkStream(workflowStream as any, {
            from: 'workflow',
          })) {
            await writer.write(part);
          }
        } finally {
          this.chatService.cleanupEphemeral(ephemeralKey);
        }
      },
    });

    pipeUIMessageStreamToResponse({ response: res, stream: uiStream });
  }
}
