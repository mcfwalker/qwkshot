import { Vector3, Box3, Quaternion } from 'three';
import * as THREE from 'three'; // For MathUtils
import { Logger } from '@/types/p2p/shared';
import { MotionStep } from '@/lib/motion-planning/types';
import { SceneAnalysis } from '@/types/p2p/scene-analyzer';
import { EnvironmentalAnalysis } from '@/types/p2p/environmental-analyzer';
import { ControlInstruction } from '@/types/p2p/camera-controls';
import { EasingFunctionName, easingFunctions, DEFAULT_EASING } from '@/lib/easing';
import {
  resolveTargetPosition,
  clampPositionWithRaycast,
  // mapDescriptorToValue, // Likely not needed for orbit
  // mapDescriptorToGoalDistance, // Likely not needed for orbit
  // normalizeDescriptor, // Likely not needed for orbit
} from '../interpreter-utils';

interface OrbitStepResult {
  instructions: ControlInstruction[];
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
  logger.debug('Handling orbit step (v3)...', step.parameters);

  const {
    direction: rawDirection,
    angle: rawAngle,
    axis: rawAxisName = 'y',
    target: rawTargetName = 'object_center',
  } = step.parameters;

  const direction = typeof rawDirection === 'string' && ['clockwise', 'counter-clockwise', 'left', 'right', 'up', 'down'].includes(rawDirection) ? rawDirection : null;
  const angleDegrees = typeof rawAngle === 'number' && rawAngle !== 0 ? rawAngle : null;
  let axisName = typeof rawAxisName === 'string' && ['x', 'y', 'z', 'camera_up'].includes(rawAxisName) ? rawAxisName : 'y';
  const targetName = typeof rawTargetName === 'string' ? rawTargetName : 'object_center';

