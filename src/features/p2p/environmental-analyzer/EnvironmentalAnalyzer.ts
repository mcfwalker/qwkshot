import { Vector3, Box3 } from 'three';
import {
  EnvironmentalAnalyzerConfig,
  EnvironmentalAnalysis,
  EnvironmentalAnalyzer,
  EnvironmentBounds,
  ObjectMeasurements,
  DistanceMeasurements,
  CameraConstraints,
  AnalysisError,
  ValidationError,
  MeasurementError,
} from '../../../types/p2p/environmental-analyzer';
import { Logger, ValidationResult, PerformanceMetrics } from '../../../types/p2p/shared';
import { SceneAnalysis } from '../../../types/p2p/scene-analyzer';

export class EnvironmentalAnalyzerImpl implements EnvironmentalAnalyzer {
  private config: EnvironmentalAnalyzerConfig;
  private initialized: boolean = false;
  private performanceMetrics: PerformanceMetrics = {
    startTime: 0,
    endTime: 0,
    duration: 0,
    operations: [],
    cacheHits: 0,
    cacheMisses: 0,
    databaseQueries: 0,
    averageResponseTime: 0
  };

  constructor(config: EnvironmentalAnalyzerConfig, private logger: Logger) {
    this.config = config;
  }

  async initialize(config: EnvironmentalAnalyzerConfig): Promise<void> {
    this.logger.info('Initializing Environmental Analyzer with config:', config);
    this.config = config;
    this.initialized = true;
    this.logger.info('Environmental Analyzer initialized successfully');
  }

  async analyzeEnvironment(sceneAnalysis: SceneAnalysis): Promise<EnvironmentalAnalysis> {
    if (!this.initialized) {
      this.logger.error('Environmental Analyzer not initialized');
      throw new AnalysisError('Environmental Analyzer not initialized');
    }

    const startTime = performance.now();
    this.logger.info('Starting environment analysis with scene:', sceneAnalysis);

    try {
      // Calculate environment bounds
      const environment = this.calculateEnvironmentBounds();
      this.logger.info('Environment bounds calculated:', environment);

      // Extract object measurements from scene analysis
      const object = this.extractObjectMeasurements(sceneAnalysis);
      this.logger.info('Object measurements extracted:', object);

      // Calculate distances from object to boundaries
      const distances = this.calculateDistances(environment, object);
      this.logger.info('Distances calculated:', distances);

      // Calculate camera constraints
      const cameraConstraints = this.calculateCameraConstraints(object);
      this.logger.info('Camera constraints calculated:', cameraConstraints);

      const endTime = performance.now();
      this.performanceMetrics = {
        startTime,
        endTime,
        duration: endTime - startTime,
        operations: [
          {
            name: 'environment_analysis',
            duration: endTime - startTime,
            success: true,
          },
        ],
        cacheHits: 0,
        cacheMisses: 0,
        databaseQueries: 0,
        averageResponseTime: endTime - startTime
      };

      const analysis = {
        environment,
        object,
        distances,
        cameraConstraints,
        performance: this.performanceMetrics,
      };

      this.logger.info('Environment analysis completed:', analysis);
      return analysis;
    } catch (error) {
      this.logger.error('Environment analysis failed:', error);
      throw new AnalysisError('Failed to analyze environment');
    }
  }

  async getEnvironmentMeasurements(
    analysis: EnvironmentalAnalysis
  ): Promise<{ environment: EnvironmentBounds; object: ObjectMeasurements }> {
    return {
      environment: analysis.environment,
      object: analysis.object,
    };
  }

  async getDistanceMeasurements(analysis: EnvironmentalAnalysis): Promise<DistanceMeasurements> {
    return analysis.distances;
  }

  async getCameraConstraints(analysis: EnvironmentalAnalysis): Promise<CameraConstraints> {
    return analysis.cameraConstraints;
  }

  async validateCameraPosition(
    analysis: EnvironmentalAnalysis,
    position: { position: Vector3; target: Vector3 }
  ): Promise<ValidationResult> {
    const { position: cameraPos, target } = position;
    const { cameraConstraints } = analysis;

    // Calculate camera height
    const height = cameraPos.y;

    // Calculate distance from camera to target
    const distance = cameraPos.distanceTo(target);

    // Validate height constraints
    if (height < cameraConstraints.minHeight || height > cameraConstraints.maxHeight) {
      return {
        isValid: false,
        errors: ['Camera height outside allowed range'],
      };
    }

    // Validate distance constraints
    if (distance < cameraConstraints.minDistance || distance > cameraConstraints.maxDistance) {
      return {
        isValid: false,
        errors: ['Camera distance outside allowed range'],
      };
    }

    return { isValid: true, errors: [] };
  }

  async getCameraRanges(analysis: EnvironmentalAnalysis): Promise<{
    height: { min: number; max: number };
    distance: { min: number; max: number };
  }> {
    const { cameraConstraints } = analysis;
    return {
      height: {
        min: cameraConstraints.minHeight,
        max: cameraConstraints.maxHeight,
      },
      distance: {
        min: cameraConstraints.minDistance,
        max: cameraConstraints.maxDistance,
      },
    };
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return this.performanceMetrics;
  }

  private calculateEnvironmentBounds(): EnvironmentBounds {
    const { width, height, depth } = this.config.environmentSize;
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const halfDepth = depth / 2;

    return {
      bounds: {
        min: new Vector3(-halfWidth, 0, -halfDepth),
        max: new Vector3(halfWidth, height, halfDepth),
        center: new Vector3(0, height / 2, 0),
      },
      dimensions: {
        width,
        height,
        depth,
      },
    };
  }

