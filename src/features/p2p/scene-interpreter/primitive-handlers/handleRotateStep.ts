import { Vector3, Quaternion } from 'three';
import * as THREE from 'three'; // For MathUtils
import { Logger } from '@/types/p2p/shared';
import { MotionStep } from '@/lib/motion-planning/types';
import { SceneAnalysis } from '@/types/p2p/scene-analyzer';
import { EnvironmentalAnalysis } from '@/types/p2p/environmental-analyzer';
import { CameraCommand } from '@/types/p2p/scene-interpreter';
import { EasingFunctionName, easingFunctions, DEFAULT_EASING } from '@/lib/easing';
// No utils needed for rotate specific logic, unless axis calculation needs helpers

interface RotateStepResult {
  commands: CameraCommand[];
  nextPosition: Vector3;
  nextTarget: Vector3;
}

/**
 * Handles a 'rotate' motion step.
 * Rotates the camera's view around its own axes (yaw, pitch, roll).
 */
export function handleRotateStep(
  step: MotionStep,
  currentPosition: Vector3,
  currentTarget: Vector3,
  stepDuration: number,
  sceneAnalysis: SceneAnalysis,
  envAnalysis: EnvironmentalAnalysis,
  logger: Logger
): RotateStepResult {
  logger.debug('Handling rotate step...', step.parameters);

  const {
    axis: rawAxisName = 'yaw',
    angle: rawAngle,
    speed: rawSpeed = 'medium',
    easing: rawEasingName = DEFAULT_EASING
  } = step.parameters;

  // Validate parameters
  let axis: 'yaw' | 'pitch' | 'roll' = 'yaw';
  const lowerAxisName = typeof rawAxisName === 'string' ? rawAxisName.toLowerCase() : null;
  if (lowerAxisName === 'pitch') axis = 'pitch';
  else if (lowerAxisName === 'roll') axis = 'roll';
  else if (lowerAxisName && lowerAxisName !== 'yaw') {
    logger.warn(`Rotate: Invalid axis '${rawAxisName}', defaulting to 'yaw'.`);
  }
  const angle = typeof rawAngle === 'number' && rawAngle !== 0 ? rawAngle : null;
  const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING;
  const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium';

  if (angle === null) {
    logger.error(`Rotate: Invalid, missing, or zero angle: ${rawAngle}. Skipping step.`);
    return { commands: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
  }

  // Handle unimplemented roll
  if (axis === 'roll') {
    logger.warn('Rotate: \'roll\' axis is not fully implemented. Camera will not visually roll. Generating static command.');
    if (stepDuration > 0) {
      const command: CameraCommand = {
        position: currentPosition.clone(),
        target: currentTarget.clone(),
        duration: stepDuration,
        easing: 'linear'
      };
      return { commands: [command], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
    } else {
      return { commands: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
    }
  }

  // Calculate rotation axes
  const viewDirection = new Vector3().subVectors(currentTarget, currentPosition).normalize();
  let cameraUp = new Vector3(0, 1, 0);
  let cameraRight = new Vector3();
  // Robust axis calculation
  if (Math.abs(viewDirection.y) > 0.999) {
    const forwardXZ = new Vector3(viewDirection.x, 0, viewDirection.z).normalize();
    cameraRight.crossVectors(new Vector3(0, 1, 0), forwardXZ).normalize();
    if (cameraRight.lengthSq() < 1e-9) cameraRight.set(1,0,0); // Fallback if forwardXZ is zero
    cameraUp.crossVectors(cameraRight, viewDirection).normalize(); // Recalculate up from right/view
  } else {
    cameraRight.crossVectors(viewDirection, cameraUp).normalize();
    if (cameraRight.lengthSq() < 1e-9) cameraRight.set(1,0,0); // Fallback if view aligned with world up
    cameraUp.crossVectors(cameraRight, viewDirection).normalize();
  }

  let rotationAxis: Vector3;
  if (axis === 'yaw') rotationAxis = cameraUp;
  else rotationAxis = cameraRight; // Pitch

  const angleRad = THREE.MathUtils.degToRad(angle);
  const quaternion = new Quaternion().setFromAxisAngle(rotationAxis, angleRad);

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
    logger.debug(`Rotate (${axis}): Speed '${speed}' selected easing '${effectiveEasingName}' (original: ${easingName})`);
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
    position: currentPosition.clone(),
    target: newTarget.clone(),
    duration: stepDuration > 0 ? stepDuration : 0.1,
    easing: effectiveEasingName
  });
  logger.debug(`Generated rotate (${axis}) commands:`, commandsList);

  // Return commands and the calculated next state
  return {
    commands: commandsList,
    nextPosition: currentPosition.clone(), // Position is unchanged
    nextTarget: newTarget.clone(),        // Target is updated
  };
} 