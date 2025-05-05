import { Vector3 } from 'three';
import { Logger } from '@/types/p2p/shared';
import { MotionStep } from '@/lib/motion-planning/types';
import { SceneAnalysis } from '@/types/p2p/scene-analyzer';
import { EnvironmentalAnalysis } from '@/types/p2p/environmental-analyzer';
import { CameraCommand } from '@/types/p2p/scene-interpreter';
import { EasingFunctionName, easingFunctions, DEFAULT_EASING } from '@/lib/easing';
import {
  resolveTargetPosition,
  // No other utils specifically needed for focus_on logic itself
} from '../interpreter-utils';

interface FocusOnStepResult {
  commands: CameraCommand[];
  nextPosition: Vector3;
  nextTarget: Vector3;
}

/**
 * Handles a 'focus_on' motion step.
 * Changes the camera's target point without moving the camera position.
 */
export function handleFocusOnStep(
  step: MotionStep,
  currentPosition: Vector3,
  currentTarget: Vector3,
  stepDuration: number,
  sceneAnalysis: SceneAnalysis,
  envAnalysis: EnvironmentalAnalysis,
  logger: Logger
): FocusOnStepResult {
  logger.debug('Handling focus_on step...', step.parameters);

  const {
    target: rawTargetName,
    easing: rawEasingName = DEFAULT_EASING,
    speed: rawSpeed = 'medium'
    // adjust_framing: rawAdjustFraming = true, // Framing adjustment not implemented here
  } = step.parameters;

  const targetName = typeof rawTargetName === 'string' ? rawTargetName : null;
  if (!targetName) {
    logger.error('FocusOn: Missing required target parameter. Skipping step.');
    return { commands: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
  }

  const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING;
  const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium';

  // Resolve the new target position
  const focusTargetPosition = resolveTargetPosition(
    targetName,
    sceneAnalysis,
    envAnalysis,
    currentTarget, // Pass current target as context
    logger
  );

  if (!focusTargetPosition) {
    logger.error(`FocusOn: Could not resolve target position for '${targetName}'. Skipping step.`);
    return { commands: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
  }

  // Determine effective easing based on speed
  let effectiveEasingName = easingName;
  if (speed === 'very_fast') effectiveEasingName = 'linear';
  else if (speed === 'fast') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeOutQuad' : easingName;
  else if (speed === 'slow') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeInOutQuad' : easingName;
  if (effectiveEasingName !== easingName) {
    logger.debug(`FocusOn: Speed '${speed}' selected easing '${effectiveEasingName}' (original: ${easingName})`);
  }

  // Create commands: One to start, one to end looking at the new target
  const commandsList: CameraCommand[] = [];
  commandsList.push({
    position: currentPosition.clone(),
    target: currentTarget.clone(),
    duration: 0,
    easing: effectiveEasingName
  });
  commandsList.push({
    position: currentPosition.clone(), // Position does not change
    target: focusTargetPosition.clone(),
    duration: stepDuration > 0 ? stepDuration : 0.1,
    easing: effectiveEasingName
  });
  logger.debug('Generated focus_on commands:', commandsList);

  // Return commands and the calculated next state
  return {
    commands: commandsList,
    nextPosition: currentPosition.clone(), // Position is unchanged
    nextTarget: focusTargetPosition.clone(), // Target is updated
  };
} 