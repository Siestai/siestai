import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface TranscriptEntry {
  speaker: string;
  content: string;
  timestamp: number;
}

/**
 * Redis-backed working memory for ephemeral session state.
 * Falls back to in-memory Map if Redis is unavailable.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: any = null;
  private fallbackStore = new Map<string, string[]>();
  private fallbackKV = new Map<string, string>();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.initRedis();
  }

  private async initRedis() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn('REDIS_URL not set — using in-memory fallback for working memory');
      return;
    }

    try {
      const Redis = (await import('ioredis')).default;
      this.client = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 3 });
      await this.client.connect();
      this.logger.log('Redis connected for working memory');
    } catch (err) {
      this.logger.warn(`Redis connection failed, using in-memory fallback: ${err}`);
      this.client = null;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  private transcriptKey(sessionId: string) {
    return `session:${sessionId}:transcript`;
  }
  private scratchpadKey(sessionId: string) {
    return `session:${sessionId}:scratchpad`;
  }

  async appendTranscript(sessionId: string, entry: TranscriptEntry) {
    const serialized = JSON.stringify(entry);
    const key = this.transcriptKey(sessionId);

    if (this.client) {
      await this.client.rpush(key, serialized);
      await this.client.ltrim(key, -50, -1);
      await this.client.expire(key, 7200); // 2 hour TTL
    } else {
      const list = this.fallbackStore.get(key) ?? [];
      list.push(serialized);
      if (list.length > 50) list.splice(0, list.length - 50);
      this.fallbackStore.set(key, list);
    }
  }

  async getRecentTranscript(sessionId: string, count = 20): Promise<TranscriptEntry[]> {
    const key = this.transcriptKey(sessionId);

    if (this.client) {
      const items = await this.client.lrange(key, -count, -1);
      return items.map((s: string) => JSON.parse(s));
    }

    const list = this.fallbackStore.get(key) ?? [];
    return list.slice(-count).map((s) => JSON.parse(s));
  }

  async setScratchpad(sessionId: string, data: Record<string, unknown>) {
    const key = this.scratchpadKey(sessionId);
    const serialized = JSON.stringify(data);

    if (this.client) {
      await this.client.set(key, serialized, 'EX', 7200);
    } else {
      this.fallbackKV.set(key, serialized);
    }
  }

  async getScratchpad(sessionId: string): Promise<Record<string, unknown> | null> {
    const key = this.scratchpadKey(sessionId);

    if (this.client) {
      const val = await this.client.get(key);
      return val ? JSON.parse(val) : null;
    }

    const val = this.fallbackKV.get(key);
    return val ? JSON.parse(val) : null;
  }

  async flushSession(sessionId: string) {
    const tKey = this.transcriptKey(sessionId);
    const sKey = this.scratchpadKey(sessionId);

    if (this.client) {
      await this.client.del(tKey, sKey);
    } else {
      this.fallbackStore.delete(tKey);
      this.fallbackKV.delete(sKey);
    }
  }
}
