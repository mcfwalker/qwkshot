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

// --- CLASS DEFINITION MOVED HERE ---
class SceneInterpreterImpl implements SceneInterpreter {
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

  interpretPath(path: CameraPath): CameraCommand[] {
    this.logger.info('Interpreting path:', path);
    if (!this.config) {
        this.logger.error('Interpreter not initialized');
        throw new Error('Interpreter not initialized');
    }

    const validation = this.validateInputPath(path);
    if (!validation.isValid) {
      this.logger.error('Path interpretation failed due to invalid input path:', validation.errors);
      throw new Error(`Input path validation failed: ${validation.errors.join(', ')}`);
    }
    this.logger.info('Input path passed validation.');

    const interpolationMethod = this.config.interpolationMethod;
    const smoothingFactor = this.config.smoothingFactor;
    this.logger.debug(`Processing path with interpolation: ${interpolationMethod}, smoothingFactor: ${smoothingFactor}`);

    const commands: CameraCommand[] = [];
    const keyframes = path.keyframes;

    if (interpolationMethod === 'smooth') {
        this.logger.info('Applying Catmull-Rom smoothing...');

        if (keyframes.length < 2) {
            this.logger.warn('Need at least 2 keyframes for smoothing. Falling back to linear.');
             for (const kf of keyframes) {
                 commands.push({
                     position: kf.position,
                     target: kf.target,
                     duration: kf.duration,
                     easing: 'linear'
                 });
             }
             return commands;
        }

        const positions = keyframes.map(kf => kf.position);
        const positionCurve = new THREE.CatmullRomCurve3(positions, false, 'catmullrom'); 

        const minPoints = 2;
        const maxPoints = 10;
        const pointsPerSegment = Math.max(minPoints, Math.round(minPoints + (this.config.smoothingFactor ?? 0.5) * (maxPoints - minPoints)));
        this.logger.debug(`Using ${pointsPerSegment} points per segment based on smoothingFactor ${this.config.smoothingFactor?.toFixed(2)}`);

        const totalGeneratedPoints = (keyframes.length - 1) * pointsPerSegment + 1;
        const curvePoints = positionCurve.getPoints(totalGeneratedPoints - 1); 

        let accumulatedDuration = 0;
        let originalKfIndex = 0;

        for (let i = 0; i < curvePoints.length - 1; i++) {
            const segmentStartTime = (i / (totalGeneratedPoints - 1)) * path.duration;
            const segmentEndTime = ((i + 1) / (totalGeneratedPoints - 1)) * path.duration;
            const segmentDuration = segmentEndTime - segmentStartTime;

            originalKfIndex = 0;
            accumulatedDuration = 0;
            while (originalKfIndex < keyframes.length - 1 && accumulatedDuration + keyframes[originalKfIndex].duration < segmentStartTime) {
                accumulatedDuration += keyframes[originalKfIndex].duration;
                originalKfIndex++;
            }

            const kf1 = keyframes[originalKfIndex];
            const kf2 = keyframes[Math.min(originalKfIndex + 1, keyframes.length - 1)];
            const localProgressStart = Math.max(0, Math.min(1, kf1.duration > 0 ? (segmentStartTime - accumulatedDuration) / kf1.duration : 0));

            const interpolatedTarget = new THREE.Vector3().lerpVectors(kf1.target, kf2.target, localProgressStart);

            let segmentEasingName: EasingFunctionName = 'linear'; 
            if (i === 0) {
                segmentEasingName = 'easeOutQuad';
                this.logger.debug('Applying easeOutQuad to first smoothed segment');
            }

            if (segmentDuration > 1e-6) { 
                const command: CameraCommand = {
                    position: curvePoints[i],
                    target: interpolatedTarget, 
                    duration: segmentDuration,
                    easing: segmentEasingName 
                };
                commands.push(command);
            }
        }

         const lastKf = keyframes[keyframes.length - 1];
         const lastCurvePoint = curvePoints[curvePoints.length - 1];
         const secondLastSegmentEndTime = curvePoints.length > 1 ? ((curvePoints.length - 2) / (totalGeneratedPoints - 1)) * path.duration : 0;
         const finalSegmentDuration = path.duration - secondLastSegmentEndTime;

         if (finalSegmentDuration > 1e-6) { 
             const finalCommand: CameraCommand = {
                 position: lastCurvePoint, 
                 target: lastKf.target,   
                 duration: finalSegmentDuration,
                 easing: 'easeInQuad' 
             };
             commands.push(finalCommand);
             this.logger.debug('Assigning easeInQuad to final smoothed segment');
         } else if (commands.length === 0 && keyframes.length === 1) {
             const singleCommand: CameraCommand = {
                  position: keyframes[0].position,
                  target: keyframes[0].target,
                  duration: keyframes[0].duration,
                  easing: 'linear' 
             };
             commands.push(singleCommand);
         }

    } else {
      for (let i = 0; i < keyframes.length; i++) {
          const kf = keyframes[i];
          let easingName: EasingFunctionName | undefined = undefined;

          if (interpolationMethod === 'ease') {
             if (i === 0 && keyframes.length > 1) {
                 easingName = 'easeOutQuad';
             } else if (i === keyframes.length - 1 && keyframes.length > 1) {
                 easingName = 'easeInQuad';
             } else if (keyframes.length === 1) {
                  easingName = 'linear';
             } else {
                 easingName = 'easeInOutQuad';
             }
              this.logger.debug(`Assigning ${easingName} easing for keyframe ${i}`);
          } else { 
              easingName = 'linear';
          }

          const command: CameraCommand = {
              position: kf.position,
              target: kf.target,
              duration: kf.duration,
              easing: easingName 
          };
          commands.push(command);
      }
    }

    this.logger.info(`Interpretation complete. Generated ${commands.length} commands.`);
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
     
     // <<< ADD IMMEDIATE ARGUMENT CHECK >>>
     this.logger.warn(`[Interpreter] Received objectBounds type: ${typeof objectBounds}, Is Box3: ${objectBounds instanceof Box3}, Value: ${JSON.stringify(objectBounds)}`);

     // --- Bounding Box Validation --- START
     if (!objectBounds) {
       this.logger.warn('Object bounds NOT PROVIDED for validation.');
     } else {
       this.logger.warn(`[Interpreter] Validating against Bounds: Min/Max received.`);
       
       for (const [index, command] of commands.entries()) {
         const pos = command.position;
         try {
             const isContained = objectBounds.containsPoint(pos);
             this.logger.warn(`[Interpreter] Check ${index}: Contained=${isContained}`); 

             if (isContained) {
               const errorMsg = 'PATH_VIOLATION_BOUNDING_BOX: Camera position enters object bounds';
               this.logger.warn(`[Interpreter] Validation failed: ${errorMsg} at command ${index}`);
               return {
                 isValid: false,
                 errors: [errorMsg]
               };
             }
         } catch (checkError) {
             this.logger.error(`[Interpreter] Error during containsPoint check for command ${index}:`, checkError);
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