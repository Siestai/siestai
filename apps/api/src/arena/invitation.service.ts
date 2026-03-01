import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

export interface InvitePayload {
  sessionId: string;
  role: 'agent' | 'host';
}

@Injectable()
export class InvitationService {
  constructor(private readonly configService: ConfigService) {}

  private getSecret(): string {
    const secret = this.configService.get<string>('ARENA_INVITE_SECRET');
    if (!secret) {
      throw new Error('ARENA_INVITE_SECRET is not configured');
    }
    return secret;
  }

  generateInvite(
    sessionId: string,
    expiresInSeconds = 3600,
  ): { token: string; expiresAt: string } {
    const expiresAt = new Date(
      Date.now() + expiresInSeconds * 1000,
    ).toISOString();

    const token = jwt.sign(
      { sessionId, role: 'agent' } satisfies InvitePayload,
      this.getSecret(),
      { expiresIn: expiresInSeconds },
    );

    return { token, expiresAt };
  }

  generateHostToken(sessionId: string): string {
    return jwt.sign(
      { sessionId, role: 'host' } satisfies InvitePayload,
      this.getSecret(),
      { expiresIn: 3600 },
    );
  }

  validateInvite(token: string): InvitePayload {
    try {
      const decoded = jwt.verify(token, this.getSecret()) as InvitePayload;
      return { sessionId: decoded.sessionId, role: decoded.role };
    } catch {
      throw new UnauthorizedException('Invalid or expired invite token');
    }
  }

  buildInviteUrl(token: string): string {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:3000';
    return `${frontendUrl}/arena/join?t=${token}`;
  }
}
