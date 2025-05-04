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
} from '../interpreter-utils'; // Adjust path as needed

// Re-define types needed locally if not imported
type Descriptor = 'tiny' | 'small' | 'medium' | 'large' | 'huge';

/**
 * Handles the interpretation of a 'zoom' motion step.
 * Calculates the new camera position based on zoom factor or goal distance.
 *
 * @param step The zoom primitive step.
 * @param currentPosition Current camera position.
 * @param currentTarget Current camera target.
 * @param stepDuration Calculated duration for this step.
 * @param sceneAnalysis Scene context.
 * @param envAnalysis Environmental context.
 * @param logger Logger instance.
 * @returns An array of CameraCommands for the zoom operation.
 */
export function handleZoomStep(
    step: PrimitiveStep,
    currentPosition: Vector3,
    currentTarget: Vector3,
    stepDuration: number,
    sceneAnalysis: SceneAnalysis,
    envAnalysis: EnvironmentalAnalysis,
    logger: Logger
): CameraCommand[] {
    const commandsList: CameraCommand[] = [];

    // --- Start Zoom Logic (Moved from interpreter.ts) ---
    const {
        direction: rawDirection,
        factor_descriptor: rawFactorDescriptor,
        factor_override: rawFactorOverride,
        target: rawTargetName = 'current_target',
        easing: rawEasingName = DEFAULT_EASING,
        speed: rawSpeed = 'medium',
        target_distance_descriptor: rawGoalDistanceDescriptor,
    } = step.parameters;

    const direction = typeof rawDirection === 'string' && (rawDirection === 'in' || rawDirection === 'out') ? rawDirection : null;
    if (!direction) {
        logger.error(`Invalid or missing zoom direction: ${rawDirection}. Skipping step.`);
        return []; // Return empty array on error
    }

    let effectiveFactor: number | null = null;

    if (typeof rawFactorOverride === 'number' && rawFactorOverride > 0) {
        effectiveFactor = rawFactorOverride;
        logger.debug(`Zoom: Using factor_override: ${effectiveFactor}`);
    } else {
        const factorDescriptor = normalizeDescriptor(rawFactorDescriptor);
        if (factorDescriptor) {
            effectiveFactor = mapDescriptorToValue(
                factorDescriptor, 'factor', 'zoom',
                sceneAnalysis, envAnalysis,
                { position: currentPosition, target: currentTarget },
                logger,
                direction
            );
            logger.debug(`Zoom: Mapped factor_descriptor '${factorDescriptor}' to factor: ${effectiveFactor}`);
        } else if (!rawGoalDistanceDescriptor) {
            logger.error(`Zoom: Missing factor_override/descriptor and no target_distance_descriptor. Skipping step.`);
            return [];
        }
    }

    const targetName = typeof rawTargetName === 'string' ? rawTargetName : 'current_target';
    const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING;
    const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium';

    const zoomTargetPosition = resolveTargetPosition(
        targetName, sceneAnalysis, envAnalysis, currentTarget, logger
    );
    if (!zoomTargetPosition) {
        logger.error(`Could not resolve zoom target '${targetName}'. Skipping step.`);
        return [];
    }

    const vectorToTarget = new Vector3().subVectors(zoomTargetPosition, currentPosition);
    const currentDistance = vectorToTarget.length();
    let newDistance: number;

    if (effectiveFactor === null) {
        const goalDescriptor = normalizeDescriptor(rawGoalDistanceDescriptor);
        if (goalDescriptor) {
            const goalDistance = mapDescriptorToGoalDistance(
                goalDescriptor, sceneAnalysis, logger
            );
            const delta = currentDistance - goalDistance;
            if (Math.abs(delta) < 1e-6) {
                logger.debug(`Zoom: Already at goal distance. Generating static command.`);
                commandsList.push({
                    position: currentPosition.clone(),
                    target: currentTarget.clone(),
                    duration: stepDuration > 0 ? stepDuration : 0.1,
                    easing: 'linear'
                });
                return commandsList; // Return static command
            }
            effectiveFactor = goalDistance / currentDistance;
            logger.debug(`Zoom: Goal descriptor '${goalDescriptor}' -> factor=${effectiveFactor.toFixed(3)}`);
            if (direction === 'in' && effectiveFactor >= 1.0) effectiveFactor = 0.99;
            else if (direction === 'out' && effectiveFactor <= 1.0) effectiveFactor = 1.01;
        }
    }

    if (effectiveFactor === null) {
        logger.error(`Zoom: Missing effective factor. Skipping step.`);
        return [];
    }

    newDistance = currentDistance * effectiveFactor;
    if (currentDistance < 1e-6) {
        logger.warn('Zoom target at camera position. Keeping position static.');
        newDistance = currentDistance;
    }
    newDistance = Math.max(1e-6, newDistance);

    const { cameraConstraints } = envAnalysis;
    const { spatial } = sceneAnalysis;
    let distanceClamped = false;
    if (cameraConstraints) {
        if (newDistance < cameraConstraints.minDistance) {
            logger.warn(`Zoom: Clamping newDistance to minDistance`);
            newDistance = cameraConstraints.minDistance;
            distanceClamped = true;
        }
        if (newDistance > cameraConstraints.maxDistance) {
            logger.warn(`Zoom: Clamping newDistance to maxDistance`);
            newDistance = cameraConstraints.maxDistance;
            distanceClamped = true;
        }
    }

    const viewDirectionNormalized = vectorToTarget.normalize();
    const newPositionCandidate = new Vector3()
        .copy(zoomTargetPosition)
        .addScaledVector(viewDirectionNormalized, -newDistance);

    let finalPosition = newPositionCandidate.clone();
    let posClamped = false;
    if (cameraConstraints) {
        if (finalPosition.y < cameraConstraints.minHeight) {
            finalPosition.y = cameraConstraints.minHeight; posClamped = true;
            logger.warn(`Zoom: Clamped final pos to minHeight`);
        }
        if (finalPosition.y > cameraConstraints.maxHeight) {
            finalPosition.y = cameraConstraints.maxHeight; posClamped = true;
            logger.warn(`Zoom: Clamped final pos to maxHeight`);
        }
    }
    if (spatial?.bounds) {
        const objectBounds = new Box3(spatial.bounds.min, spatial.bounds.max);
        const clampedPosition = clampPositionWithRaycast(
            currentPosition, newPositionCandidate, objectBounds,
            envAnalysis.userVerticalAdjustment ?? 0, logger
        );
        if (!clampedPosition.equals(newPositionCandidate)) {
            finalPosition.copy(clampedPosition);
            posClamped = true;
        }
    }

    let effectiveEasingName = easingName;
    if (speed === 'very_fast') effectiveEasingName = 'linear';
    else if (speed === 'fast') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeOutQuad' : easingName;
    else if (speed === 'slow') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeInOutQuad' : easingName;

    commandsList.push({
        position: currentPosition.clone(),
        target: currentTarget.clone(),
        duration: 0,
        easing: effectiveEasingName
    });
    commandsList.push({
        position: finalPosition.clone(),
        target: zoomTargetPosition.clone(),
        duration: stepDuration > 0 ? stepDuration : 0.1,
        easing: effectiveEasingName
    });

    logger.debug('Generated zoom commands:', commandsList);
    return commandsList;
    // --- End Zoom Logic ---
} 