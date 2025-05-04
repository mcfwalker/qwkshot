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
  Descriptor,
  MagnitudeType
} from '../interpreter-utils'; // Import utils from the parent directory

interface DollyStepResult {
  commands: CameraCommand[];
  nextPosition: Vector3;
  nextTarget: Vector3;
}

/**
 * Handles a 'dolly' motion step.
 * Moves the camera forward or backward along its view direction.
 */
export function handleDollyStep(
  step: MotionStep,
  currentPosition: Vector3,
  currentTarget: Vector3,
  stepDuration: number,
  sceneAnalysis: SceneAnalysis,
  envAnalysis: EnvironmentalAnalysis,
  logger: Logger
): DollyStepResult {
  logger.debug('Handling dolly step...', step.parameters);

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
      logger.debug(`Dolly: Already at goal distance for descriptor '${goalDistanceDescriptor}'. Generating static command.`);
      const command: CameraCommand = {
        position: currentPosition.clone(),
        target: currentTarget.clone(),
        duration: stepDuration > 0 ? stepDuration : 0.1,
        easing: 'linear',
      };
      return {
        commands: [command],
        nextPosition: currentPosition.clone(),
        nextTarget: currentTarget.clone(),
      };
    }
    direction = delta > 0 ? 'forward' : 'backward';
    effectiveDistance = Math.abs(delta);
    logger.debug(
      `Dolly: Goal descriptor '${goalDistanceDescriptor}' -> goalDist=${goalDistance.toFixed(3)}, current=${currentDistanceToTarget.toFixed(3)}, delta=${delta.toFixed(3)}, direction='${direction}', effectiveDistance=${effectiveDistance.toFixed(3)}`
    );
  }

  // Priority 1.5: Destination Target (only if goal distance wasn't primary)
  const destinationTargetName = typeof rawDestinationTargetName === 'string' ? rawDestinationTargetName : null;
  if (effectiveDistance === null && destinationTargetName) {
    logger.debug(`Dolly: Destination target '${destinationTargetName}' provided.`);
    const destinationTarget = resolveTargetPosition(
      destinationTargetName,
      sceneAnalysis,
      envAnalysis,
      currentTarget,
      logger
    );
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
        logger.warn('Dolly: Cannot calculate view direction for destination move. Ignoring destination_target.');
      }
    } else {
      logger.warn(`Dolly: Could not resolve destination target '${destinationTargetName}'. Ignoring.`);
    }
  }

  // Determine direction if not set by goal/destination
  if (!direction) {
    let assistantDirection = typeof rawDirection === 'string' ? rawDirection.toLowerCase() : null;
    if (assistantDirection === 'in') assistantDirection = 'forward';
    if (assistantDirection === 'out') assistantDirection = 'backward';
    if (assistantDirection === 'forward' || assistantDirection === 'backward') {
      direction = assistantDirection;
    } else {
      logger.error(`Invalid or missing dolly direction: ${rawDirection} (and destination/goal failed). Skipping step.`);
      // Return current state if direction invalid
      return {
        commands: [],
        nextPosition: currentPosition.clone(),
        nextTarget: currentTarget.clone(),
      };
    }
  }

  // Determine effective distance if not set by goal/destination
  if (effectiveDistance === null) {
    // Priority 2: Distance Override
    if (typeof rawDistanceOverride === 'number' && rawDistanceOverride > 0) {
      effectiveDistance = rawDistanceOverride;
      logger.debug(`Dolly: Using distance_override: ${effectiveDistance}`);
    } else {
      // Priority 3: Distance Descriptor
      const distanceDescriptor = normalizeDescriptor(rawDistanceDescriptor);
      if (distanceDescriptor) {
        effectiveDistance = mapDescriptorToValue(
          distanceDescriptor,
          'distance',
          'dolly',
          sceneAnalysis,
          envAnalysis,
          { position: currentPosition, target: currentTarget },
          logger
        );
        logger.debug(`Dolly: Mapped distance_descriptor '${distanceDescriptor}' to distance: ${effectiveDistance}`);
      } else {
        logger.error(`Dolly: No valid distance found (no goal, destination, override, or descriptor). Skipping step.`);
        return { // Return current state
          commands: [],
          nextPosition: currentPosition.clone(),
          nextTarget: currentTarget.clone(),
        };
      }
    }
  }

  // Final validation of distance
  if (effectiveDistance === null || effectiveDistance < 0) {
    logger.error(`Dolly: Final effective distance is invalid (${effectiveDistance}). Skipping step.`);
    return { commands: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
  }

  if (effectiveDistance < 1e-6) {
    logger.debug('Dolly: Effective distance is zero. Generating static command.');
    const command: CameraCommand = {
      position: currentPosition.clone(),
      target: currentTarget.clone(),
      duration: stepDuration > 0 ? stepDuration : 0.1,
      easing: 'linear'
    };
    return { commands: [command], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
  }

  const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING;
  const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium';

  // Calculate movement vector
  const viewDirection = new Vector3().subVectors(currentTarget, currentPosition).normalize();
  const moveVector = viewDirection.multiplyScalar(effectiveDistance * (direction === 'forward' ? 1 : -1));

  // Calculate candidate position
  const newPositionCandidate = new Vector3().addVectors(currentPosition, moveVector);
  let finalPosition = newPositionCandidate.clone();
  let clamped = false;

  // --- Constraint Checking ---
  const { cameraConstraints } = envAnalysis;
  const { spatial } = sceneAnalysis;

  // a) Height constraints
  if (cameraConstraints) {
    if (finalPosition.y < cameraConstraints.minHeight) {
      finalPosition.y = cameraConstraints.minHeight;
      clamped = true;
      logger.warn(`Dolly: Clamped position to minHeight (${cameraConstraints.minHeight})`);
    }
    if (finalPosition.y > cameraConstraints.maxHeight) {
      finalPosition.y = cameraConstraints.maxHeight;
      clamped = true;
      logger.warn(`Dolly: Clamped position to maxHeight (${cameraConstraints.maxHeight})`);
    }
  }

  // b) Distance constraints (relative to currentTarget)
  if (cameraConstraints) {
    const distanceToTarget = finalPosition.distanceTo(currentTarget);
    if (distanceToTarget < cameraConstraints.minDistance) {
      const directionFromTarget = new Vector3().subVectors(finalPosition, currentTarget).normalize();
      finalPosition.copy(currentTarget).addScaledVector(directionFromTarget, cameraConstraints.minDistance);
      clamped = true;
      logger.warn(`Dolly: Clamped position to minDistance (${cameraConstraints.minDistance})`);
    }
    if (distanceToTarget > cameraConstraints.maxDistance) {
      const directionFromTarget = new Vector3().subVectors(finalPosition, currentTarget).normalize();
      finalPosition.copy(currentTarget).addScaledVector(directionFromTarget, cameraConstraints.maxDistance);
      clamped = true;
      logger.warn(`Dolly: Clamped position to maxDistance (${cameraConstraints.maxDistance})`);
    }
  }

  // c) Bounding box constraint (using raycast)
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
      clamped = true;
      logger.warn(`Dolly: Clamped position due to raycast.`);
    }
    // No else needed, finalPosition already holds candidate if not clamped
  } else {
      // Should this be an error or just proceed without clamping?
      logger.warn('Dolly: Bounding box data missing, skipping bounding box constraint check.');
  }
  // --- End Constraint Checking ---

  // Determine effective easing based on speed
  let effectiveEasingName = easingName;
  if (speed === 'very_fast') effectiveEasingName = 'linear';
  else if (speed === 'fast') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeOutQuad' : easingName;
  else if (speed === 'slow') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeInOutQuad' : easingName;
  // Log if easing changed due to speed
  if (effectiveEasingName !== easingName) {
      logger.debug(`Dolly: Speed '${speed}' selected easing '${effectiveEasingName}' (original: ${easingName})`);
  }

  // Create CameraCommands
  const commandsList: CameraCommand[] = [];
  commandsList.push({
    position: currentPosition.clone(),
    target: currentTarget.clone(),
    duration: 0,
    easing: effectiveEasingName
  });
  commandsList.push({
    position: finalPosition.clone(),
    target: currentTarget.clone(), // Target doesn't change for dolly
    duration: stepDuration > 0 ? stepDuration : 0.1,
    easing: effectiveEasingName
  });
  logger.debug('Generated dolly commands:', commandsList);

  // Return commands and the calculated next state
  return {
    commands: commandsList,
    nextPosition: finalPosition.clone(),
    nextTarget: currentTarget.clone(), // Target remains unchanged
  };
} 