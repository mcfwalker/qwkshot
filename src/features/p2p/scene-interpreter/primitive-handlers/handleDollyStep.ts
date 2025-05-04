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
    clampPositionWithRaycast,
    mapDescriptorToValue,
    mapDescriptorToGoalDistance,
    normalizeDescriptor
} from '../interpreter-utils';

/**
 * Handles the interpretation of a 'dolly' motion step.
 * Moves the camera position along its view vector.
 *
 * @returns An array of CameraCommands for the dolly operation.
 */
export function handleDollyStep(
    step: PrimitiveStep,
    currentPosition: Vector3,
    currentTarget: Vector3,
    stepDuration: number,
    sceneAnalysis: SceneAnalysis,
    envAnalysis: EnvironmentalAnalysis,
    logger: Logger
): CameraCommand[] {
    const commandsList: CameraCommand[] = [];

    // --- Start Dolly Logic (Moved from interpreter.ts) ---
    const {
        direction: rawDirection,
        distance_descriptor: rawDistanceDescriptor,
        distance_override: rawDistanceOverride,
        destination_target: rawDestinationTargetName,
        target_distance_descriptor: rawGoalDistanceDescriptor,
        easing: rawEasingName = DEFAULT_EASING,
        speed: rawSpeed = 'medium'
    } = step.parameters;

    let direction: string | null = null;
    let effectiveDistance: number | null = null;
    let isDestinationMove = false;

    // Priority 1: Goal Distance Descriptor
    const goalDistanceDescriptor = normalizeDescriptor(rawGoalDistanceDescriptor);
    if (goalDistanceDescriptor) {
        const currentDistanceToTarget = currentPosition.distanceTo(currentTarget);
        const goalDistance = mapDescriptorToGoalDistance(goalDistanceDescriptor, sceneAnalysis, logger);
        const delta = currentDistanceToTarget - goalDistance;
        if (Math.abs(delta) < 1e-6) {
            logger.debug(`Dolly: Already at goal distance. Static command.`);
            commandsList.push({ position: currentPosition.clone(), target: currentTarget.clone(), duration: stepDuration > 0 ? stepDuration : 0.1, easing: 'linear' });
            return commandsList;
        }
        direction = delta > 0 ? 'forward' : 'backward';
        effectiveDistance = Math.abs(delta);
        logger.debug(`Dolly: Goal descriptor '${goalDistanceDescriptor}' -> effectiveDistance=${effectiveDistance.toFixed(3)}, direction='${direction}'`);
    }

    // Priority 2: Destination Target (only if goal descriptor wasn't used)
    const destinationTargetName = typeof rawDestinationTargetName === 'string' ? rawDestinationTargetName : null;
    if (effectiveDistance === null && destinationTargetName) {
        logger.debug(`Dolly: Destination target '${destinationTargetName}'. Calculating distance/direction.`);
        const destinationTarget = resolveTargetPosition(destinationTargetName, sceneAnalysis, envAnalysis, currentTarget, logger);
        if (destinationTarget) {
            const viewDirectionVec = new Vector3().subVectors(currentTarget, currentPosition).normalize();
            if (viewDirectionVec.lengthSq() >= 1e-9) {
                const displacementVector = new Vector3().subVectors(destinationTarget, currentPosition);
                const signedDistance = displacementVector.dot(viewDirectionVec);
                direction = signedDistance >= 0 ? 'forward' : 'backward';
                effectiveDistance = Math.abs(signedDistance);
                isDestinationMove = true;
                logger.debug(`Dolly: Calculated destination move: direction='${direction}', distance=${effectiveDistance.toFixed(2)}`);
            } else {
                logger.warn('Dolly: Cannot calculate view direction for destination move.');
            }
        } else {
            logger.warn(`Dolly: Could not resolve destination target '${destinationTargetName}'.`);
        }
    }

    // Set Direction if not already set by goal/destination logic
    if (!direction) {
        let assistantDirection = typeof rawDirection === 'string' ? rawDirection.toLowerCase() : null;
        if (assistantDirection === 'in') assistantDirection = 'forward';
        if (assistantDirection === 'out') assistantDirection = 'backward';
        if (assistantDirection === 'forward' || assistantDirection === 'backward') {
            direction = assistantDirection;
        } else {
            logger.error(`Invalid or missing dolly direction: ${rawDirection}. Skipping.`);
            return [];
        }
    }

    // Determine Effective Distance if not set by goal/destination logic
    if (effectiveDistance === null) {
        // Priority 3: Numeric Override
        if (typeof rawDistanceOverride === 'number' && rawDistanceOverride > 0) {
            effectiveDistance = rawDistanceOverride;
            logger.debug(`Dolly: Using distance_override: ${effectiveDistance}`);
        } else {
            // Priority 4: Distance Descriptor
            const distanceDescriptor = normalizeDescriptor(rawDistanceDescriptor);
            if (distanceDescriptor) {
                effectiveDistance = mapDescriptorToValue(
                    distanceDescriptor, 'distance', 'dolly',
                    sceneAnalysis, envAnalysis,
                    { position: currentPosition, target: currentTarget },
                    logger
                );
                logger.debug(`Dolly: Mapped distance_descriptor '${distanceDescriptor}' to distance: ${effectiveDistance}`);
            } else {
                logger.error(`Dolly: No valid distance found (no goal, dest, override, or descriptor). Skipping.`);
                return [];
            }
        }
    }

    // Final Validation & Movement Calc
    if (effectiveDistance === null || effectiveDistance < 0) {
        logger.error(`Dolly: Final effective distance invalid (${effectiveDistance}). Skipping.`);
        return [];
    }
    if (effectiveDistance < 1e-6) {
        logger.debug('Dolly: Effective distance is zero. Static command.');
        commandsList.push({ position: currentPosition.clone(), target: currentTarget.clone(), duration: stepDuration > 0 ? stepDuration : 0.1, easing: 'linear' });
        return commandsList;
    }

    const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING;
    const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium';

    const viewDirection = new Vector3().subVectors(currentTarget, currentPosition).normalize();
    if (viewDirection.lengthSq() < 1e-9) { // Avoid issues if target equals position
        logger.warn("Dolly: Cannot determine view direction (target equals position). Skipping step.");
        return [];
    }
    const moveVector = viewDirection.multiplyScalar(effectiveDistance * (direction === 'forward' ? 1 : -1));
    const newPositionCandidate = new Vector3().addVectors(currentPosition, moveVector);
    let finalPosition = newPositionCandidate.clone();
    let clamped = false;

    // Constraints
    const { cameraConstraints } = envAnalysis;
    const { spatial } = sceneAnalysis;
    if (cameraConstraints) {
        if (finalPosition.y < cameraConstraints.minHeight) { finalPosition.y = cameraConstraints.minHeight; clamped = true; logger.warn(`Dolly: Clamped pos to minHeight`); }
        if (finalPosition.y > cameraConstraints.maxHeight) { finalPosition.y = cameraConstraints.maxHeight; clamped = true; logger.warn(`Dolly: Clamped pos to maxHeight`); }
        const distanceToTarget = finalPosition.distanceTo(currentTarget);
        if (distanceToTarget < cameraConstraints.minDistance) {
            const dir = new Vector3().subVectors(finalPosition, currentTarget).normalize();
            finalPosition.copy(currentTarget).addScaledVector(dir, cameraConstraints.minDistance);
            clamped = true; logger.warn(`Dolly: Clamped pos to minDistance`);
        }
        if (distanceToTarget > cameraConstraints.maxDistance) {
            const dir = new Vector3().subVectors(finalPosition, currentTarget).normalize();
            finalPosition.copy(currentTarget).addScaledVector(dir, cameraConstraints.maxDistance);
            clamped = true; logger.warn(`Dolly: Clamped pos to maxDistance`);
        }
    }
    if (spatial?.bounds) {
        const objectBounds = new Box3(spatial.bounds.min, spatial.bounds.max);
        const clampedPosition = clampPositionWithRaycast(
            currentPosition, newPositionCandidate, objectBounds,
            envAnalysis.userVerticalAdjustment ?? 0, logger
        );
        if (!clampedPosition.equals(newPositionCandidate)) {
            finalPosition.copy(clampedPosition); clamped = true;
        }
    }

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
        position: finalPosition.clone(),
        target: currentTarget.clone(), // Target doesn't change
        duration: stepDuration > 0 ? stepDuration : 0.1,
        easing: effectiveEasingName
    });

    logger.debug('Generated dolly commands:', commandsList);
    return commandsList;
    // --- End Dolly Logic ---
} 