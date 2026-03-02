import { Injectable, NotFoundException } from '@nestjs/common';
import { db, tools, agentTools, toolCredentials, eq, and } from '@siestai/db';
import type { ToolWithStatus } from '@siestai/shared';

@Injectable()
export class ToolsService {
  async listTools() {
    return db
      .select()
      .from(tools)
      .where(eq(tools.isActive, true))
      .orderBy(tools.name);
  }

  async getTool(id: string) {
    const rows = await db.select().from(tools).where(eq(tools.id, id));

    if (rows.length === 0) throw new NotFoundException('Tool not found');
    return rows[0];
  }

  async getToolBySlug(slug: string) {
    const rows = await db.select().from(tools).where(eq(tools.slug, slug));
    if (rows.length === 0) throw new NotFoundException('Tool not found');
    return rows[0];
  }

  async getToolCredential(toolSlug: string, userId: string) {
    const rows = await db
      .select({
        id: toolCredentials.id,
        toolId: toolCredentials.toolId,
        userId: toolCredentials.userId,
        accessToken: toolCredentials.accessToken,
        refreshToken: toolCredentials.refreshToken,
        tokenExpiresAt: toolCredentials.tokenExpiresAt,
        scope: toolCredentials.scope,
        createdAt: toolCredentials.createdAt,
        updatedAt: toolCredentials.updatedAt,
      })
      .from(toolCredentials)
      .innerJoin(tools, eq(tools.id, toolCredentials.toolId))
      .where(and(eq(tools.slug, toolSlug), eq(toolCredentials.userId, userId)));

    return rows[0] ?? null;
  }

  async saveToolCredential(
    toolId: string,
    userId: string,
    data: {
      accessToken: string;
      refreshToken?: string;
      tokenExpiresAt?: Date | null;
      scope?: string;
    },
  ) {
    const rows = await db
      .insert(toolCredentials)
      .values({
        toolId,
        userId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? null,
        tokenExpiresAt: data.tokenExpiresAt ?? null,
        scope: data.scope ?? null,
      })
      .onConflictDoUpdate({
        target: [toolCredentials.toolId, toolCredentials.userId],
        set: {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken ?? null,
          tokenExpiresAt: data.tokenExpiresAt ?? null,
          scope: data.scope ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return rows[0];
  }

  async deleteToolCredential(toolSlug: string, userId: string) {
    const tool = await this.getToolBySlug(toolSlug);
    const rows = await db
      .delete(toolCredentials)
      .where(
        and(
          eq(toolCredentials.toolId, tool.id),
          eq(toolCredentials.userId, userId),
        ),
      )
      .returning({ id: toolCredentials.id });

    if (rows.length === 0)
      throw new NotFoundException('No credential found for this tool');
    return { ok: true };
  }

  async listToolsWithStatus(userId: string): Promise<ToolWithStatus[]> {
    const rows = await db
      .select({
        id: tools.id,
        name: tools.name,
        description: tools.description,
        icon: tools.icon,
        category: tools.category,
        type: tools.type,
        slug: tools.slug,
        oauthProvider: tools.oauthProvider,
        requiredScopes: tools.requiredScopes,
        isActive: tools.isActive,
        createdAt: tools.createdAt,
        credentialId: toolCredentials.id,
      })
      .from(tools)
      .leftJoin(
        toolCredentials,
        and(
          eq(tools.id, toolCredentials.toolId),
          eq(toolCredentials.userId, userId),
        ),
      )
      .where(eq(tools.isActive, true))
      .orderBy(tools.name);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      icon: row.icon ?? 'wrench',
      category: row.category ?? 'utility',
      type: (row.type as 'oauth' | 'api_key' | 'builtin') ?? 'builtin',
      slug: row.slug,
      oauthProvider: row.oauthProvider,
      requiredScopes: (row.requiredScopes as string[]) ?? [],
      isActive: row.isActive ?? true,
      createdAt: row.createdAt?.toISOString() ?? '',
      connected: row.credentialId !== null,
    }));
  }

  async getAgentToolsWithDefinitions(agentId: string) {
    return db
      .select({
        id: agentTools.id,
        agentId: agentTools.agentId,
        toolId: agentTools.toolId,
        config: agentTools.config,
        createdAt: agentTools.createdAt,
        slug: tools.slug,
        type: tools.type,
        toolName: tools.name,
        toolDescription: tools.description,
        toolIcon: tools.icon,
        toolCategory: tools.category,
      })
      .from(agentTools)
      .innerJoin(tools, eq(tools.id, agentTools.toolId))
      .where(eq(agentTools.agentId, agentId))
      .orderBy(agentTools.createdAt);
  }

  async listAgentTools(agentId: string) {
    return db
      .select({
        id: agentTools.id,
        agentId: agentTools.agentId,
        toolId: agentTools.toolId,
        config: agentTools.config,
        createdAt: agentTools.createdAt,
        toolName: tools.name,
        toolDescription: tools.description,
        toolIcon: tools.icon,
        toolCategory: tools.category,
      })
      .from(agentTools)
      .innerJoin(tools, eq(tools.id, agentTools.toolId))
      .where(eq(agentTools.agentId, agentId))
      .orderBy(agentTools.createdAt);
  }

  async connectTool(agentId: string, toolId: string) {
    const rows = await db
      .insert(agentTools)
      .values({ agentId, toolId })
      .onConflictDoNothing()
      .returning();

    if (rows.length === 0) {
      const existing = await db
        .select()
        .from(agentTools)
        .where(
          and(eq(agentTools.agentId, agentId), eq(agentTools.toolId, toolId)),
        );
      return existing[0];
    }
    return rows[0];
  }

  async disconnectTool(agentId: string, toolId: string) {
    const rows = await db
      .delete(agentTools)
      .where(
        and(eq(agentTools.agentId, agentId), eq(agentTools.toolId, toolId)),
      )
      .returning({ id: agentTools.id });

    if (rows.length === 0) throw new NotFoundException('Connection not found');
    return { ok: true };
  }
}
