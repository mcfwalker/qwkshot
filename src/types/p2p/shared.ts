import { Vector3, Box3, Plane } from 'three';

/**
 * Common error types for the p2p pipeline
 */
export class P2PError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly component: string
  ) {
    super(message);
    this.name = 'P2PError';
  }
}

/**
 * Common validation result type
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  errors?: string[];
}

/**
 * Performance metrics for operations
 */
export interface OperationMetrics {
  name: string;
  duration: number;
  success: boolean;
  error?: string;
}

/**
 * Performance metrics for the pipeline
 */
export interface PerformanceMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  operations: OperationMetrics[];
}

/**
 * Common configuration options
 */
export interface P2PConfig {
  debug: boolean;
  performanceMonitoring: boolean;
  errorReporting: boolean;
  maxRetries: number;
  timeout: number;
}

/**
 * Common spatial types
 */
export interface SpatialPoint {
  position: Vector3;
  description?: string;
}

export interface SpatialBounds {
  min: Vector3;
  max: Vector3;
  center: Vector3;
  dimensions: Vector3;
}

/**
 * Common metadata types
 */
export interface BaseMetadata {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  version: string;
}

/**
 * Common safety constraints
 */
export interface SafetyConstraints {
  minDistance: number;
  maxDistance: number;
  minHeight: number;
  maxHeight: number;
  restrictedZones: Box3[];
}

/**
 * Common feature types
 */
export interface Feature {
  id: string;
  type: string;
  position: Vector3;
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * Common orientation types
 */
export interface Orientation {
  front: Vector3;
  up: Vector3;
  right: Vector3;
  center: Vector3;
  scale: number;
}

/**
 * Common validation functions
 */
export interface ValidationUtils {
  validateVector3(v: Vector3): ValidationResult;
  validateBox3(b: Box3): ValidationResult;
  validateOrientation(o: Orientation): ValidationResult;
  validateSafetyConstraints(c: SafetyConstraints): ValidationResult;
}

/**
 * Common logging interface
 */
export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, error?: Error, ...args: unknown[]): void;
  performance(metrics: PerformanceMetrics): void;
} 