import * as THREE from 'three';
import { Vector3, Quaternion } from 'three';
import { CameraCommand } from '@/types/p2p/scene-interpreter';
import { PrimitiveStep } from '@/lib/motion-planning/types';
import { SceneAnalysis } from '@/types/p2p/scene-analyzer';
import { EnvironmentalAnalysis } from '@/types/p2p/environmental-analyzer';
import { Logger } from '@/types/p2p/shared';
import { easingFunctions, EasingFunctionName, DEFAULT_EASING } from '@/lib/easing';
import {
    resolveTargetPosition,
    // Pan/Tilt primarily uses THREE utils, maybe resolveTargetPosition for explicit targets
} from '../interpreter-utils';

/**
 * Handles the interpretation of a 'tilt' motion step.
 * Calculates the new camera target based on vertical rotation or resolves an absolute target.
 *
 * @param step The tilt primitive step.
 * @param currentPosition Current camera position.
 * @param currentTarget Current camera target.
 * @param stepDuration Calculated duration for this step.
 * @param sceneAnalysis Scene context.
 * @param envAnalysis Environmental context.
 * @param logger Logger instance.
 * @returns An array of CameraCommands for the tilt operation.
 */
export function handleTiltStep(
    step: PrimitiveStep,
    currentPosition: Vector3,
    currentTarget: Vector3,
    stepDuration: number,
    sceneAnalysis: SceneAnalysis,
    envAnalysis: EnvironmentalAnalysis,
    logger: Logger
): CameraCommand[] {
    const commandsList: CameraCommand[] = [];

    // --- Start Tilt Logic (Moved from interpreter.ts) ---
    const {
        direction: rawDirection,
        angle: rawAngle,
        target: rawTargetName, // Allow explicit target for tilt
        easing: rawEasingName = DEFAULT_EASING,
        speed: rawSpeed = 'medium'
    } = step.parameters;

    // Validate direction (required for relative tilt)
    const direction = typeof rawDirection === 'string' && (rawDirection === 'up' || rawDirection === 'down') ? rawDirection : null;
    // Angle is required *only* if no explicit target is given
    const angle = typeof rawAngle === 'number' && rawAngle !== 0 ? rawAngle : null;
    // Target is optional
    const targetName = typeof rawTargetName === 'string' ? rawTargetName : null;
    // Easing/Speed
    const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING;
    const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium';

    // Capture the target state *before* this step begins
    const initialTarget = currentTarget.clone();

    // --- Determine Final Target --- 
    let finalTarget: Vector3;
    let isAbsoluteTarget = false;

    if (targetName) {
        // An explicit target was specified - resolve it
        const resolvedExplicitTarget = resolveTargetPosition(
            targetName, sceneAnalysis, envAnalysis, initialTarget, logger
        );
        if (resolvedExplicitTarget) {
            finalTarget = resolvedExplicitTarget.clone();
            logger.debug(`Tilt: Using explicitly provided target '${targetName}' resolved to ${finalTarget.toArray()}`);
            isAbsoluteTarget = true;
            if (angle) {
                logger.warn(`Tilt: Explicit target '${targetName}' provided, ignoring angle parameter (${angle} degrees).`);
            }
        } else {
            logger.error(`Tilt: Could not resolve explicit target '${targetName}'. Skipping step.`);
            return []; // Cannot proceed without a valid target
        }
    } else {
        // No explicit target - perform a relative tilt by angle
        if (!direction) {
            logger.error(`Tilt: Missing direction for relative tilt. Skipping step.`);
            return [];
        }
        if (angle === null) {
            logger.error(`Tilt: Missing angle for relative tilt. Skipping step.`);
            return [];
        }
        logger.debug(`Tilt: No explicit target. Performing relative tilt of ${angle} degrees ${direction}.`);
        isAbsoluteTarget = false;
        
        // Calculate rotation axis (Camera's local RIGHT)
        const viewDirection = new Vector3().subVectors(initialTarget, currentPosition).normalize();
        let cameraRight = new Vector3(1, 0, 0); // Default fallback
        if (Math.abs(viewDirection.y) < 0.999) { 
            const worldUp = new Vector3(0, 1, 0);
            cameraRight.crossVectors(worldUp, viewDirection).normalize();
            if (cameraRight.lengthSq() < 1e-9) { 
                logger.warn('Calculated camera right vector is zero. Using world X as fallback axis for tilt.');
                cameraRight.set(1, 0, 0); 
            }                 
        } else {
            logger.warn('Cannot reliably determine camera right vector (looking straight up/down). Using world X as fallback axis for tilt.');
        }
        logger.debug(`Tilt using camera local right axis: ${cameraRight.toArray()}`);
        
        const rotationAxis = cameraRight;
        const angleRad = THREE.MathUtils.degToRad(angle) * (direction === 'up' ? -1 : 1); // Up tilt rotates around -X axis
        const quaternion = new Quaternion().setFromAxisAngle(rotationAxis, angleRad); 
        
        const targetVector = new Vector3().subVectors(initialTarget, currentPosition);
        targetVector.applyQuaternion(quaternion);
        finalTarget = new Vector3().addVectors(currentPosition, targetVector);
    }
    // --- End Determine Final Target ---

    // Determine effective easing based on speed
    let effectiveEasingName = easingName;
    if (speed === 'very_fast') effectiveEasingName = 'linear';
    else if (speed === 'fast') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeOutQuad' : easingName;
    else if (speed === 'slow') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeInOutQuad' : easingName;
    
    // Create CameraCommands
    // If it's an absolute target move, the target blending logic in interpretPath handles the transition.
    // We only generate commands here for a relative angle-based tilt.
    if (!isAbsoluteTarget) {
        logger.debug('Tilt: Generating relative tilt commands.');
        commandsList.push({
            position: currentPosition.clone(),
            target: initialTarget.clone(), // Start from the initial target state for this step
            duration: 0,
            easing: effectiveEasingName
        });
        commandsList.push({
            position: currentPosition.clone(), 
            target: finalTarget.clone(), // End with the calculated final target
            duration: stepDuration > 0 ? stepDuration : 0.1, 
            easing: effectiveEasingName
        });
        logger.debug('Generated relative tilt commands:', commandsList);
    } else {
         logger.debug('Tilt: Absolute target provided. Assuming target blending logic handles the command generation.');
         // If the target blending didn't run (e.g., target was already correct), 
         // ensure at least one command exists to represent the step duration.
         if (stepDuration > 0) {
             commandsList.push({
                 position: currentPosition.clone(),
                 target: finalTarget.clone(), // Hold the target
                 duration: stepDuration,
                 easing: 'linear' // Just holding
             });
         }
    }

    // Return the generated commands (might be empty if absolute target handled by blending)
    // The state update (currentTarget = finalTarget) happens in the main interpretPath loop
    return commandsList;
    // --- End Tilt Logic ---
} 