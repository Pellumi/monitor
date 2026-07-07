// ─────────────────────────────────────────────────────────────
// Ruleset Cache — Adapter pattern
//
// Two implementations:
//   MemoryCacheAdapter  → single-process Map (local dev / fallback)
//   RedisCacheAdapter   → ioredis (production, multi-instance safe)
//
// Factory `createRulesetCache(redisUrl?)` selects based on REDIS_URL
// env var. All public API functions remain unchanged.
// ─────────────────────────────────────────────────────────────

export interface CacheKey {
  organizationId?: string | null;
  domainKey?: string | null;
  environment?: string | null;
}

// ─────────────────────────────────────────────────────────────
// Internal adapter interface
// ─────────────────────────────────────────────────────────────

interface CacheAdapter {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  invalidatePrefix(prefix: string): Promise<number>;
  clear(): Promise<void>;
  size(): Promise<number>;
}

// ─────────────────────────────────────────────────────────────
// In-memory adapter (unchanged from original implementation)
// ─────────────────────────────────────────────────────────────

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

class MemoryCacheAdapter implements CacheAdapter {
  private store = new Map<string, CacheEntry>();

  async get(key: string): Promise<unknown | undefined> {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async set(key: string, value: unknown, ttlMs: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async invalidatePrefix(prefix: string): Promise<number> {
    let count = 0;
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) {
        this.store.delete(k);
        count++;
      }
    }
    return count;
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async size(): Promise<number> {
    return this.store.size;
  }
}

// ─────────────────────────────────────────────────────────────
// Redis adapter (production, multi-instance safe)
// Uses ioredis. Key-space: all entries are prefixed with
// "sots:rulesets:" so they can be flushed independently.
// ─────────────────────────────────────────────────────────────

class RedisCacheAdapter implements CacheAdapter {
  // ioredis is a peer dependency — loaded dynamically to avoid
  // hard-crashing services that run without Redis configured.
  private redis: any;

  constructor(redisUrl: string) {
    // Dynamic require to keep ioredis an optional peer dep
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Redis = require('ioredis');
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => Math.min(times * 100, 3000),
    });
    this.redis.on('error', (err: Error) => {
      console.error('[RulesetCache:Redis] Connection error', err.message);
    });
  }

  async get(key: string): Promise<unknown | undefined> {
    try {
      const raw = await this.redis.get(key);
      if (raw == null) return undefined;
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: unknown, ttlMs: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'PX', ttlMs);
    } catch (err: any) {
      console.warn('[RulesetCache:Redis] set failed', err?.message);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err: any) {
      console.warn('[RulesetCache:Redis] delete failed', err?.message);
    }
  }

  async invalidatePrefix(prefix: string): Promise<number> {
    try {
      const keys: string[] = await this.redis.keys(`${prefix}*`);
      if (keys.length === 0) return 0;
      await this.redis.del(...keys);
      return keys.length;
    } catch (err: any) {
      console.warn('[RulesetCache:Redis] invalidatePrefix failed', err?.message);
      return 0;
    }
  }

  async clear(): Promise<void> {
    try {
      const keys: string[] = await this.redis.keys('sots:rulesets:*');
      if (keys.length > 0) await this.redis.del(...keys);
    } catch (err: any) {
      console.warn('[RulesetCache:Redis] clear failed', err?.message);
    }
  }

  async size(): Promise<number> {
    try {
      const keys: string[] = await this.redis.keys('sots:rulesets:*');
      return keys.length;
    } catch {
      return 0;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Cache key builder
// ─────────────────────────────────────────────────────────────

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

function buildCacheKey(key: CacheKey): string {
  const org    = key.organizationId ?? 'global';
  const domain = key.domainKey      ?? 'all';
  const env    = key.environment    ?? 'default';
  return `sots:rulesets:${org}:${domain}:${env}`;
}

// ─────────────────────────────────────────────────────────────
// Module-level singleton
// ─────────────────────────────────────────────────────────────

let _adapter: CacheAdapter | null = null;

function getAdapter(): CacheAdapter {
  if (_adapter) return _adapter;
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    console.log('[RulesetCache] Using Redis adapter:', redisUrl);
    _adapter = new RedisCacheAdapter(redisUrl);
  } else {
    console.log('[RulesetCache] Using in-memory adapter (set REDIS_URL for distributed caching)');
    _adapter = new MemoryCacheAdapter();
  }
  return _adapter;
}

// ─────────────────────────────────────────────────────────────
// Public API (unchanged interface from original cache.ts)
// ─────────────────────────────────────────────────────────────

/**
 * Returns a cached value for the given key, or undefined on a miss.
 */
export async function getCachedRulesets<T>(key: CacheKey): Promise<T | undefined> {
  return getAdapter().get(buildCacheKey(key)) as Promise<T | undefined>;
}

/**
 * Stores a value in the cache for the given key with an optional TTL.
 */
export async function setCachedRulesets<T>(key: CacheKey, value: T, ttlMs = DEFAULT_TTL_MS): Promise<void> {
  return getAdapter().set(buildCacheKey(key), value, ttlMs);
}

/**
 * Invalidates cache entries for a specific ruleset/org combination.
 * Pass only organizationId to wipe all entries for a tenant.
 */
export async function invalidateRulesetCache(params: {
  organizationId?: string | null;
  rulesetId?: string;
}): Promise<void> {
  const prefix = `sots:rulesets:${params.organizationId ?? 'global'}`;
  const count  = await getAdapter().invalidatePrefix(prefix);
  if (count > 0) {
    console.log(`[RulesetCache] Invalidated ${count} entries for prefix: ${prefix}`);
  }
}

/**
 * Clears the entire ruleset cache.
 * Use this after a global ruleset version promotion.
 */
export async function flushRulesetCache(): Promise<void> {
  const size = await getAdapter().size();
  await getAdapter().clear();
  console.log(`[RulesetCache] Flushed ${size} entries`);
}

/**
 * Returns cache stats for monitoring.
 */
export async function getRulesetCacheStats(): Promise<{ size: number; backend: string }> {
  return {
    size:    await getAdapter().size(),
    backend: process.env.REDIS_URL ? 'redis' : 'memory',
  };
}
