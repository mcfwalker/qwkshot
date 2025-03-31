import { CacheAdapter } from './CacheAdapter';
import { ModelMetadata, ModelFeaturePoint } from '../../../../types/p2p/metadata-manager';
import { Logger } from '../../../../types/p2p/shared';

/**
 * Configuration for the in-memory cache
 */
export interface InMemoryCacheConfig {
  defaultTTL: number; // in milliseconds
  maxSize: number; // maximum number of items to store
  cleanupInterval: number; // in milliseconds
}

/**
 * Cache entry with expiration
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * In-memory implementation of the cache adapter
 */
export class InMemoryCache implements CacheAdapter {
  private metadataCache: Map<string, CacheEntry<ModelMetadata>>;
  private featurePointsCache: Map<string, CacheEntry<ModelFeaturePoint[]>>;
  private config: InMemoryCacheConfig;
  private logger: Logger;
  private stats: {
    hits: number;
    misses: number;
  };
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: InMemoryCacheConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.metadataCache = new Map();
    this.featurePointsCache = new Map();
    this.stats = {
      hits: 0,
      misses: 0
    };
    this.cleanupInterval = setInterval(() => this.cleanup(), config.cleanupInterval);
  }

  /**
   * Initialize the cache
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing in-memory cache');
      
      // Clear any existing data
      await this.clear();
      
      this.logger.info('In-memory cache initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize in-memory cache', error);
      throw error;
    }
  }

  /**
   * Store model metadata in cache
   */
  async setModelMetadata(
    modelId: string,
    metadata: ModelMetadata,
    ttl?: number
  ): Promise<void> {
    try {
      // Check cache size
      if (this.metadataCache.size >= this.config.maxSize) {
        await this.evictOldestMetadata();
      }

      const expiresAt = Date.now() + (ttl || this.config.defaultTTL);
      this.metadataCache.set(modelId, { value: metadata, expiresAt });
      
      this.logger.debug(`Cached metadata for model: ${modelId}`);
    } catch (error) {
      this.logger.error(`Failed to cache metadata for model: ${modelId}`, error);
      throw error;
    }
  }

  /**
   * Get model metadata from cache
   */
  async getModelMetadata(modelId: string): Promise<ModelMetadata | null> {
    try {
      const entry = this.metadataCache.get(modelId);
      
      if (!entry) {
        this.stats.misses++;
        return null;
      }

      // Check if entry has expired
      if (Date.now() > entry.expiresAt) {
        this.metadataCache.delete(modelId);
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return entry.value;
    } catch (error) {
      this.logger.error(`Failed to retrieve cached metadata for model: ${modelId}`, error);
      throw error;
    }
  }

  /**
   * Store feature points in cache
   */
  async setFeaturePoints(
    modelId: string,
    points: ModelFeaturePoint[],
    ttl?: number
  ): Promise<void> {
    try {
      // Check cache size
      if (this.featurePointsCache.size >= this.config.maxSize) {
        await this.evictOldestFeaturePoints();
      }

      const expiresAt = Date.now() + (ttl || this.config.defaultTTL);
      this.featurePointsCache.set(modelId, { value: points, expiresAt });
      
      this.logger.debug(`Cached feature points for model: ${modelId}`);
    } catch (error) {
      this.logger.error(`Failed to cache feature points for model: ${modelId}`, error);
      throw error;
    }
  }

  /**
   * Get feature points from cache
   */
  async getFeaturePoints(modelId: string): Promise<ModelFeaturePoint[] | null> {
    try {
      const entry = this.featurePointsCache.get(modelId);
      
      if (!entry) {
        this.stats.misses++;
        return null;
      }

      // Check if entry has expired
      if (Date.now() > entry.expiresAt) {
        this.featurePointsCache.delete(modelId);
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return entry.value;
    } catch (error) {
      this.logger.error(`Failed to retrieve cached feature points for model: ${modelId}`, error);
      throw error;
    }
  }

  /**
   * Remove model metadata from cache
   */
  async removeModelMetadata(modelId: string): Promise<void> {
    try {
      this.metadataCache.delete(modelId);
      this.logger.debug(`Removed cached metadata for model: ${modelId}`);
    } catch (error) {
      this.logger.error(`Failed to remove cached metadata for model: ${modelId}`, error);
      throw error;
    }
  }

  /**
   * Remove feature points from cache
   */
  async removeFeaturePoints(modelId: string): Promise<void> {
    try {
      this.featurePointsCache.delete(modelId);
      this.logger.debug(`Removed cached feature points for model: ${modelId}`);
    } catch (error) {
      this.logger.error(`Failed to remove cached feature points for model: ${modelId}`, error);
      throw error;
    }
  }

  /**
   * Clear all cached data
   */
  async clear(): Promise<void> {
    try {
      this.metadataCache.clear();
      this.featurePointsCache.clear();
      this.stats = { hits: 0, misses: 0 };
      this.logger.info('Cleared all cached data');
    } catch (error) {
      this.logger.error('Failed to clear cache', error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    hits: number;
    misses: number;
    size: number;
  } {
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.metadataCache.size + this.featurePointsCache.size
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();

    // Clean up metadata cache
    for (const [key, entry] of this.metadataCache.entries()) {
      if (now > entry.expiresAt) {
        this.metadataCache.delete(key);
      }
    }

    // Clean up feature points cache
    for (const [key, entry] of this.featurePointsCache.entries()) {
      if (now > entry.expiresAt) {
        this.featurePointsCache.delete(key);
      }
    }
  }

  /**
   * Evict oldest metadata entry
   */
  private async evictOldestMetadata(): Promise<void> {
    let oldestKey: string | null = null;
    let oldestExpiry = Infinity;

    for (const [key, entry] of this.metadataCache.entries()) {
      if (entry.expiresAt < oldestExpiry) {
        oldestKey = key;
        oldestExpiry = entry.expiresAt;
      }
    }

    if (oldestKey) {
      this.metadataCache.delete(oldestKey);
      this.logger.debug(`Evicted oldest metadata entry: ${oldestKey}`);
    }
  }

  /**
   * Evict oldest feature points entry
   */
  private async evictOldestFeaturePoints(): Promise<void> {
    let oldestKey: string | null = null;
    let oldestExpiry = Infinity;

    for (const [key, entry] of this.featurePointsCache.entries()) {
      if (entry.expiresAt < oldestExpiry) {
        oldestKey = key;
        oldestExpiry = entry.expiresAt;
      }
    }

    if (oldestKey) {
      this.featurePointsCache.delete(oldestKey);
      this.logger.debug(`Evicted oldest feature points entry: ${oldestKey}`);
    }
  }
} 