import { Vector3, Box3, Ray } from 'three';
// import { Logger } from '@/lib/logging/log-util'; // Incorrect path
import { SceneAnalysis } from '@/types/p2p/scene-analyzer';
import { EnvironmentalAnalysis } from '@/types/p2p/environmental-analyzer';
import { MotionPlan } from '@/lib/motion-planning/types';
import { Feature, Logger } from '@/types/p2p/shared'; // Corrected import path for Logger

// Define shared types locally for now
export type Descriptor = 'tiny' | 'small' | 'medium' | 'large' | 'huge';
export type MagnitudeType = 'distance' | 'factor' | 'pass_distance';

/**
 * Resolves a target name string to a Vector3 position based on scene and environmental context.
 * Applies userVerticalAdjustment to standard object landmark Y-coordinates.
 */
export function resolveTargetPosition(
  targetName: string,
  sceneAnalysis: SceneAnalysis,
  envAnalysis: EnvironmentalAnalysis, // <-- Pass full envAnalysis
  currentTarget: Vector3,
  logger: Logger // Added Logger parameter
): Vector3 | null {
  logger.debug(`Resolving target name: '${targetName}'`);

  // Extract user offset (use optional chaining and nullish coalescing)
  const userVerticalAdjustment = envAnalysis?.userVerticalAdjustment ?? 0;
  logger.debug(`Using userVerticalAdjustment: ${userVerticalAdjustment}`);

  if (targetName === 'current_target') {
    logger.debug('Resolved target to current_target');
    return currentTarget.clone();
  }

  // --- Standard Object References ---
  const bounds = sceneAnalysis?.spatial?.bounds;
  if (bounds && bounds.center && bounds.min && bounds.max) {
      const center = bounds.center;
      const min = bounds.min;
      const max = bounds.max;

      switch (targetName) {
          case 'object_center':
              logger.debug('Resolved target to object_center');
              // Apply user offset to Y component
              return new Vector3(center.x, center.y + userVerticalAdjustment, center.z);
          case 'object_top_center':
              logger.debug('Resolved target to object_top_center');
              // Apply user offset to Y component
              return new Vector3(center.x, max.y + userVerticalAdjustment, center.z);
          case 'object_bottom_center':
              logger.debug('Resolved target to object_bottom_center');
              // Apply user offset to Y component
              return new Vector3(center.x, min.y + userVerticalAdjustment, center.z);
          case 'object_left_center': // Assuming -X is left
              logger.debug('Resolved target to object_left_center');
              // Apply user offset to Y component
              return new Vector3(min.x, center.y + userVerticalAdjustment, center.z);
          case 'object_right_center': // Assuming +X is right
              logger.debug('Resolved target to object_right_center');
              // Apply user offset to Y component
              return new Vector3(max.x, center.y + userVerticalAdjustment, center.z);
          case 'object_front_center': // Assuming +Z is front
              logger.debug('Resolved target to object_front_center');
              // Apply user offset to Y component
              return new Vector3(center.x, center.y + userVerticalAdjustment, max.z);
          case 'object_back_center': // Assuming -Z is back
              logger.debug('Resolved target to object_back_center');
              // Apply user offset to Y component
              return new Vector3(center.x, center.y + userVerticalAdjustment, min.z);
          // --- ADDED Corner Cases ---
          case 'object_bottom_left':
          case 'object_bottom_left_center': // Alias
          case 'object_bottom_left_corner': // Alias
              logger.debug('Resolved target to object_bottom_left');
              return new Vector3(min.x, min.y + userVerticalAdjustment, center.z);
          case 'object_bottom_right':
          case 'object_bottom_right_center': // Alias
          case 'object_bottom_right_corner': // Alias
              logger.debug('Resolved target to object_bottom_right');
              return new Vector3(max.x, min.y + userVerticalAdjustment, center.z);
          case 'object_top_left':
          case 'object_top_left_center': // Alias
          case 'object_top_left_corner': // Alias
              logger.debug('Resolved target to object_top_left');
              return new Vector3(min.x, max.y + userVerticalAdjustment, center.z);
          case 'object_top_right':
          case 'object_top_right_center': // Alias
          case 'object_top_right_corner': // Alias
              logger.debug('Resolved target to object_top_right');
              return new Vector3(max.x, max.y + userVerticalAdjustment, center.z);
          // TODO: Add front/back corner combinations if needed later
      }
  } else if ([
        'object_center', 'object_top_center', 'object_bottom_center',
        'object_left_center', 'object_right_center', 'object_front_center', 'object_back_center',
        'object_bottom_left', 'object_bottom_right', 'object_top_left', 'object_top_right',
        'object_bottom_left_center', 'object_bottom_right_center', 'object_top_left_center', 'object_top_right_center', // Add center aliases here too
        'object_bottom_left_corner', 'object_bottom_right_corner', 'object_top_left_corner', 'object_top_right_corner' // Add corner aliases here too
        ].includes(targetName)) {
      logger.warn(`Cannot resolve target '${targetName}': SceneAnalysis missing required spatial bounds (center, min, max).`);
      return null; // Cannot calculate without bounds
  }
  // --- End Standard Object References ---

  // Resolve named features (assuming LLM uses feature.id or feature.description)
  if (sceneAnalysis?.features && Array.isArray(sceneAnalysis.features)) {
    const foundFeature = sceneAnalysis.features.find(
      (feature: Feature) => feature.id === targetName || feature.description === targetName
    );
    if (foundFeature?.position) {
      // Ensure position is a Vector3 (it should be based on SceneAnalysis type)
      if (foundFeature.position instanceof Vector3) {
         logger.debug(`Resolved target to feature '${targetName}' at ${foundFeature.position.toArray()}`);
         return foundFeature.position.clone();
      } else {
         logger.error(`Feature '${targetName}' found, but its position is not a Vector3 object.`);
         return null;
      }
    }
  }

  // TODO: Potentially add resolution for other known points like 'highest', 'lowest' from sceneAnalysis.spatial.referencePoints

  logger.warn(`Could not resolve target name '${targetName}'.`);
  return null; // Target not found
}

