import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MastraRegistryService, AgentRow } from './mastra-registry.service';

const mockRow = (overrides: Partial<AgentRow> = {}): AgentRow => ({
  id: 'agent-1',
  name: 'Test Agent',
  instructions: 'You are a test agent.',
  llm_model: 'anthropic/claude-sonnet-4-6',
  source: 'mastra',
  ...overrides,
});

describe('MastraRegistryService', () => {
  let service: MastraRegistryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MastraRegistryService,
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();

    service = module.get<MastraRegistryService>(MastraRegistryService);
  });

  describe('registerAgent + getAgent', () => {
    it('should register an agent and retrieve it by id', () => {
      const row = mockRow();
      service.registerAgent(row);

      const agent = service.getAgent('agent-1');
      expect(agent).not.toBeNull();
      expect(agent!.name).toBe('Test Agent');
    });

    it('should use default model when llm_model is null', () => {
      const row = mockRow({ llm_model: null });
      service.registerAgent(row);

      const agent = service.getAgent(row.id);
      expect(agent).not.toBeNull();
    });
  });

  describe('getAgent — missing agent returns null', () => {
    it('should return null for a non-existent agent id (not throw)', () => {
      const result = service.getAgent('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('unregisterAgent', () => {
    it('should return true when unregistering a registered agent', () => {
      service.registerAgent(mockRow());
      expect(service.unregisterAgent('agent-1')).toBe(true);
    });

    it('should return false when unregistering a non-existent agent', () => {
      expect(service.unregisterAgent('non-existent-id')).toBe(false);
    });

    it('should make agent unreachable after unregister', () => {
      service.registerAgent(mockRow());
      service.unregisterAgent('agent-1');
      expect(service.getAgent('agent-1')).toBeNull();
    });
  });

  describe('duplicate registration and update pattern', () => {
    it('should silently skip duplicate registerAgent (addAgent behavior)', () => {
      service.registerAgent(mockRow({ name: 'Original' }));
      service.registerAgent(mockRow({ name: 'Updated' }));

      const agent = service.getAgent('agent-1');
      // addAgent silently skips if key exists — original config retained
      expect(agent!.name).toBe('Original');
    });

    it('should update config via unregister + register pattern', () => {
      service.registerAgent(mockRow({ name: 'Original' }));
      service.unregisterAgent('agent-1');
      service.registerAgent(mockRow({ name: 'Updated' }));

      const agent = service.getAgent('agent-1');
      expect(agent!.name).toBe('Updated');
    });
  });

  describe('listRegistered', () => {
    it('should return empty list initially', () => {
      const result = service.listRegistered();
      expect(result).toEqual({ count: 0, agentIds: [] });
    });

    it('should return correct count after registering agents', () => {
      service.registerAgent(mockRow({ id: 'a1', name: 'Agent 1' }));
      service.registerAgent(mockRow({ id: 'a2', name: 'Agent 2' }));
      service.registerAgent(mockRow({ id: 'a3', name: 'Agent 3' }));

      const result = service.listRegistered();
      expect(result.count).toBe(3);
      expect(result.agentIds).toEqual(expect.arrayContaining(['a1', 'a2', 'a3']));
    });

    it('should reflect unregister in the count', () => {
      service.registerAgent(mockRow({ id: 'a1', name: 'Agent 1' }));
      service.registerAgent(mockRow({ id: 'a2', name: 'Agent 2' }));
      service.unregisterAgent('a1');

      const result = service.listRegistered();
      expect(result.count).toBe(1);
      expect(result.agentIds).toEqual(['a2']);
    });
  });
});
