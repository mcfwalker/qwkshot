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
    normalizeDescriptor
} from '../interpreter-utils';

/**
 * Handles the interpretation of a 'pedestal' motion step.
 * Moves the camera position vertically.
 *
 * @returns An array of CameraCommands for the pedestal operation.
 */
export function handlePedestalStep(
    step: PrimitiveStep,
    currentPosition: Vector3,
    currentTarget: Vector3,
    stepDuration: number,
    sceneAnalysis: SceneAnalysis,
    envAnalysis: EnvironmentalAnalysis,
    logger: Logger
): CameraCommand[] {
    const commandsList: CameraCommand[] = [];

    // --- Start Pedestal Logic (Moved from interpreter.ts) ---
    const {
        direction: rawDirection,
        distance_descriptor: rawDistanceDescriptor,
        distance_override: rawDistanceOverride,
        destination_target: rawDestinationTargetName,
        easing: rawEasingName = DEFAULT_EASING,
        speed: rawSpeed = 'medium'
    } = step.parameters;

    let direction: string | null = null;
    let effectiveDistance: number | null = null;
    let isDestinationMove = false;

    const destinationTargetName = typeof rawDestinationTargetName === 'string' ? rawDestinationTargetName : null;

    // Priority 1: Destination Target
    if (destinationTargetName) {
        logger.debug(`Pedestal: Destination target '${destinationTargetName}'. Calculating distance/direction.`);
        const destinationTarget = resolveTargetPosition(destinationTargetName, sceneAnalysis, envAnalysis, currentTarget, logger);
        if (destinationTarget) {
            const signedDistance = destinationTarget.y - currentPosition.y;
            if (Math.abs(signedDistance) < 1e-6) {
                logger.warn(`Pedestal: Destination target height matches current.`);
                effectiveDistance = 0;
            } else {
                effectiveDistance = Math.abs(signedDistance);
            }
            direction = signedDistance >= 0 ? 'up' : 'down';
            isDestinationMove = true;
            logger.debug(`Pedestal: Calculated destination move: direction='${direction}', distance=${effectiveDistance.toFixed(2)}`);
        } else {
            logger.warn(`Pedestal: Could not resolve destination target '${destinationTargetName}'.`);
        }
    }

    // Determine Effective Distance if not set by destination logic
    if (effectiveDistance === null) {
        // Priority 2: Numeric Override
        if (typeof rawDistanceOverride === 'number' && rawDistanceOverride > 0) {
            effectiveDistance = rawDistanceOverride;
            logger.debug(`Pedestal: Using distance_override: ${effectiveDistance}`);
        } else {
            // Priority 3: Distance Descriptor
            const distanceDescriptor = normalizeDescriptor(rawDistanceDescriptor);
            if (distanceDescriptor) {
                effectiveDistance = mapDescriptorToValue(
                    distanceDescriptor, 'distance', 'pedestal',
                    sceneAnalysis, envAnalysis,
                    { position: currentPosition, target: currentTarget },
                    logger
                );
                logger.debug(`Pedestal: Mapped distance_descriptor '${distanceDescriptor}' to distance: ${effectiveDistance}`);
            } else {
                logger.error(`Pedestal: No valid distance found. Skipping.`);
                return [];
            }
        }
    }

    // Final Validation & Movement Calc
    if (effectiveDistance === null || effectiveDistance < 0) {
        logger.error(`Pedestal: Final effective distance invalid (${effectiveDistance}). Skipping.`);
        return [];
    }
    if (effectiveDistance < 1e-6) {
        logger.debug('Pedestal: Effective distance is zero. Static command.');
        commandsList.push({ position: currentPosition.clone(), target: currentTarget.clone(), duration: stepDuration > 0 ? stepDuration : 0.1, easing: 'linear' });
        return commandsList;
    }

    // Set Direction if not set by destination logic
    if (!direction) {
        const explicitDir = typeof rawDirection === 'string' && (rawDirection === 'up' || rawDirection === 'down') ? rawDirection : null;
        if (explicitDir) {
            direction = explicitDir;
            logger.debug(`Pedestal: Using explicit direction parameter '${direction}'.`);
        } else {
             logger.error('Pedestal: Direction missing and not determined by destination. Skipping.');
             return [];
        }
    }

    const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING;
    const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium';

    // Pedestal moves along world Y axis
    const cameraUp = new Vector3(0, 1, 0);
    const moveVector = cameraUp.multiplyScalar(effectiveDistance * (direction === 'up' ? 1 : -1));

    const newPositionCandidate = new Vector3().addVectors(currentPosition, moveVector);
    const newTargetCandidate = new Vector3().addVectors(currentTarget, moveVector); // Target also shifts vertically
    let finalPosition = newPositionCandidate.clone();
    let clamped = false;

    // Constraints
    const { cameraConstraints } = envAnalysis;
    const { spatial } = sceneAnalysis;
    if (cameraConstraints) {
        if (finalPosition.y < cameraConstraints.minHeight) { finalPosition.y = cameraConstraints.minHeight; clamped = true; logger.warn(`Pedestal: Clamped pos to minHeight`); }
        if (finalPosition.y > cameraConstraints.maxHeight) { finalPosition.y = cameraConstraints.maxHeight; clamped = true; logger.warn(`Pedestal: Clamped pos to maxHeight`); }
        // Check distance relative to NEW target candidate
        const distanceToTarget = finalPosition.distanceTo(newTargetCandidate);
        if (distanceToTarget < cameraConstraints.minDistance) {
            const dir = new Vector3().subVectors(finalPosition, newTargetCandidate).normalize();
            finalPosition.copy(newTargetCandidate).addScaledVector(dir, cameraConstraints.minDistance);
            clamped = true; logger.warn(`Pedestal: Clamped pos to minDistance`);
        }
        if (distanceToTarget > cameraConstraints.maxDistance) {
            const dir = new Vector3().subVectors(finalPosition, newTargetCandidate).normalize();
            finalPosition.copy(newTargetCandidate).addScaledVector(dir, cameraConstraints.maxDistance);
            clamped = true; logger.warn(`Pedestal: Clamped pos to maxDistance`);
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

    // Calculate final target based on actual movement
    const actualMoveVector = new Vector3().subVectors(finalPosition, currentPosition);
    const finalTarget = new Vector3().addVectors(currentTarget, actualMoveVector);

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
        target: finalTarget.clone(), // Use final shifted target
        duration: stepDuration > 0 ? stepDuration : 0.1,
        easing: effectiveEasingName
    });

    logger.debug('Generated pedestal commands:', commandsList);
    return commandsList;
    // --- End Pedestal Logic ---
} 