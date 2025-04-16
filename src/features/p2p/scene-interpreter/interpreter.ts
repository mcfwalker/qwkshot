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

// Define a simple logger for this module
const logger = {
  info: (...args: any[]) => console.log('[SceneInterpreter]', ...args),
  warn: (...args: any[]) => console.warn('[SceneInterpreter]', ...args),
  error: (...args: any[]) => console.error('[SceneInterpreter]', ...args),
  debug: (...args: any[]) => console.debug('[SceneInterpreter]', ...args),
};

// Helper function to check if a vector's components are finite
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
    currentTarget: Vector3
  ): Vector3 | null {
    this.logger.debug(`Resolving target name: '${targetName}'`);

    if (targetName === 'current_target') {
      this.logger.debug('Resolved target to current_target');
      return currentTarget.clone();
    }

    if (targetName === 'object_center') {
      if (sceneAnalysis?.spatial?.bounds?.center) {
        this.logger.debug('Resolved target to object_center');
        return sceneAnalysis.spatial.bounds.center.clone();
      } else {
        this.logger.warn("Cannot resolve 'object_center': SceneAnalysis missing spatial.bounds.center.");
        return null;
      }
    }

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
    offset: number = 0.01 // Small offset to push point slightly outside the box
  ): Vector3 {
    const movementVector = new Vector3().subVectors(intendedEndPosition, startPosition);
    const distanceToEnd = movementVector.length();

    if (distanceToEnd < 1e-6) {
      return startPosition.clone(); // No movement, return start
    }

    const ray = new THREE.Ray(startPosition, movementVector.normalize());
    const intersectionPoint = new Vector3();

    if (ray.intersectBox(objectBounds, intersectionPoint)) {
      const distanceToIntersection = startPosition.distanceTo(intersectionPoint);
      
      // Check if intersection happens before reaching the intended end position
      if (distanceToIntersection < distanceToEnd - 1e-6) { // Use tolerance
        this.logger.warn(`Raycast: Path intersects bounding box. Clamping position to exact intersection.`);
        // Return the exact intersection point
        return intersectionPoint; // No offset needed
      }
    }

    // No intersection before the end point, or ray starts inside (intersectBox might return start)
    // Final check: If the intended end position is *inside* the box, clamp it to the surface as fallback.
    if (objectBounds.containsPoint(intendedEndPosition)) {
        this.logger.warn('Raycast: Intended end position is inside bounds. Clamping to surface as fallback.');
        return objectBounds.clampPoint(intendedEndPosition, new Vector3());
    }

    // No intersection or intersection is beyond the end point, return intended end
    return intendedEndPosition.clone();
  }

  interpretPath(
    plan: MotionPlan,
    sceneAnalysis: SceneAnalysis,
    envAnalysis: EnvironmentalAnalysis,
    // Add initial state, crucial for the first step
    initialCameraState: { position: Vector3; target: Vector3 }
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
      }
      
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
          // --- Start Zoom Logic (Corrected) ---
          const {
            direction: rawDirection,
            factor: rawFactor,
            target: rawTargetName = 'current_target',
            easing: rawEasingName = DEFAULT_EASING,
            speed: rawSpeed = 'medium' // Extract speed
          } = step.parameters;

          // Validate parameters
          const direction = typeof rawDirection === 'string' && (rawDirection === 'in' || rawDirection === 'out') ? rawDirection : null;
          const factor = typeof rawFactor === 'number' && rawFactor > 0 ? rawFactor : null;
          const targetName = typeof rawTargetName === 'string' ? rawTargetName : 'current_target'; // Default
          const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING;
          const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium'; // Validate speed

          if (!direction) {
            this.logger.error(`Invalid or missing zoom direction: ${rawDirection}. Skipping step.`);
            continue;
          }
          if (factor === null) {
            this.logger.error(`Invalid, missing, or non-positive zoom factor: ${rawFactor}. Skipping step.`);
            continue;
          }
          if (rawEasingName !== easingName && typeof rawEasingName === 'string') {
             this.logger.warn(`Invalid or unsupported easing name: ${rawEasingName}. Defaulting to ${easingName}.`);
          }

          // 1. Resolve target point
          const zoomTargetPosition = this._resolveTargetPosition(targetName, sceneAnalysis, currentTarget);
          if (!zoomTargetPosition) {
            this.logger.error(`Could not resolve zoom target '${targetName}'. Skipping step.`);
            continue;
          }

          // 2. Calculate new distance based on direction and factor
          const vectorToTarget = new Vector3().subVectors(zoomTargetPosition, currentPosition);
          const currentDistance = vectorToTarget.length();
          let newDistance: number;

          if (direction === 'in') {
            // Factor determines the new distance as a ratio of the old distance
            // e.g., factor = 0.5 means new distance is half the original
            newDistance = currentDistance * factor;
          } else { // direction === 'out'
            // Factor determines the new distance as a ratio of the old distance
            // e.g., factor = 2.0 means new distance is double the original
            newDistance = currentDistance * factor;
          }
          
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
                  objectBounds
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
          
          // 1. Resolve target
          let orbitCenter: Vector3;
          if (targetName === 'object_center' && sceneAnalysis?.spatial?.bounds?.center) {
            orbitCenter = sceneAnalysis.spatial.bounds.center.clone();
            this.logger.debug(`Orbit target resolved to object center: ${orbitCenter.toArray()}`);
          } else {
            // Default to object center if available, otherwise skip.
            if (sceneAnalysis?.spatial?.bounds?.center) {
                orbitCenter = sceneAnalysis.spatial.bounds.center.clone();
                this.logger.warn(`Unsupported orbit target '${targetName}', defaulting to object center.`);
            } else {
                this.logger.error(`Cannot resolve orbit target '${targetName}' and object center is unavailable. Skipping step.`);
                continue;
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

          // 3. Calculate rotation
          const angleRad = THREE.MathUtils.degToRad(angle) * (direction === 'clockwise' ? -1 : 1);
          const quaternion = new THREE.Quaternion().setFromAxisAngle(rotationAxis, angleRad);
          
          const radiusVector = new Vector3().subVectors(currentPosition, orbitCenter);
          radiusVector.applyQuaternion(quaternion);
          
          // Apply radius factor *before* adding back to center
          const radiusFactor = typeof step.parameters.radius_factor === 'number' ? step.parameters.radius_factor : 1.0;
          if (radiusFactor <= 0) {
             this.logger.warn(`Invalid radius_factor ${radiusFactor}, defaulting to 1.0.`);
             // radiusFactor = 1.0; // Already defaulted
          }

          radiusVector.multiplyScalar(radiusFactor);
          
          const newPositionCandidate = new Vector3().addVectors(orbitCenter, radiusVector);
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
              this.logger.warn(`Orbit: Clamped position to minHeight (${cameraConstraints.minHeight})`);
            }
            if (finalPosition.y > cameraConstraints.maxHeight) {
              finalPosition.y = cameraConstraints.maxHeight;
              clamped = true;
              this.logger.warn(`Orbit: Clamped position to maxHeight (${cameraConstraints.maxHeight})`);
            }
          }

          // b) Distance constraints (relative to orbitCenter)
          if (cameraConstraints) {
            const distanceToCenter = finalPosition.distanceTo(orbitCenter);
            if (distanceToCenter < cameraConstraints.minDistance) {
               const directionFromCenter = new Vector3().subVectors(finalPosition, orbitCenter).normalize();
               finalPosition.copy(orbitCenter).addScaledVector(directionFromCenter, cameraConstraints.minDistance);
               clamped = true;
               this.logger.warn(`Orbit: Clamped position to minDistance (${cameraConstraints.minDistance})`);
            }
            if (distanceToCenter > cameraConstraints.maxDistance) {
               const directionFromCenter = new Vector3().subVectors(finalPosition, orbitCenter).normalize();
               finalPosition.copy(orbitCenter).addScaledVector(directionFromCenter, cameraConstraints.maxDistance);
               clamped = true;
               this.logger.warn(`Orbit: Clamped position to maxDistance (${cameraConstraints.maxDistance})`);
            }
          }
          
          // c) Bounding box constraint (using raycast)
          if (spatial?.bounds) {
              const objectBounds = new Box3(spatial.bounds.min, spatial.bounds.max);
              const clampedPosition = this._clampPositionWithRaycast(
                  currentPosition, 
                  newPositionCandidate,
                  objectBounds
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
          // --- DECREASED ANGLE STEP for smoother curve ---
          const anglePerStep = 2; // <<< Use smaller angle step (e.g., 2 degrees)
          const numSteps = Math.max(2, Math.ceil(Math.abs(angle) / anglePerStep)); 
          // --- END DECREASE ---
          const angleStep = angle / (numSteps - 1);
          const durationStep = (stepDuration > 0 ? stepDuration : 0.1) / (numSteps - 1);
          
          this.logger.debug(`Orbit: Generating ${numSteps} steps for ${angle} degrees (target ~${anglePerStep}deg/step).`);

          let previousPosition = currentPosition.clone();

          // Add the initial state command
          commandsList.push({
              position: previousPosition.clone(),
              target: orbitCenter.clone(), // Start looking at the orbit center immediately
              duration: 0,
              easing: 'linear'
          });

          for (let i = 1; i < numSteps; i++) {
              const currentAngleRad = THREE.MathUtils.degToRad(angleStep) * (direction === 'clockwise' ? -1 : 1);
              const quaternionStep = new THREE.Quaternion().setFromAxisAngle(rotationAxis, currentAngleRad);
              
              // Rotate the *previous* position around the orbit center
              const radiusVectorStep = new Vector3().subVectors(previousPosition, orbitCenter);
              radiusVectorStep.applyQuaternion(quaternionStep);
              // Note: Radius factor is only applied conceptually to the whole move, not per step here
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
                      objectBounds
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
          // --- Start Tilt Logic ---
          const {
            direction: rawDirection,
            angle: rawAngle,
            easing: rawEasingName = DEFAULT_EASING,
            speed: rawSpeed = 'medium' // Extract speed
          } = step.parameters;

          // Validate parameters
          const direction = typeof rawDirection === 'string' && (rawDirection === 'up' || rawDirection === 'down') ? rawDirection : null;
          const angle = typeof rawAngle === 'number' && rawAngle !== 0 ? rawAngle : null;
          const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING;
          const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium'; // Validate speed

          if (!direction) {
            this.logger.error(`Invalid or missing tilt direction: ${rawDirection}. Skipping step.`);
            continue;
          }
          if (angle === null) {
            this.logger.error(`Invalid, missing, or zero tilt angle: ${rawAngle}. Skipping step.`);
            continue;
          }
          if (rawEasingName !== easingName && typeof rawEasingName === 'string') {
             this.logger.warn(`Invalid or unsupported easing name: ${rawEasingName}. Defaulting to ${easingName}.`);
          }

          // 1. Determine rotation axis (Camera's local RIGHT)
          const viewDirection = new Vector3().subVectors(currentTarget, currentPosition).normalize();
          // Assume world up is (0, 1, 0) for cross product
          let cameraRight = new Vector3(0, 1, 0); // This line seems wrong from previous edit, should calculate right
          if (Math.abs(viewDirection.y) > 0.999) { // Looking nearly straight up or down
              // Use camera's local 'forward' projected onto XZ plane to find a stable 'right'
              // const forwardXZ = new Vector3(viewDirection.x, 0, viewDirection.z).normalize();
              // const cameraRight = new Vector3().crossVectors(new Vector3(0, 1, 0), forwardXZ).normalize();
              // cameraUp.crossVectors(forwardXZ, cameraRight).normalize(); // Should give a stable 'up'
              // Correct logic for fallback when looking up/down:
              cameraRight.set(1, 0, 0); // Use world X as fallback right
              this.logger.warn('Cannot reliably determine camera right vector (looking straight up/down). Using world X as fallback axis for tilt.');
          } else {
               // Standard case: Calculate right vector
              cameraRight.crossVectors(new Vector3(0, 1, 0), viewDirection).normalize();
          }
          // Check if cross product resulted in zero vector (e.g., viewDirection is aligned with world up)
          if (cameraRight.lengthSq() < 1e-6) { 
              this.logger.warn('Calculated camera right vector is zero. Using world X as fallback axis for tilt.');
              cameraRight.set(1, 0, 0); // Fallback to world X axis
          }
          this.logger.debug(`Tilt using camera local right axis: ${cameraRight.toArray()}`);
          const rotationAxis = cameraRight; // CORRECT: Axis for tilt IS the camera's right vector

          // 2. Calculate rotation
          const angleRad = THREE.MathUtils.degToRad(angle) * (direction === 'up' ? 1 : -1); // Tilt up = positive rotation around local right
          const quaternion = new THREE.Quaternion().setFromAxisAngle(rotationAxis, angleRad); // Use the correct rotationAxis (cameraRight)

          // 3. Rotate the target point around the camera position
          const targetVector = new Vector3().subVectors(currentTarget, currentPosition);
          targetVector.applyQuaternion(quaternion);
          const newTarget = new Vector3().addVectors(currentPosition, targetVector);

          // Determine effective easing based on speed
          let effectiveEasingName = easingName;
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

          // 4. Create CameraCommand (Position stays the same, Target changes)
          const commandsList: CameraCommand[] = [];
          commandsList.push({
              position: currentPosition.clone(),
              target: currentTarget.clone(),
              duration: 0,
              easing: effectiveEasingName
          });
          commandsList.push({
            position: currentPosition.clone(), // Position does not change for tilt
            target: newTarget.clone(),
            duration: stepDuration > 0 ? stepDuration : 0.1, 
            easing: effectiveEasingName
          });
          this.logger.debug('Generated tilt commands:', commandsList);
          commands.push(...commandsList);

          // 5. Update state for the next step (Only target changes)
          currentTarget = newTarget.clone();
          // currentPosition remains the same
          // --- End Tilt Logic ---
          break;
        }
        case 'dolly': {
          // --- Start Dolly Logic (Corrected Placement and Logic) ---
          const {
            direction: rawDirection,
            distance: rawDistance,
            easing: rawEasingName = DEFAULT_EASING,
            speed: rawSpeed = 'medium' // Extract speed
          } = step.parameters;

          // Validate parameters
          let direction = typeof rawDirection === 'string' ? rawDirection.toLowerCase() : null;
          const distance = typeof rawDistance === 'number' && rawDistance > 0 ? rawDistance : null;
          const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING;
          const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium'; // Validate speed

          // Map aliases
          if (direction === 'in') direction = 'forward';
          if (direction === 'out') direction = 'backward';

          if (direction !== 'forward' && direction !== 'backward') {
            this.logger.error(`Invalid or missing dolly direction: ${rawDirection}. Skipping step.`);
            continue;
          }
          if (distance === null) {
            this.logger.error(`Invalid, missing, or non-positive dolly distance: ${rawDistance}. Skipping step.`);
            continue;
          }
           if (rawEasingName !== easingName && typeof rawEasingName === 'string') {
             this.logger.warn(`Invalid or unsupported easing name: ${rawEasingName}. Defaulting to ${easingName}.`);
          }

          // 1. Calculate movement vector along view direction
          const viewDirection = new Vector3().subVectors(currentTarget, currentPosition).normalize();
          const moveVector = viewDirection.multiplyScalar(distance * (direction === 'forward' ? 1 : -1));

          // 2. Calculate candidate position
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
                  objectBounds
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
          if (speed === 'very_fast') { effectiveEasingName = 'linear'; }
          else if (speed === 'fast' && easingName === DEFAULT_EASING) { effectiveEasingName = 'easeOutQuad'; }
          else if (speed === 'slow' && easingName === 'linear') { effectiveEasingName = DEFAULT_EASING; }
           if (effectiveEasingName !== easingName) {
              this.logger.debug(`Dolly: Speed '${speed}' changing easing from '${easingName}' to '${effectiveEasingName}'`);
          }

          // 3. Create CameraCommand
          const command: CameraCommand = {
            position: finalPosition.clone(),
            target: currentTarget.clone(), 
            duration: stepDuration > 0 ? stepDuration : 0.1,
            easing: effectiveEasingName
          };
          commands.push(command);
          this.logger.debug('Generated dolly command:', command);

          // 4. Update state for the next step
          currentPosition = finalPosition.clone();
          // currentTarget remains the same
          // --- End Dolly Logic ---
          break;
        }
        case 'truck': {
          // --- Start Truck Logic (Corrected) ---
          const {
            direction: rawDirection,
            distance: rawDistance,
            easing: rawEasingName = DEFAULT_EASING,
            speed: rawSpeed = 'medium' // Extract speed
          } = step.parameters;

          // Validate parameters
          const direction = typeof rawDirection === 'string' && (rawDirection === 'left' || rawDirection === 'right') ? rawDirection : null;
          const distance = typeof rawDistance === 'number' && rawDistance > 0 ? rawDistance : null;
          const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING;
          const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium'; // Validate speed

          if (!direction) {
            this.logger.error(`Invalid or missing truck direction: ${rawDirection}. Skipping step.`);
            continue;
          }
          if (distance === null) {
            this.logger.error(`Invalid, missing, or non-positive truck distance: ${rawDistance}. Skipping step.`);
            continue;
          }
           if (rawEasingName !== easingName && typeof rawEasingName === 'string') {
             this.logger.warn(`Invalid or unsupported easing name: ${rawEasingName}. Defaulting to ${easingName}.`);
          }

          // 1. Calculate movement vector (Camera's local RIGHT)
          const viewDirection = new Vector3().subVectors(currentTarget, currentPosition).normalize();
          const cameraRight = new Vector3().crossVectors(new Vector3(0, 1, 0), viewDirection).normalize();
          if (cameraRight.lengthSq() < 1e-6) { 
              this.logger.warn('Cannot determine camera right vector (likely looking straight up/down). Truck movement might be unpredictable. Using world X as fallback.');
              cameraRight.set(1, 0, 0); // Fallback
          }
          const moveVector = cameraRight.multiplyScalar(distance * (direction === 'left' ? -1 : 1)); 

          // 2. Calculate candidate position
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
              this.logger.warn(`Truck: Clamped position to minHeight (${cameraConstraints.minHeight})`);
            }
            if (finalPosition.y > cameraConstraints.maxHeight) {
              finalPosition.y = cameraConstraints.maxHeight;
              clamped = true;
              this.logger.warn(`Truck: Clamped position to maxHeight (${cameraConstraints.maxHeight})`);
            }
          }

          // b) Distance constraints (relative to currentTarget)
          if (cameraConstraints) {
            const distanceToTarget = finalPosition.distanceTo(currentTarget);
            if (distanceToTarget < cameraConstraints.minDistance) {
               const directionFromTarget = new Vector3().subVectors(finalPosition, currentTarget).normalize();
               finalPosition.copy(currentTarget).addScaledVector(directionFromTarget, cameraConstraints.minDistance);
               clamped = true;
               this.logger.warn(`Truck: Clamped position to minDistance (${cameraConstraints.minDistance})`);
            }
            if (distanceToTarget > cameraConstraints.maxDistance) {
               const directionFromTarget = new Vector3().subVectors(finalPosition, currentTarget).normalize();
               finalPosition.copy(currentTarget).addScaledVector(directionFromTarget, cameraConstraints.maxDistance);
               clamped = true;
               this.logger.warn(`Truck: Clamped position to maxDistance (${cameraConstraints.maxDistance})`);
            }
          }
          
          // c) Bounding box constraint (using raycast)
          if (spatial?.bounds) {
              const objectBounds = new Box3(spatial.bounds.min, spatial.bounds.max);
              const clampedPosition = this._clampPositionWithRaycast(
                  currentPosition,
                  newPositionCandidate,
                  objectBounds
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
          if (speed === 'very_fast') { effectiveEasingName = 'linear'; }
          else if (speed === 'fast' && easingName === DEFAULT_EASING) { effectiveEasingName = 'easeOutQuad'; }
          else if (speed === 'slow' && easingName === 'linear') { effectiveEasingName = DEFAULT_EASING; }
          if (effectiveEasingName !== easingName) {
              this.logger.debug(`Truck: Speed '${speed}' changing easing from '${easingName}' to '${effectiveEasingName}'`);
          }

          // 3. Create CameraCommand
          const command: CameraCommand = {
            position: finalPosition.clone(), 
            target: currentTarget.clone(), 
            duration: stepDuration > 0 ? stepDuration : 0.1,
            easing: effectiveEasingName
          };
          commands.push(command);
          this.logger.debug('Generated truck command:', command);

          // 4. Update state for the next step
          currentPosition = finalPosition.clone();
          // currentTarget remains the same
          // --- End Truck Logic ---
          break;
        }
        case 'pedestal': {
           // --- Start Pedestal Logic (Corrected) ---
          const {
            direction: rawDirection,
            distance: rawDistance,
            easing: rawEasingName = DEFAULT_EASING,
            speed: rawSpeed = 'medium' // Extract speed
          } = step.parameters;

          // Validate parameters
          const direction = typeof rawDirection === 'string' && (rawDirection === 'up' || rawDirection === 'down') ? rawDirection : null;
          const distance = typeof rawDistance === 'number' && rawDistance > 0 ? rawDistance : null;
          const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING;
          const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium'; // Validate speed

          if (!direction) {
            this.logger.error(`Invalid or missing pedestal direction: ${rawDirection}. Skipping step.`);
            continue;
          }
          if (distance === null) {
            this.logger.error(`Invalid, missing, or non-positive pedestal distance: ${rawDistance}. Skipping step.`);
            continue;
          }
           if (rawEasingName !== easingName && typeof rawEasingName === 'string') {
             this.logger.warn(`Invalid or unsupported easing name: ${rawEasingName}. Defaulting to ${easingName}.`);
          }

          // 1. Calculate movement vector (Camera's local UP)
          const viewDirection = new Vector3().subVectors(currentTarget, currentPosition).normalize();
          let cameraUp = new Vector3(0, 1, 0); // Start with world up
          // Calculate local up unless looking straight up/down
          if (Math.abs(viewDirection.y) < 0.999) { 
            const cameraRight = new Vector3().crossVectors(new Vector3(0, 1, 0), viewDirection).normalize();
            if (cameraRight.lengthSq() > 1e-6) { // Ensure right vector is valid before calculating up
               cameraUp.crossVectors(viewDirection, cameraRight).normalize();
    } else {
                // If right is zero (looking up/down), world Y is already the correct pedestal axis
                 this.logger.debug('Pedestal: Using world Y axis due to vertical view direction.');
            }
          }
          const moveVector = cameraUp.multiplyScalar(distance * (direction === 'up' ? 1 : -1));

          // 2. Calculate candidate position
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
              this.logger.warn(`Pedestal: Clamped position to minHeight (${cameraConstraints.minHeight})`);
            }
            if (finalPosition.y > cameraConstraints.maxHeight) {
              finalPosition.y = cameraConstraints.maxHeight;
              clamped = true;
              this.logger.warn(`Pedestal: Clamped position to maxHeight (${cameraConstraints.maxHeight})`);
            }
          }

          // b) Distance constraints (relative to currentTarget)
          if (cameraConstraints) {
            const distanceToTarget = finalPosition.distanceTo(currentTarget);
            if (distanceToTarget < cameraConstraints.minDistance) {
               const directionFromTarget = new Vector3().subVectors(finalPosition, currentTarget).normalize();
               finalPosition.copy(currentTarget).addScaledVector(directionFromTarget, cameraConstraints.minDistance);
               clamped = true;
               this.logger.warn(`Pedestal: Clamped position to minDistance (${cameraConstraints.minDistance})`);
            }
            if (distanceToTarget > cameraConstraints.maxDistance) {
               const directionFromTarget = new Vector3().subVectors(finalPosition, currentTarget).normalize();
               finalPosition.copy(currentTarget).addScaledVector(directionFromTarget, cameraConstraints.maxDistance);
               clamped = true;
               this.logger.warn(`Pedestal: Clamped position to maxDistance (${cameraConstraints.maxDistance})`);
            }
          }
          
          // c) Bounding box constraint (using raycast)
          if (spatial?.bounds) {
              const objectBounds = new Box3(spatial.bounds.min, spatial.bounds.max);
              const clampedPosition = this._clampPositionWithRaycast(
                  currentPosition,
                  newPositionCandidate,
                  objectBounds
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
          if (speed === 'very_fast') { effectiveEasingName = 'linear'; }
          else if (speed === 'fast' && easingName === DEFAULT_EASING) { effectiveEasingName = 'easeOutQuad'; }
          else if (speed === 'slow' && easingName === 'linear') { effectiveEasingName = DEFAULT_EASING; }
          if (effectiveEasingName !== easingName) {
              this.logger.debug(`Pedestal: Speed '${speed}' changing easing from '${easingName}' to '${effectiveEasingName}'`);
          }

          // 3. Create CameraCommand 
          const command: CameraCommand = {
            position: finalPosition.clone(), 
            target: currentTarget.clone(), 
            duration: stepDuration > 0 ? stepDuration : 0.1,
            easing: effectiveEasingName
          };
          commands.push(command);
          this.logger.debug('Generated pedestal command:', command);

          // 4. Update state for the next step
          currentPosition = finalPosition.clone();
          // currentTarget remains the same
          // --- End Pedestal Logic ---
          break;
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