/**
 * Clamps a position using raycasting against a bounding box, applying user vertical adjustment.
 * If the path from start to end intersects the box, returns the intersection point (slightly offset).
 * If the end point is inside the box, attempts to clamp to the surface and offset outwards.
 * Otherwise, returns the intended end position.
 */
export function clampPositionWithRaycast(
  startPosition: Vector3,
  intendedEndPosition: Vector3,
  objectBounds: Box3,
  userVerticalAdjustment: number, // <-- Kept userVerticalAdjustment parameter
  logger: Logger // Added Logger parameter
): Vector3 {
  const movementVector = new Vector3().subVectors(intendedEndPosition, startPosition);
  const distanceToEnd = movementVector.length();
  const movementDirection = movementVector.normalize(); // Store normalized direction

  // --- Calculate Dynamic Offset --- START ---
  let dynamicOffset = 0.1; // Default minimum offset
  try {
      const objectSize = objectBounds.getSize(new Vector3()).length(); // Diagonal size
      // Use a small fraction of object size, but ensure a minimum absolute offset, and cap maximum reasonable offset
      dynamicOffset = Math.max(0.1, Math.min(objectSize * 0.05, 0.5)); // E.g., 5% of size, min 0.1, max 0.5
      logger.debug(`Using dynamic offset: ${dynamicOffset.toFixed(3)} (based on object size: ${objectSize.toFixed(2)})`);
  } catch (sizeError) {
      logger.error("Error calculating object size for dynamic offset, using default 0.1:", sizeError);
      dynamicOffset = 0.1; // Fallback to default minimum if size calculation fails
  }
  // --- Calculate Dynamic Offset --- END ---

  if (distanceToEnd < 1e-6) {
    return startPosition.clone(); // No movement, return start
  }

  const ray = new Ray(startPosition, movementDirection); // Use normalized direction
  const intersectionPoint = new Vector3();

  // Create an offset bounding box based on the user adjustment
  const offsetBounds = objectBounds.clone().translate(new Vector3(0, userVerticalAdjustment, 0));
  logger.debug(`Raycast check using offset bounds: MinY=${offsetBounds.min.y.toFixed(2)}, MaxY=${offsetBounds.max.y.toFixed(2)}`);

  // Use the offsetBounds for collision checks
  if (ray.intersectBox(offsetBounds, intersectionPoint)) { // <-- Use offsetBounds
    const distanceToIntersection = startPosition.distanceTo(intersectionPoint);

    if (distanceToIntersection < distanceToEnd - 1e-6) { // Use tolerance
      logger.warn(`Raycast: Path intersects bounding box at distance ${distanceToIntersection.toFixed(2)}. Clamping position with dynamic offset.`);
      const finalClampedPosition = new Vector3()
          .copy(intersectionPoint)
          .addScaledVector(movementDirection, -dynamicOffset); // Use dynamicOffset
      return finalClampedPosition;
    }
  }

  // Use the offsetBounds for containsPoint check
  if (offsetBounds.containsPoint(intendedEndPosition)) { // <-- Use offsetBounds
      logger.warn('Raycast: Intended end position is inside offset bounds. Clamping to surface as fallback with dynamic offset.');
      const clampedToSurface = offsetBounds.clampPoint(intendedEndPosition, new Vector3()); // <-- Use offsetBounds
      // Calculate outward normal (approximate) based on offset center
      const outwardNormal = new Vector3().subVectors(intendedEndPosition, offsetBounds.getCenter(new Vector3())).normalize(); // <-- Use offsetBounds
      // Ensure normal is valid before applying offset
      if (Number.isFinite(outwardNormal.x) && Number.isFinite(outwardNormal.y) && Number.isFinite(outwardNormal.z) && outwardNormal.lengthSq() > 1e-6) {
           return clampedToSurface.addScaledVector(outwardNormal, dynamicOffset); // Use dynamicOffset
      } else {
           logger.warn('Could not determine valid outward normal for offset, returning clamped surface point.');
           return clampedToSurface; // Return point on surface if normal is invalid
      }
  }

  return intendedEndPosition.clone();
}


