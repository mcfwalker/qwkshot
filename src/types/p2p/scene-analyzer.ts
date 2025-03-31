import { Vector3, Box3, Plane, Material } from 'three';
import {
  P2PError,
  ValidationResult,
  PerformanceMetrics,
  P2PConfig,
  SpatialBounds,
  SafetyConstraints,
  Feature,
  Logger,
} from './shared';

/**
 * Configuration for the Scene Analyzer
 */
export interface SceneAnalyzerConfig extends P2PConfig {
  maxFileSize: number;
  supportedFormats: string[];
  analysisOptions: {
    extractFeatures: boolean;
    calculateSymmetry: boolean;
    analyzeMaterials: boolean;
  };
}

/**
 * Result of GLB file analysis
 */
export interface GLBAnalysis {
  fileInfo: {
    name: string;
    size: number;
    format: string;
    version: string;
  };
  geometry: {
    vertexCount: number;
    faceCount: number;
    boundingBox: Box3;
    center: Vector3;
    dimensions: Vector3;
  };
  materials: Material[];
  metadata: Record<string, unknown>;
  performance: PerformanceMetrics;
}

/**
 * Spatial analysis results
 */
export interface SpatialAnalysis {
  bounds: SpatialBounds;
  referencePoints: {
    center: Vector3;
    highest: Vector3;
    lowest: Vector3;
    leftmost: Vector3;
    rightmost: Vector3;
    frontmost: Vector3;
    backmost: Vector3;
  };
  symmetry: {
    hasSymmetry: boolean;
    symmetryPlanes: Plane[];
  };
  complexity: 'simple' | 'moderate' | 'high';
  performance: PerformanceMetrics;
}

/**
 * Feature analysis results
 */
export interface FeatureAnalysis {
  features: Feature[];
  landmarks: Feature[];
  constraints: Feature[];
  performance: PerformanceMetrics;
}

/**
 * Complete scene analysis result
 */
export interface SceneAnalysis {
  glb: GLBAnalysis;
  spatial: SpatialAnalysis;
  featureAnalysis: FeatureAnalysis;
  safetyConstraints: SafetyConstraints;
  orientation: Orientation;
  features: Feature[];
  performance: PerformanceMetrics;
}

/**
 * Main Scene Analyzer interface
 */
export interface SceneAnalyzer {
  /**
   * Initialize the analyzer with configuration
   */
  initialize(config: SceneAnalyzerConfig): Promise<void>;

  /**
   * Analyze a GLB file
   */
  analyzeScene(file: File): Promise<SceneAnalysis>;

  /**
   * Extract spatial reference points
   */
  extractReferencePoints(scene: SceneAnalysis): Promise<SpatialAnalysis['referencePoints']>;

  /**
   * Calculate safety boundaries
   */
  calculateSafetyBoundaries(scene: SceneAnalysis): Promise<SafetyConstraints>;

  /**
   * Get basic scene understanding
   */
  getSceneUnderstanding(scene: SceneAnalysis): Promise<{
    complexity: SpatialAnalysis['complexity'];
    symmetry: SpatialAnalysis['symmetry'];
    features: FeatureAnalysis['features'];
  }>;

  /**
   * Validate scene analysis results
   */
  validateAnalysis(analysis: SceneAnalysis): ValidationResult;

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics;
}

/**
 * Scene Analyzer factory interface
 */
export interface SceneAnalyzerFactory {
  create(config: SceneAnalyzerConfig, logger: Logger): SceneAnalyzer;
}

/**
 * Scene Analyzer error types
 */
export class SceneAnalyzerError extends P2PError {
  constructor(message: string, code: string) {
    super(message, code, 'SceneAnalyzer');
  }
}

export class GLBParseError extends SceneAnalyzerError {
  constructor(message: string) {
    super(message, 'GLB_PARSE_ERROR');
  }
}

export class AnalysisError extends SceneAnalyzerError {
  constructor(message: string) {
    super(message, 'ANALYSIS_ERROR');
  }
}

export class ValidationError extends SceneAnalyzerError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
  }
}

/**
 * Represents the calculated orientation and scale of the model.
 */
export interface Orientation {
  front: Vector3;
  up: Vector3;
  right: Vector3;
  center: Vector3;
  scale: number;
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
} 