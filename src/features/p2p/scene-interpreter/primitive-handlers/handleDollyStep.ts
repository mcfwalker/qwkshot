import { Vector3, Box3 } from 'three';
import { Logger } from '@/types/p2p/shared';
import { MotionStep } from '@/lib/motion-planning/types';
import { SceneAnalysis } from '@/types/p2p/scene-analyzer';
import { EnvironmentalAnalysis } from '@/types/p2p/environmental-analyzer';
import { ControlInstruction } from '@/types/p2p/camera-controls';
import { EasingFunctionName, easingFunctions, DEFAULT_EASING } from '@/lib/easing';
import {
  resolveTargetPosition,
  clampPositionWithRaycast,
  mapDescriptorToValue,
  mapDescriptorToGoalDistance,
  normalizeDescriptor,
} from '../interpreter-utils'; // Import utils from the parent directory

interface DollyStepResult {
  instructions: ControlInstruction[];
  nextPosition: Vector3;
  nextTarget: Vector3;
}

/**
 * Handles a 'dolly' motion step.
 * Moves the camera forward or backward along its view direction.
 * Outputs ControlInstruction for camera-controls library.
 */
export function handleDollyStep(
  step: MotionStep,
  currentPosition: Vector3,
  currentTarget: Vector3,
  stepDuration: number, // Note: stepDuration is not directly used by camera-controls' dollyTo transition
  sceneAnalysis: SceneAnalysis,
  envAnalysis: EnvironmentalAnalysis,
  logger: Logger
): DollyStepResult {
  logger.debug('Handling dolly step (v3)...', step.parameters);

  const {
    direction: rawDirection,
    distance_descriptor: rawDistanceDescriptor,
    distance_override: rawDistanceOverride,
    destination_target: rawDestinationTargetName,
    target_distance_descriptor: rawGoalDistanceDescriptor,
  } = step.parameters;

  let direction: string | null = null;
  let effectiveDistance: number | null = null;

  // Priority 1: Goal Distance Descriptor
  const goalDistanceDescriptor = normalizeDescriptor(rawGoalDistanceDescriptor);
  if (goalDistanceDescriptor) {
    const currentDistanceToTarget = currentPosition.distanceTo(currentTarget);
    const goalDistance = mapDescriptorToGoalDistance(goalDistanceDescriptor, sceneAnalysis, logger);
    const delta = currentDistanceToTarget - goalDistance;

    if (Math.abs(delta) < 1e-6) {
      logger.debug(`Dolly (v3): Already at goal distance for descriptor '${goalDistanceDescriptor}'. Generating no-op instruction.`);
      // For no-op, we could return an empty instructions array or a specific no-op instruction if camera-controls needs it.
      // For now, let's predict current state with an empty instruction. The SceneInterpreter should handle empty instructions gracefully.
      // Alternatively, a setPosition/setTarget instruction to current state could be used if an instruction is always expected.
      // For camera-controls, if no change is needed, perhaps no instruction is best.
      // However, the plan implies an instruction is generated. 'dollyTo' current distance is effectively a no-op if already there.
      const instruction: ControlInstruction = {
        method: 'dollyTo',
        args: [currentDistanceToTarget, true], // Dolly to current distance = no visual change
      };
      return {
        instructions: [instruction],
        nextPosition: currentPosition.clone(),
        nextTarget: currentTarget.clone(),
      };
    }
    direction = delta > 0 ? 'forward' : 'backward';
    effectiveDistance = Math.abs(delta);
    logger.debug(
      `Dolly (v3): Goal descriptor '${goalDistanceDescriptor}' -> goalDist=${goalDistance.toFixed(3)}, current=${currentDistanceToTarget.toFixed(3)}, delta=${delta.toFixed(3)}, direction='${direction}', effectiveDistance=${effectiveDistance.toFixed(3)}`
    );
  }

  // Priority 1.5: Destination Target (only if goal distance wasn't primary)
  const destinationTargetName = typeof rawDestinationTargetName === 'string' ? rawDestinationTargetName : null;
  if (effectiveDistance === null && destinationTargetName) {
    logger.debug(`Dolly (v3): Destination target '${destinationTargetName}' provided.`);
    const destinationTarget = resolveTargetPosition(
      destinationTargetName,
      sceneAnalysis,
      envAnalysis,
      currentTarget,
      logger
    );
    if (destinationTarget) {
      const viewDirectionVec = new Vector3().subVectors(currentTarget, currentPosition).normalize();
      if (viewDirectionVec.lengthSq() >= 1e-9) {
        const displacementVector = new Vector3().subVectors(destinationTarget, currentPosition);
        const signedDistance = displacementVector.dot(viewDirectionVec);
        direction = signedDistance >= 0 ? 'forward' : 'backward';
        effectiveDistance = Math.abs(signedDistance);
        logger.debug(`Dolly (v3): Calculated destination move: direction='${direction}', distance=${effectiveDistance.toFixed(2)}`);
      } else {
        logger.warn('Dolly (v3): Cannot calculate view direction for destination move. Ignoring destination_target.');
      }
    } else {
      logger.warn(`Dolly (v3): Could not resolve destination target '${destinationTargetName}'. Ignoring.`);
    }
  }

  // Determine direction if not set by goal/destination
  if (!direction) {
    let assistantDirection = typeof rawDirection === 'string' ? rawDirection.toLowerCase() : null;
    if (assistantDirection === 'in') assistantDirection = 'forward';
    if (assistantDirection === 'out') assistantDirection = 'backward';
    if (assistantDirection === 'forward' || assistantDirection === 'backward') {
      direction = assistantDirection;
    } else {
      logger.error(`Dolly (v3): Invalid or missing dolly direction: ${rawDirection} (and destination/goal failed). Skipping step.`);
      return {
        instructions: [],
        nextPosition: currentPosition.clone(),
        nextTarget: currentTarget.clone(),
      };
    }
  }

  // Determine effective distance if not set by goal/destination
  if (effectiveDistance === null) {
    // Priority 2: Distance Override
    if (typeof rawDistanceOverride === 'number' && rawDistanceOverride > 0) {
      effectiveDistance = rawDistanceOverride;
      logger.debug(`Dolly (v3): Using distance_override: ${effectiveDistance}`);
    } else {
      // Priority 3: Distance Descriptor
      const distanceDescriptor = normalizeDescriptor(rawDistanceDescriptor);
      if (distanceDescriptor) {
        effectiveDistance = mapDescriptorToValue(
          distanceDescriptor,
          'distance',
          'dolly',
          sceneAnalysis,
          envAnalysis,
          { position: currentPosition, target: currentTarget },
          logger
        );
        logger.debug(`Dolly (v3): Mapped distance_descriptor '${distanceDescriptor}' to distance: ${effectiveDistance}`);
      } else {
        logger.error(`Dolly (v3): No valid distance found (no goal, destination, override, or descriptor). Skipping step.`);
        return {
          instructions: [],
          nextPosition: currentPosition.clone(),
          nextTarget: currentTarget.clone(),
        };
      }
    }
  }

  // Final validation of distance
  if (effectiveDistance === null || effectiveDistance < 0) {
    logger.error(`Dolly (v3): Final effective distance is invalid (${effectiveDistance}). Skipping step.`);
    return { instructions: [], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
  }

  if (effectiveDistance < 1e-6) {
    logger.debug('Dolly (v3): Effective distance is zero. Generating no-op instruction.');
    const currentDistanceToTarget = currentPosition.distanceTo(currentTarget);
    const instruction: ControlInstruction = {
      method: 'dollyTo',
      args: [currentDistanceToTarget, true], // Dolly to current distance
    };
    return { instructions: [instruction], nextPosition: currentPosition.clone(), nextTarget: currentTarget.clone() };
  }

  // Calculate movement vector
  const viewDirection = new Vector3().subVectors(currentTarget, currentPosition).normalize();
  // Ensure viewDirection is valid before proceeding
  if (viewDirection.lengthSq() < 1e-9) { // Check for zero vector
    logger.warn('Dolly (v3): currentPosition and currentTarget are too close, cannot determine view direction. Skipping dolly.');
    const currentDistanceToTarget = currentPosition.distanceTo(currentTarget);
    const instruction: ControlInstruction = {
      method: 'dollyTo',
      args: [currentDistanceToTarget, true], // Effectively a no-op or stay put
    };
    return {
      instructions: [instruction],
      nextPosition: currentPosition.clone(),
      nextTarget: currentTarget.clone(),
    };
  }
  const moveVector = viewDirection.multiplyScalar(effectiveDistance * (direction === 'forward' ? 1 : -1));

  // Calculate candidate position
  const newPositionCandidate = new Vector3().addVectors(currentPosition, moveVector);
  let finalPosition = newPositionCandidate.clone();

  // --- Constraint Checking ---
  const { cameraConstraints } = envAnalysis;
  const { spatial } = sceneAnalysis;

  // a) Height constraints
  if (cameraConstraints) {
    if (finalPosition.y < cameraConstraints.minHeight) {
      finalPosition.y = cameraConstraints.minHeight;
      logger.warn(`Dolly (v3): Clamped position to minHeight (${cameraConstraints.minHeight})`);
    }
    if (finalPosition.y > cameraConstraints.maxHeight) {
      finalPosition.y = cameraConstraints.maxHeight;
      logger.warn(`Dolly (v3): Clamped position to maxHeight (${cameraConstraints.maxHeight})`);
    }
  }

  // b) Distance constraints (relative to currentTarget)
  if (cameraConstraints) {
    const distanceToTargetCandidate = finalPosition.distanceTo(currentTarget);
    let constrainedDistance = distanceToTargetCandidate;

    if (distanceToTargetCandidate < cameraConstraints.minDistance) {
      constrainedDistance = cameraConstraints.minDistance;
      logger.warn(`Dolly (v3): Clamping to minDistance (${cameraConstraints.minDistance}) from target.`);
    }
    if (distanceToTargetCandidate > cameraConstraints.maxDistance) {
      constrainedDistance = cameraConstraints.maxDistance;
      logger.warn(`Dolly (v3): Clamping to maxDistance (${cameraConstraints.maxDistance}) from target.`);
    }

    if (constrainedDistance !== distanceToTargetCandidate) {
      // Recalculate finalPosition based on the constrained distance from the target
      const directionFromTarget = new Vector3().subVectors(finalPosition, currentTarget).normalize();
      if (directionFromTarget.lengthSq() > 1e-9) { // Ensure not at the target
        finalPosition.copy(currentTarget).addScaledVector(directionFromTarget, constrainedDistance);
      } else {
        // If camera is AT the target and needs to be pushed out to minDistance, pick a default direction (e.g., up along Y)
        // This case should ideally be rare for dolly. If it happens, move along global Y or a default view vector.
        // For now, this situation suggests currentTarget and finalPosition are coincident.
        // Let's assume the original viewDirection is more reliable here if target hasn't changed.
        const originalViewDirection = new Vector3().subVectors(currentPosition, currentTarget).normalize();
        if (originalViewDirection.lengthSq() > 1e-9) {
          finalPosition.copy(currentTarget).addScaledVector(originalViewDirection, constrainedDistance);
        } else {
          // Fallback if original view direction is also zero (e.g. camera started at target)
          // Push out along Y axis by default for minDistance
          finalPosition.copy(currentTarget).add(new Vector3(0, constrainedDistance, 0));
          logger.warn(`Dolly (v3): Camera and target are coincident. Pushed out to minDistance along Y axis.`);
        }
      }
    }
  }

  // c) Bounding box constraint
  // This should be applied *after* height and distance constraints, using the position derived from them.
  if (spatial?.bounds) {
    const objectBounds = new Box3(spatial.bounds.min, spatial.bounds.max);
    // Raycast from currentTarget to the potential finalPosition to ensure it's outside the (adjusted) bounding box.
    // The clampPositionWithRaycast might need adjustment for camera-controls logic.
    // For now, we use the existing `clampPositionWithRaycast` which checks from `currentPosition` to `newPositionCandidate`.
    // Let's use the `finalPosition` before this step as the `startPosForRaycast` if it was modified by height/distance constraints,
    // otherwise use `currentPosition`.
    const startPosForRaycast = (finalPosition.equals(newPositionCandidate)) ? currentPosition : finalPosition;
    const clampedPositionResult = clampPositionWithRaycast(
      startPosForRaycast, // Start of the movement segment for raycasting
      finalPosition,    // Desired end position after all other constraints
      objectBounds,
      envAnalysis.userVerticalAdjustment ?? 0, // userVerticalAdjustment is handled inside clampPositionWithRaycast by offsetting bounds
      logger
    );
    if (!clampedPositionResult.equals(finalPosition)) {
      finalPosition.copy(clampedPositionResult);
      logger.warn(`Dolly (v3): Clamped position due to raycast against object bounds.`);
    }
  } else {
    logger.warn('Dolly (v3): Bounding box data missing, skipping bounding box constraint check.');
  }
  // --- End Constraint Checking ---

  // Determine the final distance for the dollyTo command AFTER all constraints.
  const finalDistanceToTarget = finalPosition.distanceTo(currentTarget);

  // Create ControlInstruction
  const instruction: ControlInstruction = {
    method: 'dollyTo',
    args: [finalDistanceToTarget, true], // true for enableTransition
  };
  logger.debug('Generated dolly instruction (v3):', instruction, 'nextPosition:', finalPosition, 'nextTarget:', currentTarget);

  // Return instruction and the calculated next state
  return {
    instructions: [instruction],
    nextPosition: finalPosition.clone(),
    nextTarget: currentTarget.clone(), // Target remains unchanged
  };
} 