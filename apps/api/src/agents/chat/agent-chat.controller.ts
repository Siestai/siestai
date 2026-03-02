import { Body, Controller, Param, Post, Res } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';
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
    const result = await this.chatService.streamChat(
      id,
      dto.messages,
      session.user.id,
    );

    result.pipeUIMessageStreamToResponse(res);
  }
}