/**
 * Maps a canonical descriptor (tiny, small, medium, large, huge) to a context-aware numeric value.
 */
export function mapDescriptorToValue(
  descriptor: Descriptor, // Use global Descriptor type
  magnitudeType: MagnitudeType, // Use global MagnitudeType
  motionType: MotionPlan['steps'][0]['type'],
  sceneAnalysis: SceneAnalysis,
  envAnalysis: EnvironmentalAnalysis,
  currentCameraState: { position: Vector3; target: Vector3 },
  logger: Logger, // Added Logger parameter
  direction?: 'in' | 'out'
): number {
  logger.debug(`Mapping descriptor '${descriptor}' for ${motionType} (${magnitudeType})`);

  const { position: currentPosition, target: currentTarget } = currentCameraState;
  const objectSize = sceneAnalysis.spatial?.bounds?.dimensions?.length() ?? 1.0;
  const objectHeight = sceneAnalysis.spatial?.bounds?.dimensions?.y ?? objectSize * 0.5;
  const objectWidth = sceneAnalysis.spatial?.bounds?.dimensions?.x ?? objectSize * 0.5;
  const currentDistanceToTarget = currentPosition.distanceTo(currentTarget);
  const minConstraintDist = envAnalysis.cameraConstraints?.minDistance ?? 0.1;
  const maxConstraintDist = envAnalysis.cameraConstraints?.maxDistance ?? Infinity;

  let value: number;

  if (magnitudeType === 'factor' && motionType === 'zoom') {
    // Zoom Factor Mapping
    if (!direction) {
      logger.error('Zoom factor mapping requires direction (\'in\'/\'out\'). Defaulting factor to 1.0');
      return 1.0;
    }
    const factorMap: { [key in Descriptor]: number } = {
      tiny: direction === 'in' ? 0.9 : 1.1,
      small: direction === 'in' ? 0.7 : 1.3,
      medium: direction === 'in' ? 0.5 : 1.8,
      large: direction === 'in' ? 0.3 : 2.5,
      huge: direction === 'in' ? 0.15 : 4.0,
    };
    value = factorMap[descriptor];
    logger.debug(`Mapped zoom descriptor '${descriptor}' (direction: ${direction}) to base factor: ${value}`);
    // Clamping logic...
    let projectedDistance = currentDistanceToTarget * value;
    if (projectedDistance < minConstraintDist) {
        value = minConstraintDist / currentDistanceToTarget;
        logger.warn(`Zoom factor clamped due to minDistance. New factor: ${value.toFixed(3)}`);
    }
    if (projectedDistance > maxConstraintDist) {
        value = maxConstraintDist / currentDistanceToTarget;
        logger.warn(`Zoom factor clamped due to maxDistance. New factor: ${value.toFixed(3)}`);
    }
    if (direction === 'in' && value >= 1.0) value = 0.99;
    if (direction === 'out' && value <= 1.0) value = 1.01;

  } else {
    // Distance Mapping
    let baseMetric: number;
    switch (motionType) {
        case 'pedestal': baseMetric = objectHeight; break;
        case 'truck': baseMetric = objectWidth; break;
        case 'dolly': baseMetric = Math.max(objectSize * 0.5, currentDistanceToTarget * 0.5); break; // Adjusted dolly case
        default: baseMetric = objectSize;
    }
    baseMetric = Math.max(baseMetric, 0.1);

    const scaleMap: { [key in Descriptor]: number } = {
        tiny: 0.1, small: 0.3, medium: 0.75, large: 1.5, huge: 3.0,
    };
    const scaleFactor = scaleMap[descriptor];
    value = baseMetric * scaleFactor;

    // Adjustments & Clamping...
    if (motionType === 'dolly' && (descriptor === 'tiny' || descriptor === 'small') && currentDistanceToTarget < baseMetric) {
        value = currentDistanceToTarget * scaleFactor;
    }
    const maxReasonableDist = Math.max(objectSize * 5, 20.0);
    if (value > maxReasonableDist) {
      logger.warn(`Clamping calculated distance ${value.toFixed(2)} to max reasonable ${maxReasonableDist.toFixed(2)}.`);
      value = maxReasonableDist;
    }
    value = Math.max(value, 1e-6);
    logger.debug(`Mapped distance descriptor '${descriptor}' for ${motionType} to value: ${value.toFixed(3)}`);
  }
  return value;
}

