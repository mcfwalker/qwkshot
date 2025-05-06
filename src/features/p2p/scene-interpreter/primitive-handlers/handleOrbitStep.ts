import { Vector3, Box3, Quaternion } from 'three';
import * as THREE from 'three'; // For MathUtils
import { Logger } from '@/types/p2p/shared';
import { MotionStep } from '@/lib/motion-planning/types';
import { SceneAnalysis } from '@/types/p2p/scene-analyzer';
import { EnvironmentalAnalysis } from '@/types/p2p/environmental-analyzer';
import { CameraCommand } from '@/types/p2p/scene-interpreter';
import { EasingFunctionName, easingFunctions, DEFAULT_EASING } from '@/lib/easing';
import {
  resolveTargetPosition,
  clampPositionWithRaycast,
  // mapDescriptorToValue, // Likely not needed for orbit
  // mapDescriptorToGoalDistance, // Likely not needed for orbit
  // normalizeDescriptor, // Likely not needed for orbit
} from '../interpreter-utils';

interface OrbitStepResult {
  commands: CameraCommand[];
  nextPosition: Vector3;
  nextTarget: Vector3;
}

/**
 * Handles an 'orbit' motion step.
 * Rotates the camera around a target point.
 */
export function handleOrbitStep(
  step: MotionStep,
  currentPosition: Vector3,
  currentTarget: Vector3, // May not be the orbit center
  stepDuration: number,
  sceneAnalysis: SceneAnalysis,
  envAnalysis: EnvironmentalAnalysis,
  logger: Logger
): OrbitStepResult {
  logger.debug('Handling orbit step...', step.parameters);

  const {
    direction: rawDirection,
    angle: rawAngle,
    axis: rawAxisName = 'y',
    target: rawTargetName = 'object_center',
    easing: rawEasingName = DEFAULT_EASING,
    speed: rawSpeed = 'medium'
  } = step.parameters;

  // Validate parameters
  const direction = typeof rawDirection === 'string' &&
    (rawDirection === 'clockwise' || rawDirection === 'counter-clockwise' || rawDirection === 'left' || rawDirection === 'right')
    ? rawDirection : null;
  const angle = typeof rawAngle === 'number' && rawAngle !== 0 ? rawAngle : null;
  let axisName = typeof rawAxisName === 'string' && ['x', 'y', 'z', 'camera_up'].includes(rawAxisName) ? rawAxisName : 'y';
  const targetName = typeof rawTargetName === 'string' ? rawTargetName : 'object_center';
  const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING;
  const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium';

  if (!direction) {
    logger.error(`Invalid or missing orbit direction: ${rawDirection}. Skipping step.`);
    return { commands: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
  }
  if (angle === null) {
    logger.error(`Invalid, missing, or zero orbit angle: ${rawAngle}. Skipping step.`);
    return { commands: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
  }
  if (rawAxisName !== axisName && typeof rawAxisName === 'string') {
    logger.warn(`Invalid or unsupported orbit axis: ${rawAxisName}. Defaulting to '${axisName}'.`);
  }

  // Resolve orbit center
  let orbitCenter = resolveTargetPosition(
    targetName,
    sceneAnalysis,
    envAnalysis,
    currentTarget, // Pass current target as context/fallback
    logger
  );

  if (!orbitCenter) {
    logger.warn(`Could not resolve orbit target '${targetName}'. Falling back to normalized object_center.`);
    const baseCenter = sceneAnalysis?.spatial?.bounds?.center;
    if (baseCenter) {
      const userVerticalAdjustment = envAnalysis?.userVerticalAdjustment ?? 0;
      orbitCenter = baseCenter.clone();
      orbitCenter.y += userVerticalAdjustment;
      logger.debug(`Using fallback orbit center: ${orbitCenter.toArray()}`);
    } else {
      logger.error(`Cannot resolve orbit target '${targetName}' and fallback object center is unavailable. Skipping step.`);
      return { commands: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
    }
  }

  // Determine rotation axis vector
  let rotationAxis = new Vector3(0, 1, 0); // Default World Y
  if (axisName === 'x') rotationAxis.set(1, 0, 0);
  else if (axisName === 'z') rotationAxis.set(0, 0, 1);
  else if (axisName === 'camera_up') {
    // Use currentTarget provided to the function
    const cameraDirection = new Vector3().subVectors(currentTarget, currentPosition).normalize();
    // Robust calculation avoiding alignment issues
    const worldUp = new Vector3(0, 1, 0);
    let approxCamRight = new Vector3().crossVectors(worldUp, cameraDirection);
    if (approxCamRight.lengthSq() < 1e-6) { // Handle looking straight up/down
      approxCamRight = new Vector3(1, 0, 0); // Use world X if up/down
    }
    approxCamRight.normalize();
    rotationAxis.crossVectors(cameraDirection, approxCamRight).normalize();
    logger.debug(`Using camera_up axis: ${rotationAxis.toArray()}`);
  }

  // Calculate rotation angle sign
  let angleSign = 1.0;
  if (direction === 'clockwise' || direction === 'left') {
    angleSign = -1.0;
    logger.debug(`Orbit: Interpreting direction '${direction}' as physically clockwise (angleSign: -1).`);
  } else {
    angleSign = 1.0;
    logger.debug(`Orbit: Interpreting direction '${direction}' as physically counter-clockwise (angleSign: 1).`);
  }

  // Determine effective easing
  let effectiveEasingName = easingName;
  if (speed === 'very_fast') effectiveEasingName = 'linear';
  else if (speed === 'fast') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeOutQuad' : easingName;
  else if (speed === 'slow') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeInOutQuad' : easingName;
  if (effectiveEasingName !== easingName) {
      logger.debug(`Orbit: Speed '${speed}' selected easing '${effectiveEasingName}' (original: ${easingName})`);
  }

  // Generate Intermediate Keyframes
  const commandsList: CameraCommand[] = [];
  const anglePerStep = 45; // Degrees per intermediate step - INCREASED FROM 20
  const numSteps = Math.max(2, Math.ceil(Math.abs(angle) / anglePerStep));
  // Ensure numSegments is not zero if numSteps is 2 (angle <= anglePerStep)
  const numSegments = Math.max(1, numSteps - 1);
  const angleStep = angle / numSegments; 
  const durationStep = (stepDuration > 0 ? stepDuration : 0.1) / numSegments;
  const angleStepRad = THREE.MathUtils.degToRad(angleStep) * angleSign;
  const quaternionStep = new Quaternion().setFromAxisAngle(rotationAxis, angleStepRad);

  logger.debug(`Orbit: Generating ${numSteps} steps for ${angle} degrees. Target anglePerStep: ${anglePerStep} deg. Actual step angle: ${angleStep.toFixed(2)} deg`); // Updated log

  let previousPosition = currentPosition.clone();
  const { spatial } = sceneAnalysis;
  const objectBounds = spatial?.bounds ? new Box3(spatial.bounds.min, spatial.bounds.max) : null;

  // Add the initial state command (looking at the orbit center)
  commandsList.push({
    position: previousPosition.clone(),
    target: orbitCenter.clone(),
    duration: 0,
    easing: 'linear' // Use linear for transitions between orbit steps
  });

  for (let i = 1; i < numSteps; i++) {
    const radiusVectorStep = new Vector3().subVectors(previousPosition, orbitCenter);
    radiusVectorStep.applyQuaternion(quaternionStep);
    const newPositionCandidateStep = new Vector3().addVectors(orbitCenter, radiusVectorStep);
    let finalPositionStep = newPositionCandidateStep.clone();
    let clampedStep = false;

    // --- Constraint Checking (Height, Distance, Bounding Box) ---
    const { cameraConstraints } = envAnalysis;
    // a) Height
    if (cameraConstraints) {
      if (finalPositionStep.y < cameraConstraints.minHeight) {
        finalPositionStep.y = cameraConstraints.minHeight; clampedStep = true;
      }
      if (finalPositionStep.y > cameraConstraints.maxHeight) {
        finalPositionStep.y = cameraConstraints.maxHeight; clampedStep = true;
      }
    }
    // b) Distance
    if (cameraConstraints) {
      const distanceToCenterStep = finalPositionStep.distanceTo(orbitCenter);
      if (distanceToCenterStep < cameraConstraints.minDistance) {
        const dir = new Vector3().subVectors(finalPositionStep, orbitCenter).normalize();
        finalPositionStep.copy(orbitCenter).addScaledVector(dir, cameraConstraints.minDistance);
        clampedStep = true;
      }
      if (distanceToCenterStep > cameraConstraints.maxDistance) {
        const dir = new Vector3().subVectors(finalPositionStep, orbitCenter).normalize();
        finalPositionStep.copy(orbitCenter).addScaledVector(dir, cameraConstraints.maxDistance);
        clampedStep = true;
      }
    }
    // c) Bounding Box
    if (objectBounds) {
      const clampedPositionStep = clampPositionWithRaycast(
        previousPosition,
        newPositionCandidateStep,
        objectBounds,
        envAnalysis.userVerticalAdjustment ?? 0,
        logger
      );
      if (!clampedPositionStep.equals(newPositionCandidateStep)) {
        finalPositionStep.copy(clampedPositionStep);
        clampedStep = true;
        logger.warn(`Orbit step ${i}: Clamped position due to raycast.`);
      }
    } else {
         logger.warn(`Orbit step ${i}: Bounding box data missing, skipping constraint check.`);
    }
    // --- End Constraints ---

    commandsList.push({
      position: finalPositionStep.clone(),
      target: orbitCenter.clone(),
      duration: durationStep,
      easing: 'linear' // Use linear between orbit steps
    });

    previousPosition = finalPositionStep.clone();
  }

  // Apply the final intended easing to the *last* generated step command
  if (commandsList.length > 1) {
      commandsList[commandsList.length - 1].easing = effectiveEasingName;
  }

  logger.debug(`Generated orbit commands (${commandsList.length} steps):`, commandsList);

  // The final state is the last position calculated and the orbit center
  return {
    commands: commandsList,
    nextPosition: previousPosition.clone(), // Position after the last step
    nextTarget: orbitCenter.clone(),      // End looking at the orbit center
  };
} 