import { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { DatabaseAdapter } from './DatabaseAdapter';
import { ModelMetadata, ModelFeaturePoint, UserPreferences, DatabaseError, NotFoundError } from '../../../../types/p2p/metadata-manager';
import { Orientation, BaseMetadata } from '../../../../types/p2p/shared';
import { Logger } from '../../../../types/p2p/shared';
import { getSupabaseClient } from '../../../../lib/supabase';

/**
 * Configuration for the Supabase adapter
 */
export interface SupabaseAdapterConfig {
  url: string;
  key: string;
}

/**
 * Supabase implementation of the DatabaseAdapter
 */
export class SupabaseAdapter implements DatabaseAdapter {
  private client: SupabaseClient;
  private logger: Logger;

  constructor(config: SupabaseAdapterConfig, logger: Logger) {
    this.client = getSupabaseClient();
    this.logger = logger;
  }

  /**
   * Initialize the database connection
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Supabase adapter');
      const { error } = await this.client.from('models').select('id').limit(1);
      if (error) throw new DatabaseError(error.message);
      this.logger.info('Supabase adapter initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Supabase adapter', error);
      throw error instanceof DatabaseError ? error : new DatabaseError('Failed to initialize database connection');
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
      this.logger.info(`Storing metadata for model: ${modelId}`, { 
        originalMetadata: metadata,
        hasAnalysis: !!metadata.analysis,
        hasEnvironment: !!metadata.analysis?.environment,
        environmentData: metadata.analysis?.environment
      });

      // Construct the complete metadata object directly
      const now = new Date();
      const completeMetadataPayload = {
        // Spreading originalMetadata ensures we keep fields not explicitly listed
        ...metadata,
        // Explicitly set/overwrite fields managed by this function
        id: modelId, // Ensure these IDs are set if not present in incoming metadata
        modelId,
        updatedAt: now.toISOString(),
        // Increment version based on a default or assume 1 if no existing data concept
        // Use incoming version if available, otherwise default calculation
        version: metadata.version ? metadata.version + 1 : 1, 
        // Ensure analysis structure is present with defaults
        analysis: {
          geometry: metadata.analysis?.geometry || {},
          environment: metadata.analysis?.environment || { 
              bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 }, center: { x: 0, y: 0, z: 0 }, dimensions: { width: 0, height: 0, depth: 0 } },
              floorOffset: 0,
              distances: {},
              constraints: { minDistance: 0, maxDistance: 0, minHeight: 0, maxHeight: 0 }
          },
          performance: metadata.analysis?.performance || {}
        },
        // Conditionally add createdAt if it exists in the input
        ...(metadata.createdAt && { 
          createdAt: metadata.createdAt instanceof Date 
            ? metadata.createdAt 
            : new Date(metadata.createdAt) 
        })
      };

      this.logger.info(`Prepared complete metadata payload for storage:`, { 
        metadataPayload: completeMetadataPayload
      });

      // Directly update the model with the complete payload
      const { error } = await this.client
        .from('models')
        .update({ metadata: completeMetadataPayload }) // Update with the fully formed object
        .eq('id', modelId);

      if (error) {
        this.logger.error(`Database error while storing metadata: ${error.message}`, { error });
        throw new DatabaseError(error.message);
      }

      this.logger.info(`Successfully stored metadata for model: ${modelId}`);

    } catch (error) {
      this.logger.error('Failed to store model metadata', error instanceof Error ? { message: error.message, stack: error.stack } : { error });
      throw error;
    }
  }

  /**
   * Retrieve model metadata
   */
  async getModelMetadata(modelId: string): Promise<ModelMetadata> {
    try {
      this.logger.info(`Retrieving metadata for model: ${modelId}`);
      
      const { data, error } = await this.client
        .from('models')
        .select(`
          id,
          created_at,
          metadata,
          user_id,
          file_url
        `)
        .eq('id', modelId)
        .single();

      if (error) throw new DatabaseError(error.message);
      if (!data) throw new NotFoundError(`Model not found: ${modelId}`);

      const metadata = data.metadata || {};
      
      return {
        id: data.id,
        modelId: data.id,
        userId: data.user_id,
        file: data.file_url,
        orientation: metadata.orientation || {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        },
        preferences: metadata.preferences || {
          defaultCameraDistance: 5,
          defaultCameraHeight: 2,
          preferredViewAngles: [0, 45, 90],
          uiPreferences: {
            showGrid: true,
            showAxes: true,
            showMeasurements: true
          }
        },
        featurePoints: metadata.featurePoints || [],
        createdAt: new Date(data.created_at),
        updatedAt: new Date(metadata.updatedAt || data.created_at),
        version: metadata.version || 1,
        analysis: {
          geometry: metadata.analysis?.geometry || {},
          environment: {
            bounds: metadata.analysis?.environment?.bounds || {
              min: { x: 0, y: 0, z: 0 },
              max: { x: 0, y: 0, z: 0 },
              center: { x: 0, y: 0, z: 0 },
              dimensions: { width: 0, height: 0, depth: 0 }
            },
            floorOffset: metadata.analysis?.environment?.floorOffset || 0,
            distances: metadata.analysis?.environment?.distances || {},
            constraints: metadata.analysis?.environment?.constraints || {
              minDistance: 0,
              maxDistance: 0,
              minHeight: 0,
              maxHeight: 0
            }
          },
          performance: metadata.analysis?.performance || {}
        }
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve metadata for model: ${modelId}`, error);
      if (error instanceof NotFoundError) throw error;
      throw error instanceof DatabaseError ? error : new DatabaseError(`Failed to retrieve metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update model orientation
   */
  async updateModelOrientation(
    modelId: string,
    orientation: Orientation
  ): Promise<void> {
    try {
      this.logger.info(`Updating orientation for model: ${modelId}`);
      
      // Get existing metadata
      const { data: existingData, error: fetchError } = await this.client
        .from('models')
        .select('metadata')
        .eq('id', modelId)
        .single();

      if (fetchError) throw new DatabaseError(fetchError.message);

      // Update metadata with new orientation
      const existingMetadata = existingData?.metadata || {};
      const updatedMetadata = {
        ...existingMetadata,
        p2p: {
          ...existingMetadata.p2p,
          orientation
        }
      };

      const { error } = await this.client
        .from('models')
        .update({ metadata: updatedMetadata })
        .eq('id', modelId);

      if (error) throw new DatabaseError(error.message);

      this.logger.info(`Successfully updated orientation for model: ${modelId}`);
    } catch (error) {
      this.logger.error(`Failed to update orientation for model: ${modelId}`, error);
      throw error instanceof DatabaseError ? error : new DatabaseError(`Failed to update orientation: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      this.logger.info(`Adding feature point for model: ${modelId}`);
      
      const { error } = await this.client
        .from('feature_points')
        .insert({
          model_id: modelId,
          user_id: point.userId,
          type: point.type,
          position: point.position,
          description: point.description,
          measurements: point.measurements
        });

      if (error) throw new DatabaseError(error.message);

      this.logger.info(`Successfully added feature point for model: ${modelId}`);
    } catch (error) {
      this.logger.error(`Failed to add feature point for model: ${modelId}`, error);
      if (error instanceof DatabaseError) throw error;
      throw new DatabaseError(`Failed to add feature point: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove a feature point
   */
  async removeFeaturePoint(modelId: string, pointId: string): Promise<void> {
    try {
      this.logger.info(`Removing feature point ${pointId} for model: ${modelId}`);
      
      const { error } = await this.client
        .from('feature_points')
        .delete()
        .eq('id', pointId)
        .eq('model_id', modelId);

      if (error) throw new DatabaseError(error.message);

      this.logger.info(`Successfully removed feature point ${pointId} for model: ${modelId}`);
    } catch (error) {
      this.logger.error(`Failed to remove feature point ${pointId} for model: ${modelId}`, error);
      throw error instanceof DatabaseError ? error : new DatabaseError(`Failed to remove feature point: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all feature points for a model
   */
  async getFeaturePoints(modelId: string): Promise<ModelFeaturePoint[]> {
    try {
      this.logger.info(`Retrieving feature points for model: ${modelId}`);
      
      const { data, error } = await this.client
        .from('feature_points')
        .select('*')
        .eq('model_id', modelId);

      if (error) throw new DatabaseError(error.message);

      return (data || []).map(row => ({
        id: row.id,
        modelId: row.model_id,
        userId: row.user_id,
        type: row.type,
        position: row.position,
        description: row.description,
        measurements: row.measurements,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        version: row.version
      }));
    } catch (error) {
      this.logger.error(`Failed to retrieve feature points for model: ${modelId}`, error);
      throw error instanceof DatabaseError ? error : new DatabaseError(`Failed to retrieve feature points: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(
    modelId: string,
    preferences: UserPreferences
  ): Promise<void> {
    try {
      this.logger.info(`Updating preferences for model: ${modelId}`);
      
      // Get existing metadata
      const { data: existingData, error: fetchError } = await this.client
        .from('models')
        .select('metadata')
        .eq('id', modelId)
        .single();

      if (fetchError) throw new DatabaseError(fetchError.message);

      // Update metadata with new preferences
      const existingMetadata = existingData?.metadata || {};
      const updatedMetadata = {
        ...existingMetadata,
        p2p: {
          ...existingMetadata.p2p,
          preferences
        }
      };

      const { error } = await this.client
        .from('models')
        .update({ metadata: updatedMetadata })
        .eq('id', modelId);

      if (error) throw new DatabaseError(error.message);

      this.logger.info(`Successfully updated preferences for model: ${modelId}`);
    } catch (error) {
      this.logger.error(`Failed to update preferences for model: ${modelId}`, error);
      throw error instanceof DatabaseError ? error : new DatabaseError(`Failed to update preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a model exists
   */
  async modelExists(modelId: string): Promise<boolean> {
    try {
      const { data, error } = await this.client
        .from('models')
        .select('id')
        .eq('id', modelId)
        .single();

      if (error && error.code !== 'PGRST116') throw new DatabaseError(error.message);
      return !!data;
    } catch (error) {
      this.logger.error(`Failed to check model existence: ${modelId}`, error);
      throw error instanceof DatabaseError ? error : new DatabaseError(`Failed to check model existence: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the number of feature points for a model
   */
  async getFeaturePointCount(modelId: string): Promise<number> {
    try {
      const { count, error } = await this.client
        .from('feature_points')
        .select('*', { count: 'exact', head: true })
        .eq('model_id', modelId);

      if (error) throw new DatabaseError(error.message);
      return count || 0;
    } catch (error) {
      this.logger.error(`Failed to get feature point count for model: ${modelId}`, error);
      throw error instanceof DatabaseError ? error : new DatabaseError(`Failed to get feature point count: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 