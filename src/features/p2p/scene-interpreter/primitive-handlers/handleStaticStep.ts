import { Vector3 } from 'three';
import { Logger } from '@/types/p2p/shared';
import { MotionStep } from '@/lib/motion-planning/types';
import { SceneAnalysis } from '@/types/p2p/scene-analyzer';
import { EnvironmentalAnalysis } from '@/types/p2p/environmental-analyzer';
import { CameraCommand } from '@/types/p2p/scene-interpreter';

interface StaticStepResult {
  commands: CameraCommand[];
  nextPosition: Vector3;
  nextTarget: Vector3;
}

/**
 * Handles a 'static' motion step.
 * Generates a command to hold the current camera position and target for the step duration.
 */
export function handleStaticStep(
  _step: MotionStep,
  currentPosition: Vector3,
  currentTarget: Vector3,
  stepDuration: number,
  _sceneAnalysis: SceneAnalysis,
  _envAnalysis: EnvironmentalAnalysis,
  logger: Logger
): StaticStepResult {
  logger.debug('Handling static step...');

  // Hold current position and target
  const command: CameraCommand = {
    position: currentPosition.clone(),
    target: currentTarget.clone(),
    duration: stepDuration > 0 ? stepDuration : 0.1, // Use provided duration or default
    easing: 'linear' // Static should always be linear
  };

  logger.debug('Generated static command:', command);

  // Return the command and the unchanged next state
  return {
    commands: [command],
    nextPosition: currentPosition.clone(),
    nextTarget: currentTarget.clone(),
  };
} 