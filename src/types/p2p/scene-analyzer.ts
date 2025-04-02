import { Box3, Vector3, Plane, Object3D, Material } from 'three';
import {
  P2PError,
  ValidationResult as ImportedValidationResult,
  PerformanceMetrics as ImportedPerformanceMetrics,
  P2PConfig,
  SpatialBounds,
  SafetyConstraints as ImportedSafetyConstraints,
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
  safetyConstraints: SceneSafetyConstraints;
  orientation: ModelOrientation;
  features: Feature[];
  performance: PerformanceMetrics;
}

/**
 * Represents the calculated orientation and scale of the model.
 */
export interface ModelOrientation {
  front: Vector3;      // Primary viewing direction
  back: Vector3;       // Opposite of front
  left: Vector3;       // Left side direction
  right: Vector3;      // Right side direction
  top: Vector3;        // Top direction
  bottom: Vector3;     // Bottom direction
  center: Vector3;     // Model center
  scale: number;       // Model scale
  confidence: number;  // Confidence in orientation detection (0-1)
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
}

export interface SceneSafetyConstraints {
  minHeight: number;
  maxHeight: number;
  minDistance: number;
  maxDistance: number;
  restrictedZones: Box3[];
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
   * Calculate orientation of the model
   */
  calculateOrientation(scene: Object3D): Promise<ModelOrientation>;

  /**
   * Calculate safety boundaries
   */
  calculateSafetyBoundaries(scene: SceneAnalysis): Promise<SceneSafetyConstraints>;

  /**
   * Extract spatial reference points
   */
  extractReferencePoints(scene: SceneAnalysis): Promise<{
    center: Vector3;
    highest: Vector3;
    lowest: Vector3;
    leftmost: Vector3;
    rightmost: Vector3;
    frontmost: Vector3;
    backmost: Vector3;
  }>;

  /**
   * Get basic scene understanding
   */
  getSceneUnderstanding(scene: SceneAnalysis): Promise<{
    complexity: 'simple' | 'moderate' | 'high';
    symmetry: {
      hasSymmetry: boolean;
      symmetryPlanes: Plane[];
    };
    features: Feature[];
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
  create(config: SceneAnalyzerConfig): SceneAnalyzer;
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

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface PerformanceMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  operations: Array<{
    name: string;
    duration: number;
    success: boolean;
  }>;
  cacheHits: number;
  cacheMisses: number;
  databaseQueries: number;
  averageResponseTime: number;
} 