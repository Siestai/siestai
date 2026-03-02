import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from 'crypto';
import { db, toolCredentials, tools, eq, and } from '@siestai/db';

interface OAuthProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  extraAuthParams?: Record<string, string>;
}

interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
}

@Injectable()
export class OAuthService {
  constructor(private readonly configService: ConfigService) {}

  // ── Encryption ──────────────────────────────────────────────

  private getEncryptionKey(): Buffer {
    const secret = this.configService.get<string>('BETTER_AUTH_SECRET');
    if (!secret) throw new Error('BETTER_AUTH_SECRET is not configured');
    return createHash('sha256').update(secret).digest();
  }

  encrypt(plaintext: string): string {
    const key = this.getEncryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(ciphertext: string): string {
    const key = this.getEncryptionKey();
    const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':');
    if (!ivHex || !authTagHex || !encryptedHex) {
      throw new BadRequestException('Invalid encrypted value');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }

  // ── HMAC state (now includes userId) ─────────────────────────

  private signState(toolSlug: string, userId: string): string {
    const secret = this.configService.get<string>('BETTER_AUTH_SECRET')!;
    const payload = `${toolSlug}:${userId}`;
    const hmac = createHmac('sha256', secret).update(payload).digest('hex');
    return `${payload}:${hmac}`;
  }

  private verifyState(state: string): { slug: string; userId: string } {
    const parts = state.split(':');
    if (parts.length !== 3) throw new BadRequestException('Invalid OAuth state');
    const [slug, userId, _hmac] = parts;
    const expected = this.signState(slug, userId);
    if (state !== expected) throw new BadRequestException('Invalid OAuth state');
    return { slug, userId };
  }

  // ── Provider config ─────────────────────────────────────────

  private getProviderConfig(
    oauthProvider: string,
    requiredScopes: string[],
  ): OAuthProviderConfig {
    if (oauthProvider === 'github') {
      return {
        authorizeUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        clientId:
          this.configService.get<string>('GITHUB_TOOLS_CLIENT_ID') || '',
        clientSecret:
          this.configService.get<string>('GITHUB_TOOLS_CLIENT_SECRET') || '',
      };
    }
    if (oauthProvider === 'google') {
      return {
        authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        clientId:
          this.configService.get<string>('GOOGLE_TOOLS_CLIENT_ID') || '',
        clientSecret:
          this.configService.get<string>('GOOGLE_TOOLS_CLIENT_SECRET') || '',
        extraAuthParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      };
    }
    throw new BadRequestException(`Unknown OAuth provider: ${oauthProvider}`);
  }

  // ── Authorization URL ───────────────────────────────────────

  getAuthorizationUrl(
    toolSlug: string,
    oauthProvider: string,
    requiredScopes: string[],
    userId: string,
  ): string {
    const config = this.getProviderConfig(oauthProvider, requiredScopes);
    const backendUrl =
      this.configService.get<string>('BETTER_AUTH_URL') ||
      'http://localhost:4200';
    const redirectUri = `${backendUrl}/tools/oauth/callback`;
    const state = this.signState(toolSlug, userId);

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      state,
      scope: requiredScopes.join(' '),
      response_type: 'code',
      ...config.extraAuthParams,
    });

    return `${config.authorizeUrl}?${params.toString()}`;
  }

  // ── Token exchange ──────────────────────────────────────────

  async exchangeCode(
    toolSlug: string,
    code: string,
  ): Promise<TokenResponse> {
    const tool = await this.getToolBySlug(toolSlug);
    if (!tool.oauthProvider) {
      throw new BadRequestException('Tool does not support OAuth');
    }

    const config = this.getProviderConfig(
      tool.oauthProvider,
      tool.requiredScopes ?? [],
    );
    const backendUrl =
      this.configService.get<string>('BETTER_AUTH_URL') ||
      'http://localhost:4200';
    const redirectUri = `${backendUrl}/tools/oauth/callback`;

    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const res = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`Token exchange failed: ${text}`);
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? undefined,
      expiresIn: data.expires_in ?? undefined,
      scope: data.scope ?? undefined,
    };
  }

  // ── Token refresh ───────────────────────────────────────────

  async refreshToken(toolSlug: string, userId: string): Promise<string> {
    const tool = await this.getToolBySlug(toolSlug);
    if (!tool.oauthProvider) {
      throw new BadRequestException('Tool does not support OAuth');
    }

    const credential = await this.getCredentialForTool(tool.id, userId);
    if (!credential?.refreshToken) {
      throw new BadRequestException('No refresh token available');
    }

    const config = this.getProviderConfig(
      tool.oauthProvider,
      tool.requiredScopes ?? [],
    );

    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: this.decrypt(credential.refreshToken),
      grant_type: 'refresh_token',
    });

    const res = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`Token refresh failed: ${text}`);
    }

    const data = await res.json();
    const newAccessToken: string = data.access_token;
    const newRefreshToken: string | undefined = data.refresh_token;
    const expiresIn: number | undefined = data.expires_in;

    // Update stored credential
    const tokenExpiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : null;

    await db
      .update(toolCredentials)
      .set({
        accessToken: this.encrypt(newAccessToken),
        ...(newRefreshToken
          ? { refreshToken: this.encrypt(newRefreshToken) }
          : {}),
        tokenExpiresAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(toolCredentials.toolId, tool.id),
          eq(toolCredentials.userId, userId),
        ),
      );

    return newAccessToken;
  }

  // ── Get valid token (auto-refresh) ──────────────────────────

  async getValidToken(toolSlug: string, userId: string): Promise<string> {
    const tool = await this.getToolBySlug(toolSlug);
    const credential = await this.getCredentialForTool(tool.id, userId);
    if (!credential) {
      throw new NotFoundException(
        `No credentials found for tool "${toolSlug}"`,
      );
    }

    // Check if token is expired (with 5-minute buffer)
    if (
      credential.tokenExpiresAt &&
      credential.tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000
    ) {
      if (credential.refreshToken) {
        return this.refreshToken(toolSlug, userId);
      }
      throw new BadRequestException(
        `Token for "${toolSlug}" is expired and no refresh token is available`,
      );
    }

    return this.decrypt(credential.accessToken);
  }

  // ── Verify OAuth state ──────────────────────────────────────

  verifyOAuthState(state: string): { slug: string; userId: string } {
    return this.verifyState(state);
  }

  // ── Helpers ─────────────────────────────────────────────────

  private async getToolBySlug(slug: string) {
    const rows = await db.select().from(tools).where(eq(tools.slug, slug));
    if (rows.length === 0) {
      throw new NotFoundException(`Tool with slug "${slug}" not found`);
    }
    return rows[0];
  }

  private async getCredentialForTool(toolId: string, userId: string) {
    const rows = await db
      .select()
      .from(toolCredentials)
      .where(
        and(
          eq(toolCredentials.toolId, toolId),
          eq(toolCredentials.userId, userId),
        ),
      );
    return rows[0] ?? null;
  }
}