  private extractObjectMeasurements(sceneAnalysis: SceneAnalysis): ObjectMeasurements {
    const { boundingBox, center, dimensions } = sceneAnalysis.glb.geometry;

    return {
      bounds: {
        min: boundingBox.min.clone(),
        max: boundingBox.max.clone(),
        center: center.clone(),
      },
      dimensions: {
        width: dimensions.x,
        height: dimensions.y,
        depth: dimensions.z,
      },
      floorOffset: boundingBox.min.y,  // Use the bottom of the bounding box as the floor offset
    };
  }

  private calculateDistances(
    environment: EnvironmentBounds,
    object: ObjectMeasurements
  ): DistanceMeasurements {
    const { bounds: envBounds } = environment;
    const { bounds: objBounds } = object;

    return {
      fromObjectToBoundary: {
        left: Math.abs(envBounds.min.x - objBounds.min.x),
        right: Math.abs(envBounds.max.x - objBounds.max.x),
        front: Math.abs(envBounds.min.z - objBounds.min.z),
        back: Math.abs(envBounds.max.z - objBounds.max.z),
        top: Math.abs(envBounds.max.y - objBounds.max.y),
        bottom: Math.abs(envBounds.min.y - objBounds.min.y),
      },
    };
  }

  /**
   * Recalculate constraints based on floor offset changes
   */
  async recalculateConstraints(
    analysis: EnvironmentalAnalysis,
    floorOffset: number
  ): Promise<EnvironmentalAnalysis> {
    if (!this.initialized) {
      throw new AnalysisError('Environmental Analyzer not initialized');
    }

    const startTime = performance.now();
    this.logger.info('Recalculating constraints with new floor offset:', floorOffset);

    try {
      // Update object measurements with new floor offset
      const updatedObject = {
        ...analysis.object,
        bounds: {
          ...analysis.object.bounds,
          min: new Vector3(
            analysis.object.bounds.min.x,
            floorOffset,
            analysis.object.bounds.min.z
          ),
          max: new Vector3(
            analysis.object.bounds.max.x,
            floorOffset + analysis.object.dimensions.height,
            analysis.object.bounds.max.z
          ),
          center: new Vector3(
            analysis.object.bounds.center.x,
            floorOffset + analysis.object.dimensions.height / 2,
            analysis.object.bounds.center.z
          ),
        },
      };

      // Recalculate distances with updated object position
      const distances = this.calculateDistances(analysis.environment, updatedObject);

      // Recalculate camera constraints with updated object position
      const cameraConstraints = this.calculateCameraConstraints(updatedObject);

      const endTime = performance.now();
      this.performanceMetrics = {
        ...this.performanceMetrics,
        startTime,
        endTime,
        duration: endTime - startTime,
        operations: [
          ...this.performanceMetrics.operations,
          {
            name: 'recalculate_constraints',
            duration: endTime - startTime,
            success: true,
          },
        ],
        cacheHits: 0,
        cacheMisses: 0,
        databaseQueries: 0,
        averageResponseTime: endTime - startTime
      };

      return {
        ...analysis,
        object: updatedObject,
        distances,
        cameraConstraints,
        performance: this.performanceMetrics,
      };
    } catch (error) {
      this.logger.error('Failed to recalculate constraints:', error);
      throw new AnalysisError('Failed to recalculate constraints');
    }
  }

  private calculateCameraConstraints(object: ObjectMeasurements): CameraConstraints {
    const { height } = object.dimensions;
    const { floorOffset } = object;

    // Base camera constraints on object height and floor offset
    const minHeight = floorOffset + height * 0.5;  // Minimum height is half the object height above floor
    const maxHeight = floorOffset + height * 3;    // Maximum height is 3x the object height above floor
    const minDistance = height * 0.8;              // Minimum distance is 0.8x the object height
    const maxDistance = height * 5;                // Maximum distance is 5x the object height

    return {
      minHeight,
      maxHeight,
      minDistance,
      maxDistance,
    };
  }

  /**
   * Update camera constraints based on floor offset changes
   */
  async updateCameraConstraints(
    analysis: EnvironmentalAnalysis,
    floorOffset: number
  ): Promise<CameraConstraints> {
    if (!this.initialized) {
      throw new AnalysisError('Environmental Analyzer not initialized');
    }

    const startTime = performance.now();
    this.logger.info('Updating camera constraints with new floor offset:', floorOffset);

    try {
      // Create updated object measurements with new floor offset
      const updatedObject = {
        ...analysis.object,
        bounds: {
          ...analysis.object.bounds,
          min: new Vector3(
            analysis.object.bounds.min.x,
            floorOffset,
            analysis.object.bounds.min.z
          ),
          max: new Vector3(
            analysis.object.bounds.max.x,
            floorOffset + analysis.object.dimensions.height,
            analysis.object.bounds.max.z
          ),
          center: new Vector3(
            analysis.object.bounds.center.x,
            floorOffset + analysis.object.dimensions.height / 2,
            analysis.object.bounds.center.z
          ),
        },
      };

      // Calculate new camera constraints
      const cameraConstraints = this.calculateCameraConstraints(updatedObject);

      const endTime = performance.now();
      this.performanceMetrics = {
        ...this.performanceMetrics,
        startTime,
        endTime,
        duration: endTime - startTime,
        operations: [
          ...this.performanceMetrics.operations,
          {
            name: 'update_camera_constraints',
            duration: endTime - startTime,
            success: true,
          },
        ],
        cacheHits: 0,
        cacheMisses: 0,
        databaseQueries: 0,
        averageResponseTime: endTime - startTime
      };

      return cameraConstraints;
    } catch (error) {
      this.logger.error('Failed to update camera constraints:', error);
      throw new AnalysisError('Failed to update camera constraints');
    }
  }
} 