import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { InvitationService } from './invitation.service';
import { CreateArenaSessionDto } from './dto/create-arena-session.dto';
import {
  ArenaSession,
  ArenaParticipant,
  ArenaParticipantStatus,
} from './arena.interfaces';

const AGENT_COLORS = [
  '#3b82f6',
  '#22c55e',
  '#eab308',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
];

@Injectable()
export class ArenaService {
  private sessions = new Map<string, ArenaSession>();

  constructor(private readonly invitationService: InvitationService) {}

  createSession(dto: CreateArenaSessionDto): {
    session: ArenaSession;
    invite: { token: string; url: string; expiresAt: string };
    hostToken: string;
  } {
    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3600 * 1000).toISOString();

    const participants: ArenaParticipant[] = (dto.nativeAgents || []).map(
      (agent, i) => ({
        id: uuidv4(),
        name: agent.name,
        type: 'native_agent' as const,
        instructions: agent.instructions,
        status: 'invited' as const,
        color: AGENT_COLORS[i % AGENT_COLORS.length],
      }),
    );

    const session: ArenaSession = {
      id: sessionId,
      topic: dto.topic,
      mode: (dto.mode as ArenaSession['mode']) || 'group',
      participationMode:
        (dto.participationMode as ArenaSession['participationMode']) ||
        'human_collab',
      status: 'waiting',
      participants,
      createdAt: now.toISOString(),
      expiresAt,
    };

    this.sessions.set(sessionId, session);

    const invite = this.invitationService.generateInvite(sessionId);
    const url = this.invitationService.buildInviteUrl(invite.token);
    const hostToken = this.invitationService.generateHostToken(sessionId);

    return {
      session,
      invite: { token: invite.token, url, expiresAt: invite.expiresAt },
      hostToken,
    };
  }

  getSession(id: string): ArenaSession {
    const session = this.sessions.get(id);
    if (!session) {
      throw new NotFoundException(`Arena session ${id} not found`);
    }
    return session;
  }

  addExternalParticipant(
    sessionId: string,
    name: string,
    platform?: string,
    model?: string,
  ): ArenaParticipant {
    const session = this.getSession(sessionId);

    const colorIndex =
      session.participants.length % AGENT_COLORS.length;

    const participant: ArenaParticipant = {
      id: uuidv4(),
      name,
      type: 'external_agent',
      platform,
      model,
      status: 'connected',
      color: AGENT_COLORS[colorIndex],
      joinedAt: new Date().toISOString(),
    };

    session.participants.push(participant);
    return participant;
  }

  updateParticipantStatus(
    sessionId: string,
    participantId: string,
    status: ArenaParticipantStatus,
  ): void {
    const session = this.getSession(sessionId);
    const participant = session.participants.find(
      (p) => p.id === participantId,
    );
    if (participant) {
      participant.status = status;
    }
  }

  startSession(sessionId: string, roomName: string): void {
    const session = this.getSession(sessionId);
    if (session.status !== 'waiting') {
      throw new BadRequestException(
        `Session ${sessionId} is not in 'waiting' status`,
      );
    }
    session.status = 'active';
    session.roomName = roomName;
  }

  endSession(sessionId: string): void {
    const session = this.getSession(sessionId);
    session.status = 'ended';
  }
}
