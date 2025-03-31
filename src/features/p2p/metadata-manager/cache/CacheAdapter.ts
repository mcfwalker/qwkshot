import { ModelMetadata, ModelFeaturePoint } from '../../../../types/p2p/metadata-manager';

/**
 * Interface for cache operations
 */
export interface CacheAdapter {
  /**
   * Initialize the cache
   */
  initialize(): Promise<void>;

  /**
   * Store model metadata in cache
   */
  setModelMetadata(modelId: string, metadata: ModelMetadata, ttl?: number): Promise<void>;

  /**
   * Get model metadata from cache
   */
  getModelMetadata(modelId: string): Promise<ModelMetadata | null>;

  /**
   * Store feature points in cache
   */
  setFeaturePoints(modelId: string, points: ModelFeaturePoint[], ttl?: number): Promise<void>;

  /**
   * Get feature points from cache
   */
  getFeaturePoints(modelId: string): Promise<ModelFeaturePoint[] | null>;

  /**
   * Remove model metadata from cache
   */
  removeModelMetadata(modelId: string): Promise<void>;

  /**
   * Remove feature points from cache
   */
  removeFeaturePoints(modelId: string): Promise<void>;

  /**
   * Clear all cached data
   */
  clear(): Promise<void>;

  /**
   * Get cache statistics
   */
  getStats(): {
    hits: number;
    misses: number;
    size: number;
  };
} 