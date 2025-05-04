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
  normalizeDescriptor,
  // mapDescriptorToGoalDistance, // Not applicable to pedestal
  Descriptor,
  MagnitudeType,
} from '../interpreter-utils';

interface PedestalStepResult {
  commands: CameraCommand[];
  nextPosition: Vector3;
  nextTarget: Vector3;
}

/**
 * Handles a 'pedestal' motion step.
 * Moves the camera vertically (up or down) along the world Y axis.
 */
export function handlePedestalStep(
  step: MotionStep,
  currentPosition: Vector3,
  currentTarget: Vector3,
  stepDuration: number,
  sceneAnalysis: SceneAnalysis,
  envAnalysis: EnvironmentalAnalysis,
  logger: Logger
): PedestalStepResult {
  logger.debug('Handling pedestal step...', step.parameters);

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
    logger.debug(`Pedestal: Destination target '${destinationTargetName}' provided.`);
    const destinationTarget = resolveTargetPosition(
      destinationTargetName,
      sceneAnalysis,
      envAnalysis,
      currentTarget,
      logger
    );

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
      logger.warn(`Pedestal: Could not resolve destination target '${destinationTargetName}'. Falling back.`);
    }
  }

  // Determine distance if not set by destination
  if (effectiveDistance === null) {
    // Priority 2: Distance Override
    if (typeof rawDistanceOverride === 'number' && rawDistanceOverride > 0) {
      effectiveDistance = rawDistanceOverride;
      logger.debug(`Pedestal: Using distance_override: ${effectiveDistance}`);
    } else {
      // Priority 3: Distance Descriptor
      const distanceDescriptor = normalizeDescriptor(rawDistanceDescriptor);
      if (distanceDescriptor) {
        effectiveDistance = mapDescriptorToValue(
          distanceDescriptor,
          'distance',
          'pedestal',
          sceneAnalysis,
          envAnalysis,
          { position: currentPosition, target: currentTarget },
          logger
        );
        logger.debug(`Pedestal: Mapped distance_descriptor '${distanceDescriptor}' to distance: ${effectiveDistance}`);
      } else {
        logger.error(`Pedestal: Missing or invalid destination/override/descriptor. Skipping step.`);
        return { commands: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
      }
    }
  }

  // Determine direction if not set by destination
  if (!direction) {
    const explicitDir = typeof rawDirection === 'string' && (rawDirection === 'up' || rawDirection === 'down') ? rawDirection : null;
    if (explicitDir) {
      direction = explicitDir;
    } else {
      logger.error(`Invalid or missing pedestal direction: ${rawDirection}. Skipping step.`);
      return { commands: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
    }
  }

  // Final validation of distance
  if (effectiveDistance === null || effectiveDistance < 0) {
    logger.error(`Pedestal: Final effective distance is invalid (${effectiveDistance}). Skipping.`);
    return { commands: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
  }

  if (effectiveDistance < 1e-6) {
    logger.debug('Pedestal: Effective distance is zero. Generating static command.');
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

  // Calculate movement vector (World Y-axis)
  const cameraUp = new Vector3(0, 1, 0);
  const moveVector = cameraUp.multiplyScalar(effectiveDistance * (direction === 'up' ? 1 : -1));

  // Calculate candidate position AND target
  const newPositionCandidate = new Vector3().addVectors(currentPosition, moveVector);
  const newTargetCandidate = new Vector3().addVectors(currentTarget, moveVector);

  let finalPosition = newPositionCandidate.clone();
  let finalTarget = newTargetCandidate.clone();
  let clamped = false;

  // --- Constraint Checking (Apply primarily to Position) ---
  const { cameraConstraints } = envAnalysis;
  const { spatial } = sceneAnalysis;

  // a) Height constraints
  if (cameraConstraints) {
    if (finalPosition.y < cameraConstraints.minHeight) {
      finalPosition.y = cameraConstraints.minHeight;
      clamped = true;
      logger.warn(`Pedestal: Clamped position to minHeight (${cameraConstraints.minHeight})`);
    }
    if (finalPosition.y > cameraConstraints.maxHeight) {
      finalPosition.y = cameraConstraints.maxHeight;
      clamped = true;
      logger.warn(`Pedestal: Clamped position to maxHeight (${cameraConstraints.maxHeight})`);
    }
  }

  // b) Distance constraints (relative to NEW target candidate)
  if (cameraConstraints) {
    const distanceToTarget = finalPosition.distanceTo(newTargetCandidate);
    if (distanceToTarget < cameraConstraints.minDistance) {
       const directionFromTarget = new Vector3().subVectors(finalPosition, newTargetCandidate).normalize();
       finalPosition.copy(newTargetCandidate).addScaledVector(directionFromTarget, cameraConstraints.minDistance);
       clamped = true;
       logger.warn(`Pedestal: Clamped position to minDistance (${cameraConstraints.minDistance}) relative to shifted target`);
    }
    if (distanceToTarget > cameraConstraints.maxDistance) {
       const directionFromTarget = new Vector3().subVectors(finalPosition, newTargetCandidate).normalize();
       finalPosition.copy(newTargetCandidate).addScaledVector(directionFromTarget, cameraConstraints.maxDistance);
       clamped = true;
       logger.warn(`Pedestal: Clamped position to maxDistance (${cameraConstraints.maxDistance}) relative to shifted target`);
    }
  }

  // c) Bounding box constraint
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
      logger.warn(`Pedestal: Clamped position due to raycast.`);
    }
  } else {
    logger.warn('Pedestal: Bounding box data missing, skipping constraint check.');
  }
  // --- End Constraint Checking ---

  // Recalculate final target based on actual position movement
  const actualMoveVector = new Vector3().subVectors(finalPosition, currentPosition);
  finalTarget = new Vector3().addVectors(currentTarget, actualMoveVector);

  // Determine effective easing based on speed
  let effectiveEasingName = easingName;
  if (speed === 'very_fast') effectiveEasingName = 'linear';
  else if (speed === 'fast') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeOutQuad' : easingName;
  else if (speed === 'slow') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeInOutQuad' : easingName;
  if (effectiveEasingName !== easingName) {
    logger.debug(`Pedestal: Speed '${speed}' selected easing '${effectiveEasingName}' (original: ${easingName})`);
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
    target: finalTarget.clone(),
    duration: stepDuration > 0 ? stepDuration : 0.1,
    easing: effectiveEasingName
  });
  logger.debug('Generated pedestal commands:', commandsList);

  // Return commands and the calculated next state
  return {
    commands: commandsList,
    nextPosition: finalPosition.clone(),
    nextTarget: finalTarget.clone(),
  };
} 