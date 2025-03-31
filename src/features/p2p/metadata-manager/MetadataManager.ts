import { DatabaseAdapter } from './adapters/DatabaseAdapter';
import { CacheAdapter } from './cache/CacheAdapter';
import { ModelMetadata, ModelFeaturePoint, UserPreferences, DatabaseError, NotFoundError } from '../../../types/p2p/metadata-manager';
import { Orientation } from '../../../types/p2p/shared';
import { Logger } from '../../../types/p2p/shared';

export interface MetadataManagerConfig {
  cacheTTL?: number;  // Time-to-live for cache entries in milliseconds
  cacheEnabled?: boolean;  // Whether to enable caching
  retryAttempts?: number;  // Number of retry attempts for database operations
}

const DEFAULT_CONFIG: Required<MetadataManagerConfig> = {
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  cacheEnabled: true,
  retryAttempts: 3
};

export class MetadataManager {
  private config: Required<MetadataManagerConfig>;
  private db: DatabaseAdapter;
  private cache: CacheAdapter;
  private logger: Logger;

  constructor(
    dbAdapter: DatabaseAdapter,
    cacheAdapter: CacheAdapter,
    logger: Logger,
    config: MetadataManagerConfig = {}
  ) {
    this.db = dbAdapter;
    this.cache = cacheAdapter;
    this.logger = logger;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the metadata manager
   */
  async initialize(): Promise<void> {
    try {
      await Promise.all([
        this.db.initialize(),
        this.cache.initialize()
      ]);
      this.logger.info('MetadataManager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize MetadataManager', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to initialize MetadataManager');
    }
  }

  /**
   * Store model metadata
   */
  async storeModelMetadata(
    modelId: string,
    metadata: Pick<ModelMetadata, 'orientation' | 'preferences'>
  ): Promise<void> {
    try {
      await this.db.storeModelMetadata(modelId, metadata);
      if (this.config.cacheEnabled) {
        await this.cache.removeModelMetadata(modelId); // Invalidate cache
      }
      this.logger.info(`Stored metadata for model: ${modelId}`);
    } catch (error) {
      this.logger.error(`Failed to store metadata for model: ${modelId}`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to store metadata for model: ${modelId}`);
    }
  }

  /**
   * Get model metadata with caching
   */
  async getModelMetadata(modelId: string): Promise<ModelMetadata> {
    try {
      // Try cache first if enabled
      if (this.config.cacheEnabled) {
        const cached = await this.cache.getModelMetadata(modelId);
        if (cached) {
          this.logger.debug(`Cache hit for model metadata: ${modelId}`);
          return cached;
        }
      }

      // Get from database
      const metadata = await this.db.getModelMetadata(modelId);
      
      // Store in cache if enabled
      if (this.config.cacheEnabled) {
        await this.cache.setModelMetadata(modelId, metadata, this.config.cacheTTL);
      }

      return metadata;
    } catch (error) {
      this.logger.error(`Failed to get metadata for model: ${modelId}`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to get metadata for model: ${modelId}`);
    }
  }

  /**
   * Update model orientation
   */
  async updateModelOrientation(modelId: string, orientation: Orientation): Promise<void> {
    try {
      await this.db.updateModelOrientation(modelId, orientation);
      if (this.config.cacheEnabled) {
        await this.cache.removeModelMetadata(modelId); // Invalidate cache
      }
      this.logger.info(`Updated orientation for model: ${modelId}`);
    } catch (error) {
      this.logger.error(`Failed to update orientation for model: ${modelId}`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to update orientation for model: ${modelId}`);
    }
  }

  /**
   * Add a feature point
   */
  async addFeaturePoint(
    modelId: string,
    point: Pick<ModelFeaturePoint, 'userId' | 'type' | 'position' | 'description' | 'measurements'>
  ): Promise<void> {
    try {
      await this.db.addFeaturePoint(modelId, point);
      if (this.config.cacheEnabled) {
        await this.cache.removeFeaturePoints(modelId); // Invalidate cache
      }
      this.logger.info(`Added feature point for model: ${modelId}`);
    } catch (error) {
      this.logger.error(`Failed to add feature point for model: ${modelId}`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to add feature point for model: ${modelId}`);
    }
  }

  /**
   * Remove a feature point
   */
  async removeFeaturePoint(modelId: string, pointId: string): Promise<void> {
    try {
      await this.db.removeFeaturePoint(modelId, pointId);
      if (this.config.cacheEnabled) {
        await this.cache.removeFeaturePoints(modelId); // Invalidate cache
      }
      this.logger.info(`Removed feature point ${pointId} for model: ${modelId}`);
    } catch (error) {
      this.logger.error(`Failed to remove feature point ${pointId} for model: ${modelId}`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to remove feature point ${pointId} for model: ${modelId}`);
    }
  }

  /**
   * Get feature points with caching
   */
  async getFeaturePoints(modelId: string): Promise<ModelFeaturePoint[]> {
    try {
      // Try cache first if enabled
      if (this.config.cacheEnabled) {
        const cached = await this.cache.getFeaturePoints(modelId);
        if (cached) {
          this.logger.debug(`Cache hit for feature points: ${modelId}`);
          return cached;
        }
      }

      // Get from database
      const points = await this.db.getFeaturePoints(modelId);
      
      // Store in cache if enabled
      if (this.config.cacheEnabled) {
        await this.cache.setFeaturePoints(modelId, points, this.config.cacheTTL);
      }

      return points;
    } catch (error) {
      this.logger.error(`Failed to get feature points for model: ${modelId}`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to get feature points for model: ${modelId}`);
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(modelId: string, preferences: UserPreferences): Promise<void> {
    try {
      await this.db.updateUserPreferences(modelId, preferences);
      if (this.config.cacheEnabled) {
        await this.cache.removeModelMetadata(modelId); // Invalidate cache
      }
      this.logger.info(`Updated preferences for model: ${modelId}`);
    } catch (error) {
      this.logger.error(`Failed to update preferences for model: ${modelId}`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to update preferences for model: ${modelId}`);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): Record<string, unknown> {
    if (!this.config.cacheEnabled) {
      return { enabled: false };
    }
    return this.cache.getStats();
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    if (this.config.cacheEnabled) {
      await this.cache.clear();
      this.logger.info('Cache cleared');
    }
  }
} 