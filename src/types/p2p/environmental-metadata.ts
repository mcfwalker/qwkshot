import { Vector3 } from 'three';
import { SerializedVector3 } from './shared';

/**
 * Environmental metadata interface for dynamic scene data
 */
export interface EnvironmentalMetadata {
  lighting?: {
    intensity: number;
    color: string;
    position: SerializedVector3;
  };
  camera?: {
    position: SerializedVector3;
    target: SerializedVector3;
    fov: number;
  };
  scene?: {
    background: string;
    ground: string;
    atmosphere: string;
  };
  shot?: {
    type: string;
    duration: number;
    keyframes: Array<{
      position: SerializedVector3;
      target: SerializedVector3;
      duration: number;
    }>;
  };
  bounds?: {
    min: SerializedVector3;
    max: SerializedVector3;
    center: SerializedVector3;
    dimensions: {
      width: number;
      height: number;
      depth: number;
    };
  };
  constraints?: {
    minDistance: number;
    maxDistance: number;
    minHeight: number;
    maxHeight: number;
    maxSpeed: number;
    maxAngleChange: number;
    minFramingMargin: number;
  };
  userVerticalAdjustment?: number;
  performance?: {
    startTime: number;
    endTime: number;
    duration: number;
    operations: Array<{
      name: string;
      duration: number;
      success: boolean;
      error?: string;
    }>;
  };
} 