import * as THREE from 'three';
import { Vector3, Quaternion } from 'three';
import { CameraCommand } from '@/types/p2p/scene-interpreter';
import { PrimitiveStep } from '@/lib/motion-planning/types';
import { Logger } from '@/types/p2p/shared';
import { easingFunctions, EasingFunctionName, DEFAULT_EASING } from '@/lib/easing';
// NOTE: Pan doesn't seem to use the imported utils like resolveTargetPosition etc.

/**
 * Handles the interpretation of a 'pan' motion step.
 * Calculates the new camera target based on horizontal rotation.
 *
 * @param step The pan primitive step.
 * @param currentPosition Current camera position.
 * @param currentTarget Current camera target.
 * @param stepDuration Calculated duration for this step.
 * @param logger Logger instance.
 * @returns An array of CameraCommands for the pan operation.
 */
export function handlePanStep(
    step: PrimitiveStep,
    currentPosition: Vector3,
    currentTarget: Vector3,
    stepDuration: number,
    logger: Logger
): CameraCommand[] {
    const commandsList: CameraCommand[] = [];

    // --- Start Pan Logic (Moved from interpreter.ts) ---
    const {
        direction: rawDirection,
        angle: rawAngle,
        easing: rawEasingName = DEFAULT_EASING,
        speed: rawSpeed = 'medium'
    } = step.parameters;

    // Validate parameters
    const direction = typeof rawDirection === 'string' && (rawDirection === 'left' || rawDirection === 'right') ? rawDirection : null;
    const angle = typeof rawAngle === 'number' && rawAngle !== 0 ? rawAngle : null;
    const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING;
    const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium';

    if (!direction) {
        logger.error(`Invalid or missing pan direction: ${rawDirection}. Skipping step.`);
        return [];
    }
    if (angle === null) {
        logger.error(`Invalid, missing, or zero pan angle: ${rawAngle}. Skipping step.`);
        return [];
    }

    // 1. Determine rotation axis (Camera's local UP)
    const viewDirection = new Vector3().subVectors(currentTarget, currentPosition).normalize();
    let cameraUp = new Vector3(0, 1, 0);
    if (Math.abs(viewDirection.y) > 0.999) { 
        const forwardXZ = new Vector3(viewDirection.x, 0, viewDirection.z).normalize();
        const cameraRight = new Vector3().crossVectors(new Vector3(0, 1, 0), forwardXZ).normalize();
        if (cameraRight.lengthSq() > 1e-9) { // Check if right is valid before using it
            cameraUp.crossVectors(forwardXZ, cameraRight).normalize(); 
        } // else cameraUp remains (0,1,0) - fallback for pure vertical view
    } else {
        const cameraRight = new Vector3().crossVectors(new Vector3(0, 1, 0), viewDirection).normalize();
        if (cameraRight.lengthSq() > 1e-9) { // Check if right is valid
             cameraUp.crossVectors(viewDirection, cameraRight).normalize();
        } // else cameraUp remains (0,1,0) - fallback if right is invalid
    }
    logger.debug(`Pan using camera local up axis: ${cameraUp.toArray()}`);

    // 2. Calculate rotation
    const angleRad = THREE.MathUtils.degToRad(angle) * (direction === 'left' ? 1 : -1);
    const quaternion = new Quaternion().setFromAxisAngle(cameraUp, angleRad);

    // 3. Rotate the target point around the camera position
    const targetVector = new Vector3().subVectors(currentTarget, currentPosition);
    targetVector.applyQuaternion(quaternion);
    const newTarget = new Vector3().addVectors(currentPosition, targetVector);

    // Determine effective easing based on speed
    let effectiveEasingName = easingName;
    if (speed === 'very_fast') effectiveEasingName = 'linear';
    else if (speed === 'fast') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeOutQuad' : easingName;
    else if (speed === 'slow') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeInOutQuad' : easingName;

    // 4. Create CameraCommand 
    commandsList.push({
        position: currentPosition.clone(),
        target: currentTarget.clone(),
        duration: 0,
        easing: effectiveEasingName
    });
    commandsList.push({
        position: currentPosition.clone(), // Position does not change
        target: newTarget.clone(),
        duration: stepDuration > 0 ? stepDuration : 0.1,
        easing: effectiveEasingName
    });

    logger.debug('Generated pan commands:', commandsList);
    return commandsList;
    // --- End Pan Logic ---
} 