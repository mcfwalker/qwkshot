import { Vector3 } from 'three';
import { P2PError } from './shared';
import type { P2PConfig, ValidationResult, PerformanceMetrics, SafetyConstraints, Logger } from './shared';
import type { SceneAnalysis } from './scene-analyzer';
import type { ModelMetadata } from './metadata-manager';

/**
 * Configuration for the P2P Pipeline
 */
export interface P2PPipelineConfig extends P2PConfig {
  sceneAnalyzer: {
    maxFileSize: number;
    supportedFormats: string[];
  };
  metadataManager: {
    database: {
      table: string;
      schema: string;
    };
    caching: {
      enabled: boolean;
      ttl: number;
    };
  };
  promptCompiler: {
    maxTokens: number;
    temperature: number;
  };
  llmEngine: {
    model: string;
    maxTokens: number;
    temperature: number;
  };
  sceneInterpreter: {
    smoothingFactor: number;
    maxKeyframes: number;
  };
}

/**
 * Model input options
 */
export interface ModelInput {
  file?: File;  // For new uploads
  modelId: string;  // Required if file is not provided
  userId: string;
}

/**
 * User instruction input
 */
export interface UserInstruction {
  text: string;
  preferences?: {
    duration?: number;
    style?: 'smooth' | 'dynamic' | 'technical';
    focus?: 'overview' | 'details' | 'features';
  };
}

/**
 * Animation output
 */
export interface AnimationOutput {
  keyframes: {
    position: Vector3;
    target: Vector3;
    timestamp: number;
  }[];
  duration: number;
  metadata: {
    style: string;
    focus: string;
    safetyConstraints: SafetyConstraints;
  };
}

/**
 * Main pipeline interface
 */
export interface P2PPipeline {
  /**
   * Initialize the pipeline with configuration
   */
  initialize(config: P2PPipelineConfig): Promise<void>;

  /**
   * Process a model (new upload or existing)
   */
  processModel(input: ModelInput): Promise<{
    modelId: string;
    analysis: SceneAnalysis;
    metadata: ModelMetadata;
  }>;

  /**
   * Generate a camera path from user instruction
   */
  generatePath(
    modelId: string,
    instruction: UserInstruction
  ): Promise<AnimationOutput>;

  /**
   * Preview a specific keyframe
   */
  previewKeyframe(
    modelId: string,
    keyframeIndex: number,
    animation: AnimationOutput
  ): Promise<void>;

  /**
   * Execute the full animation
   */
  executeAnimation(
    modelId: string,
    animation: AnimationOutput
  ): Promise<void>;

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics;
}

/**
 * Pipeline factory interface
 */
export interface P2PPipelineFactory {
  create(config: P2PPipelineConfig, logger: Logger): P2PPipeline;
}

/**
 * Pipeline error types
 */
export class P2PPipelineError extends P2PError {
  constructor(message: string, code: string) {
    super(message, code, 'P2PPipeline');
  }
}

export class ModelProcessingError extends P2PPipelineError {
  constructor(message: string) {
    super(message, 'MODEL_PROCESSING_ERROR');
  }
}

export class PathGenerationError extends P2PPipelineError {
  constructor(message: string) {
    super(message, 'PATH_GENERATION_ERROR');
  }
}

export class AnimationError extends P2PPipelineError {
  constructor(message: string) {
    super(message, 'ANIMATION_ERROR');
  }
} 