import { Camera } from 'three';
import {
  SceneInterpreter,
  SceneInterpreterConfig,
  CameraCommand,
} from '@/types/p2p/scene-interpreter';
import { CameraPath } from '@/types/p2p/llm-engine';
import { ValidationResult, PerformanceMetrics, Logger } from '@/types/p2p/shared';
import * as THREE from 'three'; // Import THREE namespace for easing functions potentially
import { CatmullRomCurve3, Vector3, Box3 } from 'three'; // Explicitly import Box3
import { MotionPlan, MotionStep } from '@/lib/motion-planning/types'; // Added
import { SceneAnalysis } from '@/types/p2p/scene-analyzer'; // Added
import { EnvironmentalAnalysis } from '@/types/p2p/environmental-analyzer'; // Added
import { easingFunctions, EasingFunctionName, DEFAULT_EASING } from '@/lib/easing';

// Define Canonical Descriptor type (KEEP OUTSIDE CLASS)
type Descriptor = 'tiny' | 'small' | 'medium' | 'large' | 'huge';

// Define Magnitude type (KEEP OUTSIDE CLASS)
type MagnitudeType = 'distance' | 'factor' | 'pass_distance';

// Define a simple logger for this module
const logger = {
  info: (...args: any[]) => console.log('[SceneInterpreter]', ...args),
  warn: (...args: any[]) => console.warn('[SceneInterpreter]', ...args),
  error: (...args: any[]) => console.error('[SceneInterpreter]', ...args),
  debug: (...args: any[]) => console.debug('[SceneInterpreter]', ...args),
};

