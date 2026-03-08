import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessToken,
  AgentDispatchClient,
  RoomServiceClient,
} from 'livekit-server-sdk';
import {
  DataPacket_Kind,
  RoomAgentDispatch,
  RoomConfiguration,
} from '@livekit/protocol';
import { CreateTokenDto } from './dto/create-token.dto';
// TODO: Consider moving ArenaSession to a shared types folder if more cross-module deps emerge
import { ArenaSession } from '../arena/arena.interfaces';
import { randomBytes } from 'crypto';

@Injectable()
export class LivekitService {
  private roomService: RoomServiceClient;
  private dispatchService: AgentDispatchClient;
  private readonly isLocal: boolean;
  private readonly livekitUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  private static readonly LOCAL_DEFAULTS = {
    url: 'ws://localhost:7880',
    apiKey: 'devkey',
    apiSecret: 'secret',
  };

  constructor(private readonly configService: ConfigService) {
    this.isLocal =
      this.configService.get<string>('LIVEKIT_ENVIRONMENT') === 'local';

    this.livekitUrl = this.isLocal
      ? LivekitService.LOCAL_DEFAULTS.url
      : this.configService.get<string>('LIVEKIT_URL') || '';
    this.apiKey = this.isLocal
      ? LivekitService.LOCAL_DEFAULTS.apiKey
      : this.configService.get<string>('LIVEKIT_API_KEY') || '';
    this.apiSecret = this.isLocal
      ? LivekitService.LOCAL_DEFAULTS.apiSecret
      : this.configService.get<string>('LIVEKIT_API_SECRET') || '';

    const httpUrl = this.livekitUrl
      .replace('wss://', 'https://')
      .replace('ws://', 'http://');
    this.roomService = new RoomServiceClient(httpUrl, this.apiKey, this.apiSecret);
    this.dispatchService = new AgentDispatchClient(httpUrl, this.apiKey, this.apiSecret);
  }

  /** Strip characters that aren't alphanumeric, hyphens, or underscores. */
  private sanitize(value: string): string {
    return value.replace(/[^a-zA-Z0-9\-_]/g, '');
  }

  async generateToken(
    dto: CreateTokenDto,
  ): Promise<{ token: string; serverUrl: string; roomName: string }> {
    if (!this.apiKey || !this.apiSecret || !this.livekitUrl) {
      throw new InternalServerErrorException('LiveKit not configured');
    }

    const roomName = this.sanitize(dto.roomName);
    const identity = this.sanitize(dto.identity);

    const at = new AccessToken(this.apiKey, this.apiSecret, {
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
      serverUrl: this.livekitUrl,
      roomName,
    };
  }

  async generateArenaToken(
    session: ArenaSession,
    agentMemories?: Map<string, string>,
    agentToolDefs?: Map<string, { slug: string; name: string; description: string }[]>,
    sessionContinuity?: string,
    agentTeamNames?: Map<string, string[]>,
    isFirstTeamMeeting?: boolean,
  ): Promise<{ token: string; serverUrl: string; roomName: string }> {
    if (!this.apiKey || !this.apiSecret || !this.livekitUrl) {
      throw new InternalServerErrorException('LiveKit not configured');
    }

    const roomName = `arena-${randomBytes(4).toString('hex')}`;
    const identity = `user-${randomBytes(4).toString('hex')}`;

    const backendUrl =
      this.configService.get<string>('BACKEND_URL') || 'http://localhost:4200';

    const toolSecret =
      this.configService.get<string>('AGENT_TOOL_SECRET') || '';

    const metadata = JSON.stringify({
      type: 'arena',
      agents: session.participants
        .filter((p) => p.type === 'native_agent')
        .map((p) => ({
          name: p.name,
          instructions: p.instructions || '',
          ...(agentMemories?.get(p.name) && {
            memories: agentMemories.get(p.name),
          }),
          ...(agentToolDefs?.get(p.name) && {
            tools: agentToolDefs.get(p.name),
          }),
          ...(agentTeamNames?.get(p.name) && {
            teamNames: agentTeamNames.get(p.name),
          }),
        })),
      mode: session.mode,
      topic: session.topic,
      participationMode: session.participationMode,
      sessionId: session.id,
      backendUrl,
      ...(toolSecret && { toolSecret }),
      ...(sessionContinuity && { sessionContinuity }),
      ...(isFirstTeamMeeting && { isFirstTeamMeeting: true }),
    });

    if (Buffer.byteLength(metadata, 'utf8') > 60 * 1024) {
      throw new InternalServerErrorException(
        'Arena room metadata exceeds 60KB limit',
      );
    }

    await this.roomService.createRoom({ name: roomName, metadata });
    await this.dispatchService.createDispatch(roomName, 'siestai-agent');

    const at = new AccessToken(this.apiKey, this.apiSecret, { identity });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: session.participationMode === 'human_collab',
      canSubscribe: true,
      canPublishData: true,
    });

    // No roomConfig here — agent was already dispatched explicitly above.
    // Adding RoomAgentDispatch on the token would cause a duplicate dispatch
    // when the user joins, resulting in two competing agents in the room.

    return {
      token: await at.toJwt(),
      serverUrl: this.livekitUrl,
      roomName,
    };
  }

  async sendDataToRoom(
    roomName: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const data = new TextEncoder().encode(JSON.stringify(payload));
    await this.roomService.sendData(roomName, data, DataPacket_Kind.RELIABLE, {
      topic: 'external-agent-msg',
    });
  }
}
