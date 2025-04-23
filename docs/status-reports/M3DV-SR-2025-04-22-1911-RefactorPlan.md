# Status Report: UI Panel Refactor & Backend Normalization Decision

**Date:** 2025-04-22
**Report ID:** M3DV-SR-2025-04-22-1911-RefactorPlan

## Session Overview
- **Focus Area(s):** Completed UI refactor for left-side panels. Implemented base UI and logic for new Camera Controls (D-Pad, Reset). Diagnosed persistent issues related to client-side normalization and decided on backend normalization as the strategic path forward. Updated Assistant instructions for orbit/focus handling.
- **Key Achievements:**
    - Successfully refactored the top-left panel in `Viewer.tsx` into "MODEL"/"CAMERA" tabs using Radix UI, keeping `SceneControls` separate below.
    - Implemented automatic tab switching to "CAMERA" on model load.
    - Created `CameraControlsPanel.tsx` containing the moved FOV slider, new D-Pad UI, and Reset Camera button UI.
    - Implemented state management, keyboard listeners, and `useFrame` logic foundation for D-Pad/keyboard camera movement in `Viewer.tsx`.
    - Implemented "Reset Camera" button functionality (currently resetting to hardcoded initial view).
    - Debugged and fixed `onLockToggle` state synchronization issue in `CameraAnimationSystem.tsx`.
    - Diagnosed Assistant misinterpretation of "look at" and ambiguous "orbit" prompts. Updated Assistant instructions (local reference files) to prioritize `focus_on` and default ambiguous orbits to `current_target`.
    - **Crucially:** Identified recurring inconsistencies and complexities stemming from the client-side normalization approach (conflicting coordinate systems between visual render and backend data).
    - **Decision:** Determined that shifting model normalization (grounding, centering, scaling) to the **backend** during model processing is the most robust long-term solution.
    - Created detailed specification document for the Backend Normalization refactor (`docs/refactors/Backend-Normalization-Spec.md`).
- **Commit(s):** [Placeholder - Add commit hash for UI panel refactor/camera controls base]

## Technical Updates
- **Code Changes:**
    - Major structural changes in `Viewer.tsx` (tabs implementation, new state, handlers, `useFrame` base).
    - Added `CameraControlsPanel.tsx`.
    - Removed FOV controls from `SceneControls.tsx`.
    - Minor fix in `CameraAnimationSystem.tsx`.
- **Documentation Changes:**
    - Created `docs/refactors/UI-Panel-Refactor-Spec.md`.
    - Created `docs/refactors/Backend-Normalization-Spec.md`.
    - Updated `docs/ai/assistant-references/SYSTEM_INSTRUCTIONS_REF.md` to sync with latest text file.

## Testing & Refinement Progress
- UI refactor (tabs, component placement) manually verified.
- Auto tab-switching verified.
- Reset Camera button basic functionality verified (resets to hardcoded view).
- Assistant instruction updates successfully tested for orbit default and "look at" cases.
- **Key Issue Identified:** Current keyboard/button camera movement implementation in `useFrame` (using world axes) causes counter-intuitive control when camera is rotated. This needs rework *after* backend normalization.

## Challenges & Blockers
- Diagnosing the root cause of inconsistent camera behavior (Reset target, Pedestal target) ultimately pointed to the limitations and complexities of the client-side normalization strategy vs backend calculations based on original geometry.
- The current implementation of keyboard/button camera movement logic (`useFrame`) is flawed due to using world axes.

## Next Steps
1.  **Prioritize Backend Normalization Refactor:** Execute the plan outlined in `docs/refactors/Backend-Normalization-Spec.md`. This is now considered a prerequisite for reliably completing the camera control features.
2.  **Revisit Camera Controls Implementation:** Once backend normalization is complete:
    *   Refactor the `useFrame` logic in `Viewer.tsx` (`CameraMover`) to correctly implement Truck/Pedestal movement using local camera axes based on the now-normalized coordinates.
    *   Update `handleCameraReset` to target the correct normalized center.
    *   Implement the Coordinate Display UI.
    *   Implement Visibility Toggles UI and logic.
3.  Perform thorough regression testing of all viewer interactions and P2P pipeline functionality after the backend normalization refactor. 