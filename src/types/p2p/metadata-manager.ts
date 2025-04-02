import { Vector3 } from 'three';
import {
  P2PConfig,
  BaseMetadata,
  Logger,
  SerializedVector3,
  SerializedOrientation
} from './shared';
import { EnvironmentalMetadata } from './environmental-metadata';

/**
 * Configuration for the Metadata Manager
 */
export interface MetadataManagerConfig extends P2PConfig {
  database: {
    type: 'supabase';
    url: string;
    key: string;
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
 * Model metadata interface
 */
export interface ModelMetadata extends BaseMetadata {
  modelId: string;
  userId: string;
  file: string;
  orientation: SerializedOrientation;
  featurePoints: ModelFeaturePoint[];
  preferences: UserPreferences;
  geometry: {
    vertexCount: number;
    faceCount: number;
    boundingBox: {
      min: SerializedVector3;
      max: SerializedVector3;
    };
    center: SerializedVector3;
    dimensions: SerializedVector3;
  };
  environment: EnvironmentalMetadata;
  performance_metrics: {
    sceneAnalysis: PerformanceMetrics;
    environmentalAnalysis: PerformanceMetrics;
  };
}

/**
 * Model feature point interface
 */
export interface ModelFeaturePoint extends BaseMetadata {
  modelId: string;
  userId: string;
  type: 'landmark' | 'region' | 'measurement';
  position: Vector3;
  description?: string;
  measurements?: {
    distance?: number;
    angle?: number;
    area?: number;
  };
}

/**
 * User preferences interface
 */
export interface UserPreferences {
  defaultCameraDistance: number;
  defaultCameraHeight: number;
  preferredViewAngles: number[];
  uiPreferences: {
    showGrid: boolean;
    showAxes: boolean;
    showMeasurements: boolean;
  };
}

/**
 * Orientation interface
 */
export interface Orientation {
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  operations: Array<{
    name: string;
    duration: number;
    success: boolean;
    error?: string;
  }>;
  cacheHits: number;
  cacheMisses: number;
  databaseQueries: number;
  averageResponseTime: number;
}

/**
 * Main Metadata Manager interface
 */
export interface MetadataManager {
  /**
   * Initialize the manager
   */
  initialize(): Promise<void>;

  /**
   * Store metadata for a model
   */
  storeModelMetadata(modelId: string, metadata: Omit<ModelMetadata, keyof BaseMetadata>): Promise<void>;

  /**
   * Retrieve metadata for a model
   */
  getModelMetadata(modelId: string): Promise<ModelMetadata>;

  /**
   * Store environmental metadata for a model
   */
  storeEnvironmentalMetadata(modelId: string, metadata: EnvironmentalMetadata): Promise<void>;

  /**
   * Retrieve environmental metadata for a model
   */
  getEnvironmentalMetadata(modelId: string): Promise<EnvironmentalMetadata>;

  /**
   * Update environmental metadata for a model
   */
  updateEnvironmentalMetadata(modelId: string, metadata: Partial<EnvironmentalMetadata>): Promise<void>;

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
   * Update floor offset
   */
  updateFloorOffset(modelId: string, floorOffset: number): Promise<void>;

  /**
   * Validate metadata
   */
  validateMetadata(metadata: ModelMetadata): ValidationResult;

  /**
   * Validate environmental metadata
   */
  validateEnvironmentalMetadata(metadata: EnvironmentalMetadata): ValidationResult;

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics;

  /**
   * Get cache statistics
   */
  getCacheStats(): Record<string, unknown>;
}

/**
 * Metadata Manager factory interface
 */
export interface MetadataManagerFactory {
  create(config: MetadataManagerConfig): MetadataManager;
}

/**
 * Base error class for metadata manager
 */
export class MetadataManagerError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'MetadataManagerError';
  }
}

/**
 * Database error class
 */
export class DatabaseError extends MetadataManagerError {
  constructor(message: string) {
    super(message, 'DATABASE_ERROR');
    this.name = 'DatabaseError';
  }
}

/**
 * Validation error class
 */
export class ValidationError extends MetadataManagerError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/**
 * Not found error class
 */
export class NotFoundError extends MetadataManagerError {
  constructor(message: string) {
    super(message, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/**
 * Duplicate error class
 */
export class DuplicateError extends MetadataManagerError {
  constructor(message: string) {
    super(message, 'DUPLICATE');
    this.name = 'DuplicateError';
  }
} 