# P2P Pipeline Enhancement Roadmap

This document outlines the proposed sequence for implementing major enhancements and features for the Prompt-to-Path (P2P) pipeline, following the completion of the Backend Normalization and Primitive Implementation refactors.

## Proposed Sequence

1.  **Complete Primitives (Visual Roll)**
    *   **Task:** Implement the visual effect for the `rotate` primitive when `axis: 'roll'` is specified. This requires updating the `SceneInterpreter` and likely the client-side `AnimationController` to handle camera `up` vector interpolation (e.g., using Quaternions and SLERP) and potential conflicts with `OrbitControls`.
    *   **Goal:** Complete the full intended functionality of all defined motion primitives.

2.  **Pattern Layer Implementation**
    *   **Task 1: Pattern KB Definition:** Define the structure and initial content for a Pattern Knowledge Base (`pattern_kb.json`) listing high-level motion patterns (e.g., `fly_by`, `zig_zag`, `reveal`) and their parameters.
    *   **Task 2: Assistant Function Spec:** Define the specific function signature (`compose_pattern({ pattern: <patternName>, ...parameters })`) that the Assistant should call when it detects a pattern request.
    *   **Task 3: Backend Pattern Composers:** Implement backend logic (potentially a new module or service) that receives calls from the Assistant (via the adapter/API route) and translates a pattern name + parameters into a sequence of primitive `MotionStep` objects based on the Pattern KB.
    *   **Task 4: Integration & Testing:** Update Assistant instructions to utilize `compose_pattern`. Modify the API route/adapter to handle function calls and integrate the composer output back into the `MotionPlan` before it reaches the interpreter. Verify patterns like `fly_by` expand correctly.
    *   **Goal:** Enable the system to handle complex, named motion sequences by composing primitives.

3.  **Parallel Motion Blending ("while" support)**
    *   **Task:** Add capability to execute certain primitives concurrently (e.g., "orbit while dollying"). This may involve:
        *   Updating the `MotionPlan` / `CameraCommand` schema (e.g., a `concurrent?: boolean` flag).
        *   Modifying the `SceneInterpreter` to potentially output commands that can be blended.
        *   Significantly enhancing the client-side `AnimationController` to interpolate and sum/apply multiple transformations simultaneously (e.g., adding dolly vector to orbit position change).
    *   **Goal:** Allow for more complex, layered animations specified via natural language.

4.  **Frontend Smoothing & Transitions**
    *   **Task:** Implement the client-side smoothing plan (`docs/refactors/FRONTEND_ANIMATION_SMOOTHING_PLAN.md`).
        *   Phase 1: Basic Catmull-Rom/Slerp interpolation within `AnimationController`.
        *   Phase 2: Corner detection and blend point injection in `PathSmoother` logic.
    *   **Goal:** Eliminate visual jerkiness within and between motion segments.

5.  **Duration Inference**
    *   **Task:** Allow users to specify qualitative durations (e.g., "quickly", "slowly").
        *   Update Assistant instructions/KB to map time descriptors to duration estimates or hints.
        *   Potentially update interpreter or adapter to use these hints when calculating `duration_ratio` or final command durations if no explicit duration is provided.
    *   **Goal:** Make animation duration specification more flexible.

6.  **Points of Interest (User-Defined Targets)**
    *   **Task:** Implement the full feature:
        *   Backend: Database schema changes (e.g., `feature_points` table), API/Server Actions for creating/managing points.
        *   Frontend: UI for users to select and name points on the model.
        *   Interpreter: Update `_resolveTargetPosition` to query and use these custom points.
        *   Assistant: Update instructions/KB to allow targeting these user-defined points by name.
    *   **Goal:** Enable highly specific targeting in user prompts.

7.  **Enhanced Logging & Monitoring**
    *   **Task:** Implement more structured logging throughout the pipeline (Adapter, Interpreter, Client). Integrate with a monitoring service (e.g., Sentry) for better error tracking. Can run in parallel once core mechanics are stable.
    *   **Goal:** Improve debuggability and observability.

8.  **Text-to-Image / Image-to-3D Pipeline (Separate Epic)**
    *   **Task:** Design and implement the workflow for users to generate 3D models from text or images, integrating with external generation services.
    *   **Goal:** Add model creation capabilities.

9.  **UI Polish**
    *   **Task:** Refine controls, loading states, error messages, and overall user experience after core functional milestones are met.
    *   **Goal:** Improve usability and aesthetics. 