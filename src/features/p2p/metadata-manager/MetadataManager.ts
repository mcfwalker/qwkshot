import { DatabaseAdapter } from './adapters/DatabaseAdapter';
import { CacheAdapter } from './cache/CacheAdapter';
import {
  ModelMetadata,
  ModelFeaturePoint,
  UserPreferences,
  DatabaseError,
  NotFoundError,
  ValidationError,
  MetadataManagerConfig,
  MetadataManager as IMetadataManager,
  ValidationResult
} from '../../../types/p2p/metadata-manager';
import { Orientation } from '../../../types/p2p/shared';
import { Logger } from '../../../types/p2p/shared';
import { EnvironmentalMetadata } from '../../../types/p2p/environmental-metadata';

const DEFAULT_CONFIG: Required<MetadataManagerConfig> = {
  database: {
    type: 'supabase',
    url: '',
    key: ''
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
    metadata: ModelMetadata
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

  /**
   * Update floor offset
   */
  async updateFloorOffset(modelId: string, floorOffset: number): Promise<void> {
    try {
      // Validate input
      if (typeof floorOffset !== 'number' || isNaN(floorOffset)) {
        throw new ValidationError('floorOffset must be a valid number');
      }

      // Get current metadata
      const metadata = await this.getModelMetadata(modelId);
      const objectHeight = metadata.geometry.dimensions.y;

      // Validate floor offset
      if (floorOffset < -objectHeight) {
        throw new ValidationError('floorOffset cannot be less than negative object height');
      }

      // Update camera constraints based on new floor offset
      const currentConstraints = metadata.environment.constraints || {
        minDistance: 1,
        maxDistance: 20,
        minHeight: floorOffset + objectHeight * 0.5,
        maxHeight: floorOffset + objectHeight * 3,
        maxSpeed: 1,
        maxAngleChange: 45,
        minFramingMargin: 0.1
      };

      metadata.environment.constraints = {
        ...currentConstraints,
        minHeight: floorOffset + objectHeight * 0.5,  // Minimum height is half the object height above floor
        maxHeight: floorOffset + objectHeight * 3     // Maximum height is 3x the object height above floor
      };

      // Store updated metadata
      await this.storeModelMetadata(modelId, metadata);

      this.logger.info(`Updated floor offset for model: ${modelId} to ${floorOffset}`);
    } catch (error) {
      this.logger.error(`Failed to update floor offset for model: ${modelId}`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to update floor offset for model: ${modelId}`);
    }
  }

  async createMetadata(modelId: string, userId: string, file: string): Promise<ModelMetadata> {
    if (!modelId || !userId || !file) {
      throw new ValidationError('modelId, userId, and file are required');
    }

    const now = new Date();
    const metadata: ModelMetadata = {
      id: modelId,
      modelId,
      userId,
      file,
      createdAt: now,
      updatedAt: now,
      version: 1,
      orientation: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      },
      featurePoints: [],
      preferences: {
        defaultCameraDistance: 5,
        defaultCameraHeight: 1.6,
        preferredViewAngles: [0, 45, 90, 135, 180],
        uiPreferences: {
          showGrid: true,
          showAxes: true,
          showMeasurements: true
        }
      },
      geometry: {
        vertexCount: 0,
        faceCount: 0,
        boundingBox: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 0, y: 0, z: 0 }
        },
        center: { x: 0, y: 0, z: 0 },
        dimensions: { x: 0, y: 0, z: 0 }
      },
      environment: {
        lighting: {
          intensity: 1,
          color: '#FFFFFF',
          position: { x: 0, y: 10, z: 0 }
        },
        camera: {
          position: { x: 0, y: 2, z: 5 },
          target: { x: 0, y: 0, z: 0 },
          fov: 45
        },
        scene: {
          background: '#000000',
          ground: '#808080',
          atmosphere: '#87CEEB'
        },
        constraints: {
          minDistance: 1,
          maxDistance: 20,
          minHeight: 0.5,
          maxHeight: 10,
          maxSpeed: 1,
          maxAngleChange: 45,
          minFramingMargin: 0.1
        },
        performance: {
          startTime: now.getTime(),
          endTime: now.getTime(),
          duration: 0,
          operations: []
        }
      },
      performance_metrics: {
        sceneAnalysis: {
          startTime: 0,
          endTime: 0,
          duration: 0,
          operations: [],
          cacheHits: 0,
          cacheMisses: 0,
          databaseQueries: 0,
          averageResponseTime: 0
        },
        environmentalAnalysis: {
          startTime: 0,
          endTime: 0,
          duration: 0,
          operations: [],
          cacheHits: 0,
          cacheMisses: 0,
          databaseQueries: 0,
          averageResponseTime: 0
        }
      }
    };

    await this.storeModelMetadata(modelId, metadata);
    return metadata;
  }

  async updateEnvironmentalAnalysis(
    modelId: string, 
    environmentalData: EnvironmentalMetadata
  ): Promise<void> {
    try {
      this.logger.info(`Updating environmental analysis for model: ${modelId}`, {
        environmentalData
      });

      // Get current metadata
      const metadata = await this.getModelMetadata(modelId);

      // Update environmental analysis
      metadata.environment = {
        ...metadata.environment,
        ...environmentalData
      };

      // Store updated metadata
      await this.storeModelMetadata(modelId, metadata);

      this.logger.info(`Successfully updated environmental analysis for model: ${modelId}`);
    } catch (error) {
      this.logger.error(`Failed to update environmental analysis for model: ${modelId}`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to update environmental analysis for model: ${modelId}`);
    }
  }

  /**
   * Store environmental metadata
   */
  async storeEnvironmentalMetadata(
    modelId: string,
    metadata: EnvironmentalMetadata
  ): Promise<void> {
    try {
      // Validate metadata before storing
      const validation = this.validateEnvironmentalMetadata(metadata);
      if (!validation.isValid) {
        throw new ValidationError(`Invalid environmental metadata: ${validation.errors.join(', ')}`);
      }

      await this.db.storeEnvironmentalMetadata(modelId, metadata);
      if (this.config.caching.enabled) {
        await this.cache.removeModelMetadata(modelId); // Invalidate cache
      }
      this.logger.info(`Stored environmental metadata for model: ${modelId}`);
    } catch (error) {
      this.logger.error(`Failed to store environmental metadata for model: ${modelId}`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to store environmental metadata for model: ${modelId}`);
    }
  }

  /**
   * Get environmental metadata with caching
   */
  async getEnvironmentalMetadata(modelId: string): Promise<EnvironmentalMetadata> {
    try {
      // Try cache first if enabled
      if (this.config.caching.enabled) {
        const cached = await this.cache.getModelMetadata(modelId);
        if (cached?.environment) {
          this.logger.debug(`Cache hit for environmental metadata: ${modelId}`);
          return cached.environment;
        }
      }

      // Get from database
      const metadata = await this.db.getEnvironmentalMetadata(modelId);
      
      // Store in cache if enabled
      if (this.config.caching.enabled) {
        const modelMetadata = await this.getModelMetadata(modelId);
        await this.cache.setModelMetadata(modelId, modelMetadata, this.config.caching.ttl);
      }

      return metadata;
    } catch (error) {
      this.logger.error(`Failed to get environmental metadata for model: ${modelId}`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to get environmental metadata for model: ${modelId}`);
    }
  }

  /**
   * Update environmental metadata
   */
  async updateEnvironmentalMetadata(
    modelId: string,
    metadata: Partial<EnvironmentalMetadata>
  ): Promise<void> {
    try {
      // Get current metadata
      const current = await this.getEnvironmentalMetadata(modelId);
      
      // Merge with new metadata
      const updated = { ...current, ...metadata };

      // Validate merged metadata
      const validation = this.validateEnvironmentalMetadata(updated);
      if (!validation.isValid) {
        throw new ValidationError(`Invalid environmental metadata: ${validation.errors.join(', ')}`);
      }

      await this.db.updateEnvironmentalMetadata(modelId, metadata);
      if (this.config.caching.enabled) {
        await this.cache.removeModelMetadata(modelId); // Invalidate cache
      }
      this.logger.info(`Updated environmental metadata for model: ${modelId}`);
    } catch (error) {
      this.logger.error(`Failed to update environmental metadata for model: ${modelId}`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to update environmental metadata for model: ${modelId}`);
    }
  }

  /**
   * Validate environmental metadata
   */
  validateEnvironmentalMetadata(metadata: EnvironmentalMetadata): ValidationResult {
    this.logger.debug('Validating environmental metadata', metadata);
    const errors: string[] = [];

    // Validate lighting
    if (metadata.lighting) {
      if (metadata.lighting.intensity !== undefined && (metadata.lighting.intensity < 0 || metadata.lighting.intensity > 1)) {
        errors.push('Lighting intensity must be between 0 and 1');
      }
      if (metadata.lighting.color && !/^#[0-9A-Fa-f]{6}$/.test(metadata.lighting.color)) {
        errors.push('Lighting color must be a valid hex color (e.g., #FF0000)');
      }
    }

    // Validate camera
    if (metadata.camera) {
      if (metadata.camera.fov !== undefined && (metadata.camera.fov < 0 || metadata.camera.fov > 180)) {
        errors.push('Camera FOV must be between 0 and 180 degrees');
      }
    }

    // Validate constraints
    if (metadata.constraints) {
      if (metadata.constraints.minDistance !== undefined && metadata.constraints.maxDistance !== undefined) {
        if (metadata.constraints.minDistance > metadata.constraints.maxDistance) {
          errors.push('Minimum distance cannot be greater than maximum distance');
        }
      }
      if (metadata.constraints.minHeight !== undefined && metadata.constraints.maxHeight !== undefined) {
        if (metadata.constraints.minHeight > metadata.constraints.maxHeight) {
          errors.push('Minimum height cannot be greater than maximum height');
        }
      }
      if (metadata.constraints.maxSpeed !== undefined && metadata.constraints.maxSpeed <= 0) {
        errors.push('Maximum speed must be greater than 0');
      }
      if (metadata.constraints.maxAngleChange !== undefined && metadata.constraints.maxAngleChange <= 0) {
        errors.push('Maximum angle change must be greater than 0');
      }
      if (metadata.constraints.minFramingMargin !== undefined && metadata.constraints.minFramingMargin < 0) {
        errors.push('Minimum framing margin cannot be negative');
      }
    }

    return { isValid: errors.length === 0, errors };
  }
} 