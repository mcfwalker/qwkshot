import { Vector3, Quaternion } from 'three';
import * as THREE from 'three'; // For MathUtils
import { Logger } from '@/types/p2p/shared';
import { MotionStep } from '@/lib/motion-planning/types';
import { SceneAnalysis } from '@/types/p2p/scene-analyzer';
import { EnvironmentalAnalysis } from '@/types/p2p/environmental-analyzer';
import { ControlInstruction } from '@/types/p2p/camera-controls';
import {
  // resolveTargetPosition, // REMOVED unused import
  // clampPositionWithRaycast, // Not needed for pan
} from '../interpreter-utils';

// ADD THIS INTERFACE (or use a generic one if available)
interface PanStepResult {
  instructions: ControlInstruction[];
  nextPosition: Vector3;
  nextTarget: Vector3;
}

/**
 * Handles a 'pan' motion step.
 * Rotates the camera target horizontally (left/right) around the camera position.
 * Outputs ControlInstruction[] for camera-controls.
 */
export function handlePanStep(
  step: MotionStep,
  currentPosition: Vector3,
  currentTarget: Vector3,
  _stepDuration: number, // Prefixed as duration is handled by camera-controls smoothing
  _sceneAnalysis: SceneAnalysis, // Prefixed unused param
  _envAnalysis: EnvironmentalAnalysis, // Prefixed unused param
  logger: Logger
): PanStepResult { // REVISED RETURN TYPE
  logger.debug('Handling pan step (for camera-controls)...', step.parameters);

  const {
    direction: rawDirection,
    angle: rawAngle,
    // target: rawTargetName, // Pan doesn't typically use an explicit target, it rotates current
    // easing: rawEasingName = DEFAULT_EASING, // REMOVE Easing
    // speed: rawSpeed = 'medium' // REMOVE Speed, affects easing
  } = step.parameters;

  // Validate parameters
  const direction = typeof rawDirection === 'string' && (rawDirection === 'left' || rawDirection === 'right') ? rawDirection : null;
  const angle = typeof rawAngle === 'number' && rawAngle !== 0 ? rawAngle : null;
  // const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING; // REMOVE Easing
  // const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium'; // REMOVE Speed

  if (!direction) {
    logger.error(`Invalid or missing pan direction: ${rawDirection}. Skipping step.`);
    // return { commands: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() }; // OLD RETURN
    return { instructions: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() }; // REVISED NEW RETURN
  }
  if (angle === null) {
    logger.error(`Invalid, missing, or zero pan angle: ${rawAngle}. Skipping step.`);
    // return { commands: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() }; // OLD RETURN
    return { instructions: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() }; // REVISED NEW RETURN
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

  // Determine effective easing based on speed // REMOVE ALL EASING LOGIC
  // let effectiveEasingName = easingName;
  // if (speed === 'very_fast') effectiveEasingName = 'linear';
  // else if (speed === 'fast') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeOutQuad' : easingName;
  // else if (speed === 'slow') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeInOutQuad' : easingName;
  // if (effectiveEasingName !== easingName) {
  //     logger.debug(`Pan: Speed '${speed}' selected easing '${effectiveEasingName}' (original: ${easingName})`);
  // }

  // Create CameraCommands // REPLACE WITH ControlInstruction
  // const commandsList: CameraCommand[] = [];
  // commandsList.push({
  // position: currentPosition.clone(),
  // target: currentTarget.clone(),
  // duration: 0,
  // easing: effectiveEasingName
  // });
  // commandsList.push({
  // position: currentPosition.clone(), // Position does not change for pan
  // target: newTarget.clone(),
  // duration: stepDuration > 0 ? stepDuration : 0.1,
  // easing: effectiveEasingName
  // });
  // logger.debug('Generated pan commands:', commandsList);

  const instruction: ControlInstruction = {
    method: 'setLookAt',
    args: [
      currentPosition.x, currentPosition.y, currentPosition.z,
      newTarget.x, newTarget.y, newTarget.z,
      true // enableTransition
    ]
  };
  logger.debug('Generated pan control instruction:', instruction);

  // Return commands and the calculated next state
  // return { // OLD RETURN
  // commands: commandsList,
  // nextPosition: currentPosition.clone(), // Position is unchanged
  // nextTarget: newTarget.clone(),        // Target is updated
  // };
  return { // REVISED NEW RETURN
    instructions: [instruction],
    nextPosition: currentPosition.clone(),
    nextTarget: newTarget.clone(),
  };
} 