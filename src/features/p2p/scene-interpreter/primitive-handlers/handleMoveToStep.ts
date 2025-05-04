import * as THREE from 'three';
import { Vector3, Box3 } from 'three';
import { CameraCommand } from '@/types/p2p/scene-interpreter';
import { PrimitiveStep } from '@/lib/motion-planning/types';
import { SceneAnalysis } from '@/types/p2p/scene-analyzer';
import { EnvironmentalAnalysis } from '@/types/p2p/environmental-analyzer';
import { Logger } from '@/types/p2p/shared';
import { easingFunctions, EasingFunctionName, DEFAULT_EASING } from '@/lib/easing';
import {
    resolveTargetPosition,
    clampPositionWithRaycast
} from '../interpreter-utils';

/**
 * Handles the interpretation of a 'move_to' motion step.
 * Moves the camera smoothly or instantly to a specified target location.
 *
 * @returns An array of CameraCommands for the move_to operation.
 */
export function handleMoveToStep(
    step: PrimitiveStep,
    currentPosition: Vector3,
    currentTarget: Vector3,
    stepDuration: number,
    sceneAnalysis: SceneAnalysis,
    envAnalysis: EnvironmentalAnalysis,
    logger: Logger
): CameraCommand[] {
    const commandsList: CameraCommand[] = [];

    // --- Start MoveTo Logic (Moved from interpreter.ts) ---
    const {
        target: rawTargetName,
        speed: rawSpeed = 'medium', // Default to medium
        easing: rawEasingName = DEFAULT_EASING
    } = step.parameters;

    // Validate target
    const targetName = typeof rawTargetName === 'string' ? rawTargetName : null;
    if (!targetName) {
        logger.error(`MoveTo: Missing required target parameter. Skipping step.`);
        return [];
    }

    // Resolve the destination target position
    const destinationPosition = resolveTargetPosition(
        targetName, sceneAnalysis, envAnalysis, currentTarget, logger
    );
    if (!destinationPosition) {
        logger.error(`MoveTo: Could not resolve target position for '${targetName}'. Skipping step.`);
        return [];
    }

    // Validate speed
    const speed = typeof rawSpeed === 'string' && ['instant', 'slow', 'medium', 'fast'].includes(rawSpeed)
        ? rawSpeed
        : 'medium';
    if (rawSpeed !== speed && typeof rawSpeed === 'string') {
        logger.warn(`MoveTo: Invalid speed '${rawSpeed}', defaulting to 'medium'.`);
    }
    const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions)
        ? rawEasingName as EasingFunctionName
        : DEFAULT_EASING;

    // Determine effective easing (ignored for instant)
    let effectiveEasingName = easingName;
    if (speed === 'fast') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeOutQuad' : easingName;
    else if (speed === 'slow') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeInOutQuad' : easingName;

    let finalPosition: Vector3;
    let finalTarget: Vector3;

    if (speed === 'instant') {
        logger.debug(`MoveTo: Generating instant cut to ${destinationPosition.toArray()}`);
        // Instant cut: Determine final state (simple offset for now) and add one command
        // TODO: Improve offset logic - maybe based on object size or maintain current distance?
        const offsetDirection = new Vector3(0, 0.5, 1.5);
        finalPosition = new Vector3().copy(destinationPosition).add(offsetDirection);
        finalTarget = destinationPosition.clone(); // Look directly at the target

        // Apply basic constraints even for instant cut (height mainly)
        const { cameraConstraints } = envAnalysis;
         if (cameraConstraints) {
            if (finalPosition.y < cameraConstraints.minHeight) { finalPosition.y = cameraConstraints.minHeight; logger.warn('MoveTo (Instant): Clamped pos to minHeight'); }
            if (finalPosition.y > cameraConstraints.maxHeight) { finalPosition.y = cameraConstraints.maxHeight; logger.warn('MoveTo (Instant): Clamped pos to maxHeight'); }
            // TODO: Add min/max distance clamping for instant cut?
        }

        commandsList.push({
            position: finalPosition,
            target: finalTarget,
            duration: 0.01, // Very small duration for a cut
            easing: 'linear'
        });
        // State is updated in the main loop based on this command
    } else {
        // Smooth move: Generate start and end commands
        logger.debug(`MoveTo: Generating smooth move to ${destinationPosition.toArray()}`);
        // Determine end state positioning logic (simple offset for now)
        // TODO: Improve offset logic - maybe based on object size or maintain current distance?
        const offsetDirection = new Vector3(0, 0.5, 1.5);
        const endPositionCandidate = new Vector3().copy(destinationPosition).add(offsetDirection);
        const endTargetCandidate = destinationPosition.clone();

        // Apply constraints to the end position candidate
        finalPosition = endPositionCandidate.clone();
        const { cameraConstraints } = envAnalysis;
        const { spatial } = sceneAnalysis;
        let clamped = false;
        if (cameraConstraints) {
            if (finalPosition.y < cameraConstraints.minHeight) { finalPosition.y = cameraConstraints.minHeight; clamped = true; }
            if (finalPosition.y > cameraConstraints.maxHeight) { finalPosition.y = cameraConstraints.maxHeight; clamped = true; }
            // TODO: Add min/max distance checks relative to finalTarget?
        }
        if (spatial?.bounds) {
            const objectBounds = new Box3(spatial.bounds.min, spatial.bounds.max);
            // Use clampPositionWithRaycast for potential collision avoidance along the path
            const clampedPos = clampPositionWithRaycast(
                currentPosition, // Check path from current position
                endPositionCandidate,
                objectBounds,
                envAnalysis.userVerticalAdjustment ?? 0,
                logger
            );
            if (!clampedPos.equals(endPositionCandidate)) {
                finalPosition.copy(clampedPos);
                clamped = true;
            }
        }
        finalTarget = endTargetCandidate.clone();
        if (clamped) logger.warn('MoveTo (Smooth): Final position was clamped by constraints.');

        // Add start command
        commandsList.push({
            position: currentPosition.clone(),
            target: currentTarget.clone(),
            duration: 0,
            easing: effectiveEasingName
        });
        // Add end command
        commandsList.push({
            position: finalPosition.clone(),
            target: finalTarget.clone(),
            duration: stepDuration > 0 ? stepDuration : 1.0, // Use step duration or default 1s
            easing: effectiveEasingName
        });
    }

    logger.debug(`Generated move_to commands:`, commandsList);
    return commandsList;
    // State update happens in the main loop based on last command
    // --- End MoveTo Logic ---
} 