import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { IncomingMessage } from 'http';
import { WebSocket } from 'ws';
import { InvitationService, InvitePayload } from './invitation.service';
import { ArenaService } from './arena.service';
import { LivekitService } from '../livekit/livekit.service';
import { ArenaParticipant, ArenaSession } from './arena.interfaces';

interface ClientInfo {
  sessionId: string;
  participantId?: string;
  role: 'agent' | 'host';
}

interface WsClientIdentify {
  type: 'identify';
  name: string;
  platform?: string;
  model?: string;
}

interface WsClientMessage {
  type: 'message';
  text: string;
}

type WsClientPayload = WsClientIdentify | WsClientMessage;

@WebSocketGateway({ path: '/arena/ws' })
export class ArenaGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ArenaGateway.name);
  private clients = new Map<WebSocket, ClientInfo>();

  constructor(
    private readonly invitationService: InvitationService,
    private readonly arenaService: ArenaService,
    private readonly livekitService: LivekitService,
  ) {}

  async handleConnection(
    client: WebSocket,
    req: IncomingMessage,
  ): Promise<void> {
    let payload: InvitePayload;

    try {
      const url = new URL(req.url || '', 'http://localhost');
      const token = url.searchParams.get('token');
      if (!token) throw new Error('Missing token');
      payload = this.invitationService.validateInvite(token);
    } catch {
      client.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
      client.close();
      return;
    }

    let session: ArenaSession | null = null;
    try {
      session = await this.arenaService.getSession(payload.sessionId);
    } catch {
      // session remains null
    }

    if (!session) {
      client.send(
        JSON.stringify({ type: 'error', message: 'Session not found' }),
      );
      client.close();
      return;
    }

    const info: ClientInfo = {
      sessionId: payload.sessionId,
      role: payload.role,
    };

    let participant: ArenaParticipant | undefined;

    if (payload.role === 'agent') {
      try {
        // Try to find an existing participant from REST join (status: connected, no WS yet)
        const existing = session.participants.find(
          (p) =>
            p.type === 'external_agent' &&
            p.status === 'connected' &&
            !Array.from(this.clients.values()).some(
              (c) => c.participantId === p.id,
            ),
        );
        if (existing) {
          participant = existing;
        } else {
          participant = await this.arenaService.addExternalParticipant(
            payload.sessionId,
            `Agent-${Date.now()}`,
          );
        }
        info.participantId = participant.id;
      } catch (err) {
        this.logger.error(`Failed to register participant: ${err}`);
        client.send(
          JSON.stringify({ type: 'error', message: 'Failed to join session' }),
        );
        client.close();
        return;
      }
    }

    this.clients.set(client, info);

    client.send(
      JSON.stringify({
        type: 'welcome',
        sessionId: session.id,
        participants: session.participants,
      }),
    );

    if (participant) {
      this.broadcastToSession(
        payload.sessionId,
        {
          type: 'system',
          event: 'participant_joined',
          participant,
        },
        client,
      );
    }

    client.on('message', (raw: Buffer | string) => {
      this.handleClientMessage(client, raw);
    });
  }

  async handleDisconnect(client: WebSocket): Promise<void> {
    const info = this.clients.get(client);
    if (!info) return;

    if (info.role === 'agent' && info.participantId) {
      await this.arenaService.updateParticipantStatus(
        info.sessionId,
        info.participantId,
        'disconnected',
      );

      let session: ArenaSession | null = null;
      try {
        session = await this.arenaService.getSession(info.sessionId);
      } catch {
        // session may not exist anymore
      }

      const participant = session?.participants.find(
        (p) => p.id === info.participantId,
      );

      if (participant) {
        this.broadcastToSession(info.sessionId, {
          type: 'system',
          event: 'participant_left',
          participant,
        });
      }
    }

    this.clients.delete(client);
  }

  private async handleClientMessage(
    client: WebSocket,
    raw: Buffer | string,
  ): Promise<void> {
    const info = this.clients.get(client);
    if (!info || info.role !== 'agent') return;

    let msg: WsClientPayload;
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'identify') {
      if (info.participantId) {
        await this.arenaService.updateParticipantInfo(
          info.sessionId,
          info.participantId,
          {
            name: msg.name,
            platform: msg.platform,
            model: msg.model,
          },
        );
      }
    } else if (msg.type === 'message') {
      let session: ArenaSession | null = null;
      try {
        session = await this.arenaService.getSession(info.sessionId);
      } catch {
        // ignore
      }

      const participant = session?.participants.find(
        (p) => p.id === info.participantId,
      );
      const speaker = participant?.name || 'Unknown';

      this.broadcastToSession(
        info.sessionId,
        {
          type: 'agent_message',
          speaker,
          text: msg.text,
          timestamp: Date.now(),
        },
        client,
      );

      // Persist transcript (fire-and-forget)
      this.arenaService
        .saveTranscript(
          info.sessionId,
          speaker,
          'external_agent',
          msg.text,
          'websocket',
        )
        .catch(() => {});

      // Bridge to LiveKit data channel so voice agent can hear external agents
      if (session?.roomName) {
        this.livekitService
          .sendDataToRoom(session.roomName, {
            type: 'external_agent_message',
            speaker,
            text: msg.text,
          })
          .catch(() => {
            // Don't break WS flow if LiveKit send fails
          });
      }
    }
  }

  broadcastTranscript(
    sessionId: string,
    speaker: string,
    text: string,
    timestamp: number,
  ): void {
    this.broadcastToSession(sessionId, {
      type: 'transcript',
      speaker,
      text,
      timestamp,
    });
  }

  broadcastParticipantJoined(
    sessionId: string,
    participant: ArenaParticipant,
  ): void {
    this.broadcastToSession(sessionId, {
      type: 'system',
      event: 'participant_joined',
      participant,
    });
  }

  broadcastSessionStarted(sessionId: string, roomName: string): void {
    this.broadcastToSession(sessionId, {
      type: 'system',
      event: 'session_started',
      roomName,
    });
  }

  private broadcastToSession(
    sessionId: string,
    message: Record<string, unknown>,
    exclude?: WebSocket,
  ): void {
    const data = JSON.stringify(message);
    for (const [ws, info] of this.clients) {
      if (info.sessionId === sessionId && ws !== exclude && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }
}
