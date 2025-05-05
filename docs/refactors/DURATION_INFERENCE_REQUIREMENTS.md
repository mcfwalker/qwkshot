# Duration Inference from Speed Qualifiers - Requirements

## 1. Motivation & Goal

**Motivation:** Currently, the system relies on either a default total duration (e.g., 10s) or an explicit duration provided by the user. This often conflicts with natural language speed qualifiers (e.g., "dolly in *fast*") leading to animations that feel paced incorrectly relative to the request. Requiring users to always specify duration numerically hinders the intuitiveness of the natural language interface.

**Goal:** Enable the P2P pipeline to intelligently infer appropriate step durations based on natural language speed qualifiers (e.g., "fast", "slowly", "quick"), motion type, and movement magnitude, while still allowing users to override with an explicit total duration if desired. This will create a more intuitive and satisfying user experience.

## 2. Scope

*   **In Scope:**
    *   Updating LLM Assistant instructions/KB to identify and normalize speed qualifiers into a canonical set (e.g., `very_fast`, `fast`, `medium`, `slow`, `very_slow`).
    *   Adding a `speed_descriptor` field (optional) to the `MotionStep` parameters within the `MotionPlan`.
    *   Implementing a duration calculation/allocation phase within `SceneInterpreterImpl.interpretPath` that runs *before* dispatching to primitive handlers.
    *   This phase will calculate a context-aware reference duration for each step (based on type, magnitude, scene scale).
    *   It will scale the reference duration based on the `speed_descriptor` (if provided).
    *   It will handle normalization: if `MotionPlan.metadata.requested_duration` exists, scale all calculated step durations proportionally to match it; otherwise, the total duration is the sum of calculated step durations.
    *   Passing the final calculated `stepDuration` to each primitive handler.
*   **Out of Scope:**
    *   Complex physics-based simulation for duration (e.g., accounting for acceleration limits beyond simple scaling).
    *   Changing the core logic within individual primitive handlers (they continue to accept `stepDuration`).
    *   Frontend changes (the `AnimationController` will receive commands with varying durations as calculated by the backend).

## 3. Proposed Implementation

1.  **LLM / MotionPlan Update:**
    *   Modify Assistant instructions to identify speed terms and map them to canonical values: `very_fast`, `fast`, `medium`, `slow`, `very_slow`.
    *   The Assistant should include an optional `speed_descriptor` parameter in relevant `MotionStep` objects within the generated `MotionPlan`. Example:
        ```json
        {
          "type": "dolly",
          "parameters": {
            "direction": "forward",
            "distance_descriptor": "medium",
            "speed_descriptor": "fast" // <-- New optional parameter
          },
          "duration_ratio": null // duration_ratio becomes less relevant or potentially deprecated
        }
        ```

2.  **Backend: `SceneInterpreterImpl.interpretPath` Duration Calculation Phase:**
    *   **Location:** Add a new private helper method (e.g., `_calculateStepDurations`) called near the beginning of `interpretPath`, replacing the existing simple duration allocation logic.
    *   **Logic (`_calculateStepDurations`):**
        *   Takes the `MotionPlan`, `sceneAnalysis`, and `initialCameraState` as input.
        *   Initializes `idealStepDurations: number[] = []` and `calculatedStepStates: {position: Vector3, target: Vector3}[] = []` (to track state changes purely for magnitude calculation).
        *   Iterates through `plan.steps` once:
            *   For each `step`, determine its magnitude (distance/angle). This requires partially simulating the step's effect based on its parameters and the *calculated* state from the *previous* step in this pre-pass. Use utility functions (`resolveTargetPosition`, `mapDescriptorToValue`, etc.) as needed.
            *   Estimate a `referenceDuration` based on motion type (e.g., base speeds for dolly, truck, orbit) and the calculated magnitude (e.g., `duration = distance / baseSpeed`). Scene scale (`sceneAnalysis.spatial.bounds.getSize().length()`) should factor into base speeds.
            *   Get the `speed_descriptor` from `step.parameters` (default to `medium`).
            *   Apply a scaling factor to `referenceDuration` based on `speed_descriptor`. Example factors (tune these):
                *   `very_fast`: 0.3x
                *   `fast`: 0.6x
                *   `medium`: 1.0x
                *   `slow`: 1.8x
                *   `very_slow`: 3.0x
            *   Store the resulting `scaledDuration` in `idealStepDurations`.
            *   Calculate and store the approximate end state (position/target) of this step in `calculatedStepStates` to be used for the *next* step's magnitude calculation in this pre-pass loop.
        *   After iterating through all steps, calculate `totalIdealDuration = idealStepDurations.reduce(...)`.
        *   Check for `plan.metadata.requested_duration`:
            *   If `requested_duration` exists and is valid (`> 0`): Calculate `normalizationFactor = requested_duration / totalIdealDuration`. Apply this factor to every duration in `idealStepDurations`.
            *   If `requested_duration` does not exist or is invalid: The final durations are simply the `idealStepDurations` as calculated.
        *   Return the final array of step durations.
    *   **`interpretPath` Main Loop:** Use the durations returned by `_calculateStepDurations` when calling each primitive handler.

3.  **Primitive Handlers:**
    *   No changes needed. They receive the final `stepDuration` and execute as before.

## 4. Testing Strategy

*   Test prompts with explicit speed qualifiers (e.g., "dolly in fast", "orbit slowly").
*   Test prompts with mixed speed qualifiers (e.g., "truck left fast, then pedestal up slowly").
*   Test prompts with speed qualifiers *and* an explicit total duration (verify normalization works).
*   Test prompts *without* speed qualifiers or explicit duration (verify fallback to `medium` speed calculation).
*   Visually inspect the resulting animation pacing to tune reference speeds and scaling factors.

## 5. Definition of Done

*   LLM Assistant correctly identifies speed qualifiers and includes `speed_descriptor` in `MotionPlan`.
*   `SceneInterpreterImpl` calculates step durations based on motion type, magnitude, context, and `speed_descriptor`.
*   `SceneInterpreterImpl` correctly normalizes calculated durations if an explicit `requested_duration` is provided.
*   Animations generated from prompts with speed qualifiers exhibit noticeably different pacing compared to prompts without them.
*   Regression tests pass, ensuring existing functionality is not broken. 