/**
 * Maps a qualitative proximity descriptor to an absolute camera–target distance based on object size.
 */
export function mapDescriptorToGoalDistance(
  descriptor: Descriptor,
  sceneAnalysis: SceneAnalysis,
  logger: Logger // Added Logger parameter
): number {
  // Map qualitative proximity descriptor to an absolute camera–target distance.
  // We purposely *ignore* current camera state so that the meaning of the descriptor
  // is stable regardless of where the camera currently is.
  const objectSize = sceneAnalysis.spatial?.bounds?.dimensions?.length() ?? 1.0;
  // Scale factors chosen so that:
  //   tiny   → ~0.5 × objectSize  (very close)
  //   small  → ~1.0 × objectSize  (close)
  //   medium → ~1.5 × objectSize  (comfortable framing)
  //   large  → ~2.5 × objectSize  (wide framing)
  //   huge   → ~4.0 × objectSize  (far)
  const scaleMap: { [key in Descriptor]: number } = {
    tiny: 0.5,
    small: 1.0,
    medium: 1.5,
    large: 2.5,
    huge: 4.0,
  };
  const goalDist = Math.max(scaleMap[descriptor] * objectSize, 0.05);
  logger.debug(
    `GoalDistance: descriptor '${descriptor}' mapped to goal distance ${goalDist.toFixed(3)}`
  );
  return goalDist;
}

/**
 * Helper to map raw qualitative words (e.g. "close", "very_far") to a canonical descriptor.
 */
export function normalizeDescriptor(raw: any): Descriptor | null {
  if (typeof raw !== 'string') return null;
  const key = raw.toLowerCase().replace(/[\s_-]/g, '');
  const aliasMap: Record<string, Descriptor> = {
    // closest buckets
    tiny: 'tiny', verytiny: 'tiny', extremelytiny: 'tiny',
    small: 'small', verysmall: 'small', close: 'small', nearer: 'small', near: 'small', closer: 'small',
    medium: 'medium', mid: 'medium', moderate: 'medium',
    large: 'large', verylarge: 'large', far: 'large', farther: 'large', distant: 'large',
    huge: 'huge', veryhuge: 'huge', gigantic: 'huge', veryfar: 'huge', extremelyfar: 'huge'
  };
  return aliasMap[key] ?? null;
} 