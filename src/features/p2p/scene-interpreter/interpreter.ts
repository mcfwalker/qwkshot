import { Camera } from 'three';
import {
  SceneInterpreter,
  SceneInterpreterConfig,
  // CameraCommand, // REMOVE CameraCommand import
} from '@/types/p2p/scene-interpreter';
import { ControlInstruction } from '@/types/p2p/camera-controls'; // ADD ControlInstruction import
import { ValidationResult, PerformanceMetrics, Logger } from '@/types/p2p/shared';
// import { CameraPath } from '@/types/p2p/llm-engine'; // Removed CameraPath
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
    this.logger.info('Creating Scene Interpreter instance (v3 architecture)');
  }

  async initialize(config: SceneInterpreterConfig): Promise<void> {
    this.config = config;
    this.logger.info('Initializing Scene Interpreter (v3 architecture)', { config });
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
  ): ControlInstruction[] {
    this.logger.info('Interpreting motion plan (v3 architecture)...', { plan });
    if (!this.config) {
        this.logger.error('Interpreter not initialized');
        throw new Error('Interpreter not initialized');
    }
    if (!plan || !Array.isArray(plan.steps) || plan.steps.length === 0) {
        this.logger.error('Invalid or empty MotionPlan provided.');
        throw new Error('Invalid or empty MotionPlan provided.');
    }

    const instructions: ControlInstruction[] = [];
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
           this.logger.warn(`Normalized step duration is zero or negative for step ${index + 1} (${step.type}). Handler must manage this.`);
      }

      // --- START Target Blending Logic (Refactored for ControlInstruction) --- 
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

      const resolvedNextTarget = resolveTargetPosition( // Use imported function
        nextTargetName,
        sceneAnalysis,
        envAnalysis, // <-- Pass full envAnalysis
        currentTarget,
        this.logger // Pass logger
      ); 

      if (resolvedNextTarget && !currentTarget.equals(resolvedNextTarget)) {
          this.logger.debug(`Target change detected. Previous: ${currentTarget.toArray()}, Next: ${resolvedNextTarget.toArray()}. Inserting 'setTarget' instruction.`);
          instructions.push({
              method: 'setTarget',
              args: [resolvedNextTarget.x, resolvedNextTarget.y, resolvedNextTarget.z, true] // true for enableTransition
          });
          currentTarget = resolvedNextTarget.clone(); // Update currentTarget for the actual step handler
          this.logger.debug(`'setTarget' instruction added. Updated currentTarget for step ${index + 1}.`);
      }
      // --- END Target Blending Logic ---

      let stepInstructions: ControlInstruction[] = [];
      let nextPositionStep: Vector3 = currentPosition.clone();
      let nextTargetStep: Vector3 = currentTarget.clone();

      this.logger.debug(`Switching on type: '${step.type}' for ControlInstruction generation`);
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
          this.logger.warn(`Step type '${step.type}' handler not yet fully refactored for ControlInstruction. Attempting to use its state updates.`);
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
          stepInstructions = result.instructions;
          nextPositionStep = result.nextPosition;
          nextTargetStep = result.nextTarget;
          break;
        }
        case 'zoom': {
          this.logger.warn(`Step type '${step.type}' handler not yet refactored for ControlInstruction. Skipping command generation for this step.`);
          // We need to call the original handler to get the predicted next state for subsequent steps,
          // but we will ignore the CameraCommand[] it produces.
          try {
            let genericResult: { nextPosition: Vector3, nextTarget: Vector3 }; // Define a generic type for the part we need
            genericResult = handleZoomStep(step, currentPosition, currentTarget, stepDuration, sceneAnalysis, envAnalysis, this.logger);
            nextPositionStep = genericResult.nextPosition;
            nextTargetStep = genericResult.nextTarget;
          } catch (e) {
            this.logger.error(`Error calling unrefactored handler for '${step.type}': ${e instanceof Error ? e.message : e}. Keeping previous state.`);
            nextPositionStep = currentPosition.clone();
            nextTargetStep = currentTarget.clone();
          }
          stepInstructions = []; // No instructions generated for unrefactored steps
          break;
        }
        case 'orbit': {
          this.logger.warn(`Step type '${step.type}' handler not yet refactored for ControlInstruction. Skipping command generation for this step.`);
          // We need to call the original handler to get the predicted next state for subsequent steps,
          // but we will ignore the CameraCommand[] it produces.
          try {
            let genericResult: { nextPosition: Vector3, nextTarget: Vector3 }; // Define a generic type for the part we need
            genericResult = handleOrbitStep(step, currentPosition, currentTarget, stepDuration, sceneAnalysis, envAnalysis, this.logger);
            nextPositionStep = genericResult.nextPosition;
            nextTargetStep = genericResult.nextTarget;
          } catch (e) {
            this.logger.error(`Error calling unrefactored handler for '${step.type}': ${e instanceof Error ? e.message : e}. Keeping previous state.`);
            nextPositionStep = currentPosition.clone();
            nextTargetStep = currentTarget.clone();
          }
          stepInstructions = []; // No instructions generated for unrefactored steps
          break;
        }
        case 'pan': {
          this.logger.warn(`Step type '${step.type}' handler not yet refactored for ControlInstruction. Skipping command generation for this step.`);
          // We need to call the original handler to get the predicted next state for subsequent steps,
          // but we will ignore the CameraCommand[] it produces.
          try {
            let genericResult: { nextPosition: Vector3, nextTarget: Vector3 }; // Define a generic type for the part we need
            genericResult = handlePanStep(step, currentPosition, currentTarget, stepDuration, sceneAnalysis, envAnalysis, this.logger);
            nextPositionStep = genericResult.nextPosition;
            nextTargetStep = genericResult.nextTarget;
          } catch (e) {
            this.logger.error(`Error calling unrefactored handler for '${step.type}': ${e instanceof Error ? e.message : e}. Keeping previous state.`);
            nextPositionStep = currentPosition.clone();
            nextTargetStep = currentTarget.clone();
          }
          stepInstructions = []; // No instructions generated for unrefactored steps
          break;
        }
        case 'tilt': {
          this.logger.warn(`Step type '${step.type}' handler not yet refactored for ControlInstruction. Skipping command generation for this step.`);
          // We need to call the original handler to get the predicted next state for subsequent steps,
          // but we will ignore the CameraCommand[] it produces.
          try {
            let genericResult: { nextPosition: Vector3, nextTarget: Vector3 }; // Define a generic type for the part we need
            const currentStepExplicitTargetName = typeof step.parameters?.target === 'string' ? step.parameters.target : null;
            genericResult = handleTiltStep(step, currentPosition, currentTarget, stepDuration, sceneAnalysis, envAnalysis, this.logger, currentStepExplicitTargetName);
            nextPositionStep = genericResult.nextPosition;
            nextTargetStep = genericResult.nextTarget;
          } catch (e) {
            this.logger.error(`Error calling unrefactored handler for '${step.type}': ${e instanceof Error ? e.message : e}. Keeping previous state.`);
            nextPositionStep = currentPosition.clone();
            nextTargetStep = currentTarget.clone();
          }
          stepInstructions = []; // No instructions generated for unrefactored steps
          break;
        }
        case 'truck': {
          this.logger.warn(`Step type '${step.type}' handler not yet refactored for ControlInstruction. Skipping command generation for this step.`);
          // We need to call the original handler to get the predicted next state for subsequent steps,
          // but we will ignore the CameraCommand[] it produces.
          try {
            let genericResult: { nextPosition: Vector3, nextTarget: Vector3 }; // Define a generic type for the part we need
            genericResult = handleTruckStep(step, currentPosition, currentTarget, stepDuration, sceneAnalysis, envAnalysis, this.logger);
            nextPositionStep = genericResult.nextPosition;
            nextTargetStep = genericResult.nextTarget;
          } catch (e) {
            this.logger.error(`Error calling unrefactored handler for '${step.type}': ${e instanceof Error ? e.message : e}. Keeping previous state.`);
            nextPositionStep = currentPosition.clone();
            nextTargetStep = currentTarget.clone();
          }
          stepInstructions = []; // No instructions generated for unrefactored steps
          break;
        }
        case 'pedestal': {
          this.logger.warn(`Step type '${step.type}' handler not yet refactored for ControlInstruction. Skipping command generation for this step.`);
          // We need to call the original handler to get the predicted next state for subsequent steps,
          // but we will ignore the CameraCommand[] it produces.
          try {
            let genericResult: { nextPosition: Vector3, nextTarget: Vector3 }; // Define a generic type for the part we need
            genericResult = handlePedestalStep(step, currentPosition, currentTarget, stepDuration, sceneAnalysis, envAnalysis, this.logger);
            nextPositionStep = genericResult.nextPosition;
            nextTargetStep = genericResult.nextTarget;
          } catch (e) {
            this.logger.error(`Error calling unrefactored handler for '${step.type}': ${e instanceof Error ? e.message : e}. Keeping previous state.`);
            nextPositionStep = currentPosition.clone();
            nextTargetStep = currentTarget.clone();
          }
          stepInstructions = []; // No instructions generated for unrefactored steps
          break;
        }
        case 'rotate': {
          this.logger.warn(`Step type '${step.type}' handler not yet refactored for ControlInstruction. Skipping command generation for this step.`);
          // We need to call the original handler to get the predicted next state for subsequent steps,
          // but we will ignore the CameraCommand[] it produces.
          try {
            let genericResult: { nextPosition: Vector3, nextTarget: Vector3 }; // Define a generic type for the part we need
            genericResult = handleRotateStep(step, currentPosition, currentTarget, stepDuration, sceneAnalysis, envAnalysis, this.logger);
            nextPositionStep = genericResult.nextPosition;
            nextTargetStep = genericResult.nextTarget;
          } catch (e) {
            this.logger.error(`Error calling unrefactored handler for '${step.type}': ${e instanceof Error ? e.message : e}. Keeping previous state.`);
            nextPositionStep = currentPosition.clone();
            nextTargetStep = currentTarget.clone();
          }
          stepInstructions = []; // No instructions generated for unrefactored steps
          break;
        }
        case 'focus_on': {
          this.logger.warn(`Step type '${step.type}' handler not yet refactored for ControlInstruction. Skipping command generation for this step.`);
          // We need to call the original handler to get the predicted next state for subsequent steps,
          // but we will ignore the CameraCommand[] it produces.
          try {
            let genericResult: { nextPosition: Vector3, nextTarget: Vector3 }; // Define a generic type for the part we need
            genericResult = handleFocusOnStep(step, currentPosition, currentTarget, stepDuration, sceneAnalysis, envAnalysis, this.logger);
            nextPositionStep = genericResult.nextPosition;
            nextTargetStep = genericResult.nextTarget;
          } catch (e) {
            this.logger.error(`Error calling unrefactored handler for '${step.type}': ${e instanceof Error ? e.message : e}. Keeping previous state.`);
            nextPositionStep = currentPosition.clone();
            nextTargetStep = currentTarget.clone();
          }
          stepInstructions = []; // No instructions generated for unrefactored steps
          break;
        }
        case 'move_to': {
          this.logger.warn(`Step type '${step.type}' handler not yet refactored for ControlInstruction. Skipping command generation for this step.`);
          // We need to call the original handler to get the predicted next state for subsequent steps,
          // but we will ignore the CameraCommand[] it produces.
          try {
            let genericResult: { nextPosition: Vector3, nextTarget: Vector3 }; // Define a generic type for the part we need
            genericResult = handleMoveToStep(step, currentPosition, currentTarget, stepDuration, sceneAnalysis, envAnalysis, this.logger);
            nextPositionStep = genericResult.nextPosition;
            nextTargetStep = genericResult.nextTarget;
          } catch (e) {
            this.logger.error(`Error calling unrefactored handler for '${step.type}': ${e instanceof Error ? e.message : e}. Keeping previous state.`);
            nextPositionStep = currentPosition.clone();
            nextTargetStep = currentTarget.clone();
          }
          stepInstructions = []; // No instructions generated for unrefactored steps
          break;
        }
        default: {
          this.logger.error(`Unknown motion type: ${step.type}. Skipping step.`);
          stepInstructions = [];
          nextPositionStep = currentPosition.clone();
          nextTargetStep = currentTarget.clone();
          break;
        }
      }

      instructions.push(...stepInstructions);

      // --- State Update --- 
      // Update the loop's state based on the calculated next state from the handler
      // (or the direct calculation within the case block for unrefactored primitives)
      currentPosition = nextPositionStep;
      currentTarget = nextTargetStep;
      this.logger.debug(`State updated after step ${index + 1}: Pos=${currentPosition.toArray().map(v => v.toFixed(2))}, Target=${currentTarget.toArray().map(v => v.toFixed(2))}`);

    } // End of loop over steps

    // if (!validationResult.isValid) { ... handle validation errors ... }

    // --- Velocity Check (Temporarily Commented Out for ControlInstruction) --- 
    /* 
    const maxVelocity = this.config?.maxVelocity;
    if (maxVelocity && maxVelocity > 0 && instructions.length > 0) { 
        let previousPosition = initialCameraState.position; 
        for (let i = 0; i < instructions.length; i++) {
            const instruction = instructions[i];
            // This logic needs to be completely rethought for ControlInstruction
            // For example, how to get 'position' and 'duration' from arbitrary methods?
            // const distanceMoved = instruction.position.distanceTo(previousPosition); 
            // if (instruction.duration > 1e-6) { 
            //      const velocity = distanceMoved / instruction.duration;
            //      if (velocity > maxVelocity) {
            //         this.logger.warn(`Velocity check failed for instruction ${i + 1}: Velocity ${velocity.toFixed(2)} exceeds max ${maxVelocity}.`);
            //      }
            // }
            // previousPosition = instruction.position; 
        }
    }
    */
    this.logger.info('Velocity check skipped for ControlInstruction format.');
    // --- End Velocity Check ---

    return instructions;
  }

  async executeCommand(_camera: Camera, command: ControlInstruction): Promise<void> {
    this.logger.info('Executing control instruction (placeholder)', { command });
    console.warn('executeCommand is not implemented for ControlInstruction!');
    return Promise.resolve();
  }

  async executeCommands(_camera: Camera, commands: ControlInstruction[]): Promise<void> {
    this.logger.info(`Executing ${commands.length} control instructions (placeholder).`);
    // This likely won't be used if commands are sent to client for execution.
    for (const command of commands) {
        await this.executeCommand(_camera, command);
    }
    return Promise.resolve();
  }

  validateCommands(
    commands: ControlInstruction[],
    _objectBounds: Box3
  ): ValidationResult {
    this.logger.warn('Validation for ControlInstruction[] not yet implemented. Returning isValid: true.');
    // --- Original Bounding Box Validation (Commented Out) ---
    /*
    console.log('--- VALIDATE COMMANDS ENTRY POINT ---'); 
     this.logger.info('Validating camera commands', { commandCount: commands.length });
     
    if (!_objectBounds || !(_objectBounds instanceof Box3)) {
       this.logger.warn('Object bounds NOT PROVIDED or invalid type for validation.');
     } else {
       this.logger.warn(`[Interpreter] Starting validation against Bounds: Min(${_objectBounds.min.x?.toFixed(2)}, ${_objectBounds.min.y?.toFixed(2)}, ${_objectBounds.min.z?.toFixed(2)}), Max(${_objectBounds.max.x?.toFixed(2)}, ${_objectBounds.max.y?.toFixed(2)}, ${_objectBounds.max.z?.toFixed(2)})`);
       for (const [index, command] of commands.entries()) {
         // This needs to adapt to ControlInstruction format, e.g. how to get 'position'?
         // const pos = command.position; 
         // if (!pos || !(pos instanceof Vector3)) {
         //    this.logger.warn(`[Interpreter] Skipping validation for command ${index}: Invalid position.`);
         //    continue;
         // }
         // this.logger.warn(`[Interpreter] Checking command ${index}: Pos(${pos.x?.toFixed(2)}, ${pos.y?.toFixed(2)}, ${pos.z?.toFixed(2)})`);
         // try {
         //      const isContained = _objectBounds.containsPoint(pos);
         //   this.logger.warn(`[Interpreter] containsPoint check completed for command ${index}. Result: ${isContained}`);
         //      if (isContained) {
         //        const errorMsg = 'PATH_VIOLATION_BOUNDING_BOX: Camera position enters object bounds';
         //        this.logger.warn(`[Interpreter] Validation failed: ${errorMsg} at command ${index}`);
         //        return {
         //          isValid: false,
         //          errors: [errorMsg]
         //        };
         //      }
         // } catch (checkError) {
         //  this.logger.error(`[Interpreter] Error during containsPoint check for command ${index}:`, checkError instanceof Error ? checkError.message : checkError);
         //      return { isValid: false, errors: [`Error during validation check: ${checkError instanceof Error ? checkError.message : 'Unknown check error'}`] };
         // }
       }
       this.logger.warn('[Interpreter] Bounding box validation passed (or skipped for ControlInstruction).');
     }
    const errors: string[] = []; 
     if (!commands || commands.length === 0) {
      this.logger.warn('Command list is empty, nothing to validate further.');
      return { isValid: true, errors: [] }; 
    }
    const isValid = errors.length === 0;
    if (!isValid) {
        this.logger.warn('Generated command validation failed (other checks):', errors);
    }
    return { isValid, errors }; 
    */
   return { isValid: true, errors: [] }; 
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