import { Vector3 } from 'three';
import { CameraCommand } from '@/types/p2p/scene-interpreter';
import { PrimitiveStep } from '@/lib/motion-planning/types';
import { Logger } from '@/types/p2p/shared';

/**
 * Handles the interpretation of a 'static' motion step.
 * Generates a command to hold the camera at its current position and target.
 *
 * @param step The static primitive step.
 * @param currentPosition The camera position at the start of the step.
 * @param currentTarget The camera target at the start of the step.
 * @param stepDuration The calculated duration for this step.
 * @param logger A logger instance.
 * @returns An array containing a single CameraCommand for the static hold.
 */
export function handleStaticStep(
    step: PrimitiveStep, // Although parameters are unused, keep for consistent signature
    currentPosition: Vector3,
    currentTarget: Vector3,
    stepDuration: number,
    logger: Logger
): CameraCommand[] {

    // Static hold: Position and Target remain the same.
    // Use the calculated step duration, ensuring a minimum if it was zero.
    const command: CameraCommand = {
        position: currentPosition.clone(),
        target: currentTarget.clone(),
        duration: stepDuration > 0 ? stepDuration : 0.1, // Use calculated duration or small default
        easing: 'linear' // Static hold should always be linear
    };

    logger.debug('Generated static command:', command);
    return [command];
} 