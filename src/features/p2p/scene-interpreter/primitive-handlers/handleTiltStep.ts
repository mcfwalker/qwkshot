import { Vector3, Quaternion } from 'three';
import * as THREE from 'three'; // For MathUtils
import { Logger } from '@/types/p2p/shared';
import { MotionStep } from '@/lib/motion-planning/types';
import { SceneAnalysis } from '@/types/p2p/scene-analyzer';
import { EnvironmentalAnalysis } from '@/types/p2p/environmental-analyzer';
import { CameraCommand } from '@/types/p2p/scene-interpreter';
import { EasingFunctionName, easingFunctions, DEFAULT_EASING } from '@/lib/easing';
import {
  // resolveTargetPosition, // REMOVED unused import
} from '../interpreter-utils';

interface TiltStepResult {
  commands: CameraCommand[];
  nextPosition: Vector3;
  nextTarget: Vector3;
}

/**
 * Handles a 'tilt' motion step.
 * Rotates the camera target vertically (up/down) around the camera position,
 * or sets the target directly if an absolute target is provided and resolved.
 */
export function handleTiltStep(
  step: MotionStep,
  currentPosition: Vector3,
  currentTarget: Vector3, // This is the target *after* potential blending
  stepDuration: number,
  _sceneAnalysis: SceneAnalysis, // Prefixed unused param
  _envAnalysis: EnvironmentalAnalysis, // Prefixed unused param
  logger: Logger,
  currentStepExplicitTargetName: string | null
): TiltStepResult {
  logger.debug('Handling tilt step...', { params: step.parameters, explicitTargetName: currentStepExplicitTargetName });

  const {
    direction: rawDirection,
    angle: rawAngle,
    // target: rawTargetName, // Handled via currentStepExplicitTargetName
    easing: rawEasingName = DEFAULT_EASING,
    speed: rawSpeed = 'medium'
  } = step.parameters;

  const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING;
  const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium';

  let finalTarget: Vector3;
  let commandsList: CameraCommand[] = [];
  const isAbsoluteTarget = !!currentStepExplicitTargetName;

  if (isAbsoluteTarget) {
    // Absolute tilt: Target should already be resolved and set via blending.
    // The handler's job is just to confirm the final target state.
    // No commands are generated here; blend/settle handled it.
    logger.debug(`Tilt: Absolute target '${currentStepExplicitTargetName}' provided. Using blended target.`);
    finalTarget = currentTarget.clone(); // Use the target already set by the blending logic
    // commandsList remains empty

  } else {
    // Relative tilt: Calculate rotation based on angle/direction.
    const direction = typeof rawDirection === 'string' && (rawDirection === 'up' || rawDirection === 'down') ? rawDirection : null;
    const angle = typeof rawAngle === 'number' && rawAngle !== 0 ? rawAngle : null;

    if (!direction) {
      logger.error(`Invalid or missing tilt direction: ${rawDirection}. Skipping step.`);
      return { commands: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
    }
    if (angle === null) {
      logger.error(`Invalid, missing, or zero tilt angle: ${rawAngle}. Skipping step.`);
      return { commands: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
    }

    logger.debug(`Tilt: Performing relative tilt of ${angle} degrees ${direction}.`);

    // Calculate rotation axis (Camera's local RIGHT)
    const viewDirection = new Vector3().subVectors(currentTarget, currentPosition).normalize();
    let cameraRight = new Vector3(1, 0, 0); // Default fallback
    if (Math.abs(viewDirection.y) < 0.999) {
      cameraRight.crossVectors(new Vector3(0, 1, 0), viewDirection).normalize();
      if (cameraRight.lengthSq() < 1e-6) {
        logger.warn('Calculated camera right vector is zero. Using world X as fallback axis for tilt.');
        cameraRight.set(1, 0, 0);
      }
    } else {
      logger.warn('Cannot reliably determine camera right vector. Using world X as fallback axis for tilt.');
    }
    logger.debug(`Tilt using camera local right axis: ${cameraRight.toArray()}`);
    const rotationAxis = cameraRight;
    const angleRad = THREE.MathUtils.degToRad(angle) * (direction === 'up' ? -1 : 1);
    const quaternion = new Quaternion().setFromAxisAngle(rotationAxis, angleRad);
    const targetVector = new Vector3().subVectors(currentTarget, currentPosition);
    targetVector.applyQuaternion(quaternion);
    finalTarget = new Vector3().addVectors(currentPosition, targetVector);

    // Determine effective easing for the relative tilt
    let effectiveEasingName = easingName;
    if (speed === 'very_fast') effectiveEasingName = 'linear';
    else if (speed === 'fast') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeOutQuad' : easingName;
    else if (speed === 'slow') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeInOutQuad' : easingName;
    if (effectiveEasingName !== easingName) {
        logger.debug(`Tilt: Speed '${speed}' selected easing '${effectiveEasingName}' (original: ${easingName})`);
    }

    // Generate commands ONLY for relative tilt
    commandsList.push({
      position: currentPosition.clone(),
      target: currentTarget.clone(), // Start from the current target state
      duration: 0,
      easing: effectiveEasingName
    });
    commandsList.push({
      position: currentPosition.clone(),
      target: finalTarget.clone(), // End with the calculated final target
      duration: stepDuration > 0 ? stepDuration : 0.1,
      easing: effectiveEasingName
    });
    logger.debug('Generated relative tilt commands:', commandsList);
  }

  // Return commands (if any) and the final state
  return {
    commands: commandsList,
    nextPosition: currentPosition.clone(), // Position is unchanged
    nextTarget: finalTarget.clone(),       // Target is updated
  };
} 