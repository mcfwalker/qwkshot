# Motion Blending Requirements

## 1. Goal

Implement the capability within the Prompt-to-Path (P2P) pipeline to execute multiple compatible motion primitives **concurrently** over the same time interval. This will enable more fluid, complex, and natural cinematic camera movements than purely sequential execution allows.

**Primary Objective:** Enable users to request blended motions via natural language prompts (e.g., "Dolly out while trucking left") and have the system generate a smooth, visually correct animation reflecting the combined movement.

**Secondary Objective:** Provide the necessary foundation for implementing high-level cinematic patterns (like "zigzag", "spiral") which inherently involve simultaneous movements.

## 2. Scope & Use Cases

*   **Initial Supported Combinations:** Define the specific pairs or groups of primitives that should support blending in the first implementation. Consider:
    *   Translation + Translation (e.g., `dolly` + `truck`, `dolly` + `pedestal`, `truck` + `pedestal`)
    *   Translation + Orbit (e.g., `dolly` + `orbit`, `truck` + `orbit`)
    *   Orbit + Pedestal/Zoom? (e.g., `orbit` + `pedestal` for spirals, `orbit` + `zoom`?)
    *   Pan/Tilt + Translation? (Less common, but possible? e.g., panning while trucking)
*   **Unsupported Combinations:** Explicitly list combinations that will *not* be supported initially or potentially ever (e.g., `dolly` + `dolly`, `static` + anything).
*   **Primary Test Case:** "Dolly out while trucking left" - this should be the benchmark for initial success.
*   **Future Consumers:** Note that implemented patterns (like zigzag, spiral) will eventually leverage this blending capability.

## 3. LLM Interaction & Prompting

*   **Trigger Phrases:** Identify keywords or phrasing the LLM should recognize as requests for blended motion (e.g., "while", "simultaneously", "as you", "at the same time").
*   **System Instructions:** How should the Assistant's instructions be updated to guide it in generating the new data structure for blended motion when these phrases are detected?
*   **Output Structure:** Define how the LLM should represent the request for blending in its output (likely influencing the decision in Section 4).

## 4. Data Structure Changes (`MotionPlan` / `MotionStep`)

Determine the best way to represent concurrent steps in the JSON `MotionPlan` that flows from the LLM (or potentially an adapter) to the `SceneInterpreter`. Options:

*   **Option A: Blend Step Type:**
    ```json
    { "type": "blend", "duration_ratio": 0.5, "steps": [ { "type": "dolly", ... }, { "type": "truck", ... } ] }
    ```
*   **Option B: Concurrent Flag:**
    ```json
    { "type": "dolly", ..., "concurrentWithNext": true },
    { "type": "truck", ... } // Both run over the duration of the first step?
    ```
*   **Option C: Array of Steps:**
    ```json
    // How to group them? Maybe nested array indicates concurrency?
    { "steps": [ {dolly}, [ {truck}, {orbit} ], {zoom} ] }
    ```
*   **Chosen Approach:** Select one option and detail its schema.
*   **Duration Handling:** Clarify how `duration_ratio` applies to a blended segment.

## 5. `SceneInterpreter` Modifications

This is the core technical challenge.

*   **Input Parsing:** Update the interpreter to recognize and correctly parse the chosen data structure (from Section 4) representing concurrent steps.
*   **Combined Effect Calculation:** Define the mathematical approach for combining the effects of blended primitives:
    *   **Translations:** Likely vector addition of the calculated position deltas from each translation primitive (`dolly`, `truck`, `pedestal`).
    *   **Rotations (Orbit/Pan/Tilt):** How to combine simultaneous rotations or rotation + translation? (e.g., Apply translation then rotation? Use quaternion multiplication/SLERP for combined rotation? Calculate target position changes separately and combine?).
    *   **Zoom:** How does zoom blend with other motions?
*   **State Update:** Ensure the camera's state (position, target) is updated correctly *after* each blended step calculation, before processing the next step.
*   **Constraint Application:** Apply safety constraints (min/max distance, height, collision detection via raycasting) to the *net calculated path* of the blended segment, not just individual component primitives.
*   **Easing:** Define how easing functions apply. Use a single easing function for the entire blended segment? Apply separate easing to components before combining (likely complex)?
*   **Target Resolution:** How are targets handled when primitives with potentially different implicit targets (e.g., `dolly` along view vector, `orbit` around `object_center`) are blended?

## 6. `AnimationController` Impact (Client-side)

*   **Goal:** Ideally, the `SceneInterpreter` should output `CameraCommand` keyframes that represent the *final, combined* path of the blended motion.
*   **Assessment:** If the interpreter successfully calculates the net effect and generates standard keyframes, the `AnimationController` might require minimal or no changes, as it just interpolates between the provided keyframes.
*   **Verification Needed:** Confirm that interpolating the keyframes generated from blended steps produces a smooth visual result.

## 7. Testing Strategy

*   **Core Cases:** Test the initial supported combinations (e.g., dolly+truck, dolly+orbit) with specific parameters.
*   **Prompts:** Use prompts with trigger phrases ("dolly out while trucking left", "orbit the top while moving up").
*   **Visual Verification:** Primarily rely on visual inspection of the resulting animation smoothness and correctness.
*   **Constraint Tests:** Ensure constraints are still respected during blended moves.
*   **Edge Cases:** Consider blending near boundaries, blending with very different magnitudes or speeds. 