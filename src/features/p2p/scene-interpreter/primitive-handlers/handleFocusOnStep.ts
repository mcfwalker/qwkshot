import { Vector3 } from 'three';
import { CameraCommand } from '@/types/p2p/scene-interpreter';
import { PrimitiveStep } from '@/lib/motion-planning/types';
import { SceneAnalysis } from '@/types/p2p/scene-analyzer';
import { EnvironmentalAnalysis } from '@/types/p2p/environmental-analyzer';
import { Logger } from '@/types/p2p/shared';
import { easingFunctions, EasingFunctionName, DEFAULT_EASING } from '@/lib/easing';
import { resolveTargetPosition } from '../interpreter-utils';

/**
 * Handles the interpretation of a 'focus_on' motion step.
 * Changes the camera target point, potentially with a smooth transition.
 *
 * @returns An array of CameraCommands for the focus change.
 */
export function handleFocusOnStep(
    step: PrimitiveStep,
    currentPosition: Vector3,
    currentTarget: Vector3,
    stepDuration: number,
    sceneAnalysis: SceneAnalysis,
    envAnalysis: EnvironmentalAnalysis,
    logger: Logger
): CameraCommand[] {
    const commandsList: CameraCommand[] = [];

    // --- Start FocusOn Logic (Moved from interpreter.ts) ---
    const {
        target: rawTargetName,
        adjust_framing: rawAdjustFraming = true, // Default true
        speed: rawSpeed = 'medium',
        easing: rawEasingName = DEFAULT_EASING
    } = step.parameters;

    // Validate target
    const targetName = typeof rawTargetName === 'string' ? rawTargetName : null;
    if (!targetName) {
        logger.error(`FocusOn: Missing required target parameter. Skipping step.`);
        return [];
    }

    // Resolve the new target position
    const newTarget = resolveTargetPosition(
        targetName, sceneAnalysis, envAnalysis, currentTarget, logger
    );
    if (!newTarget) {
        logger.error(`FocusOn: Could not resolve target position for '${targetName}'. Skipping step.`);
        return [];
    }

    // Validate adjust_framing (log only for now)
    const adjustFraming = typeof rawAdjustFraming === 'boolean' ? rawAdjustFraming : true;
    if (adjustFraming) {
        logger.warn('FocusOn: adjust_framing=true requested, but not implemented. Only changing target.');
        // TODO: Implement framing adjustment logic (dolly/zoom) if needed
    }

    // Validate speed/easing for transition
    const easingName = typeof rawEasingName === 'string' && (rawEasingName in easingFunctions) ? rawEasingName as EasingFunctionName : DEFAULT_EASING;
    const speed = typeof rawSpeed === 'string' ? rawSpeed : 'medium';
    let effectiveEasingName = easingName;
    if (speed === 'fast') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeOutQuad' : easingName;
    else if (speed === 'slow') effectiveEasingName = (easingName === DEFAULT_EASING || easingName === 'linear') ? 'easeInOutQuad' : easingName;

    // Create CameraCommands (Position stays same, Target changes)
    // Check if target actually changed to avoid unnecessary commands
    if (!currentTarget.equals(newTarget)) {
        logger.debug(`FocusOn: Generating target change commands.`);
        commandsList.push({
            position: currentPosition.clone(),
            target: currentTarget.clone(), // Start at current target
            duration: 0,
            easing: effectiveEasingName
        });
        commandsList.push({
            position: currentPosition.clone(), // Position does not change
            target: newTarget.clone(), // End looking at the new target
            duration: stepDuration > 0 ? stepDuration : 0.1, // Use allocated duration
            easing: effectiveEasingName
        });
    } else {
        logger.debug('FocusOn: Target is already correct. Generating static hold if duration > 0.');
        // If target didn't change but step has duration, create a static hold
        if (stepDuration > 0) {
            commandsList.push({
                position: currentPosition.clone(),
                target: currentTarget.clone(),
                duration: stepDuration,
                easing: 'linear'
            });
        }
    }

    logger.debug(`Generated focus_on commands:`, commandsList);
    return commandsList;
    // Note: State update (currentTarget) happens in the main loop
    // --- End FocusOn Logic ---
} 