  if (!direction || angleDegrees === null) {
    logger.error(`Invalid orbit parameters: direction='${rawDirection}', angle=${rawAngle}. Skipping.`);
    return { instructions: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
  }

  let orbitCenter = resolveTargetPosition(
    targetName,
    sceneAnalysis,
    envAnalysis,
    currentTarget,
    logger
  );

  if (!orbitCenter) {
    logger.warn(`Could not resolve orbit target '${targetName}'. Falling back.`);
    const baseCenter = sceneAnalysis?.spatial?.bounds?.center;
    if (baseCenter) {
      orbitCenter = baseCenter.clone().setY(baseCenter.y + (envAnalysis?.userVerticalAdjustment ?? 0));
    } else {
      logger.error('Fallback orbit center unavailable. Skipping step.');
      return { instructions: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
    }
  }

  // --- Logic for 'up' or 'down' direction (Polar Angle Orbit) ---
  if (direction === 'up' || direction === 'down') {
    logger.debug(`Orbit (v3): Simplified test for '${direction}' - setOrbitPoint & setTarget.`);
    const instructions: ControlInstruction[] = [];
    if (orbitCenter) {
      instructions.push({
        method: 'setOrbitPoint',
        args: [orbitCenter.x, orbitCenter.y, orbitCenter.z]
      });
      instructions.push({
        method: 'setTarget', 
        args: [orbitCenter.x, orbitCenter.y, orbitCenter.z, true] // Smoothly target the orbit point
      });
    } else {
      logger.error('Orbit (v3) polar test: orbitCenter is null. Skipping instructions.');
    }

    logger.debug('Generated simplified polar orbit test instructions (v3):', instructions);
    return {
      instructions,
      nextPosition: currentPosition.clone(),
      nextTarget: orbitCenter ? orbitCenter.clone() : currentTarget.clone(),
    };
  }

  // --- Existing Logic for 'left', 'right', 'clockwise', 'counter-clockwise' (Arbitrary Axis/Azimuthal Orbit) ---
  let rotationAxis = new Vector3(0, 1, 0); // Default World Y
  if (axisName === 'x') rotationAxis.set(1, 0, 0);
  else if (axisName === 'z') rotationAxis.set(0, 0, 1);
  else if (axisName === 'camera_up') {
    const cameraDirection = new Vector3().subVectors(currentTarget, currentPosition).normalize();
    const worldUp = new Vector3(0, 1, 0);
    let approxCamRight = new Vector3().crossVectors(worldUp, cameraDirection).normalize();
    if (approxCamRight.lengthSq() < 1e-6) approxCamRight = new Vector3(1, 0, 0);
    rotationAxis.crossVectors(cameraDirection, approxCamRight).normalize();
  }

  let angleSign = (direction === 'clockwise' || direction === 'left') ? -1.0 : 1.0;
  const angleRadians = THREE.MathUtils.degToRad(angleDegrees) * angleSign;
  logger.debug(`Orbit (v3) [Arbitrary Axis]: Center=${orbitCenter.toArray()}, Axis=${rotationAxis.toArray()}, AngleRad=${angleRadians.toFixed(4)}`);

  const radiusVector = new Vector3().subVectors(currentPosition, orbitCenter);
  const rotationQuaternion = new Quaternion().setFromAxisAngle(rotationAxis, angleRadians);
  radiusVector.applyQuaternion(rotationQuaternion);
  const finalPositionCandidate = new Vector3().addVectors(orbitCenter, radiusVector);

  let finalPosition = finalPositionCandidate.clone();
  const { cameraConstraints } = envAnalysis;
  const { spatial } = sceneAnalysis;
  const objectBounds = spatial?.bounds ? new Box3(spatial.bounds.min, spatial.bounds.max) : null;

  // --- Apply Constraints to the single finalPosition ---
  // a) Height
  if (cameraConstraints) {
    if (finalPosition.y < cameraConstraints.minHeight) {
      finalPosition.y = cameraConstraints.minHeight;
      logger.warn(`Orbit (v3): Clamped final Y to minHeight: ${finalPosition.y}`);
    }
    if (finalPosition.y > cameraConstraints.maxHeight) {
      finalPosition.y = cameraConstraints.maxHeight;
      logger.warn(`Orbit (v3): Clamped final Y to maxHeight: ${finalPosition.y}`);
    }
  }
  // b) Distance from orbitCenter
  if (cameraConstraints && orbitCenter) {
    const distanceToCenter = finalPosition.distanceTo(orbitCenter);
    let constrainedDistance = distanceToCenter;
    if (distanceToCenter < cameraConstraints.minDistance) {
      constrainedDistance = cameraConstraints.minDistance;
      logger.warn(`Orbit (v3): Clamping to minDistance (${constrainedDistance}) from orbit center.`);
    }
    if (distanceToCenter > cameraConstraints.maxDistance) {
      constrainedDistance = cameraConstraints.maxDistance;
      logger.warn(`Orbit (v3): Clamping to maxDistance (${constrainedDistance}) from orbit center.`);
    }
    if (constrainedDistance !== distanceToCenter) {
      const dir = new Vector3().subVectors(finalPosition, orbitCenter).normalize();
      if (dir.lengthSq() > 1e-9) { // Ensure not at the center
        finalPosition.copy(orbitCenter).addScaledVector(dir, constrainedDistance);
      } else { // If coincident with center, push out along original radius or default if needed
        const originalRadiusDir = new Vector3().subVectors(currentPosition, orbitCenter).normalize();
        if(originalRadiusDir.lengthSq() > 1e-9) { 
          finalPosition.copy(orbitCenter).addScaledVector(originalRadiusDir, constrainedDistance);
        } else { // Fallback if currentPosition was also at orbitCenter
          finalPosition.copy(orbitCenter).add(new Vector3(0,0,constrainedDistance)); // Default push along Z
          logger.warn('Orbit (v3): Current pos coincident with orbit center, pushed along Z for distance constraint.');
        }
      }
    }
  }
  // c) Bounding Box (raycast from currentPosition to finalPositionCandidate)
  if (objectBounds) {
    const clampedPositionResult = clampPositionWithRaycast(
      currentPosition, // Start of the intended orbit arc
      finalPositionCandidate, // End of the intended orbit arc (before other constraints)
      objectBounds,
      envAnalysis.userVerticalAdjustment ?? 0,
      logger
    );
    // If raycast changed the position, we prioritize it for safety, then re-check distance constraints briefly
    // This isn't perfect as complex interactions can occur, but it's an approximation.
    if (!clampedPositionResult.equals(finalPositionCandidate)) {
      logger.warn(`Orbit (v3): Position clamped by raycast. Original candidate: ${finalPositionCandidate.toArray()}, Clamped: ${clampedPositionResult.toArray()}`);
      finalPosition.copy(clampedPositionResult);
      // Optional: Re-check distance constraint if raycast significantly changed position near orbitCenter
      if (cameraConstraints && orbitCenter) { 
        const distAfterRayClamp = finalPosition.distanceTo(orbitCenter); 
        if (distAfterRayClamp < cameraConstraints.minDistance) { 
          const dir = new Vector3().subVectors(finalPosition, orbitCenter).normalize();
          if (dir.lengthSq() > 1e-9) finalPosition.copy(orbitCenter).addScaledVector(dir, cameraConstraints.minDistance);
          logger.warn('Orbit (v3): Re-clamped to minDistance after raycast.');
        }
      } 
    }
  } else {
    logger.warn('Orbit (v3): Bounding box data missing for constraint check.');
  }
  // --- End Constraint Application ---

  const instructions: ControlInstruction[] = [];

  if (orbitCenter) {
    instructions.push({
      method: 'setOrbitPoint',
      args: [orbitCenter.x, orbitCenter.y, orbitCenter.z]
    });
  }
  instructions.push({
    method: 'setPosition',
    args: [finalPosition.x, finalPosition.y, finalPosition.z, true]
  });

  logger.debug('Generated arbitrary axis orbit instructions (v3):', instructions);
  return {
    instructions,
    nextPosition: finalPosition.clone(),
    nextTarget: orbitCenter.clone(),
  };
} 