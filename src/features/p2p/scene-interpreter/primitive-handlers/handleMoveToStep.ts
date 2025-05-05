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
} from '../interpreter-utils';

interface MoveToStepResult {
  commands: CameraCommand[];
  nextPosition: Vector3;
  nextTarget: Vector3;
}

/**
 * Handles a 'move_to' motion step.
 * Moves the camera to a specified destination point, optionally looking at another point.
 */
export function handleMoveToStep(
  step: MotionStep,
  currentPosition: Vector3,
  currentTarget: Vector3,
  stepDuration: number,
  sceneAnalysis: SceneAnalysis,
  envAnalysis: EnvironmentalAnalysis,
  logger: Logger
): MoveToStepResult {
  logger.debug('Handling move_to step...', step.parameters);

  const {
    destination_target: rawDestinationTargetName,
    look_at_target: rawLookAtTargetName = 'object_center', // Default look_at
    easing: rawEasingName = DEFAULT_EASING,
    speed: rawSpeed = 'medium'
  } = step.parameters;

  // Validate destination target name
  const destinationTargetName = typeof rawDestinationTargetName === 'string' ? rawDestinationTargetName : null;
  if (!destinationTargetName) {
    logger.error('MoveTo: Missing required destination_target parameter. Skipping step.');
    return { commands: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
  }

  const lookAtTargetName = typeof rawLookAtTargetName === 'string' ? rawLookAtTargetName : 'object_center';
  const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING;
  const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium';

  // Resolve destination and look-at points
  const destinationPosition = resolveTargetPosition(
    destinationTargetName,
    sceneAnalysis,
    envAnalysis,
    currentTarget, // Context
    logger
  );
  const lookAtTargetPosition = resolveTargetPosition(
    lookAtTargetName,
    sceneAnalysis,
    envAnalysis,
    currentTarget, // Context
    logger
  );

  if (!destinationPosition) {
    logger.error(`MoveTo: Could not resolve destination target '${destinationTargetName}'. Skipping step.`);
    return { commands: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
  }
  // Use destination as fallback if look_at fails
  const finalTarget = lookAtTargetPosition ? lookAtTargetPosition.clone() : destinationPosition.clone();
  if (!lookAtTargetPosition) {
      logger.warn(`MoveTo: Could not resolve look_at target '${lookAtTargetName}'. Using resolved destinationPosition as target.`);
  }

  // Calculate the final position candidate (directly the resolved destination)
  const endPositionCandidate = destinationPosition.clone();
  let finalPosition = endPositionCandidate.clone();

  // Clamping final position
  const { spatial } = sceneAnalysis;
  if (spatial?.bounds) {
    const objectBounds = new Box3(spatial.bounds.min, spatial.bounds.max);
    const clampedPos = clampPositionWithRaycast(
      currentPosition,
      endPositionCandidate,
      objectBounds,
      envAnalysis.userVerticalAdjustment ?? 0,
      logger
    );
    if (!clampedPos.equals(endPositionCandidate)) {
      logger.warn(`MoveTo: Clamped final position due to bounding box intersection/containment.`);
      finalPosition.copy(clampedPos);
    }
    // No need for else, finalPosition already holds candidate
  } else {
     logger.warn('MoveTo: Bounding box data missing, skipping constraint check.');
  }

  // Determine effective easing based on speed
  let effectiveEasingName = easingName;
  if (speed === 'very_fast') effectiveEasingName = 'linear';
  else if (speed === 'fast') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeOutQuad' : easingName;
  else if (speed === 'slow') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeInOutQuad' : easingName;
   if (effectiveEasingName !== easingName) {
    logger.debug(`MoveTo: Speed '${speed}' selected easing '${effectiveEasingName}' (original: ${easingName})`);
  }

  // Create commands
  const commandsList: CameraCommand[] = [];
  commandsList.push({
    position: currentPosition.clone(),
    target: currentTarget.clone(), // Start with current target
    duration: 0,
    easing: effectiveEasingName
  });
  commandsList.push({
    position: finalPosition.clone(),
    target: finalTarget.clone(), // End looking at the final target
    duration: stepDuration > 0 ? stepDuration : 0.5, // Longer default for move_to
    easing: effectiveEasingName
  });
  logger.debug('Generated move_to commands:', commandsList);

  // Return commands and the calculated next state
  return {
    commands: commandsList,
    nextPosition: finalPosition.clone(),
    nextTarget: finalTarget.clone(),
  };
} 