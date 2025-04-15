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
          this.logger.warn(`Motion type '${step.type}' not implemented yet.`);
          // TODO: Implement orbit logic
          // 1. Resolve target, axis, direction, angle, speed, easing
          // 2. Calculate new position based on rotation around axis/target
          // 3. May need to update target as well if orbit path isn't perfectly looking at center
          // 4. Create CameraCommand
          // 5. Update currentPosition and currentTarget
          break;
        }
        case 'zoom': {
          const { 
            direction, 
            factor, 
            target: targetName = 'current_target', // Default target 
            easing: easingName = 'easeInOutQuad' // Default easing
          } = step.parameters;

          if (direction !== 'in' && direction !== 'out') {
            this.logger.error(`Invalid zoom direction: ${direction}. Skipping step.`);
            continue;
          }
          if (typeof factor !== 'number' || factor <= 0) {
            this.logger.error(`Invalid zoom factor: ${factor}. Skipping step.`);
            continue;
          }

          let zoomTargetPosition: Vector3;
          if (targetName === 'object_center' && sceneAnalysis?.spatial?.bounds?.center) {
            zoomTargetPosition = sceneAnalysis.spatial.bounds.center.clone();
            this.logger.debug(`Zoom target resolved to object center: ${zoomTargetPosition.toArray()}`);
          } else {
            zoomTargetPosition = currentTarget.clone(); // Default to current target
            this.logger.debug(`Zoom target resolved to current target: ${zoomTargetPosition.toArray()}`);
          }

          const currentDirectionVector = new Vector3().subVectors(zoomTargetPosition, currentPosition);
          const currentDistance = currentDirectionVector.length();
          
          let newDistance: number;
          if (direction === 'in') {
              // Factor determines the *remaining* distance ratio (e.g., 0.5 means move halfway closer)
              newDistance = currentDistance * (factor as number);
          } else { // direction === 'out'
              // Factor determines the *new* distance ratio (e.g., 2.0 means double the distance)
              newDistance = currentDistance * (factor as number);
          }
          
          // Avoid division by zero if currentDistance is very small
          if (currentDistance < 1e-6) {
              this.logger.warn('Current distance for zoom is near zero. Cannot calculate new position. Keeping position static for this step.');
              newDistance = currentDistance; // Keep distance same
          }

          const newPosition = new Vector3()
              .copy(zoomTargetPosition) // Start at the target
              .addScaledVector(currentDirectionVector.normalize(), -newDistance); // Move back along the direction vector

          const command: CameraCommand = {
            position: newPosition.clone(),
            target: currentTarget.clone(), // Zoom typically keeps the same target
            duration: stepDuration > 0 ? stepDuration : 0.1, // Use calculated duration
            easing: (easingName as EasingFunctionName) in easingFunctions ? easingName as EasingFunctionName : 'easeInOutQuad' // Validate easing name
          };
          commands.push(command);
          this.logger.debug('Generated zoom command:', command);

          // Update state for the next step
          currentPosition = newPosition.clone();
          // currentTarget remains the same for zoom
          break;
        }
        case 'orbit': {
          this.logger.warn(`Motion type '${step.type}' not implemented yet.`);
          // TODO: Implement orbit logic
          // 1. Resolve target, axis, direction, angle, speed, easing
          // 2. Calculate new position based on rotation around axis/target
          // 3. May need to update target as well if orbit path isn't perfectly looking at center
          // 4. Create CameraCommand
          // 5. Update currentPosition and currentTarget
          break;
        }
        // TODO: Add cases for pan, tilt, dolly, truck, pedestal, fly_by, fly_away...
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