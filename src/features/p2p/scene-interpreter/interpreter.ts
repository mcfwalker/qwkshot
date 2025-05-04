import { Camera } from 'three';
import {
  SceneInterpreter,
  SceneInterpreterConfig,
  CameraCommand,
  // InterpretationError // Removed unused import
} from '@/types/p2p/scene-interpreter';
// import { CameraPath } from '@/types/p2p/llm-engine'; // Removed CameraPath
import { ValidationResult, PerformanceMetrics, Logger } from '@/types/p2p/shared';
// import * as THREE from 'three'; // REMOVED unused namespace import
// import { CatmullRomCurve3, Vector3, Box3, Ray, Quaternion } from 'three'; // Removed Ray, Quaternion, CatmullRomCurve3
import { Vector3, Box3 } from 'three'; // Keep Vector3, Box3 explicitly
import { MotionPlan /*, MotionStep*/ } from '@/lib/motion-planning/types'; // Removed MotionStep
import { SceneAnalysis } from '@/types/p2p/scene-analyzer';
import { EnvironmentalAnalysis } from '@/types/p2p/environmental-analyzer';
import { easingFunctions, EasingFunctionName, DEFAULT_EASING } from '@/lib/easing';
import {
  resolveTargetPosition,
  // clampPositionWithRaycast, // REMOVED - No longer used directly in interpreter.ts
  // mapDescriptorToValue, // Removed
  // mapDescriptorToGoalDistance, // Removed
  // normalizeDescriptor, // Removed
  // Descriptor, // Removed
  // MagnitudeType // Removed
} from './interpreter-utils'; // Removed unused utils
// Keep handler imports
import { handleStaticStep } from './primitive-handlers/handleStaticStep';
import { handleDollyStep } from './primitive-handlers/handleDollyStep';
import { handleZoomStep } from './primitive-handlers/handleZoomStep';
import { handleOrbitStep } from './primitive-handlers/handleOrbitStep';
import { handlePanStep } from './primitive-handlers/handlePanStep';
import { handleTiltStep } from './primitive-handlers/handleTiltStep';
import { handleTruckStep } from './primitive-handlers/handleTruckStep';
import { handlePedestalStep } from './primitive-handlers/handlePedestalStep';
import { handleRotateStep } from './primitive-handlers/handleRotateStep';
import { handleFocusOnStep } from './primitive-handlers/handleFocusOnStep';
import { handleMoveToStep } from './primitive-handlers/handleMoveToStep';

// REMOVED local type definitions
// type Descriptor = ...
// type MagnitudeType = ...

// REMOVED local logger definition
/*
const logger = {
  info: (...args: any[]) => console.log('[SceneInterpreter]', ...args),
  warn: (...args: any[]) => console.warn('[SceneInterpreter]', ...args),
  error: (...args: any[]) => console.error('[SceneInterpreter]', ...args),
  debug: (...args: any[]) => console.debug('[SceneInterpreter]', ...args),
};
*/

// REMOVED isFiniteVector function
/*
function isFiniteVector(v: any): boolean {
    return v && typeof v === 'object' && 
           Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}
*/

export class SceneInterpreterImpl implements SceneInterpreter {
  private config: SceneInterpreterConfig | null = null;
  private logger: Logger;

  constructor(config: SceneInterpreterConfig, logger: Logger) { 
    this.config = config;
    this.logger = logger;
    this.logger.info('Creating Scene Interpreter instance');
  }

  async initialize(config: SceneInterpreterConfig): Promise<void> {
    this.config = config;
    this.logger.info('Initializing Scene Interpreter', { config });
  }

  // REMOVED unused validateInputPath method
  /*
  private validateInputPath(path: CameraPath): ValidationResult {
    // ... implementation ...
  }
  */

  interpretPath(
    plan: MotionPlan,
    sceneAnalysis: SceneAnalysis,
    envAnalysis: EnvironmentalAnalysis, 
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
           // Assign a small default duration if needed by the generator? Or let generator handle it.
           // For now, let the generator handle zero/negative durations if possible.
      }

      // --- START Target Blending Logic --- 
      // Determine the target *and other params* for the upcoming step BEFORE generating commands
      let nextTargetName = 'current_target'; // Default assumption
      let nextEasingName = DEFAULT_EASING; // Default easing for blend
      let nextSpeed = 'medium'; // Default speed for easing selection
      let currentStepExplicitTargetName: string | null = null; // Defined here

      if (step.parameters) {
          nextTargetName = typeof step.parameters.target === 'string' ? step.parameters.target : nextTargetName;
          currentStepExplicitTargetName = typeof step.parameters.target === 'string' ? step.parameters.target : null; // Defined here
          nextEasingName = typeof step.parameters.easing === 'string' && (step.parameters.easing in easingFunctions) ? step.parameters.easing as EasingFunctionName : DEFAULT_EASING;
          nextSpeed = typeof step.parameters.speed === 'string' ? step.parameters.speed : 'medium';
      }

      // Special case: Orbit defaults to object_center if target not specified
      if (step.type === 'orbit' && typeof step.parameters?.target !== 'string') {
          nextTargetName = 'object_center';
      }
      // Add other motion type specific default targets here if needed

      const nextTarget = resolveTargetPosition( // Use imported function
        nextTargetName,
        sceneAnalysis,
        envAnalysis, // <-- Pass full envAnalysis
        currentTarget,
        this.logger // Pass logger
      ); 

