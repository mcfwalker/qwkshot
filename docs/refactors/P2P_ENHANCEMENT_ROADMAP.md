# P2P Pipeline Enhancement Roadmap

This document outlines the proposed sequence for implementing major enhancements and features for the Prompt-to-Path (P2P) pipeline, following the completion of the Backend Normalization and Scene Interpreter Refactor (May 2025).

## Proposed Sequence

1.  **Complete Primitives (Visual Roll)**
    *   **Task:** Implement the visual effect for the `rotate` primitive when `axis: 'roll'` is specified. Requires updating `AnimationController` to handle camera `up` vector interpolation.
    *   **Goal:** Complete the full intended functionality of all defined motion primitives.

2.  **Frontend Sequential Smoothing (Phase 1 & 2)**
    *   **Task:** Implement the client-side smoothing plan (`FRONTEND_ANIMATION_SMOOTHING_PLAN.md`) covering basic Catmull-Rom/Slerp interpolation and corner blend point injection.
    *   **Goal:** Eliminate visual jerkiness *within* and *between* sequential motion segments for smoother transitions.

3.  **Duration Inference (from Speed Qualifiers)**
    *   **Task:** Allow users to specify qualitative durations (e.g., "quickly", "slowly"). Update LLM to pass `speed_descriptor`. Update backend (`interpretPath`) to calculate reference durations per step, scale by descriptor, and normalize against optional total duration. See `DURATION_INFERENCE_REQUIREMENTS.md`.
    *   **Goal:** Make animation duration specification more flexible and intuitive based on natural language speed requests.

4.  **Parallel Motion Blending ("while" support)**
    *   **Task:** Add capability to execute certain primitives concurrently (e.g., "orbit while dollying"). May involve schema updates, interpreter/handler logic changes to provide transformation info, and significant `AnimationController` enhancements to combine transformations frame-by-frame.
    *   **Goal:** Allow for more complex, layered animations specified via natural language. Prerequisite for complex patterns.

5.  **Pattern Layer Implementation**
    *   **Task:** Implement the Pattern Meta Layer as defined in `PATTERN_META_LAYER_REQUIREMENTS.md`. Includes Pattern KB, Assistant function calling (`compose_pattern`), backend Composer module, and API route integration. Leverages sequential and parallel execution capabilities.
    *   **Goal:** Enable the system to handle complex, named motion sequences (e.g., "zigzag", "fly_by", "spiral_down") by composing primitives.

6.  **Points of Interest (User-Defined Targets)**
    *   **Task:** Implement the full feature: Backend (DB, API), Frontend (UI), Interpreter (`resolveTargetPosition` update), Assistant (KB/Instructions).
    *   **Goal:** Enable highly specific targeting in user prompts.

7.  **Enhanced Logging & Monitoring**
    *   **Task:** Implement structured logging and integrate with a monitoring service (e.g., Sentry).
    *   **Goal:** Improve debuggability and observability.

8.  **Text-to-Image / Image-to-3D Pipeline (Separate Epic)**
    *   **Task:** Design and implement the workflow for users to generate 3D models from text or images.
    *   **Goal:** Add model creation capabilities.

9.  **UI Polish**
    *   **Task:** Refine controls, loading states, error messages, and overall user experience.
    *   **Goal:** Improve usability and aesthetics. 