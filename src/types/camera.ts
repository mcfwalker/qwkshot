import { Vector3 } from 'three';

/**
 * Represents a single keyframe in a camera path animation
 */
export interface CameraKeyframe {
  position: Vector3;
  target: Vector3;
  duration: number;
} 