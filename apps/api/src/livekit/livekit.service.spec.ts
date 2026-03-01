import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { LivekitService } from './livekit.service';
import { ArenaSession } from '../arena/arena.interfaces';

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
  return JSON.parse(payload) as Record<string, unknown>;
}

describe('LivekitService', () => {
  let service: LivekitService;
  let configService: ConfigService;

  const mockConfig: Record<string, string> = {
    LIVEKIT_API_KEY: 'test-api-key',
    LIVEKIT_API_SECRET: 'test-api-secret-that-is-long-enough-for-jwt',
    LIVEKIT_URL: 'wss://test.livekit.cloud',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LivekitService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => mockConfig[key]),
          },
        },
      ],
    }).compile();

    service = module.get<LivekitService>(LivekitService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateToken', () => {
    it('should return token, serverUrl, and roomName for valid input', async () => {
      const result = await service.generateToken({
        roomName: 'test-room',
        identity: 'user1',
      });

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('serverUrl');
      expect(result).toHaveProperty('roomName');
      expect(typeof result.token).toBe('string');
      expect(result.token.length).toBeGreaterThan(0);
      expect(result.serverUrl).toBe('wss://test.livekit.cloud');
      expect(result.roomName).toBe('test-room');
    });

    it('should always dispatch siestai-agent in room config', async () => {
      const result = await service.generateToken({
        roomName: 'test-room',
        identity: 'user1',
      });

      const payload = decodeJwtPayload(result.token);
      expect(payload).toHaveProperty('roomConfig');
      const roomConfig = payload.roomConfig as Record<string, unknown>;
      expect(roomConfig).toHaveProperty('agents');
      const agents = roomConfig.agents as Array<Record<string, unknown>>;
      expect(agents).toHaveLength(1);
      expect(agents[0]).toHaveProperty('agentName', 'siestai-agent');
    });

    it('should throw InternalServerErrorException when LIVEKIT_API_KEY is not configured', async () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'LIVEKIT_API_KEY') return undefined;
        return mockConfig[key];
      });

      await expect(
        service.generateToken({ roomName: 'test-room', identity: 'user1' }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException when LIVEKIT_API_SECRET is not configured', async () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'LIVEKIT_API_SECRET') return undefined;
        return mockConfig[key];
      });

      await expect(
        service.generateToken({ roomName: 'test-room', identity: 'user1' }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException when LIVEKIT_URL is not configured', async () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'LIVEKIT_URL') return undefined;
        return mockConfig[key];
      });

      await expect(
        service.generateToken({ roomName: 'test-room', identity: 'user1' }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should sanitize roomName and identity by stripping invalid characters', async () => {
      const result = await service.generateToken({
        roomName: 'test<room>!@#',
        identity: 'user 1&"name',
      });

      expect(result.roomName).toBe('testroom');
      const payload = decodeJwtPayload(result.token);
      const video = payload.video as Record<string, unknown>;
      expect(video.room).toBe('testroom');
    });

    it('should use participantName when provided', async () => {
      const result = await service.generateToken({
        roomName: 'test-room',
        identity: 'user1',
        participantName: 'John Doe',
      });

      expect(result.token).toBeTruthy();
      // Token was generated successfully with participantName
    });
  });

  describe('generateArenaToken', () => {
    const sampleArenaSession: ArenaSession = {
      id: 'arena-session-1',
      topic: 'AI ethics',
      mode: 'group',
      participationMode: 'human_collab',
      status: 'waiting',
      participants: [
        {
          id: 'p1',
          name: 'Atlas',
          type: 'native_agent',
          instructions: 'Technical perspective',
          status: 'invited',
          color: '#3b82f6',
        },
      ],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    };

    it('should create room and dispatch siestai-agent', async () => {
      const createRoom = jest.fn().mockResolvedValue(undefined);
      const createDispatch = jest.fn().mockResolvedValue(undefined);

      // Override network clients to keep unit test isolated.
      (
        service as unknown as { roomService: { createRoom: typeof createRoom } }
      ).roomService = { createRoom };
      (
        service as unknown as {
          dispatchService: { createDispatch: typeof createDispatch };
        }
      ).dispatchService = { createDispatch };

      const result = await service.generateArenaToken(sampleArenaSession);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('serverUrl', 'wss://test.livekit.cloud');
      expect(result.roomName).toMatch(/^arena-/);

      expect(createRoom).toHaveBeenCalledTimes(1);
      expect(createDispatch).toHaveBeenCalledTimes(1);
      expect(createDispatch).toHaveBeenCalledWith(
        result.roomName,
        'siestai-agent',
      );
    });
  });
});
