import * as THREE from 'three';
import { Vector3, Quaternion } from 'three';
import { CameraCommand } from '@/types/p2p/scene-interpreter';
import { PrimitiveStep } from '@/lib/motion-planning/types';
import { Logger } from '@/types/p2p/shared';
import { easingFunctions, EasingFunctionName, DEFAULT_EASING } from '@/lib/easing';
// NOTE: Rotate uses mostly THREE utils, no custom utils needed

/**
 * Handles the interpretation of a 'rotate' motion step.
 * Calculates the new camera target based on yaw, pitch, or roll rotation.
 *
 * @returns An array of CameraCommands for the rotate operation.
 */
export function handleRotateStep(
    step: PrimitiveStep,
    currentPosition: Vector3,
    currentTarget: Vector3,
    stepDuration: number,
    logger: Logger
): CameraCommand[] {
    const commandsList: CameraCommand[] = [];

    // --- Start Rotate Logic (Moved from interpreter.ts) ---
    const {
        axis: rawAxisName = 'yaw',
        angle: rawAngle,
        speed: rawSpeed = 'medium',
        easing: rawEasingName = DEFAULT_EASING
    } = step.parameters;

    // Validate parameters
    let axis: 'yaw' | 'pitch' | 'roll' = 'yaw'; // Default
    const lowerAxisName = typeof rawAxisName === 'string' ? rawAxisName.toLowerCase() : 'yaw';
    if (lowerAxisName === 'pitch') axis = 'pitch';
    else if (lowerAxisName === 'roll') axis = 'roll';
    else if (lowerAxisName !== 'yaw') {
        logger.warn(`Rotate: Invalid axis '${rawAxisName}', defaulting to 'yaw'.`);
    }

    const angle = typeof rawAngle === 'number' && rawAngle !== 0 ? rawAngle : null;
    const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING;
    const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium';

    if (angle === null) {
        logger.error(`Rotate: Invalid, missing, or zero angle: ${rawAngle}. Skipping.`);
        return [];
    }

    // Handle unimplemented roll
    if (axis === 'roll') {
        logger.warn('Rotate: \'roll\' axis is not fully implemented visually. Generating static hold.');
        if (stepDuration > 0) {
            commandsList.push({
                position: currentPosition.clone(),
                target: currentTarget.clone(),
                duration: stepDuration,
                easing: 'linear'
            });
        }
        return commandsList;
    }

    // Calculate rotation axis (Camera Up for Yaw, Camera Right for Pitch)
    const viewDirection = new Vector3().subVectors(currentTarget, currentPosition).normalize();
    const worldUp = new Vector3(0, 1, 0);
    let cameraUp = new Vector3(0, 1, 0);
    let cameraRight = new Vector3(1, 0, 0); // Default fallback

    if (Math.abs(viewDirection.y) > 0.999) { // Looking straight up/down
        logger.warn('Rotate: View aligned with world up. Using fallback axes.');
        // Use world X for right if looking vertical
        cameraRight.set(1, 0, 0);
        // Calculate local up based on view and world right
        cameraUp.crossVectors(cameraRight, viewDirection).normalize();
    } else {
        // Standard case
        cameraRight.crossVectors(worldUp, viewDirection).normalize();
        // Recalculate actual up vector based on view and right
        cameraUp.crossVectors(cameraRight, viewDirection).normalize();
    }

    let rotationAxis: Vector3;
    if (axis === 'yaw') {
        rotationAxis = cameraUp; // Yaw rotates around the camera's local up axis
        logger.debug(`Rotate (yaw) using axis: ${rotationAxis.toArray()}`);
    } else { // Pitch
        rotationAxis = cameraRight; // Pitch rotates around the camera's local right axis
        logger.debug(`Rotate (pitch) using axis: ${rotationAxis.toArray()}`);
    }

    // Calculate rotation
    const angleRad = THREE.MathUtils.degToRad(angle);
    const quaternion = new Quaternion().setFromAxisAngle(rotationAxis, angleRad);

    // Rotate the target point around the camera position
    const targetVector = new Vector3().subVectors(currentTarget, currentPosition);
    targetVector.applyQuaternion(quaternion);
    const newTarget = new Vector3().addVectors(currentPosition, targetVector);

    // Easing
    let effectiveEasingName = easingName;
    if (speed === 'very_fast') effectiveEasingName = 'linear';
    else if (speed === 'fast') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeOutQuad' : easingName;
    else if (speed === 'slow') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeInOutQuad' : easingName;

    // Commands
    commandsList.push({
        position: currentPosition.clone(),
        target: currentTarget.clone(),
        duration: 0,
        easing: effectiveEasingName
    });
    commandsList.push({
        position: currentPosition.clone(),
        target: newTarget.clone(),
        duration: stepDuration > 0 ? stepDuration : 0.1,
        easing: effectiveEasingName
    });

    logger.debug(`Generated rotate (${axis}) commands:`, commandsList);
    return commandsList;
    // --- End Rotate Logic ---
} 