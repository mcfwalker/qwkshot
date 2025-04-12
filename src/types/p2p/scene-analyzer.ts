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
  SerializedVector3,
  SerializedOrientation,
  PerformanceMetrics,
  ValidationResult,
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

// --- SERIALIZED TYPES FOR STORAGE ---

/**
 * Serialized Box3 for storage
 */
export interface SerializedBox3 {
  min: SerializedVector3;
  max: SerializedVector3;
}

/**
 * Serialized Feature for storage
 */
export interface SerializedFeature {
  id: string;
  type: string;
  position: SerializedVector3;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Serialized SpatialBounds for storage
 */
export interface SerializedSpatialBounds {
  min: SerializedVector3;
  max: SerializedVector3;
  center: SerializedVector3;
  dimensions: SerializedVector3;
}

/**
 * Serialized geometry info from GLBAnalysis for storage
 */
export interface SerializedGLBGeometry {
  vertexCount: number;
  faceCount: number;
  boundingBox: SerializedBox3;
  center: SerializedVector3;
  dimensions: SerializedVector3;
}

/**
 * Serialized GLBAnalysis for storage
 */
export interface SerializedGLBAnalysis {
  fileInfo: {
    name: string;
    size: number;
    format: string;
    version: string;
  };
  geometry: SerializedGLBGeometry;
  // materials omitted for now
  metadata: Record<string, unknown>;
  performance: PerformanceMetrics; // Reuse from shared
}

/**
 * Serialized reference points from SpatialAnalysis for storage
 */
export interface SerializedSpatialReferencePoints {
  center: SerializedVector3;
  highest: SerializedVector3;
  lowest: SerializedVector3;
  leftmost: SerializedVector3;
  rightmost: SerializedVector3;
  frontmost: SerializedVector3;
  backmost: SerializedVector3;
}

/**
 * Serialized symmetry info from SpatialAnalysis for storage
 */
export interface SerializedSymmetry {
  hasSymmetry: boolean;
  // symmetryPlanes omitted for now
}

/**
 * Serialized SpatialAnalysis for storage
 */
export interface SerializedSpatialAnalysis {
  bounds: SerializedSpatialBounds;
  referencePoints: SerializedSpatialReferencePoints;
  symmetry: SerializedSymmetry;
  complexity: 'simple' | 'moderate' | 'high';
  performance: PerformanceMetrics; // Reuse from shared
}

/**
 * Serialized FeatureAnalysis for storage
 */
export interface SerializedFeatureAnalysis {
  features: SerializedFeature[];
  landmarks: SerializedFeature[];
  constraints: SerializedFeature[];
  performance: PerformanceMetrics; // Reuse from shared
}

/**
 * Serialized SceneSafetyConstraints for storage
 */
export interface SerializedSceneSafetyConstraints {
  minHeight: number;
  maxHeight: number;
  minDistance: number;
  maxDistance: number;
  // restrictedZones omitted for now
}

/**
 * Serialized SceneAnalysis for storage (Complete result)
 */
export interface SerializedSceneAnalysis {
  glb: SerializedGLBAnalysis;
  spatial: SerializedSpatialAnalysis;
  featureAnalysis: SerializedFeatureAnalysis;
  safetyConstraints: SerializedSceneSafetyConstraints;
  orientation: SerializedOrientation; // Reuse from shared
  features: SerializedFeature[];
  performance: PerformanceMetrics; // Reuse from shared
}

// --- Original Interfaces (Keep for reference/type checking) ---

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

// --- Error types remain unchanged ---
// Note: Error class definitions were moved above Serialized Types