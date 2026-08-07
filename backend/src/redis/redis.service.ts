import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AllConfigType } from '../config/config.type';

/**
 * Thin Redis wrapper with in-memory fallback when Redis is unavailable (local dev).
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private readonly memory = new Map<string, { value: string; expiresAt: number }>();
  /** In-memory list fallback when Redis is unavailable. */
  private readonly memoryLists = new Map<string, string[]>();

  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  onModuleInit() {
    const host = this.configService.get('redis.host', { infer: true });
    const port = this.configService.get('redis.port', { infer: true });
    const password = this.configService.get('redis.password', { infer: true });

    try {
      this.client = new Redis({
        host,
        port,
        password: password || undefined,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        enableOfflineQueue: false,
      });

      this.client.on('error', (err) => {
        this.logger.warn(`Redis error: ${err.message}`);
      });

      void this.client.connect().catch((err) => {
        this.logger.warn(
          `Redis unavailable (${err.message}); using in-memory fallback for auth security.`,
        );
        this.client = null;
      });
    } catch (err) {
      this.logger.warn(
        `Redis init failed; using in-memory fallback for auth security.`,
      );
      this.client = null;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
    }
  }

  get isRedisConnected(): boolean {
    return this.client?.status === 'ready';
  }

  async incr(key: string, ttlSeconds: number): Promise<number> {
    if (this.client?.status === 'ready') {
      const count = await this.client.incr(key);
      if (count === 1) {
        await this.client.expire(key, ttlSeconds);
      }
      return count;
    }
    return this.memoryIncr(key, ttlSeconds);
  }

  async get(key: string): Promise<string | null> {
    if (this.client?.status === 'ready') {
      return this.client.get(key);
    }
    return this.memoryGet(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (this.client?.status === 'ready') {
      await this.client.set(key, value, 'EX', ttlSeconds);
      return;
    }
    this.memory.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /** SET key NX EX — returns true if the key was set. */
  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    if (this.client?.status === 'ready') {
      const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    }
    if (this.memoryGet(key) != null) return false;
    this.memory.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return true;
  }

  async del(...keys: string[]): Promise<void> {
    if (!keys.length) return;
    if (this.client?.status === 'ready') {
      await this.client.del(...keys);
      return;
    }
    for (const key of keys) {
      this.memory.delete(key);
      this.memoryLists.delete(key);
    }
  }

  /** Append to list tail (FIFO queue with lpop). */
  async rpush(key: string, value: string): Promise<number> {
    if (this.client?.status === 'ready') {
      return this.client.rpush(key, value);
    }
    const list = this.memoryLists.get(key) ?? [];
    list.push(value);
    this.memoryLists.set(key, list);
    return list.length;
  }

  /** Prepend to list head. */
  async lpush(key: string, value: string): Promise<number> {
    if (this.client?.status === 'ready') {
      return this.client.lpush(key, value);
    }
    const list = this.memoryLists.get(key) ?? [];
    list.unshift(value);
    this.memoryLists.set(key, list);
    return list.length;
  }

  /** Pop from list head. */
  async lpop(key: string): Promise<string | null> {
    if (this.client?.status === 'ready') {
      return this.client.lpop(key);
    }
    const list = this.memoryLists.get(key);
    if (!list?.length) return null;
    const value = list.shift() ?? null;
    if (!list.length) this.memoryLists.delete(key);
    else this.memoryLists.set(key, list);
    return value;
  }

  async llen(key: string): Promise<number> {
    if (this.client?.status === 'ready') {
      return this.client.llen(key);
    }
    return this.memoryLists.get(key)?.length ?? 0;
  }

  private memoryGet(key: string): string | null {
    const entry = this.memory.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return entry.value;
  }

  private memoryIncr(key: string, ttlSeconds: number): number {
    const current = this.memoryGet(key);
    const next = (current ? parseInt(current, 10) : 0) + 1;
    this.memory.set(key, {
      value: String(next),
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return next;
  }
}
