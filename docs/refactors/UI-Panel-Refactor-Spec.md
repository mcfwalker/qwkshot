# Refactor Specification: Left UI Panel & Camera Controls

**Date:** 2025-04-22
**Status:** In Progress

## 1. Overview

This refactor modifies the structure of the top-left UI panel containing the Model selection/loading UI (`ModelSelectorTabs`) by transforming it into a tabbed component. A new "Camera" tab will be added alongside the existing "Model" content area. This provides a dedicated space for future camera-specific controls while keeping the existing "Scene" controls panel separate and always visible below it. This aims to improve organization and prepare for adding new camera manipulation features.

## 2. Goals

-   [x] Replace the single top-left panel (`ModelSelectorTabs`) with a new tabbed panel using Radix UI Tabs.
-   [x] Create two tabs within this new panel: "Model" and "Camera".
-   [x] Place the existing `ModelSelectorTabs` component content under the "Model" tab.
-   [x] Place new camera controls under the "Camera" tab.
-   [x] Maintain the existing `SceneControls` panel as a separate, always-visible element below the new tabbed panel.
-   [x] Implement automatic switching to the "Camera" tab when a model is successfully loaded.
-   [ ] Implement intuitive keyboard and UI button controls for camera Truck (Left/Right) and Pedestal (Up/Down).
-   [x] Implement a "Reset Camera" function to return to a default view.
-   [ ] Implement visibility toggles for UI helpers (Reticle, Bounding Box).
-   [ ] Implement a coordinate display.

## 3. Implementation Details - UI Panel Refactor

**File:** `src/components/viewer/Viewer.tsx`

-   **[x]** Add State: Introduce `activeLeftPanelTab` state (`'model'` | `'camera'`).
-   **[x]** Add Radix Tabs: Import `TabsPrimitive`.
-   **[x]** Refactor JSX:
    -   **[x]** Identify parent `div` for left panels.
    -   **[x]** Create `TabsPrimitive.Root` for top panel.
    -   **[x]** Create `TabsPrimitive.List` with "MODEL" / "CAMERA" triggers and styling.
    -   **[x]** Create `<TabsPrimitive.Content value="model">` containing `<ModelSelectorTabs />`.
    -   **[x]** Create `<TabsPrimitive.Content value="camera">` containing `<CameraControlsPanel />`.
    -   **[x]** Ensure `<SceneControls />` renders below the `TabsPrimitive.Root`.
-   **[x]** Implement Auto-Switch: Add `useEffect` hook watching `modelUrl` to set `activeLeftPanelTab` to `'camera'` on load and `'model'` on clear.

## 4. Implementation Details - Camera Controls

**Files:** `src/components/viewer/Viewer.tsx`, `src/components/viewer/CameraControlsPanel.tsx`

-   **[x]** Move FOV Control: Remove from `SceneControls` and add to `CameraControlsPanel`. Update props interfaces.
-   **[x]** Add Camera Controls UI: Create D-Pad buttons and Reset button in `CameraControlsPanel`.
-   **[x]** Add State (Viewer.tsx):
    -   **[x]** `movementDirection` state object.
    -   **[x]** Remove `defaultCameraState` (using hardcoded reset).
-   **[x]** Implement Handlers (Viewer.tsx):
    -   **[x]** `handleCameraMove` function to update `movementDirection` state.
    -   **[x]** `handleCameraReset` function to reset camera to initial hardcoded position (`[5,5,5]`) and target (`[0,0,0]`).
    -   **[x]** Pass handlers to `CameraControlsPanel`.
-   **[x]** Implement Keyboard Listeners (Viewer.tsx): Add `useEffect` hook for Arrow Keys/WASD calling `handleCameraMove`.
-   **[ ]** **Fix `useFrame` Movement Logic (Viewer.tsx - `CameraMover` component):**
    -   **[ ]** Modify logic to use **local camera axes** (`cameraRight`, `cameraUp`) for Left/Right (Truck) and Up/Down (Pedestal) movements instead of world axes.
    -   **[ ]** Decide if Up/Down should be local Pedestal or fixed World Y movement and implement accordingly. *(Current implementation uses World Y, causing issues when camera is rotated/tilted)*.
-   **[ ]** Implement Coordinate Display: Add UI element (likely in `CameraControlsPanel` or `CameraTelemetry`) to show rounded `camera.position` (X, Y, Z) updated via `useFrame`.
-   **[ ]** Implement Visibility Toggles (New Task):
    -   **[ ]** Add state in `Viewer.tsx` for `isReticleVisible` and `isBoundingBoxVisible` (default true).
    -   **[ ]** Add toggle switches/buttons to the UI (likely in `SceneControls` or `CameraControlsPanel`).
    -   **[ ]** Conditionally render `<CenterReticle />` based on `isReticleVisible`.
    -   **[ ]** Modify the `useEffect` hook for the `Box3Helper` to conditionally add/remove it based on `isBoundingBoxVisible`.

## 5. Known Issues / Next Steps (Immediate)

1.  **Fix `useFrame` Movement Logic:** The current keyboard/button movement uses world axes, causing counter-intuitive behavior when the camera is rotated. Needs update to use local axes for truck/pedestal.
2.  Implement Coordinate Display.
3.  Implement Visibility Toggles.
4.  Perform thorough regression testing after fixes.

## 6. Assistant/KB Impact

-   No impact expected from these UI/client-side control changes.

## 7. Rollback Strategy

-   Use Git to revert changes on the `feat/viewer-controls-toggles` branch if significant issues arise during implementation. 