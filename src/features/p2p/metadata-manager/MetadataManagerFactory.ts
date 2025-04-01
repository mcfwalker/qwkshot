import { MetadataManagerConfig, MetadataManager, MetadataManagerFactory as IMetadataManagerFactory } from '@/types/p2p/metadata-manager';
import { Logger } from '@/types/p2p/shared';
import { DatabaseAdapter } from './adapters/DatabaseAdapter';
import { CacheAdapter } from './cache/CacheAdapter';
import { InMemoryCache } from './cache/InMemoryCache';
import { SupabaseAdapter } from './adapters/SupabaseAdapter';
import { MetadataManagerImpl } from './MetadataManager';

/**
 * Factory class for creating MetadataManager instances
 */
export class MetadataManagerFactory implements IMetadataManagerFactory {
  constructor(private logger: Logger) {}

  /**
   * Create a new MetadataManager instance with the specified configuration
   */
  create(config: MetadataManagerConfig): MetadataManager {
    // Create database adapter
    const database = this.createDatabaseAdapter(config);

    // Create cache adapter
    const cache = this.createCacheAdapter(config);

    // Create and return MetadataManager instance
    return new MetadataManagerImpl(database, cache, this.logger, config);
  }

  /**
   * Create the appropriate database adapter based on configuration
   */
  private createDatabaseAdapter(config: MetadataManagerConfig): DatabaseAdapter {
    // For now, we only support Supabase
    return new SupabaseAdapter(config.database, this.logger);
  }

  /**
   * Create the appropriate cache adapter based on configuration
   */
  private createCacheAdapter(config: MetadataManagerConfig): CacheAdapter {
    // For now, we only support in-memory cache
    return new InMemoryCache({
      defaultTTL: config.caching.ttl,
      maxSize: 1000, // TODO: Make this configurable
      cleanupInterval: 60000 // 1 minute
    }, this.logger);
  }
} 