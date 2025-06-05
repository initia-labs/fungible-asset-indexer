interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

export class Cache {
  private static instance: Cache;
  private cache: Map<string, CacheEntry<any>>;
  private readonly ttl: number;

  private constructor(ttlSeconds: number = 300) {
    this.cache = new Map();
    this.ttl = ttlSeconds * 1000; // Convert to milliseconds
  }

  public static getInstance(ttlSeconds?: number): Cache {
    if (!Cache.instance) {
      Cache.instance = new Cache(ttlSeconds);
    }
    return Cache.instance;
  }

  public set<T>(key: string, value: T): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  public get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  public clear(): void {
    this.cache.clear();
  }
} 