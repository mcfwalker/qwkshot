import { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { DatabaseAdapter } from './DatabaseAdapter';
import { ModelMetadata, ModelFeaturePoint, UserPreferences, DatabaseError, NotFoundError } from '../../../../types/p2p/metadata-manager';
import { Orientation, BaseMetadata } from '../../../../types/p2p/shared';
import { Logger } from '../../../../types/p2p/shared';
import { EnvironmentalMetadata } from '../../../../types/p2p/environmental-metadata';

/**
 * Supabase implementation of the DatabaseAdapter
 */
export class SupabaseAdapter implements DatabaseAdapter {
  private client: SupabaseClient;
  private logger: Logger;

  constructor(supabaseClient: SupabaseClient, logger: Logger) {
    if (!supabaseClient) {
      logger.error('Supabase client instance was not provided to SupabaseAdapter');
      throw new Error('Supabase client instance is required for SupabaseAdapter');
    }
    this.client = supabaseClient;
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
    console.log(`>>> STORE METADATA CALLED for model: ${modelId}`);
    try {
      this.logger.info(`Storing metadata for model: ${modelId}`);

      // Prepare the payload, ensuring defaults for potentially missing nested fields
      const completeMetadataPayload = {
        ...metadata,
        geometry: metadata.geometry || {
          vertexCount: 0,
          faceCount: 0,
          boundingBox: {
            min: { x: 0, y: 0, z: 0 },
            max: { x: 0, y: 0, z: 0 }
          },
          center: { x: 0, y: 0, z: 0 },
          dimensions: { x: 0, y: 0, z: 0 }
        },
        environment: metadata.environment || {
          bounds: {
            min: { x: 0, y: 0, z: 0 },
            max: { x: 0, y: 0, z: 0 },
            center: { x: 0, y: 0, z: 0 },
            dimensions: { width: 0, height: 0, depth: 0 }
          },
          floorOffset: 0,
          distances: {},
          constraints: {
            minDistance: 0,
            maxDistance: 0,
            minHeight: 0,
            maxHeight: 0
          }
        },
        performance_metrics: metadata.performance_metrics || {
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
        },
        updatedAt: new Date().toISOString(),
        version: (metadata.version || 0) + 1
      };

      // Separate sceneAnalysis from the rest of the metadata
      const { sceneAnalysis, ...restOfMetadata } = completeMetadataPayload;

      this.logger.info(`>>> Data prepared for logging/storage:`, {
          completeMetadataPayload_TYPE: typeof completeMetadataPayload,
          sceneAnalysis_TYPE: typeof sceneAnalysis,
          restOfMetadata_TYPE: typeof restOfMetadata,
          isSceneAnalysisNull: sceneAnalysis === null,
          isSceneAnalysisUndefined: typeof sceneAnalysis === 'undefined',
      });

      this.logger.info(`Storing data for model ${modelId}:`, {
          metadataToStore: restOfMetadata,
          sceneAnalysisToStore: sceneAnalysis
      });

      // Update the model with separate columns
      const { data, error } = await this.client
        .from('models')
        .update({
            metadata: restOfMetadata,
            scene_analysis: sceneAnalysis
         })
        .eq('id', modelId)
        .select();

      if (error) {
        this.logger.error(`Database error while storing metadata: ${error.message}`, { error });
        throw new DatabaseError(error.message);
      }

      this.logger.info(`Successfully stored metadata & scene_analysis for model: ${modelId}`, { responseData: data });

    } catch (error) {
      this.logger.error('Failed to store model metadata', error instanceof Error ? { message: error.message, stack: error.stack } : { error });
      if (error instanceof DatabaseError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError(`Failed to store model metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
          scene_analysis,
          user_id,
          file_url
        `)
        .eq('id', modelId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          this.logger.warn(`Model metadata not found: ${modelId}`);
          throw new NotFoundError(`Model not found: ${modelId}`);
        }
        this.logger.error(`Database error retrieving metadata: ${error.message}`, { error });
        throw new DatabaseError(error.message);
      }
      if (!data) {
        this.logger.warn(`Model metadata query returned no data: ${modelId}`);
        throw new NotFoundError(`Model not found: ${modelId}`);
      }

      const baseMetadata = data.metadata || {};
      const sceneAnalysisData = data.scene_analysis || null;
      
      const result: ModelMetadata = {
        id: data.id,
        modelId: data.id,
        userId: data.user_id,
        file: data.file_url,
        createdAt: new Date(data.created_at),
        orientation: baseMetadata.orientation || {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        },
        preferences: baseMetadata.preferences || {
          defaultCameraDistance: 5,
          defaultCameraHeight: 2,
          preferredViewAngles: [0, 45, 90],
          uiPreferences: {
            showGrid: true,
            showAxes: true,
            showMeasurements: true
          }
        },
        featurePoints: baseMetadata.featurePoints || [],
        updatedAt: new Date(baseMetadata.updatedAt || data.created_at),
        version: baseMetadata.version || 1,
        geometry: baseMetadata.geometry || {
          vertexCount: 0,
          faceCount: 0,
          boundingBox: {
            min: { x: 0, y: 0, z: 0 },
            max: { x: 0, y: 0, z: 0 }
          },
          center: { x: 0, y: 0, z: 0 },
          dimensions: { x: 0, y: 0, z: 0 }
        },
        environment: baseMetadata.environment || {
          bounds: {
            min: { x: 0, y: 0, z: 0 },
            max: { x: 0, y: 0, z: 0 },
            center: { x: 0, y: 0, z: 0 },
            dimensions: { width: 0, height: 0, depth: 0 }
          },
          floorOffset: 0,
          distances: {},
          constraints: {
            minDistance: 0,
            maxDistance: 0,
            minHeight: 0,
            maxHeight: 0
          }
        },
        performance_metrics: baseMetadata.performance_metrics || {
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
        },
        sceneAnalysis: sceneAnalysisData
      };

      this.logger.info(`Successfully retrieved metadata for model: ${modelId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to retrieve metadata for model: ${modelId}`, error);
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Failed to retrieve metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  /**
   * Store environmental metadata
   */
  async storeEnvironmentalMetadata(modelId: string, metadata: EnvironmentalMetadata): Promise<void> {
    try {
      this.logger.info(`Storing environmental metadata for model: ${modelId}`, { metadata, modelId, timestamp: new Date().toISOString() });
      
      const { data, error } = await this.client
        .from('models')
        .update({ environmental_metadata: metadata })
        .eq('id', modelId)
        .select('environmental_metadata'); // Select column to see if update returns it

      // ADD LOG HERE to inspect Supabase direct response
      this.logger.info(`>>> Supabase update response for env_metadata:`, { 
          responseData: data, 
          responseError: error, 
          modelId 
      });

      if (error) {
        this.logger.error(`Database error while storing environmental metadata: ${error.message}`, { error, modelId, metadata });
        throw new DatabaseError(error.message);
      }
      // Original success log (can keep or remove)
      this.logger.info(`Successfully stored environmental metadata for model: ${modelId}`, { storedData: data, modelId });
    } catch (error) {
      this.logger.error(`Failed to store environmental metadata for model: ${modelId}`, { error: error instanceof Error ? { message: error.message, stack: error.stack } : error, modelId, metadata });
      throw new DatabaseError(`Failed to store environmental metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve environmental metadata
   */
  async getEnvironmentalMetadata(modelId: string): Promise<EnvironmentalMetadata | null> {
    try {
      this.logger.info(`Retrieving environmental metadata for model: ${modelId}`);
      
      const { data, error } = await this.client
        .from('models')
        .select('*')
        .eq('id', modelId)
        .single();

      if (error) {
          if (error.code === 'PGRST116') { // Row not found
              this.logger.warn(`Environmental metadata source row not found: ${modelId}`);
              return null; // Return null if row not found
          }
          // Throw other database errors
          this.logger.error(`Database error retrieving environmental metadata: ${error.message}`, { error });
          throw new DatabaseError(error.message);
      } 
      
      // If data exists, return the environmental_metadata field (which might be null)
      this.logger.info(`Successfully retrieved row data for env metadata check: ${modelId}`);
      return data?.environmental_metadata || null; 

    } catch (error) {
      // Log and re-throw specific error types or a generic one
      this.logger.error(`Failed to retrieve environmental metadata for model: ${modelId}`, error);
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
          throw error;
      }
      throw new DatabaseError(`Failed to retrieve environmental metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update environmental metadata
   */
  async updateEnvironmentalMetadata(modelId: string, metadata: Partial<EnvironmentalMetadata>): Promise<void> {
    try {
      this.logger.info(`Updating environmental metadata for model: ${modelId}`);
      const current = await this.getEnvironmentalMetadata(modelId);
      // Handle case where current is null if necessary, or assume it should exist for update
      if (current === null) {
           this.logger.warn(`Attempted to update non-existent environmental metadata for model: ${modelId}. Storing instead.`);
           // Decide whether to throw error or just store the partial data as the full data
           await this.storeEnvironmentalMetadata(modelId, metadata as EnvironmentalMetadata); // Need type assertion or check
           return;
      }
      const updated = { ...current, ...metadata };
      const { error } = await this.client
        .from('models')
        .update({ environmental_metadata: updated })
        .eq('id', modelId);
      if (error) throw new DatabaseError(error.message);
      this.logger.info(`Successfully updated environmental metadata for model: ${modelId}`);
    } catch (error) {
      this.logger.error(`Failed to update environmental metadata for model: ${modelId}`, error);
      throw error instanceof DatabaseError ? error : new DatabaseError(`Failed to update environmental metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}