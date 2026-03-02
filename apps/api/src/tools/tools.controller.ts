import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AllowAnonymous,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';
import { ToolsService } from './tools.service';
import { OAuthService } from './oauth.service';
import { ToolRegistryService } from './tool-registry.service';
import { ExecuteToolDto } from './dto/execute-tool.dto';

@Controller()
export class ToolsController {
  constructor(
    private readonly toolsService: ToolsService,
    private readonly oauthService: OAuthService,
    private readonly toolRegistryService: ToolRegistryService,
    private readonly configService: ConfigService,
  ) {}

  // ── Tool listing ────────────────────────────────────────────

  @Get('tools')
  listTools(@Session() session: UserSession) {
    return this.toolsService.listToolsWithStatus(session.user.id);
  }

  @Get('tools/:id')
  getTool(@Param('id') id: string) {
    return this.toolsService.getTool(id);
  }

  // ── OAuth flow ──────────────────────────────────────────────

  @Get('tools/:slug/oauth/connect')
  async oauthConnect(
    @Session() session: UserSession,
    @Param('slug') slug: string,
    @Res() res: Response,
  ) {
    const tool = await this.toolsService.getToolBySlug(slug);
    if (!tool.oauthProvider) {
      res.status(400).json({ error: 'Tool does not support OAuth' });
      return;
    }

    const url = this.oauthService.getAuthorizationUrl(
      slug,
      tool.oauthProvider,
      (tool.requiredScopes as string[]) ?? [],
      session.user.id,
    );
    res.redirect(url);
  }

  @Get('tools/oauth/callback')
  @AllowAnonymous()
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:3000';

    try {
      const { slug, userId } = this.oauthService.verifyOAuthState(state);
      const tokens = await this.oauthService.exchangeCode(slug, code);
      const tool = await this.toolsService.getToolBySlug(slug);

      const tokenExpiresAt = tokens.expiresIn
        ? new Date(Date.now() + tokens.expiresIn * 1000)
        : null;

      await this.toolsService.saveToolCredential(tool.id, userId, {
        accessToken: this.oauthService.encrypt(tokens.accessToken),
        refreshToken: tokens.refreshToken
          ? this.oauthService.encrypt(tokens.refreshToken)
          : undefined,
        tokenExpiresAt,
        scope: tokens.scope,
      });

      res.redirect(`${frontendUrl}/tools/callback?connected=${slug}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'OAuth callback failed';
      res.redirect(
        `${frontendUrl}/tools/callback?error=${encodeURIComponent(message)}`,
      );
    }
  }

  @Get('tools/:slug/oauth/status')
  async oauthStatus(
    @Session() session: UserSession,
    @Param('slug') slug: string,
  ) {
    const credential = await this.toolsService.getToolCredential(
      slug,
      session.user.id,
    );
    if (!credential) {
      return { connected: false };
    }
    return {
      connected: true,
      scope: credential.scope ?? undefined,
      expiresAt: credential.tokenExpiresAt?.toISOString() ?? undefined,
    };
  }

  @Delete('tools/:slug/oauth/disconnect')
  async oauthDisconnect(
    @Session() session: UserSession,
    @Param('slug') slug: string,
  ) {
    return this.toolsService.deleteToolCredential(slug, session.user.id);
  }

  // ── API key tools (web_search) ──────────────────────────────

  @Post('tools/web_search/configure')
  async configureWebSearch(
    @Session() session: UserSession,
    @Body('apiKey') apiKey: string,
  ) {
    const tool = await this.toolsService.getToolBySlug('web_search');
    await this.toolsService.saveToolCredential(tool.id, session.user.id, {
      accessToken: this.oauthService.encrypt(apiKey),
    });
    return { ok: true };
  }

  @Get('tools/web_search/status')
  async webSearchStatus(@Session() session: UserSession) {
    const credential = await this.toolsService.getToolCredential(
      'web_search',
      session.user.id,
    );
    return { configured: credential !== null };
  }

  // ── Tool execution proxy (for voice worker) ────────────────

  @Post('tools/execute')
  @AllowAnonymous()
  async executeTool(
    @Headers('x-agent-secret') agentSecret: string,
    @Body() dto: ExecuteToolDto,
  ) {
    const expectedSecret = this.configService.get<string>('AGENT_TOOL_SECRET');
    if (!expectedSecret || agentSecret !== expectedSecret) {
      throw new ForbiddenException('Invalid agent secret');
    }

    try {
      const result = await this.toolRegistryService.executeToolAction(
        dto.toolSlug,
        dto.action,
        dto.params,
        dto.userId,
      );
      return { result };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : 'Tool execution failed',
      };
    }
  }

  // ── Agent-tool connections ──────────────────────────────────

  @Get('agents/:agentId/tools')
  listAgentTools(@Param('agentId') agentId: string) {
    return this.toolsService.listAgentTools(agentId);
  }

  @Post('agents/:agentId/tools')
  connectTool(
    @Param('agentId') agentId: string,
    @Body('toolId') toolId: string,
  ) {
    return this.toolsService.connectTool(agentId, toolId);
  }

  @Delete('agents/:agentId/tools/:toolId')
  disconnectTool(
    @Param('agentId') agentId: string,
    @Param('toolId') toolId: string,
  ) {
    return this.toolsService.disconnectTool(agentId, toolId);
  }
}