      if (nextTarget && !currentTarget.equals(nextTarget)) {
          this.logger.debug(`Target change detected between steps. Previous: ${currentTarget.toArray()}, Next: ${nextTarget.toArray()}. Inserting blend command.`);

          // Determine if the upcoming step is an absolute target tilt/pan
          const isAbsoluteTiltOrPan = (step.type === 'tilt' || step.type === 'pan') && currentStepExplicitTargetName; // Defined here

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

      let stepCommands: CameraCommand[] = [];
      let nextPositionStep: Vector3 = currentPosition.clone();
      let nextTargetStep: Vector3 = currentTarget.clone();

      this.logger.debug(`Switching on type: '${step.type}'`);
      switch (step.type) {
        case 'static': {
          const result = handleStaticStep(
            step,
            currentPosition,
            currentTarget,
            stepDuration,
            sceneAnalysis, // Pass context even if unused by static
            envAnalysis,
            this.logger
          );
          stepCommands = result.commands;
          nextPositionStep = result.nextPosition;
          nextTargetStep = result.nextTarget;
          break;
        }
        case 'dolly': {
          const result = handleDollyStep(
            step,
            currentPosition,
            currentTarget,
            stepDuration,
            sceneAnalysis,
            envAnalysis,
            this.logger
          );
          stepCommands = result.commands;
          nextPositionStep = result.nextPosition;
          nextTargetStep = result.nextTarget;
          break;
        }
        case 'zoom': {
          const result = handleZoomStep(
            step,
            currentPosition,
            currentTarget,
            stepDuration,
            sceneAnalysis,
            envAnalysis,
            this.logger
          );
          stepCommands = result.commands;
          nextPositionStep = result.nextPosition;
          nextTargetStep = result.nextTarget;
          break;
        }
        case 'orbit': {
          const result = handleOrbitStep(
            step,
            currentPosition,
            currentTarget,
            stepDuration,
            sceneAnalysis,
            envAnalysis,
            this.logger
          );
          stepCommands = result.commands;
          nextPositionStep = result.nextPosition;
          nextTargetStep = result.nextTarget;
          break;
        }
        case 'pan': {
          const result = handlePanStep(
            step,
            currentPosition,
            currentTarget,
            stepDuration,
            sceneAnalysis,
            envAnalysis,
            this.logger
          );
          stepCommands = result.commands;
          nextPositionStep = result.nextPosition;
          nextTargetStep = result.nextTarget;
          break;
        }
        case 'tilt': {
          const result = handleTiltStep(
            step,
            currentPosition,
            currentTarget, // Pass the potentially blended target
            stepDuration,
            sceneAnalysis,
            envAnalysis,
            this.logger,
            currentStepExplicitTargetName // Pass the explicit name check result
          );
          stepCommands = result.commands;
          nextPositionStep = result.nextPosition;
          nextTargetStep = result.nextTarget;
          break;
        }
        case 'truck': {
          const result = handleTruckStep(
            step,
            currentPosition,
            currentTarget,
            stepDuration,
            sceneAnalysis,
            envAnalysis,
            this.logger
          );
          stepCommands = result.commands;
          nextPositionStep = result.nextPosition;
          nextTargetStep = result.nextTarget;
          break;
        }
        case 'pedestal': {
          const result = handlePedestalStep(
            step,
            currentPosition,
            currentTarget,
            stepDuration,
            sceneAnalysis,
            envAnalysis,
            this.logger
          );
          stepCommands = result.commands;
          nextPositionStep = result.nextPosition;
          nextTargetStep = result.nextTarget;
          break;
        }
        case 'rotate': {
          const result = handleRotateStep(
            step,
            currentPosition,
            currentTarget,
            stepDuration,
            sceneAnalysis,
            envAnalysis,
            this.logger
          );
          stepCommands = result.commands;
          nextPositionStep = result.nextPosition;
          nextTargetStep = result.nextTarget;
          break;
        }
        case 'focus_on': {
          const result = handleFocusOnStep(
            step,
            currentPosition,
            currentTarget,
            stepDuration,
            sceneAnalysis,
            envAnalysis,
            this.logger
          );
          stepCommands = result.commands;
          nextPositionStep = result.nextPosition;
          nextTargetStep = result.nextTarget;
          break;
        }
        case 'move_to': {
          const result = handleMoveToStep(
            step,
            currentPosition,
            currentTarget,
            stepDuration,
            sceneAnalysis,
            envAnalysis,
            this.logger
          );
          stepCommands = result.commands;
          nextPositionStep = result.nextPosition;
          nextTargetStep = result.nextTarget;
          break;
        }
        default: {
          this.logger.error(`Unknown motion type: ${step.type}. Skipping step.`);
          stepCommands = [];
          nextPositionStep = currentPosition.clone();
          nextTargetStep = currentTarget.clone();
          break;
        }
      }

      // Add the commands generated by this step
      commands.push(...stepCommands);

      // --- State Update --- 
      // Update the loop's state based on the calculated next state from the handler
      // (or the direct calculation within the case block for unrefactored primitives)
      currentPosition = nextPositionStep;
      currentTarget = nextTargetStep;
      this.logger.debug(`State updated after step ${index + 1}: Pos=${currentPosition.toArray().map(v => v.toFixed(2))}, Target=${currentTarget.toArray().map(v => v.toFixed(2))}`);

    } // End of loop over steps

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

  async executeCommand(_camera: Camera, command: CameraCommand): Promise<void> {
    this.logger.info('Executing camera command (placeholder)', { command });
    // TODO: Implement actual command execution logic if needed on backend,
    // or confirm this is handled purely client-side by AnimationController.
    console.warn('executeCommand is not implemented!');
    return Promise.resolve();
  }

  async executeCommands(_camera: Camera, commands: CameraCommand[]): Promise<void> {
    this.logger.info(`Executing ${commands.length} camera commands (placeholder).`);
    // This likely won't be used if commands are sent to client for execution.
    for (const command of commands) {
        await this.executeCommand(_camera, command);
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

} // End class

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