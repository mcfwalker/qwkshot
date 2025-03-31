import { Vector3, Box3 } from 'three';
import type {
  P2PError,
  ValidationResult,
  PerformanceMetrics,
  P2PConfig,
  Logger,
} from './shared';
import type { SceneAnalysis } from './scene-analyzer';
import type { EnvironmentalAnalysis } from './environmental-analyzer';
import type { ModelMetadata } from './metadata-manager';

export type CameraStyle = 'cinematic' | 'documentary' | 'technical' | 'artistic';

export interface CameraConstraints {
  maxSpeed?: number;
  minDistance: number;
  maxDistance: number;
  maxAngleChange?: number;
  minFramingMargin?: number;
  minHeight?: number;
  maxHeight?: number;
  restrictedZones?: any[];
}

export interface SceneContext {
  objectCenter: Vector3;
  boundingBox: Box3;
  cameraStart: {
    position: Vector3;
    target: Vector3;
  };
  sceneScale: number;
  objectType: string;
  objectDimensions: {
    width: number;
    height: number;
    depth: number;
  };
}

export interface OptimizationStep {
  timestamp: Date;
  action: string;
  tokenCountBefore: number;
  tokenCountAfter: number;
  details: string;
}

export interface PromptMetadata {
  timestamp: Date;
  version: string;
  optimizationHistory: OptimizationStep[];
  performanceMetrics: PerformanceMetrics;
  requestId: string;
  userId?: string;
}

/**
 * Configuration for the Prompt Compiler
 */
export interface PromptCompilerConfig extends P2PConfig {
  maxTokens: number;
  temperature: number;
}

/**
 * Compiled prompt with metadata
 */
export interface CompiledPrompt {
  systemMessage: string;
  userMessage: string;
  constraints: CameraConstraints;
  metadata: PromptMetadata;
  tokenCount?: number;
}

/**
 * Main Prompt Compiler interface
 */
export interface PromptCompiler {
  /**
   * Initialize the compiler with configuration
   */
  initialize(config: PromptCompilerConfig): Promise<void>;

  /**
   * Compile a user prompt into an optimized format
   *
   * @param userInput Raw user instruction string.
   * @param sceneAnalysis Analysis result from the Scene Analyzer.
   * @param envAnalysis Analysis result from the Environmental Analyzer.
   * @param modelMetadata Metadata associated with the current model.
   * @param currentCameraState Current position and target of the camera.
   * @returns A promise resolving to the compiled prompt object.
   */
  compilePrompt(
    userInput: string,
    sceneAnalysis: SceneAnalysis,
    envAnalysis: EnvironmentalAnalysis,
    modelMetadata: ModelMetadata,
    currentCameraState: { position: Vector3; target: Vector3 }
  ): Promise<CompiledPrompt>;

  /**
   * Validate a compiled prompt
   */
  validatePrompt(prompt: CompiledPrompt): ValidationResult;

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics;

  /**
   * Optimize a compiled prompt (e.g., reduce token count)
   */
  optimizePrompt(prompt: CompiledPrompt): Promise<CompiledPrompt>;
} 