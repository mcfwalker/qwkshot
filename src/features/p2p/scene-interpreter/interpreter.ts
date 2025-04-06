import { Camera } from 'three';
import {
  SceneInterpreter,
  SceneInterpreterConfig,
  CameraCommand,
} from '@/types/p2p/scene-interpreter';
import { CameraPath } from '@/types/p2p/llm-engine';
import { ValidationResult, PerformanceMetrics } from '@/types/p2p/shared';
import * as THREE from 'three'; // Import THREE namespace for easing functions potentially
import { CatmullRomCurve3, Vector3 } from 'three'; // Explicitly import CatmullRomCurve3 and Vector3

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
const easingFunctions = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  // Add more easing functions as needed from libraries like tween.js or implement custom ones
};

type EasingFunctionName = keyof typeof easingFunctions;

class CoreSceneInterpreter implements SceneInterpreter {
  private config: SceneInterpreterConfig | null = null;

  async initialize(config: SceneInterpreterConfig): Promise<void> {
    logger.info('Initializing SceneInterpreter with config:', config);
    this.config = config;
    // TODO: Add actual initialization logic
    return Promise.resolve();
  }

  private validateInputPath(path: CameraPath): ValidationResult {
    logger.debug('Validating input path...');
    const errors: string[] = [];
    
    if (!this.config) {
      return { isValid: false, errors: ['Interpreter not initialized'] };
    }

    if (!path || !Array.isArray(path.keyframes)) {
        return { isValid: false, errors: ['Invalid path or keyframes structure'] };
    }

    if (path.keyframes.length === 0) {
        errors.push('Input path has no keyframes.');
        // No point doing further checks if empty
        return { isValid: false, errors }; 
    }

    if (path.keyframes.length > this.config.maxKeyframes) {
        errors.push(`Path exceeds max keyframes (${path.keyframes.length} > ${this.config.maxKeyframes}).`);
    }

    let totalKeyframeDuration = 0;
    let previousKfPosition: THREE.Vector3 | null = null; 
    let previousKfTarget: THREE.Vector3 | null = null; // Track previous target
    
    path.keyframes.forEach((kf, index) => {
        let currentKfHasError = false; // Flag to avoid cascading errors if basic props are bad

        // --- Basic Keyframe Property Checks ---
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
        
        // Accumulate duration if valid
        if (!currentKfHasError && kf.duration > 0) {
             totalKeyframeDuration += kf.duration;
        }

        // Skip further checks for this keyframe if basic properties are invalid
        if (currentKfHasError) {
          // Set previousKfPosition to null to prevent velocity check on the *next* iteration
          previousKfPosition = null; 
          return; // Go to next keyframe
        }

        // --- Basic Safety Checks (Using path.metadata.safetyConstraints) ---
        const constraints = path.metadata?.safetyConstraints;
        if (!constraints) {
            // Warning logged once outside the loop if needed
        } else {
            // Check height bounds
            if (kf.position.y < constraints.minHeight || kf.position.y > constraints.maxHeight) {
                errors.push(`Keyframe ${index}: Position y (${kf.position.y.toFixed(2)}) outside height bounds [${constraints.minHeight}, ${constraints.maxHeight}].`);
            }
            // Check distance from origin
            const distanceFromOrigin = kf.position.length();
            if (distanceFromOrigin < constraints.minDistance || distanceFromOrigin > constraints.maxDistance) {
                errors.push(`Keyframe ${index}: Position distance (${distanceFromOrigin.toFixed(2)}) outside bounds [${constraints.minDistance}, ${constraints.maxDistance}].`);
            }
            // Check restrictedZones
            if (constraints.restrictedZones && Array.isArray(constraints.restrictedZones)) {
              for (const zone of constraints.restrictedZones) {
                // Assuming zone is a THREE.Box3 object
                if (zone instanceof THREE.Box3 && zone.containsPoint(kf.position)) {
                  errors.push(`Keyframe ${index}: Position (${kf.position.x.toFixed(2)}, ${kf.position.y.toFixed(2)}, ${kf.position.z.toFixed(2)}) is inside a restricted zone.`);
                  // Optionally break if one violation is enough per keyframe
                  // break; 
                }
              }
            }
            
            // TODO: Check restrictedAngles: Calculate viewing angle relative to some axis/object and check against constraints.restrictedAngles?
        }

        // --- Velocity & Angular Velocity Checks (Requires valid previous keyframe) ---
        if (previousKfPosition && previousKfTarget && constraints && kf.duration > 0) {
            // Linear Velocity
            if (constraints.maxSpeed !== undefined) {
                const distance = kf.position.distanceTo(previousKfPosition);
                const speed = distance / kf.duration;
                if (speed > constraints.maxSpeed) {
                    errors.push(`Segment ${index-1}-${index}: Calculated speed (${speed.toFixed(2)}) exceeds maxSpeed (${constraints.maxSpeed}). Dist: ${distance.toFixed(2)}, Dur: ${kf.duration.toFixed(2)}`);
                }
            }
            // Angular Velocity (simplified check based on target change)
            if (constraints.maxAngularVelocity !== undefined) {
                const vecToPrevTarget = new THREE.Vector3().subVectors(previousKfTarget, previousKfPosition).normalize();
                const vecToCurrTarget = new THREE.Vector3().subVectors(kf.target, kf.position).normalize();
                // Calculate angle change in radians
                const angleChange = vecToPrevTarget.angleTo(vecToCurrTarget);
                const angularSpeed = angleChange / kf.duration; // radians per second
                // Convert maxAngularVelocity (assuming degrees/sec) to radians/sec
                const maxAngularSpeedRad = THREE.MathUtils.degToRad(constraints.maxAngularVelocity);
                if (angularSpeed > maxAngularSpeedRad) {
                    errors.push(`Segment ${index-1}-${index}: Calculated angular speed (${(angularSpeed * 180 / Math.PI).toFixed(1)} deg/s) exceeds max (${constraints.maxAngularVelocity} deg/s). Angle change: ${(angleChange * 180 / Math.PI).toFixed(1)} deg`);
                }
            }
        }

        // Update previous position and target for next iteration's checks
        previousKfPosition = kf.position; 
        previousKfTarget = kf.target;

    }); // End of forEach loop

    // Check if constraints were missing (log once after loop)
    if (!path.metadata?.safetyConstraints) {
      logger.warn('No safety constraints found in path metadata. Some safety checks skipped.');
    }

    // Check total duration match (allow for small floating point discrepancies)
    if (Math.abs(totalKeyframeDuration - path.duration) > 0.01) {
        errors.push(`Sum of keyframe durations (${totalKeyframeDuration.toFixed(2)}s) does not match overall path duration (${path.duration.toFixed(2)}s).`);
    }
    
    const isValid = errors.length === 0;
    if (!isValid) {
        logger.warn('Input path validation failed:', errors);
    }
    return { isValid, errors };
  }

