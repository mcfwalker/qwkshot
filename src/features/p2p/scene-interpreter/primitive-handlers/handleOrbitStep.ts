import * as THREE from 'three';
import { Vector3, Box3, Quaternion } from 'three';
import { CameraCommand } from '@/types/p2p/scene-interpreter';
import { PrimitiveStep } from '@/lib/motion-planning/types';
import { SceneAnalysis } from '@/types/p2p/scene-analyzer';
import { EnvironmentalAnalysis } from '@/types/p2p/environmental-analyzer';
import { Logger } from '@/types/p2p/shared';
import { easingFunctions, EasingFunctionName, DEFAULT_EASING } from '@/lib/easing';
import {
    resolveTargetPosition,
    clampPositionWithRaycast
} from '../interpreter-utils'; // Adjust path as needed

/**
 * Handles the interpretation of an 'orbit' motion step.
 * Generates intermediate keyframes for smooth rotation around a target point.
 *
 * @param step The orbit primitive step.
 * @param currentPosition Current camera position.
 * @param currentTarget Current camera target (used for resolving orbit center initially).
 * @param stepDuration Calculated duration for this step.
 * @param sceneAnalysis Scene context.
 * @param envAnalysis Environmental context.
 * @param logger Logger instance.
 * @returns An array of CameraCommands for the orbit operation.
 */
