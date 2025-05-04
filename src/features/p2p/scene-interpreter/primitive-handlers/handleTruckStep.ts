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
  Descriptor,
  MagnitudeType,
} from '../interpreter-utils';

interface TruckStepResult {
  commands: CameraCommand[];
  nextPosition: Vector3;
  nextTarget: Vector3;
}

/**
 * Handles a 'truck' motion step.
 * Moves the camera left or right parallel to the ground plane.
 */
export function handleTruckStep(
  step: MotionStep,
  currentPosition: Vector3,
  currentTarget: Vector3,
  stepDuration: number,
  sceneAnalysis: SceneAnalysis,
  envAnalysis: EnvironmentalAnalysis,
  logger: Logger
): TruckStepResult {
  logger.debug('Handling truck step...', step.parameters);

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
    logger.debug(`Truck: Destination target '${destinationTargetName}' provided.`);
    const destinationTarget = resolveTargetPosition(
      destinationTargetName,
      sceneAnalysis,
      envAnalysis,
      currentTarget,
      logger
    );

    if (destinationTarget) {
      const viewDirection = new Vector3().subVectors(currentTarget, currentPosition).normalize();
      const worldUp = new Vector3(0, 1, 0);
      const cameraRight = new Vector3().crossVectors(viewDirection, worldUp).normalize();

      if (cameraRight.lengthSq() < 1e-9) {
        logger.warn('Truck: Cannot calculate camera right vector. Falling back to distance.');
      } else {
        const displacementVector = new Vector3().subVectors(destinationTarget, currentPosition);
        const signedDistance = displacementVector.dot(cameraRight);

        if (Math.abs(signedDistance) < 1e-6) {
          logger.warn(`Truck: Destination target is effectively already in the current plane.`);
          effectiveDistance = 0;
        } else {
          effectiveDistance = Math.abs(signedDistance);
        }
        direction = signedDistance >= 0 ? 'right' : 'left';
        isDestinationMove = true;
        logger.debug(`Truck: Calculated destination move: direction='${direction}', distance=${effectiveDistance.toFixed(2)}`);
      }
    } else {
      logger.warn(`Truck: Could not resolve destination target '${destinationTargetName}'. Falling back.`);
    }
  }

  // Determine distance if not set by destination
  if (effectiveDistance === null) {
    // Priority 2: Distance Override
    if (typeof rawDistanceOverride === 'number' && rawDistanceOverride > 0) {
      effectiveDistance = rawDistanceOverride;
      logger.debug(`Truck: Using distance_override: ${effectiveDistance}`);
    } else {
      // Priority 3: Distance Descriptor
      const distanceDescriptor = normalizeDescriptor(rawDistanceDescriptor);
      if (distanceDescriptor) {
        effectiveDistance = mapDescriptorToValue(
          distanceDescriptor,
          'distance',
          'truck',
          sceneAnalysis,
          envAnalysis,
          { position: currentPosition, target: currentTarget },
          logger
        );
        logger.debug(`Truck: Mapped distance_descriptor '${distanceDescriptor}' to distance: ${effectiveDistance}`);
      } else {
        logger.error(`Truck: Missing or invalid destination/override/descriptor. Skipping step.`);
        return { commands: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
      }
    }
  }

  // Determine direction if not set by destination
  if (!direction) {
     const explicitDir = typeof rawDirection === 'string' && (rawDirection === 'left' || rawDirection === 'right') ? rawDirection : null;
     if (explicitDir) {
        direction = explicitDir;
     } else {
         logger.error(`Invalid or missing truck direction: ${rawDirection}. Skipping step.`);
         return { commands: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
     }
  }

  // Final validation of distance
  if (effectiveDistance === null || effectiveDistance < 0) {
    logger.error(`Truck: Final effective distance is invalid (${effectiveDistance}). Skipping.`);
    return { commands: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
  }

  if (effectiveDistance < 1e-6) {
    logger.debug('Truck: Effective distance is zero. Generating static command.');
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
  const worldUp = new Vector3(0, 1, 0);
  const cameraRight = new Vector3().crossVectors(viewDirection, worldUp).normalize();
  if (cameraRight.lengthSq() < 1e-6) {
    logger.warn('Cannot determine camera right vector (view likely aligned with world up). Using world X as fallback.');
    cameraRight.set(1, 0, 0);
  }
  const moveVector = cameraRight.multiplyScalar(effectiveDistance * (direction === 'left' ? -1 : 1));

  // Calculate candidate position AND target
  const newPositionCandidate = new Vector3().addVectors(currentPosition, moveVector);
  const newTargetCandidate = new Vector3().addVectors(currentTarget, moveVector);

  let finalPosition = newPositionCandidate.clone();
  let finalTarget = newTargetCandidate.clone(); // Start final target based on parallel move
  let clamped = false;

  // --- Constraint Checking (Apply primarily to Position) ---
  const { cameraConstraints } = envAnalysis;
  const { spatial } = sceneAnalysis;

  // a) Height constraints
  if (cameraConstraints) {
    if (finalPosition.y < cameraConstraints.minHeight) {
      finalPosition.y = cameraConstraints.minHeight;
      clamped = true;
      logger.warn(`Truck: Clamped position to minHeight (${cameraConstraints.minHeight})`);
    }
    if (finalPosition.y > cameraConstraints.maxHeight) {
      finalPosition.y = cameraConstraints.maxHeight;
      clamped = true;
      logger.warn(`Truck: Clamped position to maxHeight (${cameraConstraints.maxHeight})`);
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
      clamped = true;
      logger.warn(`Truck: Clamped position due to raycast.`);
    }
  } else {
    logger.warn('Truck: Bounding box data missing, skipping bounding box constraint check.');
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
    logger.debug(`Truck: Speed '${speed}' selected easing '${effectiveEasingName}' (original: ${easingName})`);
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
  logger.debug('Generated truck commands:', commandsList);

  // Return commands and the calculated next state
  return {
    commands: commandsList,
    nextPosition: finalPosition.clone(),
    nextTarget: finalTarget.clone(),
  };
} 