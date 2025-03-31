import { Vector3, Box3 } from 'three';

/**
 * Base configuration interface for P2P pipeline components
 */
export interface P2PConfig {
  debug?: boolean;
  performance?: {
    enabled: boolean;
    logInterval: number;
  };
}

/**
 * Base metadata interface with common fields
 */
export interface BaseMetadata {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

/**
 * Orientation interface for 3D objects
 */
export interface Orientation {
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
}

/**
 * Safety constraints for camera movement
 */
export interface SafetyConstraints {
  minDistance: number;
  maxDistance: number;
  minHeight: number;
  maxHeight: number;
  restrictedAngles?: number[];
  restrictedZones?: Box3[];
}

/**
 * Feature point interface
 */
export interface Feature {
  id: string;
  type: string;
  position: Vector3;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Logger interface for consistent logging across the application
 */
export interface Logger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  trace(message: string, ...args: unknown[]): void;
  performance(message: string, ...args: unknown[]): void;
}

/**
 * Base error class for P2P pipeline
 */
export class P2PError extends Error {
  constructor(
    message: string,
    public code: string,
    public component: string
  ) {
    super(message);
    this.name = 'P2PError';
  }
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
  operations: OperationMetrics[];
  cacheHits: number;
  cacheMisses: number;
  databaseQueries: number;
  averageResponseTime: number;
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
 * Common validation functions
 */
export interface ValidationUtils {
  validateVector3(v: Vector3): ValidationResult;
  validateBox3(b: Box3): ValidationResult;
  validateOrientation(o: Orientation): ValidationResult;
  validateSafetyConstraints(c: SafetyConstraints): ValidationResult;
} 