export function handleOrbitStep(
    step: PrimitiveStep,
    currentPosition: Vector3,
    currentTarget: Vector3, // Passed for resolving target
    stepDuration: number,
    sceneAnalysis: SceneAnalysis,
    envAnalysis: EnvironmentalAnalysis,
    logger: Logger
): CameraCommand[] {
    const commandsList: CameraCommand[] = [];

    // --- Start Orbit Logic (Moved from interpreter.ts) ---
    const {
        direction: rawDirection,
        angle: rawAngle,
        axis: rawAxisName = 'y',
        target: rawTargetName = 'object_center',
        easing: rawEasingName = DEFAULT_EASING,
        speed: rawSpeed = 'medium',
        radius_factor: rawRadiusFactor = 1.0 // Extract radius_factor
    } = step.parameters;

    // Type validation
    const direction = typeof rawDirection === 'string' && ('clockwise' === rawDirection || 'counter-clockwise' === rawDirection || 'left' === rawDirection || 'right' === rawDirection) ? rawDirection : null;
    const angle = typeof rawAngle === 'number' && rawAngle !== 0 ? rawAngle : null;
    let axisName = typeof rawAxisName === 'string' && ['x', 'y', 'z', 'camera_up'].includes(rawAxisName) ? rawAxisName : 'y';
    const targetName = typeof rawTargetName === 'string' ? rawTargetName : 'object_center';
    const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING;
    const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium';
    const radiusFactor = typeof rawRadiusFactor === 'number' && rawRadiusFactor > 0 ? rawRadiusFactor : 1.0;

    if (!direction) { logger.error(`Invalid orbit direction: ${rawDirection}. Skipping.`); return []; }
    if (angle === null) { logger.error(`Invalid orbit angle: ${rawAngle}. Skipping.`); return []; }

    // 1. Resolve orbit center
    let orbitCenter: Vector3;
    const resolvedTarget = resolveTargetPosition(targetName, sceneAnalysis, envAnalysis, currentTarget, logger);
    if (resolvedTarget) {
        orbitCenter = resolvedTarget.clone();
        logger.debug(`Orbit target '${targetName}' resolved to: ${orbitCenter.toArray()}`);
    } else {
        logger.warn(`Could not resolve orbit target '${targetName}'. Falling back.`);
        const baseCenter = sceneAnalysis?.spatial?.bounds?.center;
        if (baseCenter) {
            const userVerticalAdjustment = envAnalysis?.userVerticalAdjustment ?? 0;
            orbitCenter = baseCenter.clone().add(new Vector3(0, userVerticalAdjustment, 0));
            logger.debug(`Using fallback orbit center: ${orbitCenter.toArray()}`);
        } else {
            logger.error(`Cannot resolve orbit target/fallback. Skipping step.`);
            return [];
        }
    }

    // 2. Determine rotation axis vector
    let rotationAxis = new Vector3(0, 1, 0); // Default World Y
    if (axisName === 'x') rotationAxis.set(1, 0, 0);
    else if (axisName === 'z') rotationAxis.set(0, 0, 1);
    else if (axisName === 'camera_up') {
        const cameraDirection = new Vector3().subVectors(orbitCenter, currentPosition).normalize(); // Pointing towards orbit center
        const worldUp = new Vector3(0, 1, 0);
        let cameraRight = new Vector3().crossVectors(worldUp, cameraDirection).normalize();
        if (cameraRight.lengthSq() < 1e-9) cameraRight = new Vector3(1, 0, 0); // Handle gimbal lock looking up/down
        rotationAxis.crossVectors(cameraDirection, cameraRight).normalize();
        logger.debug(`Using camera_up axis: ${rotationAxis.toArray()}`);
    }

    // 3. Calculate rotation angle sign for step calculation
    let angleSign = (direction === 'clockwise' || direction === 'left') ? -1.0 : 1.0;
    logger.debug(`Orbit: Direction '${direction}' -> angleSign: ${angleSign}.`);

    // Determine effective easing based on speed
    let effectiveEasingName = easingName;
    if (speed === 'very_fast') effectiveEasingName = 'linear';
    else if (speed === 'fast') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeOutQuad' : easingName;
    else if (speed === 'slow') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeInOutQuad' : easingName;

    // 4. Generate Intermediate Keyframes
    const anglePerStep = 2; // Degrees per intermediate step
    const numSteps = Math.max(2, Math.ceil(Math.abs(angle) / anglePerStep));
    const angleStep = angle / (numSteps - 1);
    const durationStep = (stepDuration > 0 ? stepDuration : 0.1) / (numSteps - 1);
    const angleStepRad = THREE.MathUtils.degToRad(angleStep) * angleSign;
    const quaternionStep = new Quaternion().setFromAxisAngle(rotationAxis, angleStepRad);
    const radiusFactorPerStep = radiusFactor === 1.0 ? 1.0 : Math.pow(radiusFactor, 1 / (numSteps - 1)); // Apply radius change gradually

    logger.debug(`Orbit: Generating ${numSteps} steps for ${angle} deg. Step angleRad: ${angleStepRad.toFixed(4)}, Radius factor/step: ${radiusFactorPerStep.toFixed(4)}`);

    let previousPosition = currentPosition.clone();
    let currentRadiusVector = new Vector3().subVectors(previousPosition, orbitCenter);

    commandsList.push({
        position: previousPosition.clone(),
        target: orbitCenter.clone(),
        duration: 0,
        easing: 'linear' // Start command is instant
    });

    for (let i = 1; i < numSteps; i++) {
        currentRadiusVector.applyQuaternion(quaternionStep);
        if (radiusFactorPerStep !== 1.0) {
            currentRadiusVector.multiplyScalar(radiusFactorPerStep);
        }
        const newPositionCandidateStep = new Vector3().addVectors(orbitCenter, currentRadiusVector);
        let finalPositionStep = newPositionCandidateStep.clone();
        let clampedStep = false;

        // Constraint Checking (Apply to each intermediate step)
        const { cameraConstraints } = envAnalysis;
        const { spatial } = sceneAnalysis;
        if (cameraConstraints) {
            if (finalPositionStep.y < cameraConstraints.minHeight) { finalPositionStep.y = cameraConstraints.minHeight; clampedStep = true; }
            if (finalPositionStep.y > cameraConstraints.maxHeight) { finalPositionStep.y = cameraConstraints.maxHeight; clampedStep = true; }
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
        if (spatial?.bounds) {
            const objectBounds = new Box3(spatial.bounds.min, spatial.bounds.max);
            const clampedPositionStep = clampPositionWithRaycast(
                previousPosition, newPositionCandidateStep, objectBounds,
                envAnalysis.userVerticalAdjustment ?? 0, logger
            );
            if (!clampedPositionStep.equals(newPositionCandidateStep)) {
                finalPositionStep.copy(clampedPositionStep);
                clampedStep = true;
            }
        }
        if(clampedStep) logger.debug(`Orbit step ${i} clamped.`);

        commandsList.push({
            position: finalPositionStep.clone(),
            target: orbitCenter.clone(),
            duration: durationStep,
            easing: 'linear' // Intermediate steps are linear, overall curve via points
        });

        previousPosition = finalPositionStep.clone();
        // Update currentRadiusVector for next step's rotation base
        currentRadiusVector.subVectors(previousPosition, orbitCenter);
    }

    logger.debug('Generated orbit commands (multi-step):', commandsList);
    return commandsList;
    // --- End Orbit Logic ---
} 