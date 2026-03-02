/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock('@thallesp/nestjs-better-auth', () => ({
  AllowAnonymous: () => () => {},
  Session: () => () => {},
}));

jest.mock('@siestai/db', () => ({
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockResolvedValue([]),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    onConflictDoUpdate: jest.fn().mockReturnThis(),
    onConflictDoNothing: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
  },
  tools: { id: 'id', slug: 'slug', isActive: 'isActive', name: 'name' },
  agentTools: { agentId: 'agentId', toolId: 'toolId', createdAt: 'createdAt' },
  toolCredentials: { id: 'id', toolId: 'toolId', userId: 'userId' },
  eq: jest.fn(),
  and: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { ToolRegistryService } from '../tool-registry.service';
import { ToolsService } from '../tools.service';
import { OAuthService } from '../oauth.service';
import { ToolsController } from '../tools.controller';
import { WebSearchExecutor } from '../executors/web-search.executor';

describe('tool-execution', () => {
  let registryService: ToolRegistryService;
  let toolsService: ToolsService;
  let oauthService: OAuthService;
  let controller: ToolsController;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ToolsController],
      providers: [
        ToolRegistryService,
        ToolsService,
        OAuthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const map: Record<string, string> = {
                BETTER_AUTH_SECRET: 'test-secret-that-is-long-enough-32chars!',
                AGENT_TOOL_SECRET: 'test-agent-secret',
                TAVILY_API_KEY: 'test-tavily-key',
                BETTER_AUTH_URL: 'http://localhost:4200',
                FRONTEND_URL: 'http://localhost:3000',
              };
              return map[key];
            }),
          },
        },
      ],
    }).compile();

    registryService = module.get(ToolRegistryService);
    toolsService = module.get(ToolsService);
    oauthService = module.get(OAuthService);
    controller = module.get(ToolsController);
    configService = module.get(ConfigService);
  });

  // ── Test 1: Web search execution with mocked Tavily ─────────
  describe('ToolRegistryService.executeToolAction (web_search)', () => {
    it('should return structured results from Tavily', async () => {
      const tavilyResponse = {
        results: [
          { title: 'Result 1', url: 'https://example.com/1', content: 'Content 1', score: 0.9 },
          { title: 'Result 2', url: 'https://example.com/2', content: 'Content 2', score: 0.8 },
        ],
      };

      // Mock getValidToken to return the env key (for web_search it falls through to env var)
      jest.spyOn(oauthService, 'getValidToken').mockRejectedValue(new Error('No credential'));

      // Mock fetch for Tavily API
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => tavilyResponse,
        text: async () => '',
      } as Response);

      const result = await registryService.executeToolAction('web_search', 'search', {
        query: 'test query',
      });

      expect(result).toEqual({
        results: [
          { title: 'Result 1', url: 'https://example.com/1', content: 'Content 1', score: 0.9 },
          { title: 'Result 2', url: 'https://example.com/2', content: 'Content 2', score: 0.8 },
        ],
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.tavily.com/search',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"query":"test query"'),
        }),
      );

      fetchSpy.mockRestore();
    });

    it('should throw clear error when no API key is configured', async () => {
      jest.spyOn(oauthService, 'getValidToken').mockRejectedValue(new Error('No credential'));
      jest.spyOn(configService, 'get').mockReturnValue(undefined);

      await expect(
        registryService.executeToolAction('web_search', 'search', { query: 'test' }),
      ).rejects.toThrow('Tavily API key is not configured');
    });
  });

  // ── Test 2: POST /tools/execute auth guard ──────────────────
  describe('POST /tools/execute', () => {
    it('should return result with valid agent secret', async () => {
      jest.spyOn(registryService, 'executeToolAction').mockResolvedValue({ results: [] });

      const result = await controller.executeTool('test-agent-secret', {
        toolSlug: 'web_search',
        action: 'search',
        params: { query: 'test' },
      });

      expect(result).toEqual({ result: { results: [] } });
    });

    it('should throw 403 without agent secret', async () => {
      await expect(
        controller.executeTool('', {
          toolSlug: 'web_search',
          action: 'search',
          params: { query: 'test' },
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw 403 with wrong agent secret', async () => {
      await expect(
        controller.executeTool('wrong-secret', {
          toolSlug: 'web_search',
          action: 'search',
          params: { query: 'test' },
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return error object on tool execution failure', async () => {
      jest
        .spyOn(registryService, 'executeToolAction')
        .mockRejectedValue(new Error('Token expired'));

      const result = await controller.executeTool('test-agent-secret', {
        toolSlug: 'github',
        action: 'search_repos',
        params: { query: 'test' },
      });

      expect(result).toEqual({ error: 'Token expired' });
    });
  });

  // ── Test 3: buildToolsForAgent with no connected tools ──────
  describe('buildToolsForAgent', () => {
    it('should return empty object for agent with no connected tools', async () => {
      jest.spyOn(toolsService, 'getAgentToolsWithDefinitions').mockResolvedValue([]);

      const result = await registryService.buildToolsForAgent('agent-123', 'user-123');

      expect(result).toEqual({});
    });
  });

  // ── Test 4: OAuthService encrypt/decrypt round-trip ─────────
  describe('OAuthService encrypt/decrypt', () => {
    it('should round-trip encrypt and decrypt correctly', () => {
      const original = 'gho_secretToken123_test_value';
      const encrypted = oauthService.encrypt(original);

      // Encrypted form should be different from original
      expect(encrypted).not.toBe(original);
      // Should have iv:authTag:ciphertext format
      expect(encrypted.split(':')).toHaveLength(3);

      const decrypted = oauthService.decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should produce different ciphertexts for same plaintext (random IV)', () => {
      const plaintext = 'same-token-value';
      const enc1 = oauthService.encrypt(plaintext);
      const enc2 = oauthService.encrypt(plaintext);

      expect(enc1).not.toBe(enc2);
      expect(oauthService.decrypt(enc1)).toBe(plaintext);
      expect(oauthService.decrypt(enc2)).toBe(plaintext);
    });
  });

  // ── Test 5: Unknown tool slug error ─────────────────────────
  describe('error handling', () => {
    it('should throw clear error for unknown tool slug', async () => {
      await expect(
        registryService.executeToolAction('unknown_tool', 'action', {}),
      ).rejects.toThrow('Unknown tool slug: unknown_tool');
    });
  });
});
