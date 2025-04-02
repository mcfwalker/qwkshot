import { Vector3, Box3 } from 'three';
import {
  P2PError,
  ValidationResult,
  PerformanceMetrics,
  P2PConfig,
} from './shared';
import { SceneAnalysis } from './scene-analyzer';

/**
 * Configuration for the Environmental Analyzer
 */
export interface EnvironmentalAnalyzerConfig extends P2PConfig {
  environmentSize: {
    width: number;
    height: number;
    depth: number;
  };
  analysisOptions: {
    calculateDistances: boolean;
    validateConstraints: boolean;
    optimizeCameraSpace: boolean;
  };
  debug: boolean;
  performanceMonitoring: boolean;
  errorReporting: boolean;
  maxRetries: number;
  timeout: number;
}

/**
 * Environment bounds and dimensions
 */
export interface EnvironmentBounds {
  bounds: {
    min: Vector3;
    max: Vector3;
    center: Vector3;
  };
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
}

/**
 * Object measurements and positioning
 */
export interface ObjectMeasurements {
  bounds: {
    min: Vector3;
    max: Vector3;
    center: Vector3;
  };
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
  floorOffset: number;  // Distance from the object's bottom to the floor
}

/**
 * Distance measurements from object to environment boundaries
 */
export interface DistanceMeasurements {
  fromObjectToBoundary: {
    left: number;    // Distance to left boundary
    right: number;   // Distance to right boundary
    front: number;   // Distance to front boundary
    back: number;    // Distance to back boundary
    top: number;     // Distance to top boundary
    bottom: number;  // Distance to bottom boundary
  };
}

/**
 * Camera positioning constraints
 */
export interface CameraConstraints {
  minHeight: number;    // Minimum camera height
  maxHeight: number;    // Maximum camera height
  minDistance: number;  // Minimum distance from object
  maxDistance: number;  // Maximum distance from object
  maxSpeed: number;     // Maximum camera movement speed
  maxAngleChange: number; // Maximum angle change between keyframes
  minFramingMargin: number; // Minimum margin from model bounds
}

/**
 * Complete environmental analysis result
 */
export interface EnvironmentalAnalysis {
  environment: EnvironmentBounds;
  object: ObjectMeasurements;
  distances: DistanceMeasurements;
  cameraConstraints: CameraConstraints;
  performance: PerformanceMetrics;
}

/**
 * Main Environmental Analyzer interface
 */
export interface EnvironmentalAnalyzer {
  /**
   * Initialize the analyzer with configuration
   */
  initialize(config: EnvironmentalAnalyzerConfig): Promise<void>;

  /**
   * Analyze the environment using scene analysis data
   */
  analyzeEnvironment(sceneAnalysis: SceneAnalysis): Promise<EnvironmentalAnalysis>;

  /**
   * Get environment measurements
   */
  getEnvironmentMeasurements(analysis: EnvironmentalAnalysis): Promise<{
    environment: EnvironmentBounds;
    object: ObjectMeasurements;
  }>;

  /**
   * Get distance measurements from object to boundaries
   */
  getDistanceMeasurements(analysis: EnvironmentalAnalysis): Promise<DistanceMeasurements>;

  /**
   * Get camera positioning constraints
   */
  getCameraConstraints(analysis: EnvironmentalAnalysis): Promise<CameraConstraints>;

  /**
   * Update camera constraints based on floor offset changes
   */
  updateCameraConstraints(analysis: EnvironmentalAnalysis, floorOffset: number): Promise<CameraConstraints>;

  /**
   * Validate a camera position
   */
  validateCameraPosition(
    analysis: EnvironmentalAnalysis,
    position: { position: Vector3; target: Vector3 }
  ): Promise<ValidationResult>;

  /**
   * Get recommended camera ranges
   */
  getCameraRanges(analysis: EnvironmentalAnalysis): Promise<{
    height: { min: number; max: number };
    distance: { min: number; max: number };
  }>;

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics;
}

/**
 * Environmental Analyzer factory interface
 */
export interface EnvironmentalAnalyzerFactory {
  create(config: EnvironmentalAnalyzerConfig): EnvironmentalAnalyzer;
}

/**
 * Environmental Analyzer error types
 */
export class EnvironmentalAnalyzerError extends P2PError {
  constructor(message: string, code: string) {
    super(message, code, 'EnvironmentalAnalyzer');
  }
}

export class AnalysisError extends EnvironmentalAnalyzerError {
  constructor(message: string) {
    super(message, 'ANALYSIS_ERROR');
  }
}

export class ValidationError extends EnvironmentalAnalyzerError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
  }
}

export class MeasurementError extends EnvironmentalAnalyzerError {
  constructor(message: string) {
    super(message, 'MEASUREMENT_ERROR');
  }
}

export interface Logger {
  info(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
  performance(message: string, ...args: any[]): void;
} 