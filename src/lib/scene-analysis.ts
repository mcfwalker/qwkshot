import { Box3, Vector3, Object3D, Sphere } from 'three';

export interface SceneGeometry {
  // Model information
  boundingBox: {
    min: Vector3;
    max: Vector3;
    center: Vector3;
    size: Vector3;
  };
  boundingSphere: {
    center: Vector3;
    radius: number;
  };
  // Scene boundaries
  floor: {
    height: number;
    normal: Vector3;
  };
  safeDistance: {
    min: number;  // Minimum safe distance from model
    max: number;  // Maximum reasonable distance for viewing
  };
  // Current camera state (optional as it may not always be available)
  currentCamera?: {
    position: {
      x: number;
      y: number;
      z: number;
    };
    target: {
      x: number;
      y: number;
      z: number;
    };
    modelOrientation: {
      front: {
        x: number;
        y: number;
        z: number;
      };
      up: {
        x: number;
        y: number;
        z: number;
      };
    };
  };
}

export function analyzeScene(model: Object3D): SceneGeometry {
  // Calculate bounding box
  const bbox = new Box3().setFromObject(model);
  const size = new Vector3();
  bbox.getSize(size);
  const center = new Vector3();
  bbox.getCenter(center);

  // Calculate bounding sphere
  const sphere = new Sphere();
  bbox.getBoundingSphere(sphere);

  // Calculate safe distances based on model size
  const maxDimension = Math.max(size.x, size.y, size.z);
  const minSafeDistance = maxDimension * 1.5; // 1.5x the largest dimension
  const maxSafeDistance = maxDimension * 5;   // 5x the largest dimension

  return {
    boundingBox: {
      min: bbox.min.clone(),
      max: bbox.max.clone(),
      center: center.clone(),
      size: size.clone()
    },
    boundingSphere: {
      center: sphere.center.clone(),
      radius: sphere.radius
    },
    floor: {
      height: bbox.min.y,  // Assume model sits on floor at its lowest point
      normal: new Vector3(0, 1, 0)
    },
    safeDistance: {
      min: minSafeDistance,
      max: maxSafeDistance
    }
  };
}

export function generateSafeKeyframes(
  geometry: SceneGeometry,
  instruction: string
): Array<{
  position: Vector3;
  target: Vector3;
  duration: number;
}> {
  // This will be replaced with LLM-generated keyframes
  // For now, return a simple orbit
  const { center } = geometry.boundingBox;
  const { radius } = geometry.boundingSphere;
  const distance = radius * 2;
  
  const keyframes = [];
  const numPoints = 8;
  
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const position = new Vector3(
      center.x + Math.sin(angle) * distance,
      center.y + radius * 0.5, // Slightly above center
      center.z + Math.cos(angle) * distance
    );
    
    keyframes.push({
      position: position,
      target: center.clone(),
      duration: 2 // 2 seconds between each keyframe
    });
  }
  
  return keyframes;
}

// Helper function to check if a camera position is safe
export function isSafeCameraPosition(
  position: Vector3,
  target: Vector3,
  geometry: SceneGeometry
): boolean {
  // Check if camera is too close to model
  const distanceToCenter = position.distanceTo(geometry.boundingSphere.center);
  if (distanceToCenter < geometry.safeDistance.min) return false;
  if (distanceToCenter > geometry.safeDistance.max) return false;

  // Check if camera is below floor
  if (position.y < geometry.floor.height) return false;

  // Add more safety checks as needed
  return true;
} 