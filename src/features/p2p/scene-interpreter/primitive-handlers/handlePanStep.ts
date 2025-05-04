import { Vector3, Quaternion } from 'three';
import * as THREE from 'three'; // For MathUtils
import { Logger } from '@/types/p2p/shared';
import { MotionStep } from '@/lib/motion-planning/types';
import { SceneAnalysis } from '@/types/p2p/scene-analyzer';
import { EnvironmentalAnalysis } from '@/types/p2p/environmental-analyzer';
import { CameraCommand } from '@/types/p2p/scene-interpreter';
import { EasingFunctionName, easingFunctions, DEFAULT_EASING } from '@/lib/easing';
import {
  resolveTargetPosition,
  // clampPositionWithRaycast, // Not needed for pan
} from '../interpreter-utils';

interface PanStepResult {
  commands: CameraCommand[];
  nextPosition: Vector3;
  nextTarget: Vector3;
}

/**
 * Handles a 'pan' motion step.
 * Rotates the camera target horizontally (left/right) around the camera position.
 */
export function handlePanStep(
  step: MotionStep,
  currentPosition: Vector3,
  currentTarget: Vector3,
  stepDuration: number,
  sceneAnalysis: SceneAnalysis,
  envAnalysis: EnvironmentalAnalysis,
  logger: Logger
): PanStepResult {
  logger.debug('Handling pan step...', step.parameters);

  const {
    direction: rawDirection,
    angle: rawAngle,
    // target: rawTargetName, // Pan doesn't typically use an explicit target, it rotates current
    easing: rawEasingName = DEFAULT_EASING,
    speed: rawSpeed = 'medium'
  } = step.parameters;

  // Validate parameters
  const direction = typeof rawDirection === 'string' && (rawDirection === 'left' || rawDirection === 'right') ? rawDirection : null;
  const angle = typeof rawAngle === 'number' && rawAngle !== 0 ? rawAngle : null;
  const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING;
  const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium';

  if (!direction) {
    logger.error(`Invalid or missing pan direction: ${rawDirection}. Skipping step.`);
    return { commands: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
  }
  if (angle === null) {
    logger.error(`Invalid, missing, or zero pan angle: ${rawAngle}. Skipping step.`);
    return { commands: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
  }
  // Note: Absolute target panning (looking AT a specific point) is handled by target blending + focus_on/move_to logic upstream or needs a different primitive type.
  // Pan strictly rotates the current view.

  // Determine rotation axis (Camera's local UP)
  const viewDirection = new Vector3().subVectors(currentTarget, currentPosition).normalize();
  let cameraUp = new Vector3(0, 1, 0);
  if (Math.abs(viewDirection.y) > 0.999) {
    const forwardXZ = new Vector3(viewDirection.x, 0, viewDirection.z).normalize();
    const cameraRight = new Vector3().crossVectors(new Vector3(0, 1, 0), forwardXZ).normalize();
    cameraUp.crossVectors(forwardXZ, cameraRight).normalize();
  } else {
    const cameraRight = new Vector3().crossVectors(new Vector3(0, 1, 0), viewDirection).normalize();
    cameraUp.crossVectors(viewDirection, cameraRight).normalize();
  }
  logger.debug(`Pan using camera local up axis: ${cameraUp.toArray()}`);

  // Calculate rotation
  const angleRad = THREE.MathUtils.degToRad(angle) * (direction === 'left' ? 1 : -1);
  const quaternion = new Quaternion().setFromAxisAngle(cameraUp, angleRad);

  // Rotate the target point around the camera position
  const targetVector = new Vector3().subVectors(currentTarget, currentPosition);
  targetVector.applyQuaternion(quaternion);
  const newTarget = new Vector3().addVectors(currentPosition, targetVector);

  // Determine effective easing based on speed
  let effectiveEasingName = easingName;
  if (speed === 'very_fast') effectiveEasingName = 'linear';
  else if (speed === 'fast') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeOutQuad' : easingName;
  else if (speed === 'slow') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeInOutQuad' : easingName;
  if (effectiveEasingName !== easingName) {
      logger.debug(`Pan: Speed '${speed}' selected easing '${effectiveEasingName}' (original: ${easingName})`);
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
    position: currentPosition.clone(), // Position does not change for pan
    target: newTarget.clone(),
    duration: stepDuration > 0 ? stepDuration : 0.1,
    easing: effectiveEasingName
  });
  logger.debug('Generated pan commands:', commandsList);

  // Return commands and the calculated next state
  return {
    commands: commandsList,
    nextPosition: currentPosition.clone(), // Position is unchanged
    nextTarget: newTarget.clone(),        // Target is updated
  };
} 