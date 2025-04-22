# Refactor Specification: Left UI Panel Consolidation

**Date:** 2025-04-22
**Status:** Planned

## 1. Overview

This refactor modifies the structure of the top-left UI panel containing the Model selection/loading UI (`ModelSelectorTabs`) by transforming it into a tabbed component. A new "Camera" tab will be added alongside the existing "Model" content area. This provides a dedicated space for future camera-specific controls while keeping the existing "Scene" controls panel separate and always visible below it. This aims to improve organization and prepare for adding new camera manipulation features.

## 2. Goals

-   Replace the single top-left panel (`ModelSelectorTabs`) with a new tabbed panel using Radix UI Tabs.
-   Create two tabs within this new panel: "Model" and "Camera".
-   Place the existing `ModelSelectorTabs` component content under the "Model" tab.
-   Create an initially empty content area for the "Camera" tab, ready for future controls.
-   **Maintain the existing `SceneControls` panel as a separate, always-visible element below the new tabbed panel.**
-   Implement automatic switching to the "Camera" tab when a model is successfully loaded.
-   Establish a clear location (`Camera` tab) for adding future camera manipulation controls (Reset button, coordinate display, movement buttons).

## 3. Implementation Details

**File:** `src/components/viewer/Viewer.tsx`

**State:**

-   Introduce a new state variable to manage the active tab:
    ```typescript
    const [activeLeftPanelTab, setActiveLeftPanelTab] = useState<'model' | 'camera'>('model');
    ```

**JSX Structure (within the main return `div`'s left-side absolute container):**

-   Identify the parent `div` that currently holds `<ModelSelectorTabs />` and `<SceneControls />` (e.g., `absolute top-16 left-4... flex flex-col gap-4`).
-   **Within this parent div:**
    1.  **Top Element (New Tabbed Component):** Add a `<TabsPrimitive.Root>` component:
        -   `value={activeLeftPanelTab}`
        -   `onValueChange={(value) => setActiveLeftPanelTab(value as 'model' | 'camera')}`
        -   Appropriate container `className`.
        -   Add a `<TabsPrimitive.List>`:
            -   Container styling (e.g., flex, background, rounded corners).
            -   Two `<TabsPrimitive.Trigger>` elements:
                -   `value="model"` with text "MODEL"
                -   `value="camera"` with text "CAMERA"
                -   Apply conditional styling based on `activeLeftPanelTab` for active/inactive states.
        -   Add two `<TabsPrimitive.Content>` blocks:
            -   Content 1:
                -   `value="model"`
                -   Render the existing `<ModelSelectorTabs onModelSelect={onModelSelect} />` component inside.
            -   Content 2:
                -   `value="camera"`
                -   **(Initially Empty/Placeholder)** This content area will later hold the new camera controls (Reset, Coordinates, Movement Buttons).
    2.  **Bottom Element (Existing Scene Controls):** Render the existing `<SceneControls ... />` component *directly below* the new `<TabsPrimitive.Root>` element (within the same parent flex column), passing its necessary props (`fov`, `gridVisible`, etc.).

**Automatic Tab Switching:**

-   Implement a `useEffect` hook:
    -   Dependencies: `[modelUrl]` (and potentially `setActiveLeftPanelTab` if ESLint requires).
    -   Logic:
        ```typescript
        useEffect(() => {
          if (modelUrl && activeLeftPanelTab !== 'camera') { // Check if model loaded and tab isn't already camera
            console.log("Viewer: Model loaded, switching to Camera tab.");
            setActiveLeftPanelTab('camera');
          } else if (!modelUrl && activeLeftPanelTab !== 'model') { // Optional: Switch back if model cleared?
             console.log("Viewer: Model cleared, switching back to Model tab.");
             setActiveLeftPanelTab('model');
          }
        }, [modelUrl, activeLeftPanelTab]); // Add setActiveLeftPanelTab if needed
        ```

## 4. Future Additions (Post-Refactor)

-   **Reset Camera Button:** Add to the **"Camera" tab's `<TabsPrimitive.Content>` block** (likely within a new component placed there).
-   **Coordinate Display:** Add to the **"Camera" tab's content block**.
-   **Movement Controls (Buttons):** Add to the **"Camera" tab's content block**.

## 5. Potential Impacts

-   Requires careful styling of the new Tabs components (`Root`, `List`, `Trigger`, `Content`) to match the existing UI theme.
-   Prop drilling for `SceneControls` remains the same, as it stays separate.
-   Does not directly affect backend or animation pipeline. 