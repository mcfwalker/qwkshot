import { Vector3, Box3 } from 'three';
import { Logger } from '@/types/p2p/shared';
import { MotionStep } from '@/lib/motion-planning/types';
import { SceneAnalysis } from '@/types/p2p/scene-analyzer';
import { EnvironmentalAnalysis } from '@/types/p2p/environmental-analyzer';
import { CameraCommand } from '@/types/p2p/scene-interpreter';
import { EasingFunctionName, easingFunctions, DEFAULT_EASING } from '@/lib/easing';
import {
  resolveTargetPosition,
  clampPositionWithRaycast,
  mapDescriptorToValue,
  mapDescriptorToGoalDistance,
  normalizeDescriptor,
} from '../interpreter-utils';

interface ZoomStepResult {
  commands: CameraCommand[];
  nextPosition: Vector3;
  nextTarget: Vector3;
}

/**
 * Handles a 'zoom' motion step.
 * Moves the camera closer or further from its target point along the view vector,
 * adjusting the distance by a factor.
 */
export function handleZoomStep(
  step: MotionStep,
  currentPosition: Vector3,
  currentTarget: Vector3,
  stepDuration: number,
  sceneAnalysis: SceneAnalysis,
  envAnalysis: EnvironmentalAnalysis,
  logger: Logger
): ZoomStepResult {
  logger.debug('Handling zoom step...', step.parameters);

  const {
    direction: rawDirection,
    factor_descriptor: rawFactorDescriptor,
    factor_override: rawFactorOverride,
    target: rawTargetName = 'current_target',
    easing: rawEasingName = DEFAULT_EASING,
    speed: rawSpeed = 'medium',
    target_distance_descriptor: rawGoalDistanceDescriptor,
  } = step.parameters;

  // Validate direction
  const direction = typeof rawDirection === 'string' && (rawDirection === 'in' || rawDirection === 'out') ? rawDirection : null;
  if (!direction) {
    logger.error(`Invalid or missing zoom direction: ${rawDirection}. Skipping step.`);
    return { commands: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
  }

  let effectiveFactor: number | null = null;

  // Priority 1: Numeric Override
  if (typeof rawFactorOverride === 'number' && rawFactorOverride > 0) {
    effectiveFactor = rawFactorOverride;
    logger.debug(`Zoom: Using factor_override: ${effectiveFactor}`);
  } else {
    // Priority 2: Factor Descriptor
    const factorDescriptor = normalizeDescriptor(rawFactorDescriptor);
    if (factorDescriptor) {
      effectiveFactor = mapDescriptorToValue(
        factorDescriptor,
        'factor',
        'zoom',
        sceneAnalysis,
        envAnalysis,
        { position: currentPosition, target: currentTarget },
        logger,
        direction
      );
      logger.debug(`Zoom: Mapped factor_descriptor '${factorDescriptor}' to factor: ${effectiveFactor}`);
    } else if (!rawGoalDistanceDescriptor) {
      logger.error(
        `Zoom: Missing factor_override, factor_descriptor, and target_distance_descriptor. Skipping step.`
      );
      return { commands: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
    }
  }

  const targetName = typeof rawTargetName === 'string' ? rawTargetName : 'current_target';
  const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING;
  const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium';

  // Resolve target point
  const zoomTargetPosition = resolveTargetPosition(
    targetName,
    sceneAnalysis,
    envAnalysis,
    currentTarget,
    logger
  );
  if (!zoomTargetPosition) {
    logger.error(`Could not resolve zoom target '${targetName}'. Skipping step.`);
    return { commands: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
  }

  // Calculate current distance
  const vectorToTarget = new Vector3().subVectors(zoomTargetPosition, currentPosition);
  const currentDistance = vectorToTarget.length();
  let newDistance: number;

  // Priority 3: Compute factor from goal distance descriptor if factor still unknown
  if (effectiveFactor === null) {
    const goalDescriptor = normalizeDescriptor(rawGoalDistanceDescriptor);
    if (goalDescriptor) {
      const goalDistance = mapDescriptorToGoalDistance(goalDescriptor, sceneAnalysis, logger);
      const delta = currentDistance - goalDistance;
      if (Math.abs(delta) < 1e-6) {
        logger.debug(`Zoom: Already at goal distance for descriptor '${goalDescriptor}'. Generating static command.`);
        const command: CameraCommand = {
          position: currentPosition.clone(),
          target: currentTarget.clone(), // Use currentTarget, zoom target might differ
          duration: stepDuration > 0 ? stepDuration : 0.1,
          easing: 'linear'
        };
        return {
          commands: [command],
          nextPosition: currentPosition.clone(),
          nextTarget: currentTarget.clone(), // Keep original target
        };
      }
      effectiveFactor = goalDistance / currentDistance;
      logger.debug(`Zoom: Goal descriptor '${goalDescriptor}' -> goalDist=${goalDistance.toFixed(3)}, current=${currentDistance.toFixed(3)}, factor=${effectiveFactor.toFixed(3)}`);
      // Ensure factor moves in the requested direction (handle tiny adjustments if already past target)
      if (direction === 'in' && effectiveFactor >= 1.0) effectiveFactor = 0.99;
      else if (direction === 'out' && effectiveFactor <= 1.0) effectiveFactor = 1.01;
    } else {
      // Error if goal descriptor invalid and other methods failed
      logger.error(`Zoom: Invalid goal descriptor '${rawGoalDistanceDescriptor}' and no other factors provided. Skipping.`);
      return { commands: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
    }
  }

  // Final check for effective factor
  if (effectiveFactor === null) {
    logger.error("Zoom: Internal error - effectiveFactor remained null. Skipping step.");
    return { commands: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
  }

  // Calculate new distance based on the final effectiveFactor
  newDistance = currentDistance * effectiveFactor;

  // Handle edge case: Zooming from the target point
  if (currentDistance < 1e-6) {
    logger.warn('Zoom target is effectively at the current camera position. Cannot zoom further. Keeping position static.');
    newDistance = currentDistance; // No change
  }
  // Ensure new distance is positive
  newDistance = Math.max(1e-6, newDistance);

  // --- Constraint Checking (Distance) ---
  const { cameraConstraints } = envAnalysis;
  if (cameraConstraints) {
    if (newDistance < cameraConstraints.minDistance) {
      logger.warn(`Zoom: Calculated newDistance (${newDistance.toFixed(2)}) violates minDistance (${cameraConstraints.minDistance}). Clamping distance.`);
      newDistance = cameraConstraints.minDistance;
    }
    if (newDistance > cameraConstraints.maxDistance) {
      logger.warn(`Zoom: Calculated newDistance (${newDistance.toFixed(2)}) violates maxDistance (${cameraConstraints.maxDistance}). Clamping distance.`);
      newDistance = cameraConstraints.maxDistance;
    }
  }

  // Calculate new position candidate
  const viewDirectionNormalized = vectorToTarget.normalize();
  const newPositionCandidate = new Vector3()
    .copy(zoomTargetPosition)
    .addScaledVector(viewDirectionNormalized, -newDistance);

  // --- Constraint Checking (Height & Bounding Box) ---
  let finalPosition = newPositionCandidate.clone();
  const { spatial } = sceneAnalysis;

  // a) Height constraints
  if (cameraConstraints) {
    if (finalPosition.y < cameraConstraints.minHeight) {
      finalPosition.y = cameraConstraints.minHeight;
      logger.warn(`Zoom: Clamped final position to minHeight (${cameraConstraints.minHeight})`);
    }
    if (finalPosition.y > cameraConstraints.maxHeight) {
      finalPosition.y = cameraConstraints.maxHeight;
      logger.warn(`Zoom: Clamped final position to maxHeight (${cameraConstraints.maxHeight})`);
    }
  }

  // b) Bounding box constraint
  if (spatial?.bounds) {
    const objectBounds = new Box3(spatial.bounds.min, spatial.bounds.max);
    const clampedPositionResult = clampPositionWithRaycast(
      currentPosition,
      newPositionCandidate,
      objectBounds,
      envAnalysis.userVerticalAdjustment ?? 0,
      logger
    );
    if (!clampedPositionResult.equals(newPositionCandidate)) {
      finalPosition.copy(clampedPositionResult);
      logger.warn(`Zoom: Clamped final position due to raycast.`);
    }
  } else {
      logger.warn('Zoom: Bounding box data missing, skipping bounding box constraint check.');
  }
  // --- End Constraint Checking ---

  // Determine effective easing based on speed
  let effectiveEasingName = easingName;
  if (speed === 'very_fast') effectiveEasingName = 'linear';
  else if (speed === 'fast') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeOutQuad' : easingName;
  else if (speed === 'slow') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeInOutQuad' : easingName;
  if (effectiveEasingName !== easingName) {
      logger.debug(`Zoom: Speed '${speed}' selected easing '${effectiveEasingName}' (original: ${easingName})`);
  }

  // Create CameraCommands
  const commandsList: CameraCommand[] = [];
  commandsList.push({
    position: currentPosition.clone(),
    target: zoomTargetPosition.clone(), // Start looking at the resolved zoom target
    duration: 0,
    easing: effectiveEasingName
  });
  commandsList.push({
    position: finalPosition.clone(),
    target: zoomTargetPosition.clone(), // Continue looking at the resolved zoom target
    duration: stepDuration > 0 ? stepDuration : 0.1,
    easing: effectiveEasingName
  });
  logger.debug('Generated zoom commands:', commandsList);

  // Return commands and the calculated next state
  return {
    commands: commandsList,
    nextPosition: finalPosition.clone(),
    nextTarget: zoomTargetPosition.clone(), // End looking at the resolved zoom target
  };
} 