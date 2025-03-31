import { MetadataManagerConfig, MetadataManager, MetadataManagerFactory as IMetadataManagerFactory } from '../../types/p2p/metadata-manager';
import { Logger } from '../../types/p2p/shared';
import { DatabaseAdapter } from './adapters/DatabaseAdapter';
import { CacheAdapter } from './cache/CacheAdapter';
import { InMemoryCache } from './cache/InMemoryCache';
import { SupabaseAdapter } from './adapters/SupabaseAdapter';

/**
 * Factory class for creating MetadataManager instances
 */
export class MetadataManagerFactory implements IMetadataManagerFactory {
  /**
   * Create a new MetadataManager instance with the specified configuration
   */
  create(config: MetadataManagerConfig, logger: Logger): MetadataManager {
    // Create database adapter
    const database = this.createDatabaseAdapter(config, logger);

    // Create cache adapter
    const cache = this.createCacheAdapter(config, logger);

    // Create and return MetadataManager instance
    return new MetadataManager(config, logger, database, cache);
  }

  /**
   * Create the appropriate database adapter based on configuration
   */
  private createDatabaseAdapter(config: MetadataManagerConfig, logger: Logger): DatabaseAdapter {
    // For now, we only support Supabase
    return new SupabaseAdapter(config.database, logger);
  }

  /**
   * Create the appropriate cache adapter based on configuration
   */
  private createCacheAdapter(config: MetadataManagerConfig, logger: Logger): CacheAdapter {
    // For now, we only support in-memory cache
    return new InMemoryCache({
      defaultTTL: config.caching.ttl,
      maxSize: 1000, // TODO: Make this configurable
      cleanupInterval: 60000 // 1 minute
    }, logger);
  }
} 