// Helper function to check if a vector's components are finite (Ensure this is outside the class)
function isFiniteVector(v: any): boolean {
    return v && typeof v === 'object' && 
           Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

// --- CLASS DEFINITION MOVED HERE --- Export the class
export class SceneInterpreterImpl implements SceneInterpreter {
  private config: SceneInterpreterConfig | null = null;
  private logger: Logger;

  constructor(config: SceneInterpreterConfig, logger: Logger) { // Make logger required
    this.config = config; // Store initial config
    this.logger = logger; // Store logger
    this.logger.info('Creating Scene Interpreter instance');
  }

  async initialize(config: SceneInterpreterConfig): Promise<void> {
    this.config = config;
    this.logger.info('Initializing Scene Interpreter', { config });
  }

  private validateInputPath(path: CameraPath): ValidationResult {
    this.logger.debug('Validating input path...');
    const errors: string[] = [];
    
    if (!this.config) {
      return { isValid: false, errors: ['Interpreter not initialized'] };
    }

    if (!path || !Array.isArray(path.keyframes)) {
        return { isValid: false, errors: ['Invalid path or keyframes structure'] };
    }

    if (path.keyframes.length === 0) {
        errors.push('Input path has no keyframes.');
        return { isValid: false, errors }; 
    }

    if (path.keyframes.length > this.config.maxKeyframes) {
        errors.push(`Path exceeds max keyframes (${path.keyframes.length} > ${this.config.maxKeyframes}).`);
    }

    let totalKeyframeDuration = 0;
    let previousKfPosition: THREE.Vector3 | null = null; 
    let previousKfTarget: THREE.Vector3 | null = null; 
    
    path.keyframes.forEach((kf, index) => {
        let currentKfHasError = false; 

        if (typeof kf.duration !== 'number' || kf.duration <= 0) {
            errors.push(`Keyframe ${index}: Invalid or non-positive duration (${kf.duration}).`);
            currentKfHasError = true;
        }
        if (!isFiniteVector(kf.position)) {
            errors.push(`Keyframe ${index}: Invalid or non-finite position vector.`);
            currentKfHasError = true;
        }
        if (!isFiniteVector(kf.target)) {
            errors.push(`Keyframe ${index}: Invalid or non-finite target vector.`);
            currentKfHasError = true;
        }
        
        if (!currentKfHasError && kf.duration > 0) {
             totalKeyframeDuration += kf.duration;
        }

        if (currentKfHasError) {
          previousKfPosition = null; 
          return; 
        }

        /* // Temporarily Comment Out ALL Constraint Checks
        // ... (original constraint checks commented out) ...
        */

        previousKfPosition = kf.position; 
        previousKfTarget = kf.target;

    }); 

    if (!path.metadata?.safetyConstraints) {
      this.logger.warn('No safety constraints found in path metadata. Some safety checks skipped.');
    }

    if (Math.abs(totalKeyframeDuration - path.duration) > 0.01) {
        errors.push(`Sum of keyframe durations (${totalKeyframeDuration.toFixed(2)}s) does not match overall path duration (${path.duration.toFixed(2)}s).`);
    }
    
    const isValid = errors.length === 0;
    if (!isValid) {
        this.logger.warn('Input path validation failed:', errors);
    }
    return { isValid, errors };
  }

  /**
   * Helper method to resolve a target name string into a Vector3 position.
   * Uses SceneAnalysis data and the current camera target.
   */
  private _resolveTargetPosition(
    targetName: string,
    sceneAnalysis: SceneAnalysis,
    envAnalysis: EnvironmentalAnalysis, // <-- Pass full envAnalysis
    currentTarget: Vector3
  ): Vector3 | null {
    this.logger.debug(`Resolving target name: '${targetName}'`);

    // Extract user offset (use optional chaining and nullish coalescing)
    const userVerticalAdjustment = envAnalysis?.userVerticalAdjustment ?? 0;
    this.logger.debug(`Using userVerticalAdjustment: ${userVerticalAdjustment}`);

    if (targetName === 'current_target') {
      this.logger.debug('Resolved target to current_target');
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
                this.logger.debug('Resolved target to object_center');
                // Apply user offset to Y component
                return new Vector3(center.x, center.y + userVerticalAdjustment, center.z);
            case 'object_top_center':
                this.logger.debug('Resolved target to object_top_center');
                // Apply user offset to Y component
                return new Vector3(center.x, max.y + userVerticalAdjustment, center.z);
            case 'object_bottom_center':
                this.logger.debug('Resolved target to object_bottom_center');
                // Apply user offset to Y component
                return new Vector3(center.x, min.y + userVerticalAdjustment, center.z);
            case 'object_left_center': // Assuming -X is left
                this.logger.debug('Resolved target to object_left_center');
                // Apply user offset to Y component
                return new Vector3(min.x, center.y + userVerticalAdjustment, center.z);
            case 'object_right_center': // Assuming +X is right
                this.logger.debug('Resolved target to object_right_center');
                // Apply user offset to Y component
                return new Vector3(max.x, center.y + userVerticalAdjustment, center.z);
            case 'object_front_center': // Assuming +Z is front
                this.logger.debug('Resolved target to object_front_center');
                // Apply user offset to Y component
                return new Vector3(center.x, center.y + userVerticalAdjustment, max.z);
            case 'object_back_center': // Assuming -Z is back
                this.logger.debug('Resolved target to object_back_center');
                // Apply user offset to Y component
                return new Vector3(center.x, center.y + userVerticalAdjustment, min.z);
            // --- ADDED Corner Cases --- 
            case 'object_bottom_left': 
            case 'object_bottom_left_center': // Alias
            case 'object_bottom_left_corner': // Alias
                this.logger.debug('Resolved target to object_bottom_left');
                return new Vector3(min.x, min.y + userVerticalAdjustment, center.z);
            case 'object_bottom_right': 
            case 'object_bottom_right_center': // Alias
            case 'object_bottom_right_corner': // Alias
                this.logger.debug('Resolved target to object_bottom_right');
                return new Vector3(max.x, min.y + userVerticalAdjustment, center.z);
            case 'object_top_left': 
            case 'object_top_left_center': // Alias
            case 'object_top_left_corner': // Alias
                this.logger.debug('Resolved target to object_top_left');
                return new Vector3(min.x, max.y + userVerticalAdjustment, center.z);
            case 'object_top_right': 
            case 'object_top_right_center': // Alias
            case 'object_top_right_corner': // Alias
                this.logger.debug('Resolved target to object_top_right');
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
        this.logger.warn(`Cannot resolve target '${targetName}': SceneAnalysis missing required spatial bounds (center, min, max).`);
        return null; // Cannot calculate without bounds
    }
    // --- End Standard Object References ---

    // Resolve named features (assuming LLM uses feature.id or feature.description)
    if (sceneAnalysis?.features && Array.isArray(sceneAnalysis.features)) {
      const foundFeature = sceneAnalysis.features.find(
        (feature) => feature.id === targetName || feature.description === targetName
      );
      if (foundFeature?.position) {
        // Ensure position is a Vector3 (it should be based on SceneAnalysis type)
        if (foundFeature.position instanceof Vector3) {
           this.logger.debug(`Resolved target to feature '${targetName}' at ${foundFeature.position.toArray()}`);
           return foundFeature.position.clone();
        } else {
           this.logger.error(`Feature '${targetName}' found, but its position is not a Vector3 object.`);
           return null;
        }
      }
    }
    
    // TODO: Potentially add resolution for other known points like 'highest', 'lowest' from sceneAnalysis.spatial.referencePoints

    this.logger.warn(`Could not resolve target name '${targetName}'.`);
    return null; // Target not found
  }

  /**
   * Helper method to clamp a position using raycasting against a bounding box.
   * If the path from start to end intersects the box, returns the intersection point (slightly offset).
   * Otherwise, returns the intended end position.
   */
  private _clampPositionWithRaycast(
    startPosition: Vector3,
    intendedEndPosition: Vector3,
    objectBounds: Box3,
    userVerticalAdjustment: number // <-- ADDED userVerticalAdjustment parameter
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
        this.logger.debug(`Using dynamic offset: ${dynamicOffset.toFixed(3)} (based on object size: ${objectSize.toFixed(2)})`);
    } catch (sizeError) {
        this.logger.error("Error calculating object size for dynamic offset, using default 0.1:", sizeError);
        dynamicOffset = 0.1; // Fallback to default minimum if size calculation fails
    }
    // --- Calculate Dynamic Offset --- END ---

    if (distanceToEnd < 1e-6) {
      return startPosition.clone(); // No movement, return start
    }

    const ray = new THREE.Ray(startPosition, movementDirection); // Use normalized direction
    const intersectionPoint = new Vector3();

    // Create an offset bounding box based on the user adjustment
    const offsetBounds = objectBounds.clone().translate(new Vector3(0, userVerticalAdjustment, 0));
    this.logger.debug(`Raycast check using offset bounds: MinY=${offsetBounds.min.y.toFixed(2)}, MaxY=${offsetBounds.max.y.toFixed(2)}`);

    // Use the offsetBounds for collision checks
    if (ray.intersectBox(offsetBounds, intersectionPoint)) { // <-- Use offsetBounds
      const distanceToIntersection = startPosition.distanceTo(intersectionPoint);
      
      if (distanceToIntersection < distanceToEnd - 1e-6) { // Use tolerance
        this.logger.warn(`Raycast: Path intersects bounding box at distance ${distanceToIntersection.toFixed(2)}. Clamping position with dynamic offset.`);
        const finalClampedPosition = new Vector3()
            .copy(intersectionPoint)
            .addScaledVector(movementDirection, -dynamicOffset); // Use dynamicOffset
        return finalClampedPosition;
      }
    }

    // Use the offsetBounds for containsPoint check
    if (offsetBounds.containsPoint(intendedEndPosition)) { // <-- Use offsetBounds
        this.logger.warn('Raycast: Intended end position is inside offset bounds. Clamping to surface as fallback with dynamic offset.');
        const clampedToSurface = offsetBounds.clampPoint(intendedEndPosition, new Vector3()); // <-- Use offsetBounds
        // Calculate outward normal (approximate) based on offset center
        const outwardNormal = new Vector3().subVectors(intendedEndPosition, offsetBounds.getCenter(new Vector3())).normalize(); // <-- Use offsetBounds
        // Ensure normal is valid before applying offset
        if (Number.isFinite(outwardNormal.x) && Number.isFinite(outwardNormal.y) && Number.isFinite(outwardNormal.z) && outwardNormal.lengthSq() > 1e-6) {
             return clampedToSurface.addScaledVector(outwardNormal, dynamicOffset); // Use dynamicOffset
        } else {
             this.logger.warn('Could not determine valid outward normal for offset, returning clamped surface point.');
             return clampedToSurface; // Return point on surface if normal is invalid
        }
    }

    return intendedEndPosition.clone();
  }

  /**
   * Helper method to calculate the effective numeric distance for dolly, truck, or pedestal
   * based on qualitative string inputs (e.g., "close", "a_bit") or a direct number.
   *
   * @param rawDistance The distance parameter from the MotionStep (string, number, or undefined).
   * @param motionType The type of motion ('dolly', 'truck', 'pedestal').
   * @param sceneAnalysis Provides context like object size.
   * @param envAnalysis Provides context like camera constraints.
   * @param currentPosition Current camera position (needed for dolly).
   * @param currentTarget Current camera target (needed for dolly).
   * @param defaultDistance Fallback distance if calculation fails.
   * @returns The calculated numeric distance.
   */
  private _calculateEffectiveDistance(
    rawDistance: string | number | boolean | undefined | null,
    motionType: 'dolly' | 'truck' | 'pedestal',
    sceneAnalysis: SceneAnalysis,
    envAnalysis: EnvironmentalAnalysis,
    currentPosition: Vector3,
    currentTarget: Vector3,
    defaultDistance: number
  ): number {
    let effectiveDistance: number | null = null;

    // 1. Handle direct numeric input
    if (typeof rawDistance === 'number' && rawDistance > 0) {
      effectiveDistance = rawDistance;
      this.logger.debug(`Using numeric distance for ${motionType}: ${effectiveDistance}`);
      return effectiveDistance;
    } else if (typeof rawDistance === 'number' && rawDistance <= 0) {
       this.logger.warn(`Non-positive numeric distance provided for ${motionType}: ${rawDistance}. Using default.`);
       // Falls through to default
    }

    // 2. Handle qualitative string input
    if (typeof rawDistance === 'string') {
      const distStr = rawDistance.toLowerCase().replace(/_/g, ''); // Normalize
      const objectSize = sceneAnalysis.spatial?.bounds?.dimensions.length() ?? 1.0;
      const objectHeight = sceneAnalysis.spatial?.bounds?.dimensions.y ?? 0.5;
      const currentDistanceToTarget = currentPosition.distanceTo(currentTarget); // Dolly specific
      const minConstraintDist = envAnalysis.cameraConstraints?.minDistance ?? 0.1; // Dolly specific

      this.logger.debug(`Calculating ${motionType} distance for qualitative term: '${distStr}' (objectSize: ${objectSize.toFixed(2)}, objectHeight: ${objectHeight.toFixed(2)}, currentDist: ${currentDistanceToTarget.toFixed(2)}, minDist: ${minConstraintDist.toFixed(2)})`);

      switch (motionType) {
        case 'dolly':
          switch (distStr) {
            case 'veryclose':
            case 'extremelyclose':
              // Move almost to the minimum allowed distance
              effectiveDistance = Math.max(0, currentDistanceToTarget - (minConstraintDist + objectSize * 0.05)); // Adjusted factor
              break;
            case 'close':
            case 'closer':
              // Move 60% of the way towards the target (capped by min distance)
              effectiveDistance = Math.max(0, currentDistanceToTarget - (minConstraintDist + objectSize * 0.1)) * 0.6; // Simple ratio, ensures we don't overshoot min dist boundary
              // Alternative: effectiveDistance = currentDistanceToTarget * 0.6; // Simpler, but might violate minDistance more easily if not clamped later
              break;
            case 'abit':
            case 'alittle':
            case 'smallamount':
            case 'slightly':
              // Move by a fraction of current distance or object size
              effectiveDistance = Math.min(currentDistanceToTarget * 0.2, objectSize * 0.5, 2.0);
              break;
            case 'medium':
            case 'mediumdistance': // <<< ADD THIS CASE
              // Move 40% of the way
              effectiveDistance = currentDistanceToTarget * 0.4;
              break;
            // Add cases for "far", "further", "largeamount" if needed for dolly backward?
            // --- ADDED: Dolly backward large distance ---
            case 'far':
            case 'further':
            case 'largeamount':
            case 'largedistance':
              // For dolly backward, move a significant distance away
              // e.g., double the current distance or a large fixed step
              effectiveDistance = Math.max(currentDistanceToTarget * 1.0, objectSize * 2.0, 5.0); // Double distance OR 2x object size OR 5 units, whichever is largest
              this.logger.debug(`Dolly backward large distance interpreted as ${effectiveDistance.toFixed(2)} units away.`);
              break;
            // --- END ADDED ---
            default:
              this.logger.warn(`Unknown qualitative dolly distance: '${rawDistance}'. Using default.`);
              effectiveDistance = defaultDistance;
          }
          break;

        case 'truck':
          switch (distStr) {
            case 'abit':
            case 'alittle':
            case 'smallamount':
            case 'slightly':
              effectiveDistance = Math.min(objectSize * 0.5, 2.0);
              break;
            case 'medium':
            case 'mediumdistance': // <<< ADD THIS CASE
              effectiveDistance = Math.min(objectSize * 1.0, 4.0);
              break;
            case 'far':
            case 'largeamount':
            case 'significantly':
              // --- INCREASED multiplier and cap --- 
              effectiveDistance = Math.min(objectSize * 3.0, 10.0);
              break;
            default:
              this.logger.warn(`Unknown qualitative truck distance: '${rawDistance}'. Using default.`);
              effectiveDistance = defaultDistance;
          }
          break;

        case 'pedestal':
          switch (distStr) {
            case 'abit':
            case 'alittle':
            case 'smallamount':
            case 'slightly':
              effectiveDistance = Math.min(objectHeight * 0.5, 1.0);
              break;
            case 'medium':
            case 'mediumdistance': // <<< ADD THIS CASE
              effectiveDistance = Math.min(objectHeight * 1.0, 2.0);
              break;
            case 'far': // "far" for pedestal might mean a larger vertical move
            case 'largeamount':
            case 'significantly':
            case 'largedistance': // <<< ADD THIS CASE
              // --- INCREASED multiplier and cap --- 
              effectiveDistance = Math.min(objectHeight * 2.5, 5.0);
              break;
            default:
              this.logger.warn(`Unknown qualitative pedestal distance: '${rawDistance}'. Using default.`);
              effectiveDistance = defaultDistance;
          }
          break;
      }

      // Ensure calculated distance is positive if it was calculated
      if (effectiveDistance !== null) {
          effectiveDistance = Math.max(1e-6, effectiveDistance);
          this.logger.debug(`Calculated effective ${motionType} distance: ${effectiveDistance.toFixed(2)}`);
          return effectiveDistance;
      }
    } else if (rawDistance !== undefined && rawDistance !== null) {
        // Handle other invalid types (like boolean passed accidentally)
        this.logger.warn(`Invalid distance type provided for ${motionType}: ${typeof rawDistance}. Using default.`);
    }

    // 3. Fallback to default if no valid distance found
    this.logger.warn(`Could not determine effective distance for ${motionType} from input: ${rawDistance}. Using default: ${defaultDistance}`);
    return defaultDistance;
  }

  /**
 * Maps a canonical descriptor (tiny, small, medium, large, huge) to a context-aware numeric value.
 *
 * @param descriptor The canonical descriptor string.
 * @param magnitudeType Type of magnitude being calculated ('distance', 'factor', 'pass_distance').
 * @param motionType The type of motion ('dolly', 'zoom', etc.).
 * @param sceneAnalysis Provides context like object size.
 * @param envAnalysis Provides context like camera constraints.
 * @param currentCameraState Current camera position and target.
 * @param direction Optional: Direction ('in'/'out') specifically for zoom factor calculation.
 * @returns Calculated numeric value (distance or factor).
 */
private _mapDescriptorToValue(
  descriptor: Descriptor, // Use global Descriptor type
  magnitudeType: MagnitudeType, // Use global MagnitudeType
  motionType: MotionPlan['steps'][0]['type'],
  sceneAnalysis: SceneAnalysis,
  envAnalysis: EnvironmentalAnalysis,
  currentCameraState: { position: Vector3; target: Vector3 },
  direction?: 'in' | 'out'
): number {
  this.logger.debug(`Mapping descriptor '${descriptor}' for ${motionType} (${magnitudeType})`);

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
      this.logger.error('Zoom factor mapping requires direction (\'in\'/\'out\'). Defaulting factor to 1.0');
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
    this.logger.debug(`Mapped zoom descriptor '${descriptor}' (direction: ${direction}) to base factor: ${value}`);
    // Clamping logic...
    let projectedDistance = currentDistanceToTarget * value;
    if (projectedDistance < minConstraintDist) {
        value = minConstraintDist / currentDistanceToTarget;
        this.logger.warn(`Zoom factor clamped due to minDistance. New factor: ${value.toFixed(3)}`);
    }
    if (projectedDistance > maxConstraintDist) {
        value = maxConstraintDist / currentDistanceToTarget;
        this.logger.warn(`Zoom factor clamped due to maxDistance. New factor: ${value.toFixed(3)}`);
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
      this.logger.warn(`Clamping calculated distance ${value.toFixed(2)} to max reasonable ${maxReasonableDist.toFixed(2)}.`);
      value = maxReasonableDist;
    }
    value = Math.max(value, 1e-6);
    this.logger.debug(`Mapped distance descriptor '${descriptor}' for ${motionType} to value: ${value.toFixed(3)}`);
  }
  return value;
}

  private _mapDescriptorToGoalDistance(
    descriptor: Descriptor,
    sceneAnalysis: SceneAnalysis
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
    this.logger.debug(
      `GoalDistance: descriptor '${descriptor}' mapped to goal distance ${goalDist.toFixed(3)}`
    );
    return goalDist;
  }

  // Helper to map raw qualitative words (e.g. "close", "very_far") to a canonical descriptor
  private _normalizeDescriptor(raw: any): Descriptor | null {
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

  interpretPath(
    plan: MotionPlan,
    sceneAnalysis: SceneAnalysis,
    envAnalysis: EnvironmentalAnalysis, 
    // Add initial state, crucial for the first step
    initialCameraState: { camera: Camera, position: Vector3; target: Vector3 }
  ): CameraCommand[] {
    this.logger.info('Interpreting motion plan...', { plan });
    if (!this.config) {
        this.logger.error('Interpreter not initialized');
        throw new Error('Interpreter not initialized');
    }
    if (!plan || !Array.isArray(plan.steps) || plan.steps.length === 0) {
        this.logger.error('Invalid or empty MotionPlan provided.');
        throw new Error('Invalid or empty MotionPlan provided.');
    }

    const commands: CameraCommand[] = [];
    let currentPosition = initialCameraState.position.clone();
    let currentTarget = initialCameraState.target.clone();
    // ADDED: Make camera object available and get initial orientation
    const currentCamera = initialCameraState.camera;
    let currentOrientation = new THREE.Quaternion();
    currentCamera.getWorldQuaternion(currentOrientation);

    // Determine total duration
    const totalDuration = plan.metadata?.requested_duration;
    if (totalDuration === undefined || totalDuration <= 0) {
      this.logger.warn('Total duration not provided or invalid in plan metadata. Cannot calculate step durations accurately.');
      // TODO: Decide how to handle this - default duration? Error?
      // For now, we might not be able to generate commands requiring duration.
      // throw new Error('Missing or invalid requested_duration in MotionPlan metadata');
    }

    // --- Duration Allocation and Normalization --- 
    let idealStepDurations: number[] = [];
    let totalIdealDuration = 0;
    let normalizationFactor = 1.0;

    if (totalDuration && totalDuration > 0) {
        // First pass: Calculate ideal durations based on ratios
        for (const step of plan.steps) {
            const idealDuration = totalDuration * (step.duration_ratio ?? 0);
            idealStepDurations.push(idealDuration);
            totalIdealDuration += idealDuration;
        }

        // Check if normalization is needed (allow small tolerance)
        if (totalIdealDuration > 0 && Math.abs(totalIdealDuration - totalDuration) > 1e-4) {
            normalizationFactor = totalDuration / totalIdealDuration;
            this.logger.warn(`Total ideal step duration (${totalIdealDuration.toFixed(3)}s) differs from requested total (${totalDuration.toFixed(3)}s). Normalizing durations by factor ${normalizationFactor.toFixed(3)}.`);
        } else if (totalIdealDuration <= 0) {
             this.logger.warn('Sum of ideal step durations is zero or negative. Cannot allocate durations.');
        }
    } else {
        this.logger.warn('Total duration not available for normalization. Using default/zero durations.');
        idealStepDurations = plan.steps.map(() => 0);
    }
    // --- End Duration Allocation ---

    for (const [index, step] of plan.steps.entries()) { // Use entries to get index
      this.logger.debug(`Processing step ${index + 1}: ${step.type}`, step.parameters);

      // Get the normalized duration for this step
      let stepDuration = (idealStepDurations[index] ?? 0) * normalizationFactor;
      stepDuration = Math.max(0, stepDuration);

      if (stepDuration <= 0 && step.type !== 'static') {
           this.logger.warn(`Normalized step duration is zero or negative for step ${index + 1} (${step.type}). Using default minimum duration in command generation.`);
           // Assign a small default duration if needed by the generator? Or let generator handle it.
           // For now, let the generator handle zero/negative durations if possible.
      }

      // --- START Target Blending Logic --- 
      // Determine the target *and other params* for the upcoming step BEFORE generating commands
      let nextTargetName = 'current_target'; // Default assumption
      let nextEasingName = DEFAULT_EASING; // Default easing for blend
      let nextSpeed = 'medium'; // Default speed for easing selection
      let currentStepExplicitTargetName: string | null = null; // <<< Define targetName here

      if (step.parameters) {
          nextTargetName = typeof step.parameters.target === 'string' ? step.parameters.target : nextTargetName;
          currentStepExplicitTargetName = typeof step.parameters.target === 'string' ? step.parameters.target : null; // <<< Assign here
          nextEasingName = typeof step.parameters.easing === 'string' && (step.parameters.easing in easingFunctions) ? step.parameters.easing as EasingFunctionName : DEFAULT_EASING;
          nextSpeed = typeof step.parameters.speed === 'string' ? step.parameters.speed : 'medium';
      }

      // Special case: Orbit defaults to object_center if target not specified
      if (step.type === 'orbit' && typeof step.parameters?.target !== 'string') {
          nextTargetName = 'object_center';
      }
      // Add other motion type specific default targets here if needed

      const nextTarget = this._resolveTargetPosition(
        nextTargetName,
        sceneAnalysis,
        envAnalysis, // <-- Pass full envAnalysis
        currentTarget
        // envAnalysis.modelOffset ?? 0 // <-- REMOVE old offset param
      ); // Pass currentTarget as fallback for 'current_target'

      if (nextTarget && !currentTarget.equals(nextTarget)) {
          this.logger.debug(`Target change detected between steps. Previous: ${currentTarget.toArray()}, Next: ${nextTarget.toArray()}. Inserting blend command.`);

          // Determine if the upcoming step is an absolute target tilt/pan
          const isAbsoluteTiltOrPan = (step.type === 'tilt' || step.type === 'pan') && currentStepExplicitTargetName; // <<< Use correct variable name

          // Determine easing for the blend based on the *next* step's speed/easing params
          let blendEasingName = nextEasingName;
           if (nextSpeed === 'very_fast') blendEasingName = 'linear';
           else if (nextSpeed === 'fast') blendEasingName = (nextEasingName === DEFAULT_EASING || nextEasingName === 'linear') ? 'easeOutQuad' : nextEasingName;
           else if (nextSpeed === 'slow') blendEasingName = (nextEasingName === DEFAULT_EASING || nextEasingName === 'linear') ? 'easeInOutQuad' : nextEasingName;

          // --- Adjust Blend/Settle Duration based on context --- 
          let blendDuration: number;
          let addSettleCommand: boolean;

          if (isAbsoluteTiltOrPan) {
              // Use the step's allocated duration for the blend, skip settle
              blendDuration = Math.max(0.1, stepDuration); // Ensure a minimum duration
              addSettleCommand = false;
              this.logger.debug(`Absolute ${step.type} target detected. Using step duration (${blendDuration.toFixed(2)}s) for blend, skipping settle.`);
          } else {
              // Use fixed short duration for blend and add settle for other transitions
              blendDuration = 0.15; 
              addSettleCommand = true;
          }
          // --- End Duration Adjustment --- 
          
          // Add the blend command: Pivot camera target while holding position
          commands.push({
              position: currentPosition.clone(), // Keep position same as end of last step
              target: nextTarget.clone(),       // Set target to the upcoming step's target
              duration: blendDuration,          // Use calculated duration
              easing: blendEasingName
          });

          // Add a tiny settling command if needed
          if (addSettleCommand) {
              const SETTLE_DURATION = 0.05; 
              commands.push({
                  position: currentPosition.clone(), // Position still the same
                  target: nextTarget.clone(),       // Target is now the new target
                  duration: SETTLE_DURATION,        // Very short duration
                  easing: 'linear'                // Linear for a hold
              });
              this.logger.debug(`Settle command added after blend.`);
          }
          
          // Update currentTarget state *before* calling the generator
          currentTarget = nextTarget.clone();
          
          this.logger.debug(`Blend command added. Updated currentTarget for step ${index + 1}.`);
      }
      // --- END Target Blending Logic ---

      // Add debug log before switch
      this.logger.debug(`Switching on type: '${step.type}' (Length: ${step.type?.length ?? 'undefined'})`);
      // Pass stepDuration down to generators (already done implicitly as it's in scope)
      switch (step.type) {
        case 'static': {          
          // Hold current position and target
          const command: CameraCommand = {
            position: currentPosition.clone(),
            target: currentTarget.clone(),
            duration: stepDuration > 0 ? stepDuration : 0.1, 
            easing: 'linear' // Static should always be linear, ignore speed/easing params
          };
          commands.push(command);
          this.logger.debug('Generated static command:', command);
          // State update: Position and target remain the same for the next step
          break;
        }
        case 'zoom': {
          // --- Start Zoom Logic (REVISED for Descriptors/Overrides) ---
          const {
            direction: rawDirection,
            // factor: rawFactor, // OLD
            factor_descriptor: rawFactorDescriptor, // NEW
            factor_override: rawFactorOverride,   // NEW
            target: rawTargetName = 'current_target',
            easing: rawEasingName = DEFAULT_EASING,
            speed: rawSpeed = 'medium',
            target_distance_descriptor: rawGoalDistanceDescriptor, // NEW
          } = step.parameters;

          // Validate direction
          const direction = typeof rawDirection === 'string' && (rawDirection === 'in' || rawDirection === 'out') ? rawDirection : null;
          if (!direction) {
            this.logger.error(`Invalid or missing zoom direction: ${rawDirection}. Skipping step.`);
            continue;
          }

          let effectiveFactor: number | null = null;

          // 1. Check for numeric override
          if (typeof rawFactorOverride === 'number' && rawFactorOverride > 0) {
            effectiveFactor = rawFactorOverride;
            this.logger.debug(`Zoom: Using factor_override: ${effectiveFactor}`);
          } else {
            // 2. Check for descriptor
            const factorDescriptor = typeof rawFactorDescriptor === 'string' && [
              'tiny', 'small', 'medium', 'large', 'huge'
            ].includes(rawFactorDescriptor) ? rawFactorDescriptor as Descriptor : null;

            if (factorDescriptor) {
              // Map descriptor to value
              effectiveFactor = this._mapDescriptorToValue(
                factorDescriptor,
                'factor',
                'zoom',
                sceneAnalysis,
                envAnalysis,
                { position: currentPosition, target: currentTarget },
                direction // Pass direction for zoom factor mapping
              );
              this.logger.debug(`Zoom: Mapped factor_descriptor '${factorDescriptor}' to factor: ${effectiveFactor}`);
            } else if (!rawGoalDistanceDescriptor) {
              // Only error out if there is *no* goal-distance descriptor to fall back on
              this.logger.error(
                `Zoom: Missing factor_override (${rawFactorOverride}) and factor_descriptor (${rawFactorDescriptor}), and no target_distance_descriptor provided. Skipping step.`
              );
              continue;
            }
          }
          
          // Now we have effectiveFactor, proceed with existing zoom logic...
          const targetName = typeof rawTargetName === 'string' ? rawTargetName : 'current_target'; // Default
          const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING;
          const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium'; // Validate speed

          // 1. Resolve target point (uses targetName)
          const zoomTargetPosition = this._resolveTargetPosition(
              targetName,
              sceneAnalysis,
              envAnalysis, // <-- Pass full envAnalysis
              currentTarget
              // envAnalysis.modelOffset ?? 0 // <-- REMOVE old offset param
          );
          if (!zoomTargetPosition) {
            this.logger.error(`Could not resolve zoom target '${targetName}'. Skipping step.`);
            continue;
          }

          // 2. Calculate new distance based on direction and *effectiveFactor*
          const vectorToTarget = new Vector3().subVectors(zoomTargetPosition, currentPosition);
          const currentDistance = vectorToTarget.length();
          let newDistance: number;
          
          // --- NEW: Compute factor from goal‑distance descriptor if provided and factor still undefined ---
          if (effectiveFactor === null) {
              const goalDescriptor = this._normalizeDescriptor(rawGoalDistanceDescriptor);
              if (goalDescriptor) {
                  const goalDistance = this._mapDescriptorToGoalDistance(goalDescriptor, sceneAnalysis);
                  const delta = currentDistance - goalDistance;
                  if (Math.abs(delta) < 1e-6) {
                      this.logger.debug(`Zoom: Already at goal distance for descriptor '${goalDescriptor}'. Generating static command.`);
                      commands.push({
                        position: currentPosition.clone(),
                        target: currentTarget.clone(),
                        duration: stepDuration > 0 ? stepDuration : 0.1,
                        easing: 'linear'
                      });
                      // Skip rest of zoom logic for this step
                      continue;
                  }
                  effectiveFactor = goalDistance / currentDistance;
                  this.logger.debug(`Zoom: Goal descriptor '${goalDescriptor}' → goalDist=${goalDistance.toFixed(3)}, current=${currentDistance.toFixed(3)}, factor=${effectiveFactor.toFixed(3)}`);
                  // Ensure factor moves in the requested direction
                  if (direction === 'in' && effectiveFactor >= 1.0) {
                      effectiveFactor = 0.99; // Minimal inwards move
                  } else if (direction === 'out' && effectiveFactor <= 1.0) {
                      effectiveFactor = 1.01; // Minimal outwards move
                  }
              }
          }

          if (effectiveFactor === null) {
              this.logger.error(`Zoom: Missing effective factor (goal descriptor '${rawGoalDistanceDescriptor}', factor_override '${rawFactorOverride}', factor_descriptor '${rawFactorDescriptor}'). Skipping step.`);
              continue;
          }
          
          // --- Compute newDistance from the resolved factor ---
          newDistance = currentDistance * effectiveFactor;

          // Avoid division by zero or moving to the exact target point if already there
          if (currentDistance < 1e-6) {
              this.logger.warn('Zoom target is effectively at the current camera position. Cannot zoom further. Keeping position static.');
              newDistance = currentDistance; // No change
          }
           // Ensure new distance is positive
          newDistance = Math.max(1e-6, newDistance);

          // --- Constraint Checking (Distance for Zoom) ---
          const { cameraConstraints } = envAnalysis;
          const { spatial } = sceneAnalysis;
          let distanceClamped = false;

          if (cameraConstraints) {
            if (newDistance < cameraConstraints.minDistance) {
              this.logger.warn(`Zoom: Calculated newDistance (${newDistance.toFixed(2)}) violates minDistance (${cameraConstraints.minDistance}). Clamping distance.`);
              newDistance = cameraConstraints.minDistance;
              distanceClamped = true;
            }
            if (newDistance > cameraConstraints.maxDistance) {
              this.logger.warn(`Zoom: Calculated newDistance (${newDistance.toFixed(2)}) violates maxDistance (${cameraConstraints.maxDistance}). Clamping distance.`);
              newDistance = cameraConstraints.maxDistance;
              distanceClamped = true;
            }
          }
          // --- End Distance Constraint Check ---

          // 3. Calculate new position
          // Start from the target and move back along the view vector by the newDistance
          const viewDirectionNormalized = vectorToTarget.normalize(); // Normalize vectorToTarget
          const newPositionCandidate = new Vector3()
              .copy(zoomTargetPosition)
              .addScaledVector(viewDirectionNormalized, -newDistance);

          // --- Constraint Checking (Height & Bounding Box) ---
          let finalPosition = newPositionCandidate.clone();
          let posClamped = false;

          // a) Height constraints
          if (cameraConstraints) {
            if (finalPosition.y < cameraConstraints.minHeight) {
              finalPosition.y = cameraConstraints.minHeight;
              posClamped = true;
              this.logger.warn(`Zoom: Clamped final position to minHeight (${cameraConstraints.minHeight})`);
            }
            if (finalPosition.y > cameraConstraints.maxHeight) {
              finalPosition.y = cameraConstraints.maxHeight;
              posClamped = true;
              this.logger.warn(`Zoom: Clamped final position to maxHeight (${cameraConstraints.maxHeight})`);
            }
          }

          // b) Bounding box constraint (using raycast)
          if (spatial?.bounds) {
              const objectBounds = new Box3(spatial.bounds.min, spatial.bounds.max);
              const clampedPosition = this._clampPositionWithRaycast(
                  currentPosition, // Start from previous position
                  newPositionCandidate, // Target the candidate position
                  objectBounds, // Pass normalized bounds
                  envAnalysis.userVerticalAdjustment ?? 0 // Pass user offset
              );
              if (!clampedPosition.equals(newPositionCandidate)) {
                  finalPosition.copy(clampedPosition);
                  posClamped = true;
              } else {
                  finalPosition.copy(newPositionCandidate);
              }
          } else {
              finalPosition.copy(newPositionCandidate);
          }
          // --- End Height/BB Constraint Check ---

          // Determine effective easing based on speed
          let effectiveEasingName = easingName;
          if (speed === 'very_fast') {
            effectiveEasingName = 'linear';
            this.logger.debug(`Zoom: Speed 'very_fast' overriding easing to ${effectiveEasingName}`);
          } else if (speed === 'fast') {
            effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeOutQuad' : easingName;
            if (effectiveEasingName !== easingName) this.logger.debug(`Zoom: Speed 'fast' selected easing '${effectiveEasingName}' (original: ${easingName})`);
          } else if (speed === 'slow') {
            effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeInOutQuad' : easingName;
            if (effectiveEasingName !== easingName) this.logger.debug(`Zoom: Speed 'slow' selected easing '${effectiveEasingName}' (original: ${easingName})`);
          }

          // 4. Create CameraCommand
          const commandsList: CameraCommand[] = [];
          commandsList.push({
            position: currentPosition.clone(),
            target: currentTarget.clone(), // Zoom doesn't change target *during* the move typically
            duration: 0, // Start command has zero duration
            easing: effectiveEasingName // Apply easing to the transition *following* this command
          });
          commandsList.push({
            position: finalPosition.clone(), // Use potentially clamped position
            target: zoomTargetPosition.clone(), // Zoom keeps looking at the resolved target
            duration: stepDuration > 0 ? stepDuration : 0.1,
            easing: effectiveEasingName // Easing applies to the transition reaching this state
          });
          this.logger.debug('Generated zoom commands:', commandsList);
          commands.push(...commandsList);

          // 5. Update state for the next step
          currentPosition = finalPosition.clone();
          currentTarget = zoomTargetPosition.clone(); // Keep looking at the resolved target
          // --- End Zoom Logic ---
          break;
        }
        case 'orbit': {
          // --- Start Orbit Logic ---
          // Corrected Destructuring & Type Validation
          const { 
            direction: rawDirection, 
            angle: rawAngle, 
            axis: rawAxisName = 'y', 
            target: rawTargetName = 'object_center', 
            easing: rawEasingName = DEFAULT_EASING,
            speed: rawSpeed = 'medium' // Extract speed
          } = step.parameters;

          // Type validation and extraction
          const direction = typeof rawDirection === 'string' && 
                            (rawDirection === 'clockwise' || rawDirection === 'counter-clockwise' || rawDirection === 'left' || rawDirection === 'right') 
                            ? rawDirection : null;
          const angle = typeof rawAngle === 'number' && rawAngle !== 0 ? rawAngle : null;
          let axisName = typeof rawAxisName === 'string' && ['x', 'y', 'z', 'camera_up'].includes(rawAxisName) ? rawAxisName : 'y'; // Include camera_up, default to 'y'
          const targetName = typeof rawTargetName === 'string' ? rawTargetName : 'object_center'; // Default if invalid
          const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING; // Validate and default
          const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium'; // Validate speed

          // Validate essential parameters after type checks
          if (!direction) {
            this.logger.error(`Invalid or missing orbit direction: ${rawDirection}. Skipping step.`);
            continue;
          }
          if (angle === null) { 
            this.logger.error(`Invalid, missing, or zero orbit angle: ${rawAngle}. Skipping step.`);
            continue;
          }
          if (rawAxisName !== axisName && typeof rawAxisName === 'string') { // Log if axis was defaulted
              this.logger.warn(`Invalid or unsupported orbit axis: ${rawAxisName}. Defaulting to '${axisName}'.`);
          }
          // Note: No need to log target/easing defaults as they are common fallbacks.
          
          // 1. Resolve target / orbit center
          let orbitCenter: Vector3;
          // Use the centralized resolver function for ALL named targets
          const resolvedTarget = this._resolveTargetPosition(
              targetName, // Pass the target name from the step parameters
              sceneAnalysis,
              envAnalysis, // <-- Pass full envAnalysis
              currentTarget // Pass current target for potential 'current_target' resolution
              // envAnalysis.modelOffset ?? 0 // <-- REMOVE old offset param
          );

          if (resolvedTarget) {
              orbitCenter = resolvedTarget.clone();
              this.logger.debug(`Orbit target '${targetName}' resolved to: ${orbitCenter.toArray()}`);
          } else {
              // Fallback if resolution fails: Try object_center (now uses normalized data)
              this.logger.warn(`Could not resolve orbit target '${targetName}'. Falling back to normalized object_center.`);
              const baseCenter = sceneAnalysis?.spatial?.bounds?.center;
              if (baseCenter) {
                  // Get the user adjustment for the fallback
                  const userVerticalAdjustment = envAnalysis?.userVerticalAdjustment ?? 0; 
                  orbitCenter = baseCenter.clone();
                  orbitCenter.y += userVerticalAdjustment; // Apply offset to fallback center
                  this.logger.debug(`Using fallback orbit center: ${orbitCenter.toArray()}`);
              } else {
                  this.logger.error(`Cannot resolve orbit target '${targetName}' and fallback object center is unavailable. Skipping step.`);
                  continue; // Cannot proceed without a valid center
              }
          }

          // 2. Determine rotation axis vector
          let rotationAxis = new Vector3(0, 1, 0); // Default World Y
          if (axisName === 'x') rotationAxis.set(1, 0, 0);
          else if (axisName === 'z') rotationAxis.set(0, 0, 1);
          else if (axisName === 'camera_up') {
            // Calculate camera's current up vector
            // Need camera's current orientation. Let's assume standard Y-up for now.
            // To do this properly, we might need the full camera state (or calculate from position/target)
            const cameraDirection = new Vector3().subVectors(currentTarget, currentPosition).normalize();
            const approxCamRight = new Vector3().crossVectors(new Vector3(0, 1, 0), cameraDirection).normalize(); // Assumes world Y is up
            rotationAxis.crossVectors(cameraDirection, approxCamRight).normalize(); // Calculate local up
             this.logger.debug(`Using camera_up axis: ${rotationAxis.toArray()}`);
             // TODO: Refine camera_up calculation if world isn't Y-up or target changes
          }
          // If axisName was invalid, it defaults to Y axis (0,1,0)

          // 3. Calculate rotation angle sign (INVERTED for user perspective)
          let angleSign = 1.0; // Default: counter-clockwise / camera moves left / SCENE MOVES RIGHT
          if (direction === 'clockwise' || direction === 'left') { // <<< Treat 'left' as physically clockwise
            angleSign = -1.0;
            this.logger.debug(`Orbit: Interpreting direction '${direction}' as physically clockwise (scene moves left) (angleSign: -1).`);
          } else { // counter-clockwise or right
            angleSign = 1.0;
            this.logger.debug(`Orbit: Interpreting direction '${direction}' as physically counter-clockwise (scene moves right) (angleSign: 1).`);
          }
          // Apply the sign to the total angle for the final position calculation (though intermediate steps are preferred)
          // const angleRad = THREE.MathUtils.degToRad(angle) * angleSign;
          // const quaternion = new THREE.Quaternion().setFromAxisAngle(rotationAxis, angleRad);
          
          // --- Calculate final position using angleSign (less critical now due to intermediate steps) ---
          const finalAngleRad = THREE.MathUtils.degToRad(angle) * angleSign;
          const finalQuaternion = new THREE.Quaternion().setFromAxisAngle(rotationAxis, finalAngleRad);
          const initialRadiusVector = new Vector3().subVectors(currentPosition, orbitCenter);
          const finalRadiusVector = initialRadiusVector.clone().applyQuaternion(finalQuaternion);
          const radiusFactor = typeof step.parameters.radius_factor === 'number' && step.parameters.radius_factor > 0 ? step.parameters.radius_factor : 1.0;
          if (radiusFactor !== 1.0) finalRadiusVector.multiplyScalar(radiusFactor);
          const newPositionCandidate = new Vector3().addVectors(orbitCenter, finalRadiusVector);
          // --- End final position calculation ---

          // --- Constraint Checking (Apply to the theoretical final position for safety) ---
          let finalPositionClamped = newPositionCandidate.clone(); // Start with theoretical final position
          let clamped = false;
          // ... (rest of constraint checking logic for finalPositionClamped remains the same) ...
          // --- End Constraint Checking ---

          // Determine effective easing based on speed
          let effectiveEasingName = easingName;
          if (speed === 'very_fast') {
            effectiveEasingName = 'linear';
            if (effectiveEasingName !== easingName) this.logger.debug(`Orbit: Speed 'very_fast' selected easing '${effectiveEasingName}' (original: ${easingName})`);
          } else if (speed === 'fast') {
            effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeOutQuad' : easingName;
            if (effectiveEasingName !== easingName) this.logger.debug(`Orbit: Speed 'fast' selected easing '${effectiveEasingName}' (original: ${easingName})`);
          } else if (speed === 'slow') {
            effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeInOutQuad' : easingName;
            if (effectiveEasingName !== easingName) this.logger.debug(`Orbit: Speed 'slow' selected easing '${effectiveEasingName}' (original: ${easingName})`);
          }

          // --- MODIFIED: Generate Intermediate Keyframes --- 
          const commandsList: CameraCommand[] = [];
          const anglePerStep = 2; 
          const numSteps = Math.max(2, Math.ceil(Math.abs(angle) / anglePerStep)); 
          const angleStep = angle / (numSteps - 1); // Use absolute angle for step size calculation
          const durationStep = (stepDuration > 0 ? stepDuration : 0.1) / (numSteps - 1);
          
          // --- Calculate the STEP rotation using the correct angleSign ---
          const angleStepRad = THREE.MathUtils.degToRad(angleStep) * angleSign; // Apply sign here
          const quaternionStep = new THREE.Quaternion().setFromAxisAngle(rotationAxis, angleStepRad);
          // --- END STEP rotation calculation ---
          
          this.logger.debug(`Orbit: Generating ${numSteps} steps for ${angle} degrees (target ~${anglePerStep}deg/step). Step angleRad: ${angleStepRad.toFixed(4)}`);

          let previousPosition = currentPosition.clone();

          // Add the initial state command
          commandsList.push({
              position: previousPosition.clone(),
              target: orbitCenter.clone(), // Start looking at the orbit center immediately
              duration: 0,
              easing: 'linear'
          });

          for (let i = 1; i < numSteps; i++) {
              // Rotate the *previous* position around the orbit center using the STEP quaternion
              const radiusVectorStep = new Vector3().subVectors(previousPosition, orbitCenter);
              radiusVectorStep.applyQuaternion(quaternionStep); // Apply the STEP rotation
              
              // Apply radius factor change incrementally (optional, more complex)
              // For simplicity, we are currently only applying radius factor to the final conceptual point,
              // the intermediate steps maintain the initial radius unless further logic is added.

              const newPositionCandidateStep = new Vector3().addVectors(orbitCenter, radiusVectorStep);
              let finalPositionStep = newPositionCandidateStep.clone();
              let clampedStep = false;

              // --- Constraint Checking (Apply to each intermediate step) --- 
              const { cameraConstraints } = envAnalysis;
              const { spatial } = sceneAnalysis;

              // a) Height constraints
              if (cameraConstraints) {
                if (finalPositionStep.y < cameraConstraints.minHeight) {
                  finalPositionStep.y = cameraConstraints.minHeight;
                  clampedStep = true;
                  // Add specific logging for step clamping if needed
                }
                if (finalPositionStep.y > cameraConstraints.maxHeight) {
                  finalPositionStep.y = cameraConstraints.maxHeight;
                  clampedStep = true;
                }
              }
              // b) Distance constraints
              if (cameraConstraints) {
                  const distanceToCenterStep = finalPositionStep.distanceTo(orbitCenter);
                  if (distanceToCenterStep < cameraConstraints.minDistance) {
                      // Clamp logic
                      const directionFromCenter = new Vector3().subVectors(finalPositionStep, orbitCenter).normalize();
                      finalPositionStep.copy(orbitCenter).addScaledVector(directionFromCenter, cameraConstraints.minDistance);
                      clampedStep = true;
                  }
                  if (distanceToCenterStep > cameraConstraints.maxDistance) {
                     // Clamp logic
                      const directionFromCenter = new Vector3().subVectors(finalPositionStep, orbitCenter).normalize();
                      finalPositionStep.copy(orbitCenter).addScaledVector(directionFromCenter, cameraConstraints.maxDistance);
                      clampedStep = true;
                  }
              }
              // c) Bounding box constraint (using raycast)
              if (spatial?.bounds) {
                  const objectBounds = new Box3(spatial.bounds.min, spatial.bounds.max);
                  const clampedPositionStep = this._clampPositionWithRaycast(
                      previousPosition, // Raycast from previous step's position
                      newPositionCandidateStep,
                      objectBounds,
                      envAnalysis.userVerticalAdjustment ?? 0 // Pass user offset
                  );
                  if (!clampedPositionStep.equals(newPositionCandidateStep)) {
                      finalPositionStep.copy(clampedPositionStep);
                      clampedStep = true;
                  }
              }
              // --- End Constraint Checking --- 

              // Add the intermediate/final command for this step
              commandsList.push({
                  position: finalPositionStep.clone(),
                  target: orbitCenter.clone(), // Always look at the orbit center
                  duration: durationStep, 
                  easing: 'linear'
              });

              // Update previous position for the next iteration
              previousPosition = finalPositionStep.clone();
          }
          
          this.logger.debug('Generated orbit commands (multi-step):', commandsList);
          commands.push(...commandsList);
          // --- END MODIFIED --- 

          // 5. Update state for the next step (use the final calculated position)
          currentPosition = previousPosition.clone(); // previousPosition holds the last step's final position
          currentTarget = orbitCenter.clone(); // Update target to the orbit center
          // --- End Orbit Logic ---
          break;
        }
        case 'pan': {
          // --- Start Pan Logic ---
          const {
            direction: rawDirection,
            angle: rawAngle,
            easing: rawEasingName = DEFAULT_EASING,
            speed: rawSpeed = 'medium' // Extract speed
          } = step.parameters;

          // Validate parameters
          const direction = typeof rawDirection === 'string' && (rawDirection === 'left' || rawDirection === 'right') ? rawDirection : null;
          const angle = typeof rawAngle === 'number' && rawAngle !== 0 ? rawAngle : null;
          const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING;
          const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium'; // Validate speed

          if (!direction) {
            this.logger.error(`Invalid or missing pan direction: ${rawDirection}. Skipping step.`);
            continue;
          }
          if (angle === null) {
            this.logger.error(`Invalid, missing, or zero pan angle: ${rawAngle}. Skipping step.`);
            continue;
          }
          if (rawEasingName !== easingName && typeof rawEasingName === 'string') {
             this.logger.warn(`Invalid or unsupported easing name: ${rawEasingName}. Defaulting to ${easingName}.`);
          }

          // 1. Determine rotation axis (Camera's local UP)
          // We need to calculate the camera's local up vector. 
          // Assume world up is (0, 1, 0) for cross product calculations.
          const viewDirection = new Vector3().subVectors(currentTarget, currentPosition).normalize();
          // Handle cases where view direction might align with world up (looking straight up/down)
          let cameraUp = new Vector3(0, 1, 0);
          if (Math.abs(viewDirection.y) > 0.999) { // Looking nearly straight up or down
              // Use camera's local 'forward' projected onto XZ plane to find a stable 'right'
              const forwardXZ = new Vector3(viewDirection.x, 0, viewDirection.z).normalize();
              const cameraRight = new Vector3().crossVectors(new Vector3(0, 1, 0), forwardXZ).normalize();
              cameraUp.crossVectors(forwardXZ, cameraRight).normalize(); // Should give a stable 'up'
          } else {
               // Standard case: Calculate right vector, then true up vector
              const cameraRight = new Vector3().crossVectors(new Vector3(0, 1, 0), viewDirection).normalize();
              cameraUp.crossVectors(viewDirection, cameraRight).normalize();
          }
          this.logger.debug(`Pan using camera local up axis: ${cameraUp.toArray()}`);

          // 2. Calculate rotation
          const angleRad = THREE.MathUtils.degToRad(angle) * (direction === 'left' ? 1 : -1); // Pan left = positive rotation around local Y
          const quaternion = new THREE.Quaternion().setFromAxisAngle(cameraUp, angleRad);

          // 3. Rotate the target point around the camera position
          const targetVector = new Vector3().subVectors(currentTarget, currentPosition);
          targetVector.applyQuaternion(quaternion);
          const newTarget = new Vector3().addVectors(currentPosition, targetVector);

          // Determine effective easing based on speed
          let effectiveEasingName = easingName;
          if (speed === 'very_fast') {
            effectiveEasingName = 'linear';
            if (effectiveEasingName !== easingName) this.logger.debug(`Pan: Speed 'very_fast' selected easing '${effectiveEasingName}' (original: ${easingName})`);
          } else if (speed === 'fast') {
            effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeOutQuad' : easingName;
            if (effectiveEasingName !== easingName) this.logger.debug(`Pan: Speed 'fast' selected easing '${effectiveEasingName}' (original: ${easingName})`);
          } else if (speed === 'slow') {
            effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeInOutQuad' : easingName;
            if (effectiveEasingName !== easingName) this.logger.debug(`Pan: Speed 'slow' selected easing '${effectiveEasingName}' (original: ${easingName})`);
          }

          // 4. Create CameraCommand (Position stays the same, Target changes)
          const commandsList: CameraCommand[] = [];
          commandsList.push({
            position: currentPosition.clone(), 
            target: currentTarget.clone(), 
            duration: 0,
            easing: effectiveEasingName
          });
          commandsList.push({
            position: currentPosition.clone(), // Position does not change for pan
            target: newTarget.clone(),
            duration: stepDuration > 0 ? stepDuration : 0.1, // Use calculated duration
            easing: effectiveEasingName
          });
          this.logger.debug('Generated pan commands:', commandsList);
          commands.push(...commandsList);

          // 5. Update state for the next step (Only target changes)
          currentTarget = newTarget.clone();
          // currentPosition remains the same
          // --- End Pan Logic ---
          break;
        }
        case 'tilt': {
          // --- Start Tilt Logic (REVISED to handle explicit target) ---
          const {
            direction: rawDirection,
            angle: rawAngle,
            // target: rawTargetName, // <<< Already determined as currentStepExplicitTargetName
            easing: rawEasingName = DEFAULT_EASING,
            speed: rawSpeed = 'medium' 
          } = step.parameters;

          // Validate parameters
          const direction = typeof rawDirection === 'string' && (rawDirection === 'up' || rawDirection === 'down') ? rawDirection : null;
          const angle = typeof rawAngle === 'number' && rawAngle !== 0 ? rawAngle : null;
          const targetName = currentStepExplicitTargetName; // <<< Use variable from outer scope
          const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING;
          const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium';

          if (!direction) {
            this.logger.error(`Invalid or missing tilt direction: ${rawDirection}. Skipping step.`);
            continue;
          }
          if (angle === null) {
            this.logger.error(`Invalid, missing, or zero tilt angle: ${rawAngle}. Skipping step.`);
            continue;
          }
          // We don't need to check easing/speed defaults here as they are handled later

          // Capture the target state *before* this step begins
          const initialTarget = currentTarget.clone(); 

          // --- Determine Final Target --- 
          let finalTarget: Vector3;
          let isAbsoluteTarget = false;
          if (targetName) {
              // An explicit target was specified in the step parameters
              const resolvedExplicitTarget = this._resolveTargetPosition(
                targetName,
                sceneAnalysis,
                envAnalysis, // <-- Pass full envAnalysis
                initialTarget // Use initialTarget here
                // envAnalysis.modelOffset ?? 0 // <-- REMOVE old offset param
            ); // Try resolving it
              if (resolvedExplicitTarget) {
                  finalTarget = resolvedExplicitTarget.clone();
                  this.logger.debug(`Tilt: Using explicitly provided target '${targetName}' resolved to ${finalTarget.toArray()}`);
                  isAbsoluteTarget = true; 
                  // NOTE: The provided 'angle' parameter is ignored when an absolute target is given.
                  // We might want to log a warning or refine the KB/Assistant instructions about this.
                  if (angle) { 
                      this.logger.warn(`Tilt: Explicit target '${targetName}' provided, ignoring angle parameter (${angle} degrees).`);
                  }
              } else {
                  this.logger.error(`Tilt: Could not resolve explicit target '${targetName}'. Skipping step.`);
                  continue; // Cannot proceed without a valid target
              }
          } else {
              // No explicit target - perform a relative tilt by the specified angle
              this.logger.debug(`Tilt: No explicit target provided. Performing relative tilt of ${angle} degrees ${direction}.`);
              isAbsoluteTarget = false;
              // Calculate rotation axis (Camera's local RIGHT)
              const viewDirection = new Vector3().subVectors(initialTarget, currentPosition).normalize();
              let cameraRight = new Vector3(1, 0, 0); // Default fallback
              if (Math.abs(viewDirection.y) < 0.999) { 
                 cameraRight.crossVectors(new Vector3(0, 1, 0), viewDirection).normalize();
                 if (cameraRight.lengthSq() < 1e-6) { 
                    this.logger.warn('Calculated camera right vector is zero. Using world X as fallback axis for tilt.');
                    cameraRight.set(1, 0, 0); 
                 }                 
              } else {
                 this.logger.warn('Cannot reliably determine camera right vector (looking straight up/down). Using world X as fallback axis for tilt.');
              }
              this.logger.debug(`Tilt using camera local right axis: ${cameraRight.toArray()}`);
              const rotationAxis = cameraRight;
              const angleRad = THREE.MathUtils.degToRad(angle) * (direction === 'up' ? -1 : 1); 
              const quaternion = new THREE.Quaternion().setFromAxisAngle(rotationAxis, angleRad); 
              const targetVector = new Vector3().subVectors(initialTarget, currentPosition);
              targetVector.applyQuaternion(quaternion);
              finalTarget = new Vector3().addVectors(currentPosition, targetVector);
          }
          // --- End Determine Final Target ---

          // Determine effective easing based on speed
          let effectiveEasingName = easingName;
          // Restore the original easing logic block
          if (speed === 'very_fast') {
            effectiveEasingName = 'linear';
            if (effectiveEasingName !== easingName) this.logger.debug(`Tilt: Speed 'very_fast' selected easing '${effectiveEasingName}' (original: ${easingName})`);
          } else if (speed === 'fast') {
            effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeOutQuad' : easingName;
            if (effectiveEasingName !== easingName) this.logger.debug(`Tilt: Speed 'fast' selected easing '${effectiveEasingName}' (original: ${easingName})`);
          } else if (speed === 'slow') {
            effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeInOutQuad' : easingName;
            if (effectiveEasingName !== easingName) this.logger.debug(`Tilt: Speed 'slow' selected easing '${effectiveEasingName}' (original: ${easingName})`);
          }
          
          // Create CameraCommands
          const commandsList: CameraCommand[] = [];
          // --- Only add commands if it's a relative tilt --- 
          if (!isAbsoluteTarget) {
            this.logger.debug('Tilt: Generating relative tilt commands.');
            commandsList.push({
                position: currentPosition.clone(),
                target: initialTarget.clone(), // <<< Start from the initial target state for this step
                duration: 0,
                easing: effectiveEasingName
            });
            commandsList.push({
              position: currentPosition.clone(), 
              target: finalTarget.clone(), // <<< End with the calculated final target
              duration: stepDuration > 0 ? stepDuration : 0.1, 
              easing: effectiveEasingName
            });
            this.logger.debug('Generated relative tilt commands:', commandsList);
            commands.push(...commandsList);
          } else {
             this.logger.debug('Tilt: Absolute target provided. Blend/settle commands handled orientation. Skipping tilt command generation.');
             // No commands needed here, blend+settle already handled it.
             // The duration allocated to this step is effectively used by blend/settle.
          }

          // Update state for the next step 
          currentTarget = finalTarget.clone(); // <<< Update state with the actual final target
          // currentPosition remains the same
          // --- End Tilt Logic (REVISED) ---
          break;
        }
        case 'dolly': {
          // --- Start Dolly Logic (REVISED structure) ---
          const {
            direction: rawDirection, 
            distance_descriptor: rawDistanceDescriptor, 
            distance_override: rawDistanceOverride, 
            destination_target: rawDestinationTargetName,
            target_distance_descriptor: rawGoalDistanceDescriptor,
            easing: rawEasingName = DEFAULT_EASING,
            speed: rawSpeed = 'medium'
          } = step.parameters;

          let direction: string | null = null;
          let effectiveDistance: number | null = null;
          let isDestinationMove = false;

          // --- NEW: Handle goal‑distance descriptor early ---
          const goalDistanceDescriptor = this._normalizeDescriptor(rawGoalDistanceDescriptor);

          if (goalDistanceDescriptor) {
            // Compute absolute goal distance, then derive delta & direction.
            const currentDistanceToTarget = currentPosition.distanceTo(currentTarget);
            const goalDistance = this._mapDescriptorToGoalDistance(
              goalDistanceDescriptor,
              sceneAnalysis,
            );
            const delta = currentDistanceToTarget - goalDistance;
            if (Math.abs(delta) < 1e-6) {
              this.logger.debug(
                `Dolly: Already at goal distance for descriptor '${goalDistanceDescriptor}'. Generating static command.`
              );
              commands.push({
                position: currentPosition.clone(),
                target: currentTarget.clone(),
                duration: stepDuration > 0 ? stepDuration : 0.1,
                easing: 'linear',
              });
              break;
            }
            direction = delta > 0 ? 'forward' : 'backward';
            effectiveDistance = Math.abs(delta);
            this.logger.debug(
              `Dolly: Goal descriptor '${goalDistanceDescriptor}' → goalDist=${goalDistance.toFixed(
                3,
              )}, current=${currentDistanceToTarget.toFixed(3)}, delta=${delta.toFixed(
                3,
              )}, direction='${direction}', effectiveDistance=${effectiveDistance.toFixed(
                3,
              )}`,
            );
          }

          const destinationTargetName = typeof rawDestinationTargetName === 'string' ? rawDestinationTargetName : null;

          // Only evaluate destination_target logic if goal‑distance was *not* used.
          if (!goalDistanceDescriptor && destinationTargetName) {
            // Attempt to calculate direction from destination target
            this.logger.debug(`Dolly: Destination target '${destinationTargetName}' provided. Calculating required distance and direction.`);
            const destinationTarget = this._resolveTargetPosition(
              destinationTargetName,
              sceneAnalysis,
              envAnalysis, // <-- Pass full envAnalysis
              currentTarget
              // envAnalysis.modelOffset ?? 0 // <-- REMOVE old offset param
            );
            if (destinationTarget) {
              const viewDirectionVec = new Vector3().subVectors(currentTarget, currentPosition).normalize();
              if (viewDirectionVec.lengthSq() >= 1e-9) {
                  const displacementVector = new Vector3().subVectors(destinationTarget, currentPosition);
                  const signedDistance = displacementVector.dot(viewDirectionVec);
                  direction = signedDistance >= 0 ? 'forward' : 'backward'; // Set direction based on calculation
                  effectiveDistance = Math.abs(signedDistance); // Also calculate distance here
                  isDestinationMove = true;
                  this.logger.debug(`Dolly: Calculated destination move: direction='${direction}', distance=${effectiveDistance.toFixed(2)}`);
              } else {
                 this.logger.warn('Dolly: Cannot calculate view direction for destination move (target equals position). Ignoring destination_target for direction.');
              }
            } else {
              this.logger.warn(`Dolly: Could not resolve destination target '${destinationTargetName}'. Ignoring destination_target for direction.`);
            }
          }

          // If direction wasn't set by goal‑descriptor or destination logic, use rawDirection
          if (!direction) {
            let assistantDirection = typeof rawDirection === 'string' ? rawDirection.toLowerCase() : null;
            if (assistantDirection === 'in') assistantDirection = 'forward';
            if (assistantDirection === 'out') assistantDirection = 'backward';
            if (assistantDirection === 'forward' || assistantDirection === 'backward') {
              direction = assistantDirection;
            } else {
              this.logger.error(`Invalid or missing dolly direction: ${rawDirection} (and destination/goal failed). Skipping step.`);
              continue;
            }
          }

          // --- STEP 2: Determine Effective Distance if still unknown --- 
          if (effectiveDistance === null && !isDestinationMove && !goalDistanceDescriptor) {
            // 1. Check Override
            this.logger.debug(`Dolly: Checking override. rawDistanceOverride = ${rawDistanceOverride}, typeof = ${typeof rawDistanceOverride}`);
            if (typeof rawDistanceOverride === 'number' && rawDistanceOverride > 0) {
              effectiveDistance = rawDistanceOverride;
              this.logger.debug(`Dolly: Using distance_override: ${effectiveDistance}`);
            } else {
              // 2. Check Descriptor
              const distanceDescriptor = this._normalizeDescriptor(rawDistanceDescriptor);

              if (distanceDescriptor) {
                effectiveDistance = this._mapDescriptorToValue(
                  distanceDescriptor, 'distance', 'dolly',
                  sceneAnalysis, envAnalysis,
                  { position: currentPosition, target: currentTarget }
                );
                this.logger.debug(`Dolly: Mapped distance_descriptor '${distanceDescriptor}' to distance: ${effectiveDistance}`);
              } else {
                this.logger.error(`Dolly: No valid distance found (no destination, override, descriptor, or goal). Skipping step.`);
                continue; 
              }
            }
          }
          
          // --- STEP 3: Validation and Movement Calculation ---
          if (effectiveDistance === null || effectiveDistance < 0) {
            this.logger.error(`Dolly: Final effective distance is invalid (${effectiveDistance}). Skipping step.`);
            continue;
          }
          if (effectiveDistance < 1e-6) { 
             this.logger.debug('Dolly: Effective distance is zero. Generating static command.');
             commands.push({
               position: currentPosition.clone(),
               target: currentTarget.clone(),
               duration: stepDuration > 0 ? stepDuration : 0.1,
               easing: 'linear'
             });
             break; // Skip rest of dolly logic
          }

          const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING;
          const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium';

          // Calculate movement vector (Direction is now guaranteed to be valid)
          const viewDirection = new Vector3().subVectors(currentTarget, currentPosition).normalize();
          const moveVector = viewDirection.multiplyScalar(effectiveDistance * (direction === 'forward' ? 1 : -1));

          // Calculate candidate position
          const newPositionCandidate = new Vector3().addVectors(currentPosition, moveVector);
          let finalPosition = newPositionCandidate.clone();
          let clamped = false;

          // --- Constraint Checking --- 
          const { cameraConstraints } = envAnalysis;
          const { spatial } = sceneAnalysis;

          // a) Height constraints
          if (cameraConstraints) {
            if (finalPosition.y < cameraConstraints.minHeight) {
              finalPosition.y = cameraConstraints.minHeight;
              clamped = true;
              this.logger.warn(`Dolly: Clamped position to minHeight (${cameraConstraints.minHeight})`);
            }
            if (finalPosition.y > cameraConstraints.maxHeight) {
              finalPosition.y = cameraConstraints.maxHeight;
              clamped = true;
              this.logger.warn(`Dolly: Clamped position to maxHeight (${cameraConstraints.maxHeight})`);
            }
          }

          // b) Distance constraints (relative to currentTarget)
          if (cameraConstraints) {
            const distanceToTarget = finalPosition.distanceTo(currentTarget);
            if (distanceToTarget < cameraConstraints.minDistance) {
               const directionFromTarget = new Vector3().subVectors(finalPosition, currentTarget).normalize();
               finalPosition.copy(currentTarget).addScaledVector(directionFromTarget, cameraConstraints.minDistance);
               clamped = true;
               this.logger.warn(`Dolly: Clamped position to minDistance (${cameraConstraints.minDistance})`);
            }
            if (distanceToTarget > cameraConstraints.maxDistance) {
               const directionFromTarget = new Vector3().subVectors(finalPosition, currentTarget).normalize();
               finalPosition.copy(currentTarget).addScaledVector(directionFromTarget, cameraConstraints.maxDistance);
               clamped = true;
               this.logger.warn(`Dolly: Clamped position to maxDistance (${cameraConstraints.maxDistance})`);
            }
          }
          
          // c) Bounding box constraint (using raycast)
          if (spatial?.bounds) {
              const objectBounds = new Box3(spatial.bounds.min, spatial.bounds.max);
              const clampedPosition = this._clampPositionWithRaycast(
                  currentPosition,
                  newPositionCandidate,
                  objectBounds,
                  envAnalysis.userVerticalAdjustment ?? 0 // Pass user offset
              );
              if (!clampedPosition.equals(newPositionCandidate)) {
                  finalPosition.copy(clampedPosition);
                  clamped = true;
              } else {
                  finalPosition.copy(newPositionCandidate);
              }
          } else {
              finalPosition.copy(newPositionCandidate);
          }
          // --- End Constraint Checking ---

          // Determine effective easing based on speed
          let effectiveEasingName = easingName;
          if (speed === 'very_fast') {
            effectiveEasingName = 'linear';
            if (effectiveEasingName !== easingName) this.logger.debug(`Dolly: Speed 'very_fast' selected easing '${effectiveEasingName}' (original: ${easingName})`);
          } else if (speed === 'fast') {
            effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeOutQuad' : easingName;
            if (effectiveEasingName !== easingName) this.logger.debug(`Dolly: Speed 'fast' selected easing '${effectiveEasingName}' (original: ${easingName})`);
          } else if (speed === 'slow') {
            effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeInOutQuad' : easingName;
            if (effectiveEasingName !== easingName) this.logger.debug(`Dolly: Speed 'slow' selected easing '${effectiveEasingName}' (original: ${easingName})`);
          }

          // 3. Create CameraCommands
          const commandsList: CameraCommand[] = [];
          commandsList.push({
            position: currentPosition.clone(),
            target: currentTarget.clone(), 
            duration: 0,
            easing: effectiveEasingName
          });
          commandsList.push({
            position: finalPosition.clone(),
            target: currentTarget.clone(), // Target doesn't change for dolly
            duration: stepDuration > 0 ? stepDuration : 0.1,
            easing: effectiveEasingName
          });
          this.logger.debug('Generated dolly commands:', commandsList);
          commands.push(...commandsList);

          // 4. Update state for the next step
          currentPosition = finalPosition.clone();
          // currentTarget remains the same
          // --- End Dolly Logic ---
          break;
        }
        case 'truck': {
          const {
            direction: rawDirection,
            // distance: rawDistance, // OLD
            distance_descriptor: rawDistanceDescriptor, // NEW - Should define it
            distance_override: rawDistanceOverride,     // NEW - Should define it
            destination_target: rawDestinationTargetName,
            easing: rawEasingName = DEFAULT_EASING,
            speed: rawSpeed = 'medium'
          } = step.parameters;

          let direction: string | null = null;
          let effectiveDistance: number | null = null;
          let isDestinationMove = false;

          const destinationTargetName = typeof rawDestinationTargetName === 'string' ? rawDestinationTargetName : null;

          // --- Check for Destination Target --- 
          if (destinationTargetName) {
            this.logger.debug(`Truck: Destination target '${destinationTargetName}' provided. Calculating required distance.`);
            const destinationTarget = this._resolveTargetPosition(
                destinationTargetName,
                sceneAnalysis,
                envAnalysis, // <-- Pass full envAnalysis
                currentTarget
                // envAnalysis.modelOffset ?? 0 // <-- REMOVE old offset param
            );

            if (destinationTarget) {
                const viewDirection = new Vector3().subVectors(currentTarget, currentPosition).normalize();
                const worldUp = new Vector3(0, 1, 0);
                const cameraRight = new Vector3().crossVectors(viewDirection, worldUp).normalize();

                if (cameraRight.lengthSq() < 1e-9) {
                    this.logger.warn('Truck: Cannot calculate camera right vector for destination move (view likely aligned with world up). Falling back to distance parameter.');
                } else {
                    const displacementVector = new Vector3().subVectors(destinationTarget, currentPosition);
                    // Project displacement onto camera right vector
                    const signedDistance = displacementVector.dot(cameraRight);

                    if (Math.abs(signedDistance) < 1e-6) {
                        this.logger.warn(`Truck: Destination target ${destinationTargetName} is effectively already in the current plane perpendicular to truck direction. No truck needed.`);
                        effectiveDistance = 0;
                    } else {
                        effectiveDistance = Math.abs(signedDistance);
                    }
                    
                    // Override direction based on calculated distance
                    direction = signedDistance >= 0 ? 'right' : 'left';
                    isDestinationMove = true;
                    this.logger.debug(`Truck: Calculated destination move: direction='${direction}', distance=${effectiveDistance.toFixed(2)}`);
                }
            } else {
                this.logger.warn(`Truck: Could not resolve destination target '${destinationTargetName}'. Falling back to distance parameter.`);
            }
          }
          // --- End Destination Target Check ---

          // --- Distance Calculation (Priority: Override > Descriptor) ---
          if (!isDestinationMove) {
             // Add diagnostic logging
             this.logger.debug(`Truck: Checking override. rawDistanceOverride = ${rawDistanceOverride}, typeof = ${typeof rawDistanceOverride}`);
             
             // 1. Check Override (PRIORITY 2)
             if (typeof rawDistanceOverride === 'number' && rawDistanceOverride > 0) {
                effectiveDistance = rawDistanceOverride;
                this.logger.debug(`Truck: Using distance_override: ${effectiveDistance}`);
             } else {
                // 2. Check Descriptor
                const distanceDescriptor = this._normalizeDescriptor(rawDistanceDescriptor);
                
                if (distanceDescriptor) {
                  effectiveDistance = this._mapDescriptorToValue(
                    distanceDescriptor,
                    'distance',
                    'truck',
                    sceneAnalysis,
                    envAnalysis,
                    { position: currentPosition, target: currentTarget }
                  );
                  this.logger.debug(`Truck: Mapped distance_descriptor '${distanceDescriptor}' to distance: ${effectiveDistance}`);
                } else {
                   // 3. Error
                   this.logger.error(`Truck: Missing or invalid destination_target, distance_override (${rawDistanceOverride}), AND distance_descriptor (${rawDistanceDescriptor}). Skipping step.`);
                   continue; 
                }
             }
          }
          // --- End Distance Calculation (Priority: Override > Descriptor) ---

          // Validate final calculated distance
          if (effectiveDistance === null || effectiveDistance < 0) {
            this.logger.error(`Truck: Final effective distance calculation failed or resulted in negative value. Skipping step.`);
            continue;
          }
          if (effectiveDistance < 1e-6) { // Handle zero movement explicitly
             this.logger.debug('Truck: Effective distance is zero. Generating static command.');
             commands.push({
               position: currentPosition.clone(),
               target: currentTarget.clone(),
               duration: stepDuration > 0 ? stepDuration : 0.1,
               easing: 'linear'
             });
             break; // Skip rest of truck logic
          }

          const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING;
          const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium';

          // 1. Calculate movement vector using effectiveDistance & determined direction
          const viewDirection = new Vector3().subVectors(currentTarget, currentPosition).normalize();
          // --- FIX: Correct cross product order for cameraRight --- 
          // Right = Forward x Up (in a right-handed system)
          const worldUp = new Vector3(0, 1, 0); 
          const cameraRight = new Vector3().crossVectors(viewDirection, worldUp).normalize(); 
          // --- END FIX ---
          // Handle edge case where view is aligned with world up
          if (cameraRight.lengthSq() < 1e-6) { 
             this.logger.warn('Cannot determine camera right vector (view likely aligned with world up). Using world X as fallback.');
             cameraRight.set(1, 0, 0); // Fallback to world X axis
          }

          // Fallback: use explicit direction parameter if destination‑target logic
          // didn't set it.
          if (!direction) {
            const explicitDir =
              typeof rawDirection === 'string' &&
              (rawDirection === 'left' || rawDirection === 'right')
                ? rawDirection
                : null;

            if (explicitDir) {
              direction = explicitDir;
              this.logger.debug(`Truck: Using explicit direction parameter '${direction}'.`);
            }
          }

          // Ensure direction is valid before proceeding
          if (!direction) {
             this.logger.error('Truck: Internal error - direction not set. Skipping step.');
             continue;
          }
          const moveVector = cameraRight.multiplyScalar(effectiveDistance * (direction === 'left' ? -1 : 1)); // Left = -X, Right = +X

          // 2. Calculate candidate position AND target
          const newPositionCandidate = new Vector3().addVectors(currentPosition, moveVector);
          const newTargetCandidate = new Vector3().addVectors(currentTarget, moveVector); // <<< ALSO SHIFT TARGET
          
          let finalPosition = newPositionCandidate.clone();
          let clamped = false;

          // --- Ensure Context is Available for Constraints --- 
          const { cameraConstraints } = envAnalysis;
          const { spatial } = sceneAnalysis;
          // --- End Context ---
          
          // --- Constraint Checking (Apply primarily to Position) --- 
          // a) Height constraints
          if (cameraConstraints) {
             if (finalPosition.y < cameraConstraints.minHeight) {
               finalPosition.y = cameraConstraints.minHeight;
               clamped = true;
               this.logger.warn(`Truck: Clamped position to minHeight (${cameraConstraints.minHeight})`);
             }
             if (finalPosition.y > cameraConstraints.maxHeight) {
               finalPosition.y = cameraConstraints.maxHeight;
               clamped = true;
               this.logger.warn(`Truck: Clamped position to maxHeight (${cameraConstraints.maxHeight})`);
             }
          }
          // ... (Bounding box constraint using raycast from currentPosition to newPositionCandidate) ...
          if (spatial?.bounds) { // <<< Make sure spatial is defined here
              const objectBounds = new Box3(spatial.bounds.min, spatial.bounds.max);
              const clampedPosition = this._clampPositionWithRaycast(
                  currentPosition,
                  newPositionCandidate,
                  objectBounds,
                  envAnalysis.userVerticalAdjustment ?? 0 // Pass user offset
              );
              if (!clampedPosition.equals(newPositionCandidate)) {
                  finalPosition.copy(clampedPosition);
                  clamped = true;
              } else {
                  finalPosition.copy(newPositionCandidate);
              }
          } else {
              finalPosition.copy(newPositionCandidate);
          }
          // --- End Constraint Checking ---
          
          // --- Calculate final target based on actual position movement --- START ---
          // This ensures target moves exactly parallel to how the position actually moved after clamping
          const actualMoveVector = new Vector3().subVectors(finalPosition, currentPosition);
          const finalTarget = new Vector3().addVectors(currentTarget, actualMoveVector);
          // --- Calculate final target based on actual position movement --- END ---

          // Determine effective easing based on speed
          let effectiveEasingName = easingName;
          if (speed === 'very_fast') {
            effectiveEasingName = 'linear';
            if (effectiveEasingName !== easingName) this.logger.debug(`Truck: Speed 'very_fast' selected easing '${effectiveEasingName}' (original: ${easingName})`);
          } else if (speed === 'fast') {
            effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeOutQuad' : easingName;
            if (effectiveEasingName !== easingName) this.logger.debug(`Truck: Speed 'fast' selected easing '${effectiveEasingName}' (original: ${easingName})`);
          } else if (speed === 'slow') {
            effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeInOutQuad' : easingName;
            if (effectiveEasingName !== easingName) this.logger.debug(`Truck: Speed 'slow' selected easing '${effectiveEasingName}' (original: ${easingName})`);
          }

          // 3. Create CameraCommands
          const commandsList: CameraCommand[] = [];
          commandsList.push({
            position: currentPosition.clone(),
            target: currentTarget.clone(), 
            duration: 0,
            easing: effectiveEasingName
          });
          commandsList.push({
            position: finalPosition.clone(), 
            target: finalTarget.clone(), // <<< USE FINAL TARGET
            duration: stepDuration > 0 ? stepDuration : 0.1,
            easing: effectiveEasingName
          });
          this.logger.debug('Generated truck commands:', commandsList);
          commands.push(...commandsList);

          // 4. Update state for the next step
          currentPosition = finalPosition.clone();
          currentTarget = finalTarget.clone(); // <<< UPDATE TARGET STATE
          // --- End Truck Logic ---
          break;
        }
        case 'pedestal': {
          const {
            direction: rawDirection,
            // distance: rawDistance, // OLD
            distance_descriptor: rawDistanceDescriptor, // NEW - Should define it
            distance_override: rawDistanceOverride,     // NEW - Should define it
            destination_target: rawDestinationTargetName,
            easing: rawEasingName = DEFAULT_EASING,
            speed: rawSpeed = 'medium'
          } = step.parameters;

          let direction: string | null = null;
          let effectiveDistance: number | null = null;
          let isDestinationMove = false;

          const destinationTargetName = typeof rawDestinationTargetName === 'string' ? rawDestinationTargetName : null;

          // --- Check for Destination Target --- 
          if (destinationTargetName) {
            this.logger.debug(`Pedestal: Destination target '${destinationTargetName}' provided. Calculating required distance.`);
            // Pass the offset from envAnalysis, defaulting to 0
            // Assuming modelOffset is directly on envAnalysis or fetched separately
            const userVerticalAdjustmentValue = envAnalysis.userVerticalAdjustment ?? 0; // Use ?? 0 for null/undefined fallback // <-- FIX LINTER ERROR
            this.logger.debug(`Using userVerticalAdjustmentValue: ${userVerticalAdjustmentValue}`); // Add log
            const destinationTarget = this._resolveTargetPosition(
                destinationTargetName,
                sceneAnalysis,
                envAnalysis, // <-- Pass full envAnalysis
                currentTarget
                // envAnalysis.modelOffset ?? 0 // <-- REMOVE old offset param
            );

            if (destinationTarget) {
                // Pedestal moves along world Y axis
                const signedDistance = destinationTarget.y - currentPosition.y;
                if (Math.abs(signedDistance) < 1e-6) { // Case 1: Distance is effectively zero
                    this.logger.warn(`Pedestal: Destination target height matches current. No pedestal needed.`);
                    effectiveDistance = 0;
                    isDestinationMove = true; // <<< FIX: Ensure flag is set even for zero distance
                } else { // Case 2: Distance is non-zero
                    effectiveDistance = Math.abs(signedDistance);
                direction = signedDistance >= 0 ? 'up' : 'down';
                    isDestinationMove = true; // <<< Ensure flag is set for non-zero distance
                this.logger.debug(`Pedestal: Calculated destination move: direction='${direction}', distance=${effectiveDistance.toFixed(2)}`);
                }
            } else {
                this.logger.warn(`Pedestal: Could not resolve destination target '${destinationTargetName}'. Falling back to distance parameter.`);
            }
          }
          // --- End Destination Target Check ---

          // --- Distance Calculation (Priority: Override > Descriptor) ---
          if (!isDestinationMove) {
             // Add diagnostic logging
             this.logger.debug(`Pedestal: Checking override. rawDistanceOverride = ${rawDistanceOverride}, typeof = ${typeof rawDistanceOverride}`);
             
             // 1. Check Override (PRIORITY 2)
             if (typeof rawDistanceOverride === 'number' && rawDistanceOverride > 0) {
                effectiveDistance = rawDistanceOverride;
                this.logger.debug(`Pedestal: Using distance_override: ${effectiveDistance}`);
             } else {
                 // 2. Check Descriptor
                const distanceDescriptor = this._normalizeDescriptor(rawDistanceDescriptor);

                if (distanceDescriptor) {
                  effectiveDistance = this._mapDescriptorToValue(
                    distanceDescriptor,
                    'distance',
                    'pedestal',
                    sceneAnalysis,
                    envAnalysis,
                    { position: currentPosition, target: currentTarget }
                  );
                  this.logger.debug(`Pedestal: Mapped distance_descriptor '${distanceDescriptor}' to distance: ${effectiveDistance}`);
                } else {
                  // 3. Error
                  this.logger.error(`Pedestal: Missing or invalid destination_target, distance_override (${rawDistanceOverride}), AND distance_descriptor (${rawDistanceDescriptor}). Skipping step.`);
                  continue; 
                }
             }
          }
          // --- End Distance Calculation (Priority: Override > Descriptor) ---

          // Validate final calculated distance
          if (effectiveDistance === null || effectiveDistance < 0) { 
            this.logger.error(`Pedestal: Final effective distance calculation failed or resulted in negative value. Skipping step.`);
            continue;
          }
          if (effectiveDistance < 1e-6) { // Handle zero movement explicitly
             this.logger.debug('Pedestal: Effective distance is zero. Generating static command.');
             commands.push({
               position: currentPosition.clone(),
               target: currentTarget.clone(),
               duration: stepDuration > 0 ? stepDuration : 0.1,
               easing: 'linear'
             });
             break; // Skip rest of pedestal logic
          }

          const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING;
          const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium';

          // 1. Calculate movement vector using effectiveDistance & determined direction
          const viewDirection = new Vector3().subVectors(currentTarget, currentPosition).normalize();
          let cameraUp = new Vector3(0, 1, 0); 
          if (Math.abs(viewDirection.y) < 0.999) { /* calculate local up */ }
          
          // Fallback: use explicit direction parameter if destination‑target logic
          // didn't set it.
          if (!direction) {
            const explicitDir =
              typeof rawDirection === 'string' &&
              (rawDirection === 'up' || rawDirection === 'down')
                ? rawDirection
                : null;

            if (explicitDir) {
              direction = explicitDir;
              this.logger.debug(`Pedestal: Using explicit direction parameter '${direction}'.`);
            }
          }
          
          // Ensure direction is valid before proceeding
          if (!direction) {
             this.logger.error('Pedestal: Internal error - direction not set. Skipping step.');
             continue;
          }
          const moveVector = cameraUp.multiplyScalar(effectiveDistance * (direction === 'up' ? 1 : -1));

          // 2. Calculate candidate position AND target
          const newPositionCandidate = new Vector3().addVectors(currentPosition, moveVector);
          const newTargetCandidate = new Vector3().addVectors(currentTarget, moveVector); // <<< ALSO SHIFT TARGET

          let finalPosition = newPositionCandidate.clone();
          let clamped = false;

          // --- Constraint Checking (Apply primarily to Position) --- 
          const { cameraConstraints } = envAnalysis;
          const { spatial } = sceneAnalysis;

          // a) Height constraints
          if (cameraConstraints) {
            if (finalPosition.y < cameraConstraints.minHeight) {
              finalPosition.y = cameraConstraints.minHeight;
              clamped = true;
              this.logger.warn(`Pedestal: Clamped position to minHeight (${cameraConstraints.minHeight})`);
            }
            if (finalPosition.y > cameraConstraints.maxHeight) {
              finalPosition.y = cameraConstraints.maxHeight;
              clamped = true;
              this.logger.warn(`Pedestal: Clamped position to maxHeight (${cameraConstraints.maxHeight})`);
            }
          }

          // b) Distance constraints (relative to NEW target candidate)
          if (cameraConstraints) {
            const distanceToTarget = finalPosition.distanceTo(newTargetCandidate);
            if (distanceToTarget < cameraConstraints.minDistance) {
               const directionFromTarget = new Vector3().subVectors(finalPosition, newTargetCandidate).normalize();
               finalPosition.copy(newTargetCandidate).addScaledVector(directionFromTarget, cameraConstraints.minDistance);
               clamped = true;
               this.logger.warn(`Pedestal: Clamped position to minDistance (${cameraConstraints.minDistance}) relative to shifted target`);
            }
            if (distanceToTarget > cameraConstraints.maxDistance) {
               const directionFromTarget = new Vector3().subVectors(finalPosition, newTargetCandidate).normalize();
               finalPosition.copy(newTargetCandidate).addScaledVector(directionFromTarget, cameraConstraints.maxDistance);
               clamped = true;
               this.logger.warn(`Pedestal: Clamped position to maxDistance (${cameraConstraints.maxDistance}) relative to shifted target`);
            }
          }
          
          // c) Bounding box constraint (using raycast)
          if (spatial?.bounds) {
              const objectBounds = new Box3(spatial.bounds.min, spatial.bounds.max);
              const clampedPosition = this._clampPositionWithRaycast(
                  currentPosition,
                  newPositionCandidate,
                  objectBounds,
                  envAnalysis.userVerticalAdjustment ?? 0 // Pass user offset
              );
              if (!clampedPosition.equals(newPositionCandidate)) {
                  finalPosition.copy(clampedPosition);
                  clamped = true;
              } // No need for else, finalPosition already holds newPositionCandidate if not clamped
          }
          // --- End Constraint Checking ---
          
           // --- Calculate final target based on actual position movement --- START ---
          const actualMoveVector = new Vector3().subVectors(finalPosition, currentPosition);
          const finalTarget = new Vector3().addVectors(currentTarget, actualMoveVector);
          // --- Calculate final target based on actual position movement --- END ---

          // Determine effective easing based on speed
          let effectiveEasingName = easingName;
          if (speed === 'very_fast') {
            effectiveEasingName = 'linear';
            if (effectiveEasingName !== easingName) this.logger.debug(`Pedestal: Speed 'very_fast' selected easing '${effectiveEasingName}' (original: ${easingName})`);
          } else if (speed === 'fast') {
            effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeOutQuad' : easingName;
            if (effectiveEasingName !== easingName) this.logger.debug(`Pedestal: Speed 'fast' selected easing '${effectiveEasingName}' (original: ${easingName})`);
          } else if (speed === 'slow') {
            effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeInOutQuad' : easingName;
            if (effectiveEasingName !== easingName) this.logger.debug(`Pedestal: Speed 'slow' selected easing '${effectiveEasingName}' (original: ${easingName})`);
          }

          // 3. Create CameraCommands
          const commandsList: CameraCommand[] = [];
          commandsList.push({
            position: currentPosition.clone(),
            target: currentTarget.clone(), 
            duration: 0,
            easing: effectiveEasingName
          });
          commandsList.push({
            position: finalPosition.clone(), 
            target: finalTarget.clone(), // <<< USE FINAL TARGET
            duration: stepDuration > 0 ? stepDuration : 0.1,
            easing: effectiveEasingName
          });
          this.logger.debug('Generated pedestal commands:', commandsList);
          commands.push(...commandsList);

          // 4. Update state for the next step
          currentPosition = finalPosition.clone();
          currentTarget = finalTarget.clone(); // <<< UPDATE TARGET STATE
          // --- End Pedestal Logic ---
          break;
        }
        case 'move_to': { // <<< NEW CASE
          const {
            target: rawTargetName,
            speed: rawSpeed = 'medium', // Default to medium
            easing: rawEasingName = DEFAULT_EASING
          } = step.parameters;

          // Validate target
          const targetName = typeof rawTargetName === 'string' ? rawTargetName : null;
          if (!targetName) {
            this.logger.error(`MoveTo: Missing required target parameter. Skipping step.`);
            continue;
          }

          // Resolve the destination target position
          const destinationPosition = this._resolveTargetPosition(
            targetName,
            sceneAnalysis,
            envAnalysis,
            currentTarget // Pass currentTarget for context, though move_to doesn't use it directly
          );

          if (!destinationPosition) {
            this.logger.error(`MoveTo: Could not resolve target position for '${targetName}'. Skipping step.`);
            continue;
          }

          // Validate speed
          const speed = typeof rawSpeed === 'string' && ['instant', 'slow', 'medium', 'fast'].includes(rawSpeed) 
              ? rawSpeed 
              : 'medium';
          if (rawSpeed !== speed && typeof rawSpeed === 'string') { // Check type again before warning
             this.logger.warn(`MoveTo: Invalid speed '${rawSpeed}', defaulting to 'medium'.`);
          }
          const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) 
              ? rawEasingName as EasingFunctionName 
              : DEFAULT_EASING;

          // Determine effective easing (ignored for instant)
          let effectiveEasingName = easingName;
          if (speed === 'fast') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeOutQuad' : easingName;
          else if (speed === 'slow') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeInOutQuad' : easingName;

          const commandsList: CameraCommand[] = [];
          let finalPosition: Vector3; // Declare finalPosition outside the if/else
          let finalTarget: Vector3;   // Declare finalTarget outside the if/else

          if (speed === 'instant') {
            this.logger.debug(`MoveTo: Generating instant cut to ${destinationPosition.toArray()}`);
            // Instant cut: Determine final state and add one command
            const offsetDirection = new Vector3(0, 0.5, 1.5); // Simple offset
            finalPosition = new Vector3().copy(destinationPosition).add(offsetDirection);
            finalTarget = destinationPosition.clone(); // Look directly at the target

            commandsList.push({
                position: finalPosition,
                target: finalTarget,
                duration: 0.01, // Very small duration for a cut 
                easing: 'linear' 
            });
            // Update state immediately
            currentPosition = finalPosition.clone();
            currentTarget = finalTarget.clone();
          } else {
            // Smooth move: Generate start and end commands
            this.logger.debug(`MoveTo: Generating smooth move to ${destinationPosition.toArray()}`);
            // Determine end state positioning logic
            const offsetDirection = new Vector3(0, 0.5, 1.5);
            const endPositionCandidate = new Vector3().copy(destinationPosition).add(offsetDirection);
            const endTargetCandidate = destinationPosition.clone();

            // Apply constraints to the end position candidate
            finalPosition = endPositionCandidate.clone(); // Initialize finalPosition
            const { cameraConstraints } = envAnalysis;
            const { spatial } = sceneAnalysis;
            let clamped = false;
            if (cameraConstraints) {
                if (finalPosition.y < cameraConstraints.minHeight) { finalPosition.y = cameraConstraints.minHeight; clamped = true; }
                if (finalPosition.y > cameraConstraints.maxHeight) { finalPosition.y = cameraConstraints.maxHeight; clamped = true; }
                // Add min/max distance checks if needed relative to finalTarget
            }
            if (spatial?.bounds) {
                const objectBounds = new Box3(spatial.bounds.min, spatial.bounds.max);
                const clampedPos = this._clampPositionWithRaycast(currentPosition, endPositionCandidate, objectBounds, envAnalysis.userVerticalAdjustment ?? 0);
                if (!clampedPos.equals(endPositionCandidate)) {
                    finalPosition.copy(clampedPos);
                    clamped = true;
                }
            } // If clamping occurred, finalPosition holds the clamped position
            finalTarget = endTargetCandidate.clone(); // Target remains the resolved destination
            if (clamped) this.logger.warn('MoveTo: Final position was clamped by constraints.');

            // Add start command
            commandsList.push({
                position: currentPosition.clone(),
                target: currentTarget.clone(), 
                duration: 0,
                easing: effectiveEasingName 
            });
            // Add end command
            commandsList.push({
                position: finalPosition.clone(), // Use clamped final position
                target: finalTarget.clone(), // Use final target
                duration: stepDuration > 0 ? stepDuration : 1.0, // Use step duration or default
                easing: effectiveEasingName
            });
            // Update state for next step
            currentPosition = finalPosition.clone();
            currentTarget = finalTarget.clone();
          }

          this.logger.debug(`Generated move_to commands:`, commandsList);
          commands.push(...commandsList);

          break;
        }
        case 'focus_on': { // <<< NEW CASE
          const {
            target: rawTargetName,
            adjust_framing: rawAdjustFraming = true, // Default true per instructions
            speed: rawSpeed = 'medium', // Speed might influence blend/settle
            easing: rawEasingName = DEFAULT_EASING 
          } = step.parameters;

          // Validate target
          const targetName = typeof rawTargetName === 'string' ? rawTargetName : null;
          if (!targetName) {
            this.logger.error(`FocusOn: Missing required target parameter. Skipping step.`);
            continue;
          }

          // Resolve the new target position
          const newTarget = this._resolveTargetPosition(
            targetName,
            sceneAnalysis,
            envAnalysis,
            currentTarget // Pass current target for context
          );

          if (!newTarget) {
            this.logger.error(`FocusOn: Could not resolve target position for '${targetName}'. Skipping step.`);
            continue;
          }

          // Validate adjust_framing (just log for now)
          const adjustFraming = typeof rawAdjustFraming === 'boolean' ? rawAdjustFraming : true;
          if (adjustFraming) {
              this.logger.warn('FocusOn: adjust_framing=true is requested, but automatic framing adjustment is not yet implemented. Only changing target.');
              // TODO: Implement dolly/zoom logic here based on distance to newTarget if needed.
          }
          
          // Validate speed/easing for potential use in blending (though focus_on itself is just target change)
          const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) 
              ? rawEasingName as EasingFunctionName 
              : DEFAULT_EASING;
          const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium';
          let effectiveEasingName = easingName;
          // Apply speed logic similar to other non-instant moves
          if (speed === 'fast') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeOutQuad' : easingName;
          else if (speed === 'slow') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeInOutQuad' : easingName;

          // Create CameraCommands (Position stays same, Target changes)
          const commandsList: CameraCommand[] = [];
          commandsList.push({
              position: currentPosition.clone(), 
              target: currentTarget.clone(), // Start at current target
              duration: 0,
              easing: effectiveEasingName
          });
          commandsList.push({
              position: currentPosition.clone(), // Position does not change
              target: newTarget.clone(), // End looking at the new target
              duration: stepDuration > 0 ? stepDuration : 0.1, // Use allocated duration or small default
              easing: effectiveEasingName
          });
          this.logger.debug(`Generated focus_on commands:`, commandsList);
          commands.push(...commandsList);

          // Update state for the next step (Only target changes)
          currentTarget = newTarget.clone();
          // currentPosition remains the same
          break;
        }
        case 'rotate': { // <<< Restore correct rotate logic
          const {
            axis: rawAxisName = 'yaw',
            angle: rawAngle,
            speed: rawSpeed = 'medium',
            easing: rawEasingName = DEFAULT_EASING
          } = step.parameters;

          // Validate parameters
          let axis: 'yaw' | 'pitch' | 'roll' = 'yaw'; // Default
          const lowerAxisName = typeof rawAxisName === 'string' ? rawAxisName.toLowerCase() : null;
          if (lowerAxisName === 'pitch') {
              axis = 'pitch';
          } else if (lowerAxisName === 'roll') {
              axis = 'roll';
          } else if (lowerAxisName && lowerAxisName !== 'yaw') { 
              this.logger.warn(`Rotate: Invalid axis '${rawAxisName}', defaulting to 'yaw'.`);
          }
          const angle = typeof rawAngle === 'number' && rawAngle !== 0 ? rawAngle : null;
          const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) 
              ? rawEasingName as EasingFunctionName 
              : DEFAULT_EASING;
          const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium';

          if (angle === null) {
            this.logger.error(`Rotate: Invalid, missing, or zero angle: ${rawAngle}. Skipping step.`);
            continue;
          }
          
          // --- Determine effective easing (Common to all rotation axes) ---
          let effectiveEasingName = easingName;
          if (speed === 'very_fast') effectiveEasingName = 'linear';
          else if (speed === 'fast') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeOutQuad' : easingName;
          else if (speed === 'slow') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeInOutQuad' : easingName;
          // --- End Easing Logic ---

          // --- Initialize end states ---
          let endPosition: Vector3 = currentPosition.clone(); // Position doesn't change for rotate
          let endTarget: Vector3 | null = null;              // Target changes for yaw/pitch, not roll
          let startOrientation: THREE.Quaternion = currentOrientation.clone(); // Use current state
          let endOrientation: THREE.Quaternion | null = null;    // Will be calculated for roll

          if (axis === 'roll') {
              this.logger.debug(`Rotate: Calculating roll angle ${angle} degrees.`);
              // 1. Calculate Rotation Axis (Camera's forward vector)
              const forward = new THREE.Vector3();
              currentCamera.getWorldDirection(forward);
              const rollAxis = forward; 

              // 2. Calculate Rotation Quaternion
              const angleRad = THREE.MathUtils.degToRad(angle);
              const rollQuaternion = new THREE.Quaternion().setFromAxisAngle(rollAxis, angleRad);

              // 3. Calculate End Orientation
              endOrientation = currentOrientation.clone().multiply(rollQuaternion).normalize();
              endTarget = currentTarget.clone(); // Target doesn't change for pure roll

          } else { // Yaw or Pitch
              this.logger.debug(`Rotate: Calculating ${axis} angle ${angle} degrees.`);
              const viewDirection = new THREE.Vector3().subVectors(currentTarget, currentPosition).normalize();
              // Recalculate camera up/right based on current view direction
              let cameraUp = new THREE.Vector3(0, 1, 0);
              let cameraRight = new THREE.Vector3();
              if (Math.abs(viewDirection.dot(cameraUp)) > 0.999) { // Looking straight up or down
                  currentCamera.getWorldQuaternion(startOrientation); // Ensure we have latest orientation
                  cameraRight.set(1, 0, 0).applyQuaternion(startOrientation).normalize();
                  if(Math.abs(cameraRight.dot(viewDirection)) > 0.999) {
                     cameraRight.set(0, 0, 1).applyQuaternion(startOrientation).normalize();
                  }
                  cameraUp.crossVectors(viewDirection, cameraRight).normalize();
              } else {
                  cameraRight.crossVectors(viewDirection, cameraUp).normalize();
                  cameraUp.crossVectors(cameraRight, viewDirection).normalize(); 
              }

              let rotationAxis: Vector3;
              if (axis === 'yaw') {
                  rotationAxis = cameraUp; 
              } else { 
                  rotationAxis = cameraRight; 
              }

              const angleRad = THREE.MathUtils.degToRad(angle);
              const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(rotationAxis, angleRad);

              const targetVector = new THREE.Vector3().subVectors(currentTarget, currentPosition);
              targetVector.applyQuaternion(rotationQuaternion);
              endTarget = new THREE.Vector3().addVectors(currentPosition, targetVector);
              // End orientation for yaw/pitch is derived from lookAt, remains null
          }

          if (!endTarget) {
            this.logger.error(`Rotate: Failed to calculate end target for ${axis}. Skipping step.`);
            continue;
          }

          // Create Commands
          const commandsList: CameraCommand[] = [];
          commandsList.push({
            position: currentPosition.clone(),
            target: currentTarget.clone(),
            orientation: startOrientation.clone(), // <<< ADDED start orientation
            duration: 0,
            easing: effectiveEasingName
          });
          commandsList.push({
            position: endPosition.clone(),      // Position doesn't change
            target: endTarget.clone(),          // Target only changes for yaw/pitch
            orientation: endOrientation ? endOrientation.clone() : null, // <<< ADDED end orientation (only for roll)
            duration: stepDuration > 0 ? stepDuration : 0.1, 
            easing: effectiveEasingName
          });
          this.logger.debug(`Generated rotate (${axis}) commands:`, commandsList);
          commands.push(...commandsList);

          // Update State
          currentTarget = endTarget.clone();
          // currentPosition remains the same
          if (endOrientation) { // Update orientation state only if calculated (i.e., for roll)
              currentOrientation = endOrientation.clone();
          } else {
            // For yaw/pitch, recalculate orientation based on new target
            currentCamera.position.copy(currentPosition); // Ensure camera instance matches state
            currentCamera.lookAt(currentTarget);
            currentCamera.getWorldQuaternion(currentOrientation);
          }

          break;
        }
        default: {
          this.logger.error(`Unknown motion type: ${step.type}. Skipping step.`);
          continue;
        }
      }
    }

    // if (!validationResult.isValid) { ... handle validation errors ... }

    // --- Velocity Check --- 
    const maxVelocity = this.config?.maxVelocity;
    if (maxVelocity && maxVelocity > 0 && commands.length > 0) { // Check commands.length > 0
        // Use initialCameraState for the position before the first command
        let previousPosition = initialCameraState.position; 
        for (let i = 0; i < commands.length; i++) {
            const command = commands[i];
            const distanceMoved = command.position.distanceTo(previousPosition);
            if (command.duration > 1e-6) { // Avoid division by zero
                 const velocity = distanceMoved / command.duration;
                 if (velocity > maxVelocity) {
                    this.logger.warn(`Velocity check failed for command ${i + 1}: Velocity ${velocity.toFixed(2)} exceeds max ${maxVelocity}.`);
                    // TODO: Optionally modify command duration or add intermediate steps?
                 }
            }
            previousPosition = command.position; // Update for next iteration
        }
    }
    // --- End Velocity Check ---

    return commands;
  }

  async executeCommand(camera: Camera, command: CameraCommand): Promise<void> {
    this.logger.info('Executing camera command (placeholder)', { command });
    // TODO: Implement actual command execution logic if needed on backend,
    // or confirm this is handled purely client-side by AnimationController.
    console.warn('executeCommand is not implemented!');
    return Promise.resolve();
  }

  async executeCommands(camera: Camera, commands: CameraCommand[]): Promise<void> {
    this.logger.info(`Executing ${commands.length} camera commands (placeholder).`);
    // This likely won't be used if commands are sent to client for execution.
    for (const command of commands) {
        await this.executeCommand(camera, command);
    }
    return Promise.resolve();
  }

  validateCommands(
    commands: CameraCommand[],
    objectBounds: Box3
  ): ValidationResult {
    console.log('--- VALIDATE COMMANDS ENTRY POINT ---'); // Keep console log for debugging
     this.logger.info('Validating camera commands', { commandCount: commands.length });
     
    // --- Bounding Box Validation (Restore previous logic) --- 
    if (!objectBounds || !(objectBounds instanceof Box3)) {
       this.logger.warn('Object bounds NOT PROVIDED or invalid type for validation.');
     } else {
       this.logger.warn(`[Interpreter] Starting validation against Bounds: Min(${objectBounds.min.x?.toFixed(2)}, ${objectBounds.min.y?.toFixed(2)}, ${objectBounds.min.z?.toFixed(2)}), Max(${objectBounds.max.x?.toFixed(2)}, ${objectBounds.max.y?.toFixed(2)}, ${objectBounds.max.z?.toFixed(2)})`);
       for (const [index, command] of commands.entries()) {
         const pos = command.position;
        if (!pos || !(pos instanceof Vector3)) {
            this.logger.warn(`[Interpreter] Skipping validation for command ${index}: Invalid position.`);
            continue;
        }
        this.logger.warn(`[Interpreter] Checking command ${index}: Pos(${pos.x?.toFixed(2)}, ${pos.y?.toFixed(2)}, ${pos.z?.toFixed(2)})`);
        try {
             const isContained = objectBounds.containsPoint(pos);
          this.logger.warn(`[Interpreter] containsPoint check completed for command ${index}. Result: ${isContained}`);
             if (isContained) {
               const errorMsg = 'PATH_VIOLATION_BOUNDING_BOX: Camera position enters object bounds';
               this.logger.warn(`[Interpreter] Validation failed: ${errorMsg} at command ${index}`);
               return {
                 isValid: false,
                 errors: [errorMsg]
               };
             }
         } catch (checkError) {
          this.logger.error(`[Interpreter] Error during containsPoint check for command ${index}:`, checkError instanceof Error ? checkError.message : checkError);
             return { isValid: false, errors: [`Error during validation check: ${checkError instanceof Error ? checkError.message : 'Unknown check error'}`] };
         }
       }
       this.logger.warn('[Interpreter] Bounding box validation passed.');
     }
    // --- End Bounding Box Validation ---

    // TODO: Add other command validation checks here (e.g., max speed, angle change)
    const errors: string[] = []; 
     if (!commands || commands.length === 0) {
      this.logger.warn('Command list is empty, nothing to validate further.');
      // Return true if bounding box passed or wasn't checked
      return { isValid: true, errors: [] }; 
    }

    // Return based on ALL validation checks
    const isValid = errors.length === 0;
    if (!isValid) {
        this.logger.warn('Generated command validation failed (other checks):', errors);
    }
    return { isValid, errors }; 
   }

   getPerformanceMetrics(): PerformanceMetrics {
    this.logger.info('Getting performance metrics (placeholder)');
    // TODO: Implement actual performance metric collection if needed
    return { 
        startTime: 0, 
        endTime: 0, 
        duration: 0, 
        operations: [], 
        cacheHits: 0, 
        cacheMisses: 0, 
        databaseQueries: 0, 
        averageResponseTime: 0 
    } as PerformanceMetrics;
  }

} // <<< Add closing brace for the class

// Factory function (should be outside the class)
export function getSceneInterpreter(): SceneInterpreter {
    const dummyLogger = { info: ()=>{}, warn: ()=>{}, error: ()=>{}, debug: ()=>{}, trace: ()=>{}, performance: ()=>{} };
    const dummyConfig: SceneInterpreterConfig = { 
        smoothingFactor: 0.5, 
        maxKeyframes: 100, 
        interpolationMethod: 'smooth' 
    };
    return new SceneInterpreterImpl(dummyConfig, dummyLogger);
}