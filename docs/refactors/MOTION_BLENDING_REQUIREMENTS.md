# Motion Blending Requirements

## 1. Goal

Implement the capability within the Prompt-to-Path (P2P) pipeline to execute multiple compatible motion primitives **concurrently** over the same time interval. This will enable more fluid, complex, and natural cinematic camera movements than purely sequential execution allows.

**Primary Objective:** Enable users to request blended motions via natural language prompts (e.g., "Dolly out while trucking left") and have the system generate a smooth, visually correct animation reflecting the combined movement.

**Secondary Objective:** Provide the necessary foundation for implementing high-level cinematic patterns (like "zigzag", "spiral") which inherently involve simultaneous movements.

## 2. Scope & Use Cases

*   **Initial Supported Combinations:** Define the specific pairs or groups of primitives that should support blending in the first implementation. Tentative initial scope:
    *   Translation + Translation (e.g., `dolly` + `truck`, `dolly` + `pedestal`, `truck` + `pedestal`)
    *   Translation + Orbit (e.g., `dolly` + `orbit`, `truck` + `orbit`)
    *   Orbit + Pedestal (for spiral-like motion)
*   **Unsupported Combinations:** Explicitly list combinations that will *not* be supported initially: `dolly`+`dolly`, `truck`+`truck`, `pedestal`+`pedestal`, `static`+anything, `pan`+`tilt` (use `focus_on` or single `rotate`), potentially others TBD.
*   **Primary Test Case:** "Dolly out while trucking left" - this should be the benchmark for initial success.
*   **Future Consumers:** Note that implemented patterns (like zigzag, spiral) will eventually leverage this blending capability.

## 3. LLM Interaction & Prompting

*   **Trigger Phrases:** Identify keywords or phrasing the LLM should recognize as requests for blended motion (e.g., "while", "simultaneously", "as you", "at the same time").
*   **System Instructions:** Update Assistant instructions to guide it on recognizing blend requests and generating the appropriate output structure (see below).
*   **Output Structure Strategy:** Define how the LLM represents the blend request. **Chosen Strategy:** Potentially have the LLM output an intermediate, simpler structure indicating the intent to blend and the motions involved. The backend adapter layer would then normalize this into the standardized `type: "blend"` structure before it reaches the interpreter.
    *   *Example Intermediate LLM Output:* `{ "blend": true, "motions": [ { "type": "dolly", ... }, { "type": "truck", ... } ] }`
    *   This simplifies the LLM's task; the adapter handles enforcing the final strict schema.

## 4. Data Structure Changes (`MotionPlan` / `MotionStep`)

**Chosen Approach: Option A (Blend Step Type)**

Represent concurrent motions using a dedicated `blend` step type within the `MotionPlan.steps` array. This isolates the blended segment and allows uniform application of parameters like duration and easing.

**Schema:**

```json
{
  "type": "blend",
  "duration_ratio": 0.6, // Proportion of total plan duration for this blended segment
  "parameters": {
    "easing": "easeInOutCubic", // Optional: Easing for the entire blended segment
    // Other potential blend-level parameters?
    "steps": [
      // Array of standard MotionStep objects to execute concurrently
      { 
        "type": "dolly", 
        // Note: duration_ratio within sub-steps is ignored; blend duration applies
        "parameters": { "direction": "backward", "distance_descriptor": "large" }
      },
      { 
        "type": "truck", 
        "parameters": { "direction": "left", "distance_descriptor": "small" }
      }
      // Can potentially include more compatible primitives here
    ]
  }
}
```

*   **Duration Handling:** The `duration_ratio` at the top level of the `blend` step applies to the entire concurrent segment. Any `duration_ratio` specified within the nested `steps` is ignored.
*   **Easing:** An optional `easing` parameter at the `blend` level applies uniformly to the combined motion over the segment's duration.
*   **Nested Steps:** The `steps` array within `parameters` contains standard `MotionStep` definitions, excluding `duration_ratio`.

## 5. `SceneInterpreter` Modifications

This requires significant updates to the interpreter's core logic.

*   **Input Parsing:** Implement logic to identify `type: "blend"` steps and parse the nested `steps` array within `parameters`.
*   **Combined Effect Calculation Strategy:**
    *   **Independent Delta Calculation:** For each nested primitive step within the `blend` parameters, calculate its intended effect over the *full duration* of the blend segment as if it were running alone (e.g., target end position/orientation delta).
    *   **Translation Combination:** Sum the vector deltas calculated for all concurrent translation primitives (`dolly`, `truck`, `pedestal`) to get a single net translation vector.
    *   **Rotation Combination:**
        *   If blending translation(s) and a single rotation (e.g., `dolly` + `orbit`): Calculate the final orientation from the rotation, then apply the net translation vector relative to the start position.
        *   If blending multiple rotations (less common initial scope): Use quaternion multiplication or SLERP to find the net rotation quaternion.
    *   **Zoom Combination:** Treat zoom (FOV change or camera distance scaling) as an independent scalar interpolation that layers on top of positional/rotational changes.
*   **State Update & Interpolation:** Calculate the final target state (position, target/orientation, FOV) after applying the combined effects. Generate keyframes (start and end, potentially intermediate for complex curves) representing the smooth transition to this target state over the blend segment's duration.
*   **Constraint Application:** Apply safety constraints (min/max distance, height, collision raycasting with dynamic offset) to the *calculated net path* from the start state to the target end state of the *entire blended segment*. If the net path is invalid, reject or clamp the blended step.
*   **Easing:** Apply the specified `blend`-level `easing` function (or default) to the interpolation parameter `t` (from 0 to 1) over the segment's duration. Use the resulting `t_eased` to interpolate between the start and calculated target state: `newState = lerp(startState, targetState, t_eased)`.
*   **Target Resolution:** Before calculating deltas, resolve targets for each nested step. If conflicting targets are implied (e.g., dolly towards `current_target` while orbiting `object_center`), prioritize explicit targets or define a clear precedence rule (e.g., orbit target usually dominates). Default to using the camera's current target at the start of the blend segment if no specific targets are provided in the nested steps.

## 6. `AnimationController` Impact (Client-side)

*   **Goal:** Interpreter outputs standard `CameraCommand` keyframes representing the combined path.
*   **Assessment:** If the interpreter successfully generates valid start/end keyframes for the blended segment, the `AnimationController` should require **no changes**, as it simply interpolates between the states defined in the commands it receives.
*   **Verification Needed:** Confirm smooth visual interpolation occurs based on the keyframes generated for blended steps.

## 7. Testing Strategy

*   **Core Cases:** Test initial supported combinations (dolly+truck, dolly+orbit, orbit+pedestal) with varying parameters.
*   **Prompts:** Use prompts with trigger phrases ("dolly out while trucking left", "spiral up around the model").
*   **Visual Verification:** Primarily rely on visual inspection of animation smoothness and correctness.
*   **Snapshot Tests:** Programmatically save camera `position` and `quaternion`/`target` at intervals (e.g., t=0, 0.25, 0.5, 0.75, 1.0) during a blended animation for specific test prompts. Compare against expected values.
*   **Path Deviation Checks:** For relevant blends (e.g., orbit+dolly), plot the calculated camera path in 2D/3D and compare against expected shapes (e.g., helix for orbit+pedestal).
*   **Constraint Tests:** Ensure constraints (min/max distance/height, object collision) are respected during blended moves, using mocked scene setups.
*   **Edge Cases:** Test blending near boundaries, blending primitives with very different magnitudes or speeds, blending from various starting camera angles. 