import { MetadataManagerConfig, MetadataManager, MetadataManagerFactory as IMetadataManagerFactory } from '@/types/p2p/metadata-manager';
import { Logger } from '@/types/p2p/shared';
import { DatabaseAdapter } from './adapters/DatabaseAdapter';
import { CacheAdapter } from './cache/CacheAdapter';
import { InMemoryCache } from './cache/InMemoryCache';
import { SupabaseAdapter } from './adapters/SupabaseAdapter';
import { MetadataManagerImpl } from './MetadataManager';
import { getSupabaseClient, getSupabaseServiceRoleClient } from '@/lib/supabase';
import { SupabaseClient } from '@supabase/supabase-js';

// Define client type option
type SupabaseClientType = 'default' | 'serviceRole';

/**
 * Factory class for creating MetadataManager instances
 */
export class MetadataManagerFactory implements IMetadataManagerFactory {
  constructor(private logger: Logger) {}

  /**
   * Create a new MetadataManager instance.
   * @param config The configuration for the manager.
   * @param clientType Optional: Specifies which Supabase client to use ('default' or 'serviceRole'). Defaults to 'default'.
   */
  create(
    config: MetadataManagerConfig, 
    clientType: SupabaseClientType = 'default' // Default to standard client
  ): MetadataManager {
    // Create database adapter, passing the desired client type
    const database = this.createDatabaseAdapter(clientType); // Pass clientType, remove config

    // Create cache adapter
    const cache = this.createCacheAdapter(config);

    // Pass the created adapters to the implementation
    return new MetadataManagerImpl(database, cache, this.logger, config);
  }

  /**
   * Create the Supabase database adapter with the specified client.
   */
  private createDatabaseAdapter(clientType: SupabaseClientType): DatabaseAdapter {
    let supabaseClient: SupabaseClient;

    if (clientType === 'serviceRole') {
      this.logger.info('MetadataManagerFactory creating adapter with SERVICE ROLE client');
      supabaseClient = getSupabaseServiceRoleClient();
    } else {
      this.logger.info('MetadataManagerFactory creating adapter with DEFAULT (anon) client');
      // Ensure getSupabaseClient returns the correct base SupabaseClient type if needed
      // If getSupabaseClient() returns the component client, we might need a different getter
      // Assuming getSupabaseClient() is suitable or we have another function for the base client
      supabaseClient = getSupabaseClient() as unknown as SupabaseClient; // Cast may be needed depending on getSupabaseClient return type
    }
    
    // Pass the chosen client instance to the adapter constructor
    return new SupabaseAdapter(supabaseClient, this.logger);
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