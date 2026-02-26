import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';
import { RoomAgentDispatch, RoomConfiguration } from '@livekit/protocol';
import { CreateTokenDto } from './dto/create-token.dto';

@Injectable()
export class LivekitService {
  constructor(private readonly configService: ConfigService) {}

  /** Strip characters that aren't alphanumeric, hyphens, or underscores. */
  private sanitize(value: string): string {
    return value.replace(/[^a-zA-Z0-9\-_]/g, '');
  }

  async generateToken(
    dto: CreateTokenDto,
  ): Promise<{ token: string; serverUrl: string; roomName: string }> {
    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET');

    const serverUrl = this.configService.get<string>('LIVEKIT_URL');

    if (!apiKey || !apiSecret || !serverUrl) {
      throw new InternalServerErrorException('LiveKit not configured');
    }

    const roomName = this.sanitize(dto.roomName);
    const identity = this.sanitize(dto.identity);

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: dto.participantName || identity,
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    at.roomConfig = new RoomConfiguration({
      agents: [new RoomAgentDispatch({ agentName: 'siestai-agent' })],
    });

    return {
      token: await at.toJwt(),
      serverUrl,
      roomName,
    };
  }
}