  interpretPath(path: CameraPath): CameraCommand[] {
    logger.info('Interpreting path:', path);
    if (!this.config) {
        logger.error('Interpreter not initialized');
        throw new Error('Interpreter not initialized');
    }

    const validation = this.validateInputPath(path);
    if (!validation.isValid) {
      logger.error('Path interpretation failed due to invalid input path:', validation.errors);
      return [];
    }

    const interpolationMethod = this.config.interpolationMethod;
    const smoothingFactor = this.config.smoothingFactor; // TODO: Use this factor
    logger.debug(`Processing path with interpolation: ${interpolationMethod}, smoothingFactor: ${smoothingFactor}`);

    const commands: CameraCommand[] = [];
    const keyframes = path.keyframes;

    if (interpolationMethod === 'smooth') {
        logger.info('Applying Catmull-Rom smoothing...');

        if (keyframes.length < 2) {
            logger.warn('Need at least 2 keyframes for smoothing. Falling back to linear.');
             for (const kf of keyframes) {
                 commands.push({
                     position: kf.position,
                     target: kf.target,
                     duration: kf.duration,
                     easing: easingFunctions.linear
                 });
             }
             return commands;
        }

        const positions = keyframes.map(kf => kf.position);
        const positionCurve = new THREE.CatmullRomCurve3(positions, false, 'catmullrom'); 

        // Determine number of points per segment based on smoothingFactor
        // Assuming smoothingFactor is roughly 0 (less smooth) to 1 (more smooth)
        // Map to a range like 2 to 10 points per original segment.
        const minPoints = 2;
        const maxPoints = 10;
        const pointsPerSegment = Math.max(minPoints, Math.round(minPoints + (this.config.smoothingFactor ?? 0.5) * (maxPoints - minPoints)));
        logger.debug(`Using ${pointsPerSegment} points per segment based on smoothingFactor ${this.config.smoothingFactor?.toFixed(2)}`);

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
            const localProgressStart = Math.max(0, Math.min(1, kf1.duration > 0 ? (segmentStartTime - accumulatedDuration) / kf1.duration : 0)); // Avoid division by zero

            const interpolatedTarget = new THREE.Vector3().lerpVectors(kf1.target, kf2.target, localProgressStart);

            // Determine easing for this small segment
            let segmentEasing = easingFunctions.linear; // Default to linear between curve points
            if (i === 0) {
                // Ease out for the very first segment of the smoothed path
                segmentEasing = easingFunctions.easeOutQuad;
                logger.debug('Applying easeOutQuad to first smoothed segment');
            }
            // Note: Easing for the *last* segment needs to be applied when creating the final command below

            if (segmentDuration > 1e-6) { 
                commands.push({
                    position: curvePoints[i],
                    target: interpolatedTarget, 
                    duration: segmentDuration,
                    easing: segmentEasing // Use calculated easing
                });
            }
        }

         const lastKf = keyframes[keyframes.length - 1];
         const lastCurvePoint = curvePoints[curvePoints.length - 1];
         const secondLastSegmentEndTime = curvePoints.length > 1 ? ((curvePoints.length - 2) / (totalGeneratedPoints - 1)) * path.duration : 0;
         const finalSegmentDuration = path.duration - secondLastSegmentEndTime;

         if (finalSegmentDuration > 1e-6) { 
             commands.push({
                 position: lastCurvePoint, 
                 target: lastKf.target,   
                 duration: finalSegmentDuration,
                 // Ease in for the very last segment of the smoothed path
                 easing: easingFunctions.easeInQuad
             });
             logger.debug('Applying easeInQuad to final smoothed segment');
         } else if (commands.length === 0 && keyframes.length === 1) {
             commands.push({
                  position: keyframes[0].position,
                  target: keyframes[0].target,
                  duration: keyframes[0].duration,
                  easing: easingFunctions.linear
             });
         }

    } else {
      // --- Linear or Ease Interpolation (Original Logic) ---
      for (let i = 0; i < keyframes.length; i++) {
          const kf = keyframes[i];
          let easingFunction: ((t: number) => number) | undefined = undefined;

          if (interpolationMethod === 'ease') {
             // Apply easing based on position in sequence for non-smoothed paths too?
             if (i === 0 && keyframes.length > 1) {
                 easingFunction = easingFunctions.easeOutQuad;
             } else if (i === keyframes.length - 1 && keyframes.length > 1) {
                 easingFunction = easingFunctions.easeInQuad;
             } else if (keyframes.length === 1) {
                  easingFunction = easingFunctions.linear; // Single keyframe, just linear?
             } else {
                 easingFunction = easingFunctions.easeInOutQuad; // Default for middle segments
             }
              logger.debug(`Applying ${easingFunction.name} easing for keyframe ${i}`);
          } else { // linear
              easingFunction = easingFunctions.linear;
          }

          commands.push({
              position: kf.position,
              target: kf.target,
              duration: kf.duration,
              easing: easingFunction
          });
      }
    }

