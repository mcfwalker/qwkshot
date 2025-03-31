import { DatabaseAdapter } from './adapters/DatabaseAdapter';
import { CacheAdapter } from './cache/CacheAdapter';
import {
  ModelMetadata,
  ModelFeaturePoint,
  UserPreferences,
  DatabaseError,
  NotFoundError,
  MetadataManagerConfig,
  MetadataManager as IMetadataManager
} from '../../../types/p2p/metadata-manager';
import { Orientation } from '../../../types/p2p/shared';
import { Logger } from '../../../types/p2p/shared';

const DEFAULT_CONFIG: Required<MetadataManagerConfig> = {
  database: {
    table: 'model_metadata',
    schema: 'public',
  },
  caching: {
    enabled: true,
    ttl: 5 * 60 * 1000,
  },
  validation: {
    strict: false,
    maxFeaturePoints: 100,
  },
  debug: false,
  performance: {
    enabled: true,
    logInterval: 5000,
  },
};

export class MetadataManagerImpl implements IMetadataManager {
  private config: Required<MetadataManagerConfig>;
  private db: DatabaseAdapter;
  private cache: CacheAdapter;
  private logger: Logger;

  constructor(
    dbAdapter: DatabaseAdapter,
    cacheAdapter: CacheAdapter,
    logger: Logger,
    config: MetadataManagerConfig = DEFAULT_CONFIG
  ) {
    this.db = dbAdapter;
    this.cache = cacheAdapter;
    this.logger = logger;
    this.config = {
      database: { ...DEFAULT_CONFIG.database, ...config.database },
      caching: { ...DEFAULT_CONFIG.caching, ...config.caching },
      validation: { ...DEFAULT_CONFIG.validation, ...config.validation },
      debug: config.debug ?? DEFAULT_CONFIG.debug,
      performance: { ...DEFAULT_CONFIG.performance, ...config.performance },
    };
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
      if (this.config.caching.enabled) {
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
      if (this.config.caching.enabled) {
        const cached = await this.cache.getModelMetadata(modelId);
        if (cached) {
          this.logger.debug(`Cache hit for model metadata: ${modelId}`);
          return cached;
        }
      }

      // Get from database
      const metadata = await this.db.getModelMetadata(modelId);
      
      // Store in cache if enabled
      if (this.config.caching.enabled) {
        await this.cache.setModelMetadata(modelId, metadata, this.config.caching.ttl);
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
      if (this.config.caching.enabled) {
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
      if (this.config.caching.enabled) {
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
      if (this.config.caching.enabled) {
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
      if (this.config.caching.enabled) {
        const cached = await this.cache.getFeaturePoints(modelId);
        if (cached) {
          this.logger.debug(`Cache hit for feature points: ${modelId}`);
          return cached;
        }
      }

      // Get from database
      const points = await this.db.getFeaturePoints(modelId);
      
      // Store in cache if enabled
      if (this.config.caching.enabled) {
        await this.cache.setFeaturePoints(modelId, points, this.config.caching.ttl);
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
      if (this.config.caching.enabled) {
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
    if (!this.config.caching.enabled) {
      return { enabled: false };
    }
    return this.cache.getStats();
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    if (this.config.caching.enabled) {
      await this.cache.clear();
      this.logger.info('Cache cleared');
    }
  }

  validateMetadata(metadata: ModelMetadata): { isValid: boolean; errors: string[] } {
    this.logger.debug('validateMetadata called (stub)', metadata);
    // TODO: Implement actual validation logic based on config.validation rules
    const errors: string[] = [];
    if (metadata.featurePoints && metadata.featurePoints.length > this.config.validation.maxFeaturePoints) {
      errors.push(`Exceeded maximum feature points (${this.config.validation.maxFeaturePoints})`);
    }
    // Add more checks...
    return { isValid: errors.length === 0, errors };
  }

  getPerformanceMetrics(): any { // Return type might need refinement
    this.logger.debug('getPerformanceMetrics called (stub)');
    // TODO: Implement actual performance metrics aggregation
    // Access db/cache adapters for their metrics if they expose them
    return { 
        cacheStats: this.getCacheStats(), 
        dbQueries: 0, // Placeholder 
        // Potentially add average response times, etc.
    };
  }
} 