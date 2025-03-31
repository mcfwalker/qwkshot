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
 * Base metadata interface for all metadata types
 */
export interface BaseMetadata {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

/**
 * Model metadata interface
 */
export interface ModelMetadata extends BaseMetadata {
  modelId: string;
  userId: string;
  file: string;
  orientation: Orientation;
  featurePoints: ModelFeaturePoint[];
  preferences: UserPreferences;
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