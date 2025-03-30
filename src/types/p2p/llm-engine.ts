import { Vector3 } from 'three';
import {
  P2PError,
  ValidationResult,
  PerformanceMetrics,
  P2PConfig,
  SafetyConstraints,
  Logger,
} from './shared';
import { CompiledPrompt } from './prompt-compiler';

/**
 * Configuration for the LLM Engine
 */
export interface LLMEngineConfig extends P2PConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  apiKey?: string;  // Optional, can be provided at runtime
}

/**
 * Camera path keyframe
 */
export interface CameraKeyframe {
  position: Vector3;
  target: Vector3;
  timestamp: number;
}

/**
 * Complete camera path
 */
export interface CameraPath {
  keyframes: CameraKeyframe[];
  duration: number;
  metadata: {
    style: string;
    focus: string;
    safetyConstraints: SafetyConstraints;
  };
}

/**
 * Main LLM Engine interface
 */
export interface LLMEngine {
  /**
   * Initialize the engine with configuration
   */
  initialize(config: LLMEngineConfig): Promise<void>;

  /**
   * Generate a camera path from a compiled prompt
   */
  generatePath(prompt: CompiledPrompt): Promise<CameraPath>;

  /**
   * Validate a generated path
   */
  validatePath(path: CameraPath): ValidationResult;

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics;
}

/**
 * LLM Engine factory interface
 */
export interface LLMEngineFactory {
  create(config: LLMEngineConfig, logger: Logger): LLMEngine;
}

/**
 * LLM Engine error types
 */
export class LLMEngineError extends P2PError {
  constructor(message: string, code: string) {
    super(message, code, 'LLMEngine');
  }
}

export class GenerationError extends LLMEngineError {
  constructor(message: string) {
    super(message, 'GENERATION_ERROR');
  }
}

export class ValidationError extends LLMEngineError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
  }
}

export class ConfigurationError extends LLMEngineError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR');
  }
} 