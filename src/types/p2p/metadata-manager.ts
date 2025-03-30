import { Vector3 } from 'three';
import {
  P2PError,
  ValidationResult,
  PerformanceMetrics,
  P2PConfig,
  BaseMetadata,
  Orientation,
  SafetyConstraints,
  Feature,
  Logger,
} from './shared';

/**
 * Configuration for the Metadata Manager
 */
export interface MetadataManagerConfig extends P2PConfig {
  database: {
    table: string;
    schema: string;
  };
  caching: {
    enabled: boolean;
    ttl: number;
  };
  validation: {
    strict: boolean;
    maxFeaturePoints: number;
  };
}

/**
 * Model metadata
 */
export interface ModelMetadata extends BaseMetadata {
  modelId: string;
  userId: string;
  file: File;
  orientation: Orientation;
  featurePoints: Feature[];
  preferences: UserPreferences;
}

/**
 * User preferences for model viewing
 */
export interface UserPreferences {
  defaultCameraDistance: number;
  preferredViewingAngles: ViewingAngle[];
  safetyConstraints: SafetyConstraints;
}

/**
 * Viewing angle definition
 */
export interface ViewingAngle {
  position: Vector3;
  target: Vector3;
  description: string;
}

/**
 * Feature point with additional metadata
 */
export interface ModelFeaturePoint extends Feature {
  modelId: string;
  userId: string;
  type: 'landmark' | 'reference' | 'constraint';
  metadata?: Record<string, unknown>;
}

/**
 * Main Metadata Manager interface
 */
export interface MetadataManager {
  /**
   * Initialize the manager with configuration
   */
  initialize(config: MetadataManagerConfig): Promise<void>;

  /**
   * Store metadata for a model
   */
  storeModelMetadata(modelId: string, metadata: Omit<ModelMetadata, keyof BaseMetadata>): Promise<void>;

  /**
   * Retrieve metadata for a model
   */
  getModelMetadata(modelId: string): Promise<ModelMetadata>;

  /**
   * Update model orientation
   */
  updateModelOrientation(modelId: string, orientation: Orientation): Promise<void>;

  /**
   * Add a feature point
   */
  addFeaturePoint(modelId: string, point: Omit<ModelFeaturePoint, keyof BaseMetadata>): Promise<void>;

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
   * Validate metadata
   */
  validateMetadata(metadata: ModelMetadata): ValidationResult;

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics;
}

/**
 * Metadata Manager factory interface
 */
export interface MetadataManagerFactory {
  create(config: MetadataManagerConfig, logger: Logger): MetadataManager;
}

/**
 * Metadata Manager error types
 */
export class MetadataManagerError extends P2PError {
  constructor(message: string, code: string) {
    super(message, code, 'MetadataManager');
  }
}

export class DatabaseError extends MetadataManagerError {
  constructor(message: string) {
    super(message, 'DATABASE_ERROR');
  }
}

export class ValidationError extends MetadataManagerError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends MetadataManagerError {
  constructor(message: string) {
    super(message, 'NOT_FOUND_ERROR');
  }
}

export class DuplicateError extends MetadataManagerError {
  constructor(message: string) {
    super(message, 'DUPLICATE_ERROR');
  }
} 