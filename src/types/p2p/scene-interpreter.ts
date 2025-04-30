import { Vector3, Camera, Box3 } from 'three';
import {
  P2PError,
  ValidationResult,
  PerformanceMetrics,
  P2PConfig,
  SafetyConstraints,
  Logger,
} from './shared';
import { CameraPath } from './llm-engine';
import { EasingFunctionName } from '@/lib/easing';
import { SceneAnalysis } from './scene-analyzer';
import { EnvironmentalAnalysis } from './environmental-analyzer';
import { MotionPlan } from '@/lib/motion-planning/types';
import * as THREE from 'three';

/**
 * Configuration for the Scene Interpreter
 */
export interface SceneInterpreterConfig extends P2PConfig {
  smoothingFactor: number;
  maxKeyframes: number;
  interpolationMethod: 'linear' | 'smooth' | 'ease';
  maxVelocity?: number; // Optional: Max allowed velocity (units/sec)
}

/**
 * Camera command for Three.js
 */
export interface CameraCommand {
  position: Vector3;
  target: Vector3;
  orientation?: THREE.Quaternion | null;
  duration: number;
  easing: EasingFunctionName;
  animationType?: 'orbit' | 'orbit_start' | string;
}

/**
 * Main Scene Interpreter interface
 */
export interface SceneInterpreter {
  /**
   * Initialize the interpreter with configuration
   */
  initialize(config: SceneInterpreterConfig): Promise<void>;

  /**
   * Convert a structured motion plan into executable commands using scene context.
   */
  interpretPath(
    plan: MotionPlan, 
    sceneAnalysis: SceneAnalysis, 
    envAnalysis: EnvironmentalAnalysis,
    initialCameraState: { position: Vector3; target: Vector3 }
  ): CameraCommand[];

  /**
   * Execute a single camera command
   */
  executeCommand(
    camera: Camera,
    command: CameraCommand
  ): Promise<void>;

  /**
   * Execute a sequence of camera commands
   */
  executeCommands(
    camera: Camera,
    commands: CameraCommand[]
  ): Promise<void>;

  /**
   * Validate camera commands against constraints like bounding box
   */
  validateCommands(
    commands: CameraCommand[], 
    objectBounds: Box3
  ): ValidationResult;

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics;
}

/**
 * Scene Interpreter factory interface
 */
export interface SceneInterpreterFactory {
  create(config: SceneInterpreterConfig): SceneInterpreter;
}

/**
 * Scene Interpreter error types
 */
export class SceneInterpreterError extends P2PError {
  constructor(message: string, code: string) {
    super(message, code, 'SceneInterpreter');
  }
}

export class InterpretationError extends SceneInterpreterError {
  constructor(message: string) {
    super(message, 'INTERPRETATION_ERROR');
  }
}

export class ExecutionError extends SceneInterpreterError {
  constructor(message: string) {
    super(message, 'EXECUTION_ERROR');
  }
}

export class ValidationError extends SceneInterpreterError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
  }
} 