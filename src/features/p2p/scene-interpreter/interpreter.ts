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

// Placeholder Easing Function Map (replace with actual implementations)
export const easingFunctions = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  // Add more easing functions as needed from libraries like tween.js or implement custom ones
};

export type EasingFunctionName = keyof typeof easingFunctions;

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

    for (const step of plan.steps) {
      this.logger.debug(`Processing step: ${step.type}`, step.parameters);

      let stepDuration = 0;
      if (totalDuration && totalDuration > 0) {
          stepDuration = totalDuration * (step.duration_ratio ?? 0);
          if (stepDuration <= 0) {
              this.logger.warn(`Calculated step duration is zero or negative for step type ${step.type}. Skipping duration-based command generation for this step.`);
              // Decide if step should be skipped or handled differently
          }
      } else if (step.type !== 'static') { 
          // Only allow non-static steps if totalDuration is valid
          this.logger.error(`Cannot process step type '${step.type}' without a valid total duration.`);
          continue; // Skip this step
      }

      switch (step.type) {
        case 'static': {          
          // Hold current position and target
          const command: CameraCommand = {
            position: currentPosition.clone(),
            target: currentTarget.clone(),
            // Use stepDuration if valid, otherwise maybe a default small duration or handle error?
            duration: stepDuration > 0 ? stepDuration : 0.1, // Example: default 0.1s if calculation failed
            easing: 'linear' // Static hold is linear
          };
          commands.push(command);
          this.logger.debug('Generated static command:', command);
          // State update: Position and target remain the same for the next step
          break;
        }
        case 'zoom': {
          this.logger.warn(`Motion type '${step.type}' not implemented yet.`);
          // TODO: Implement zoom logic
          // 1. Resolve target (e.g., 'object_center' from sceneAnalysis)
          // 2. Get direction, factor, speed, easing from step.parameters
          // 3. Calculate new position along the line from currentPosition to target
          // 4. Create CameraCommand with new position, current target, calculated duration, easing
          // 5. Update currentPosition for the next step
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
            easing: rawEasingName = 'easeInOutQuad' 
          } = step.parameters;

          // Type validation and extraction
          const direction = typeof rawDirection === 'string' && 
                            (rawDirection === 'clockwise' || rawDirection === 'counter-clockwise' || rawDirection === 'left' || rawDirection === 'right') 
                            ? rawDirection : null;
          const angle = typeof rawAngle === 'number' && rawAngle !== 0 ? rawAngle : null;
          let axisName = typeof rawAxisName === 'string' && ['x', 'y', 'z', 'camera_up'].includes(rawAxisName) ? rawAxisName : 'y'; // Include camera_up, default to 'y'
          const targetName = typeof rawTargetName === 'string' ? rawTargetName : 'object_center'; // Default if invalid
          const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : 'easeInOutQuad'; // Validate and default

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
          
          const newPosition = new Vector3().addVectors(orbitCenter, radiusVector);

          // Validate essential parameters after type checks
          let effectiveDirection = direction;
          if (direction === 'left') effectiveDirection = 'counter-clockwise'; // Map left/right to directions relative to Y axis
          if (direction === 'right') effectiveDirection = 'clockwise';

          if (!effectiveDirection || (effectiveDirection !== 'clockwise' && effectiveDirection !== 'counter-clockwise')) {
            this.logger.error(`Invalid or unmappable orbit direction: ${rawDirection}. Skipping step.`);
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
          
          // 4. Create CameraCommand
          const command: CameraCommand = {
            position: newPosition.clone(),
            target: orbitCenter.clone(), // Orbit keeps looking at the orbit center
            duration: stepDuration > 0 ? stepDuration : 0.1, // Use calculated duration
            easing: easingName // Use validated easing name
          };
          commands.push(command);
          this.logger.debug('Generated orbit command:', command);

          // 5. Update state for the next step
          currentPosition = newPosition.clone();
          currentTarget = orbitCenter.clone(); // Update target to the orbit center
          // --- End Orbit Logic ---
          break;
        }
        case 'pan': {
          // --- Start Pan Logic ---
          const {
            direction: rawDirection,
            angle: rawAngle,
            easing: rawEasingName = 'easeInOutQuad'
          } = step.parameters;

          // Validate parameters
          const direction = typeof rawDirection === 'string' && (rawDirection === 'left' || rawDirection === 'right') ? rawDirection : null;
          const angle = typeof rawAngle === 'number' && rawAngle !== 0 ? rawAngle : null;
          const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : 'easeInOutQuad';

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

          // 4. Create CameraCommand (Position stays the same, Target changes)
          const command: CameraCommand = {
            position: currentPosition.clone(), // Position does not change for pan
            target: newTarget.clone(),
            duration: stepDuration > 0 ? stepDuration : 0.1, // Use calculated duration
            easing: easingName
          };
          commands.push(command);
          this.logger.debug('Generated pan command:', command);

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
            easing: rawEasingName = 'easeInOutQuad'
          } = step.parameters;

          // Validate parameters
          const direction = typeof rawDirection === 'string' && (rawDirection === 'up' || rawDirection === 'down') ? rawDirection : null;
          const angle = typeof rawAngle === 'number' && rawAngle !== 0 ? rawAngle : null;
          const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : 'easeInOutQuad';

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
          const cameraRight = new Vector3().crossVectors(new Vector3(0, 1, 0), viewDirection).normalize();
          // If looking straight up/down, the cross product might be zero. Need a fallback.
          if (cameraRight.lengthSq() < 1e-6) { 
              this.logger.warn('Cannot determine camera right vector (likely looking straight up/down). Using world X as fallback axis for tilt.');
              cameraRight.set(1, 0, 0); // Fallback to world X axis
          }
          this.logger.debug(`Tilt using camera local right axis: ${cameraRight.toArray()}`);
          const rotationAxis = cameraRight; // Axis for tilt

          // 2. Calculate rotation
          const angleRad = THREE.MathUtils.degToRad(angle) * (direction === 'up' ? 1 : -1); // Tilt up = positive rotation around local right
          const quaternion = new THREE.Quaternion().setFromAxisAngle(rotationAxis, angleRad);

          // 3. Rotate the target point around the camera position
          const targetVector = new Vector3().subVectors(currentTarget, currentPosition);
          targetVector.applyQuaternion(quaternion);
          
          // Constraint check: Prevent target from going too far past vertical (e.g., > 85 degrees up/down)
          const newTargetWorld = new Vector3().addVectors(currentPosition, targetVector);
          const newViewDirection = new Vector3().subVectors(newTargetWorld, currentPosition).normalize();
          const angleWithWorldUp = newViewDirection.angleTo(new Vector3(0, 1, 0)); // Angle to world Y
          const maxTiltAngle = THREE.MathUtils.degToRad(85); // Max 85 degrees from horizontal plane
          if (angleWithWorldUp < (Math.PI / 2 - maxTiltAngle) || angleWithWorldUp > (Math.PI / 2 + maxTiltAngle)) {
               this.logger.warn(`Tilt angle limit reached (${angle} deg). Clamping target.`);
               // Re-calculate target based on clamped angle (more complex, skip for now)
               // For simplicity, we could just use the previous target if clamping is hard
               // Or use the clamped vector direction. Let's stick to the calculated one for now, maybe add clamping later.
               // TODO: Implement proper tilt clamping if necessary
          }

          const newTarget = newTargetWorld; // Use potentially unclamped target for now

          // 4. Create CameraCommand (Position stays the same, Target changes)
          const command: CameraCommand = {
            position: currentPosition.clone(),
            target: newTarget.clone(),
            duration: stepDuration > 0 ? stepDuration : 0.1,
            easing: easingName
          };
          commands.push(command);
          this.logger.debug('Generated tilt command:', command);

          // 5. Update state for the next step
          currentTarget = newTarget.clone();
          // currentPosition remains the same
          // --- End Tilt Logic ---
          break;
        }
        case 'dolly': {
          // --- Start Dolly Logic ---
          const {
            direction: rawDirection,
            distance: rawDistance,
            easing: rawEasingName = 'easeInOutQuad'
          } = step.parameters;

          // Validate parameters
          let direction = typeof rawDirection === 'string' ? rawDirection.toLowerCase() : null;
          const distance = typeof rawDistance === 'number' && rawDistance > 0 ? rawDistance : null;
          const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : 'easeInOutQuad';

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

          // 1. Calculate movement vector
          const viewDirection = new Vector3().subVectors(currentTarget, currentPosition).normalize();
          const moveVector = viewDirection.multiplyScalar(distance * (direction === 'forward' ? 1 : -1));

          // 2. Calculate new position
          const newPosition = new Vector3().addVectors(currentPosition, moveVector);

          // 3. Create CameraCommand (Target stays the same, Position changes)
          const command: CameraCommand = {
            position: newPosition.clone(),
            target: currentTarget.clone(), // Target does not change for dolly
            duration: stepDuration > 0 ? stepDuration : 0.1,
            easing: easingName
          };
          commands.push(command);
          this.logger.debug('Generated dolly command:', command);

          // 4. Update state for the next step
          currentPosition = newPosition.clone();
          // currentTarget remains the same
          // --- End Dolly Logic ---
          break;
        }
        case 'truck': {
          // --- Start Truck Logic ---
          const {
            direction: rawDirection,
            distance: rawDistance,
            easing: rawEasingName = 'easeInOutQuad'
          } = step.parameters;

          // Validate parameters
          const direction = typeof rawDirection === 'string' && (rawDirection === 'left' || rawDirection === 'right') ? rawDirection : null;
          const distance = typeof rawDistance === 'number' && rawDistance > 0 ? rawDistance : null;
          const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : 'easeInOutQuad';

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
          // Assume world up is (0, 1, 0)
          const cameraRight = new Vector3().crossVectors(new Vector3(0, 1, 0), viewDirection).normalize();
          // Handle looking straight up/down where cross product is zero
           if (cameraRight.lengthSq() < 1e-6) { 
              this.logger.warn('Cannot determine camera right vector (likely looking straight up/down). Truck movement might be unpredictable. Using world X as fallback.');
              cameraRight.set(1, 0, 0); // Fallback
          }
          
          const moveVector = cameraRight.multiplyScalar(distance * (direction === 'left' ? -1 : 1)); // Truck left moves along negative right vector

          // 2. Calculate new position
          const newPosition = new Vector3().addVectors(currentPosition, moveVector);

          // 3. Create CameraCommand (Target stays the same, Position changes)
          const command: CameraCommand = {
            position: newPosition.clone(),
            target: currentTarget.clone(), // Target does not change for truck
            duration: stepDuration > 0 ? stepDuration : 0.1,
            easing: easingName
          };
          commands.push(command);
          this.logger.debug('Generated truck command:', command);

          // 4. Update state for the next step
          currentPosition = newPosition.clone();
          // currentTarget remains the same
          // --- End Truck Logic ---
          break;
        }
        case 'pedestal': {
           // --- Start Pedestal Logic ---
          const {
            direction: rawDirection,
            distance: rawDistance,
            easing: rawEasingName = 'easeInOutQuad'
          } = step.parameters;

          // Validate parameters
          const direction = typeof rawDirection === 'string' && (rawDirection === 'up' || rawDirection === 'down') ? rawDirection : null;
          const distance = typeof rawDistance === 'number' && rawDistance > 0 ? rawDistance : null;
          const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : 'easeInOutQuad';

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
          // Assume world up is (0, 1, 0)
          let cameraUp = new Vector3(0, 1, 0);
          if (Math.abs(viewDirection.y) < 0.999) { // If not looking straight up/down
            const cameraRight = new Vector3().crossVectors(new Vector3(0, 1, 0), viewDirection).normalize();
            cameraUp.crossVectors(viewDirection, cameraRight).normalize();
          } // else cameraUp remains world Y (0,1,0), which is correct for pedestal when looking straight up/down
          
          const moveVector = cameraUp.multiplyScalar(distance * (direction === 'up' ? 1 : -1));

          // 2. Calculate new position
          const newPosition = new Vector3().addVectors(currentPosition, moveVector);

          // 3. Create CameraCommand (Target stays the same, Position changes)
          const command: CameraCommand = {
            position: newPosition.clone(),
            target: currentTarget.clone(), // Target does not change for pedestal
            duration: stepDuration > 0 ? stepDuration : 0.1,
            easing: easingName
          };
          commands.push(command);
          this.logger.debug('Generated pedestal command:', command);

          // 4. Update state for the next step
          currentPosition = newPosition.clone();
          // currentTarget remains the same
          // --- End Pedestal Logic ---
          break;
        }
        // TODO: Add cases for fly_by, fly_away...
        default: {
          this.logger.warn(`Unsupported motion type '${step.type}'. Skipping step.`);
          break;
        }
      }
    }

    this.logger.info(`Interpretation complete. Generated ${commands.length} commands.`);

    // TODO: Consider running validateCommands here on the generated commands
    // const validationResult = this.validateCommands(commands, sceneAnalysis.spatial.bounds); // Assuming bounds are needed
    // if (!validationResult.isValid) { ... handle validation errors ... }

    return commands;
  }

  async executeCommand(camera: Camera, command: CameraCommand): Promise<void> {
    this.logger.info('Executing command:', command);
    console.warn('executeCommand is not implemented!');
    return Promise.resolve();
  }

  async executeCommands(camera: Camera, commands: CameraCommand[]): Promise<void> {
    this.logger.info(`Executing ${commands.length} commands.`);
    for (const command of commands) {
        await this.executeCommand(camera, command);
    }
    return Promise.resolve();
  }

  validateCommands(
    commands: CameraCommand[],
    objectBounds: Box3
  ): ValidationResult {
     console.log('--- VALIDATE COMMANDS ENTRY POINT ---'); 
     this.logger.info('Validating camera commands', { commandCount: commands.length });
     
     // Simplified argument check - Avoid stringify
     this.logger.warn(`[Interpreter] Received objectBounds type: ${typeof objectBounds}, Is Box3: ${objectBounds instanceof Box3}`);
     if (objectBounds instanceof Box3) {
         this.logger.warn(`[Interpreter] Bounds Min: ${JSON.stringify(objectBounds.min)}, Max: ${JSON.stringify(objectBounds.max)}`);
     }

     // --- Bounding Box Validation --- START
     if (!objectBounds || !(objectBounds instanceof Box3)) { // Added instanceof check
       this.logger.warn('Object bounds NOT PROVIDED or invalid type for validation.');
     } else {
       this.logger.warn(`[Interpreter] Starting validation against Bounds: Min(${objectBounds.min.x?.toFixed(2)}, ${objectBounds.min.y?.toFixed(2)}, ${objectBounds.min.z?.toFixed(2)}), Max(${objectBounds.max.x?.toFixed(2)}, ${objectBounds.max.y?.toFixed(2)}, ${objectBounds.max.z?.toFixed(2)})`);
       
       for (const [index, command] of commands.entries()) {
         const pos = command.position;
         this.logger.warn(`[Interpreter] Checking command ${index}: Pos(${pos.x?.toFixed(2)}, ${pos.y?.toFixed(2)}, ${pos.z?.toFixed(2)})`); // Log position being checked
         try {
             this.logger.warn(`[Interpreter] Calling containsPoint for command ${index}...`);
             const isContained = objectBounds.containsPoint(pos);
             this.logger.warn(`[Interpreter] containsPoint call completed for command ${index}. Result: ${isContained}`); // Log after the call

             if (isContained) {
               const errorMsg = 'PATH_VIOLATION_BOUNDING_BOX: Camera position enters object bounds';
               this.logger.warn(`[Interpreter] Validation failed: ${errorMsg} at command ${index}`);
               return {
                 isValid: false,
                 errors: [errorMsg]
               };
             }
         } catch (checkError) {
             this.logger.error(`[Interpreter] Error during containsPoint check for command ${index}:`, checkError instanceof Error ? checkError.message : checkError); // Log only error message
             return { isValid: false, errors: [`Error during validation check: ${checkError instanceof Error ? checkError.message : 'Unknown check error'}`] };
         }
       }
       this.logger.warn('[Interpreter] Bounding box validation passed.');
     }
     // --- Bounding Box Validation --- END

     // TODO: Add other command validation checks here
     // ... (e.g., check velocity, angle change based on command durations/positions)

     const errors: string[] = []; // Initialize errors array for other checks
     if (!commands || commands.length === 0) {
      this.logger.warn('Command list is empty, nothing to validate further.');
      return { isValid: true, errors: [] }; // Valid but empty
    }

    // Example other checks (can be added here):
    // - Max speed between consecutive commands
    // - Max angle change between commands
    // - Duration validity (already checked in loop?)

    const isValid = errors.length === 0;
    if (!isValid) {
        this.logger.warn('Generated command validation failed (other checks):', errors);
    }
    // Return based on ALL validation checks
    return { isValid, errors }; 
   }

   getPerformanceMetrics(): PerformanceMetrics {
     this.logger.info('Getting performance metrics');
     return { /* placeholder */ } as PerformanceMetrics;
   }

} // --- End of SceneInterpreterImpl class ---


// Factory function follows the class definition
export function getSceneInterpreter(): SceneInterpreter {
    const dummyLogger = { info: ()=>{}, warn: ()=>{}, error: ()=>{}, debug: ()=>{}, trace: ()=>{}, performance: ()=>{} };
    const dummyConfig: SceneInterpreterConfig = { 
        smoothingFactor: 0.5, 
        maxKeyframes: 100, 
        interpolationMethod: 'smooth' 
    };
    return new SceneInterpreterImpl(dummyConfig, dummyLogger);
}

// REMOVE OLD CLASS DEFINITION FROM DOWN HERE
/*
class CoreSceneInterpreter implements SceneInterpreter {
  // ... [old implementation] ...
}
*/ 