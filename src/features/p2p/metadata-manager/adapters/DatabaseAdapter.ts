import { ModelMetadata, ModelFeaturePoint, UserPreferences } from '../../../../types/p2p/metadata-manager';
import { Orientation } from '../../../../types/p2p/shared';
import { EnvironmentalMetadata } from '../../../../types/p2p/environmental-metadata';

/**
 * Interface for database operations
 */
export interface DatabaseAdapter {
  /**
   * Initialize the database connection
   */
  initialize(): Promise<void>;

  /**
   * Store model metadata
   */
  storeModelMetadata(
    modelId: string,
    metadata: ModelMetadata
  ): Promise<void>;

  /**
   * Retrieve model metadata
   */
  getModelMetadata(modelId: string): Promise<ModelMetadata>;

  /**
   * Store environmental metadata
   */
  storeEnvironmentalMetadata(
    modelId: string,
    metadata: EnvironmentalMetadata
  ): Promise<void>;

  /**
   * Retrieve environmental metadata
   */
  getEnvironmentalMetadata(modelId: string): Promise<EnvironmentalMetadata | null>;

  /**
   * Update environmental metadata
   */
  updateEnvironmentalMetadata(
    modelId: string,
    metadata: Partial<EnvironmentalMetadata>
  ): Promise<void>;

  /**
   * Update model orientation
   */
  updateModelOrientation(modelId: string, orientation: Orientation): Promise<void>;

  /**
   * Add a feature point
   */
  addFeaturePoint(
    modelId: string,
    point: Pick<ModelFeaturePoint, 'userId' | 'type' | 'position' | 'description' | 'measurements'>
  ): Promise<void>;

  /**
   * Remove a feature point
   */
  removeFeaturePoint(modelId: string, pointId: string): Promise<void>;

  /**
   * Get all feature points for a model
   */
  getFeaturePoints(modelId: string): Promise<ModelFeaturePoint[]>;

  /**
   * Update user preferences
   */
  updateUserPreferences(modelId: string, preferences: UserPreferences): Promise<void>;

  /**
   * Check if a model exists
   */
  modelExists(modelId: string): Promise<boolean>;

  /**
   * Get the number of feature points for a model
   */
  getFeaturePointCount(modelId: string): Promise<number>;
} 