    logger.info(`Interpretation complete. Generated ${commands.length} commands.`);
    // TODO: Add final command validation step here?
    return commands;
  }

  async executeCommand(camera: Camera, command: CameraCommand): Promise<void> {
    logger.info('Executing command:', command);
    // TODO: Implement single command execution (or remove if Viewer handles execution)
    console.warn('executeCommand is not implemented!');
    return Promise.resolve();
  }

  async executeCommands(camera: Camera, commands: CameraCommand[]): Promise<void> {
    logger.info(`Executing ${commands.length} commands.`);
    // TODO: Implement command sequence execution (or remove)
    for (const command of commands) {
        await this.executeCommand(camera, command);
    }
    return Promise.resolve();
  }

  validateCommands(commands: CameraCommand[]): ValidationResult {
    logger.info(`Validating ${commands.length} generated commands.`);
    const errors: string[] = [];

    if (!commands || commands.length === 0) {
      // Not necessarily an error, but worth noting or handling based on requirements
      logger.warn('Command list is empty, nothing to validate.');
      return { isValid: true, errors: [] }; // Valid but empty
    }
    
    // Re-fetch constraints if needed, assuming they might be relevant for command validation
    // This depends on what checks we want to perform here vs. in validateInputPath
    // const constraints = this.config ? path.metadata?.safetyConstraints : null; 
    // ^ Need access to the original path metadata or pass constraints differently

    let previousCommandPosition: THREE.Vector3 | null = null;
    let previousCommandTarget: THREE.Vector3 | null = null;
    let totalCommandDuration = 0;

    commands.forEach((cmd, index) => {
      let currentCmdHasError = false;

      // Check duration
      if (typeof cmd.duration !== 'number' || cmd.duration <= 0) {
        errors.push(`Command ${index}: Invalid or non-positive duration (${cmd.duration}).`);
        currentCmdHasError = true;
      }
      // Check position
      if (!isFiniteVector(cmd.position)) {
        errors.push(`Command ${index}: Invalid or non-finite position vector.`);
        currentCmdHasError = true;
      }
      // Check target
      if (!isFiniteVector(cmd.target)) {
        errors.push(`Command ${index}: Invalid or non-finite target vector.`);
        currentCmdHasError = true;
      }
      // Check easing function (basic check)
      if (cmd.easing && typeof cmd.easing !== 'function') {
           errors.push(`Command ${index}: Invalid easing function type.`);
           currentCmdHasError = true;
      }

      // Accumulate duration if valid
      if (!currentCmdHasError) {
        totalCommandDuration += cmd.duration;
      }

      // --- Optional: Re-run velocity checks on generated commands --- 
      // Requires access to safety constraints (e.g., maxSpeed, maxAngularVelocity)
      // if (previousCommandPosition && previousCommandTarget && constraints && !currentCmdHasError) {
      //    // Re-calculate speed and angular speed between command[index] and command[index-1]
      //    // Add errors if constraints are violated
      // }

      // Update previous command state if current one is valid
      if (!currentCmdHasError) {
        previousCommandPosition = cmd.position;
        previousCommandTarget = cmd.target;
      } else {
        // Prevent checks against invalid previous command
        previousCommandPosition = null;
        previousCommandTarget = null;
      }
    });

    // TODO: Check if totalCommandDuration matches the original path duration?
    // Need original path duration here.

    const isValid = errors.length === 0;
    if (!isValid) {
        logger.warn('Generated command validation failed:', errors);
    }
    return { isValid, errors }; 
  }

  getPerformanceMetrics(): PerformanceMetrics {
    logger.info('Getting performance metrics');
    // TODO: Implement actual performance tracking
    return {
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 0,
        operations: [],
        cacheHits: 0,
        cacheMisses: 0,
        databaseQueries: 0,
        averageResponseTime: 0
       }; // Placeholder
  }
}

// Factory function or instance export
let interpreterInstance: SceneInterpreter | null = null;

export function getSceneInterpreter(): SceneInterpreter {
    if (!interpreterInstance) {
        // Basic instantiation - might need refinement
        interpreterInstance = new CoreSceneInterpreter();
    }
    return interpreterInstance;
} 