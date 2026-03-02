import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTool } from '@mastra/core/tools';
import type { ToolsInput } from '@mastra/core/agent';
import { z } from 'zod';
import { ToolsService } from './tools.service';
import { OAuthService } from './oauth.service';
import { GitHubExecutor } from './executors/github.executor';
import { GmailExecutor } from './executors/gmail.executor';
import { WebSearchExecutor } from './executors/web-search.executor';

@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);
  private readonly githubExecutor = new GitHubExecutor();
  private readonly gmailExecutor = new GmailExecutor();
  private readonly webSearchExecutor = new WebSearchExecutor();

  constructor(
    private readonly toolsService: ToolsService,
    private readonly oauthService: OAuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Build Mastra tool instances for an agent based on its connected tools.
   * Returns a ToolsInput record keyed by tool slug.
   */
  async buildToolsForAgent(
    agentId: string,
    userId: string,
  ): Promise<ToolsInput> {
    const agentTools =
      await this.toolsService.getAgentToolsWithDefinitions(agentId);

    this.logger.log(
      `Agent ${agentId} has ${agentTools.length} connected tools: ${JSON.stringify(agentTools.map((t) => ({ slug: t.slug, toolId: t.toolId })))}`,
    );

    const toolMap: ToolsInput = {};

    for (const at of agentTools) {
      const slug = at.slug;
      if (!slug) continue;

      const tool = this.buildTool(slug, at.toolDescription ?? '', userId);
      if (tool) {
        toolMap[slug] = tool;
      }
    }

    return toolMap;
  }

  /**
   * Execute a tool action by slug — used by the /tools/execute proxy endpoint.
   */
  async executeToolAction(
    toolSlug: string,
    action: string,
    params: Record<string, unknown>,
    userId?: string,
  ): Promise<unknown> {
    switch (toolSlug) {
      case 'github': {
        const token = await this.oauthService.getValidToken(
          'github',
          userId!,
        );
        return this.githubExecutor.execute(action, params, token);
      }
      case 'gmail': {
        const token = await this.oauthService.getValidToken('gmail', userId!);
        return this.gmailExecutor.execute(action, params, token);
      }
      case 'web_search': {
        const apiKey = await this.getWebSearchApiKey(userId);
        return this.webSearchExecutor.execute(action, params, apiKey);
      }
      default:
        throw new Error(`Unknown tool slug: ${toolSlug}`);
    }
  }

  /**
   * Retrieve the Tavily API key — stored as an encrypted credential,
   * falling back to the TAVILY_API_KEY env var.
   */
  private async getWebSearchApiKey(userId?: string): Promise<string> {
    if (userId) {
      try {
        return await this.oauthService.getValidToken('web_search', userId);
      } catch {
        // Fall through to env var
      }
    }
    const envKey = this.configService.get<string>('TAVILY_API_KEY');
    if (envKey) return envKey;
    throw new Error(
      'Tavily API key is not configured. Set it via /tools or TAVILY_API_KEY env var.',
    );
  }

  private buildTool(slug: string, description: string, userId: string) {
    switch (slug) {
      case 'github':
        return this.buildGitHubTool(description, userId);
      case 'gmail':
        return this.buildGmailTool(description, userId);
      case 'web_search':
        return this.buildWebSearchTool(description, userId);
      default:
        this.logger.warn(`Unknown tool slug: ${slug}`);
        return null;
    }
  }

  private buildGitHubTool(description: string, userId: string) {
    const registry = this;
    return createTool({
      id: 'github',
      description:
        description ||
        'Search repositories, list issues, and read file contents from GitHub.',
      inputSchema: z.object({
        action: z
          .enum(['search_repos', 'list_issues', 'get_file'])
          .describe('The GitHub action to perform'),
        query: z
          .string()
          .optional()
          .describe('Search query (for search_repos)'),
        owner: z
          .string()
          .optional()
          .describe('Repository owner (for list_issues, get_file)'),
        repo: z
          .string()
          .optional()
          .describe('Repository name (for list_issues, get_file)'),
        path: z.string().optional().describe('File path (for get_file)'),
      }),
      execute: async (inputData) => {
        registry.logger.log(
          `GitHub tool execute called: action=${inputData.action}, userId=${userId}`,
        );
        return registry.executeToolAction(
          'github',
          inputData.action,
          inputData as Record<string, unknown>,
          userId,
        );
      },
    });
  }

  private buildGmailTool(description: string, userId: string) {
    const registry = this;
    return createTool({
      id: 'gmail',
      description:
        description || 'Send emails via your connected Gmail account.',
      inputSchema: z.object({
        to: z.string().describe('Recipient email address'),
        subject: z.string().describe('Email subject line'),
        body: z.string().describe('Email body text'),
      }),
      execute: async (inputData) => {
        return registry.executeToolAction(
          'gmail',
          'send_email',
          inputData as Record<string, unknown>,
          userId,
        );
      },
    });
  }

  private buildWebSearchTool(description: string, userId: string) {
    const registry = this;
    return createTool({
      id: 'web_search',
      description:
        description ||
        'Search the web for real-time information using Tavily.',
      inputSchema: z.object({
        query: z.string().describe('Search query'),
        maxResults: z
          .number()
          .optional()
          .default(5)
          .describe('Maximum number of results to return'),
      }),
      execute: async (inputData) => {
        return registry.executeToolAction(
          'web_search',
          'search',
          inputData as Record<string, unknown>,
          userId,
        );
      },
    });
  }
}
