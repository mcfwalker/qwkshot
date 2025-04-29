# Refactor Specification: Backend Model Normalization

**Date:** 2025-04-22
**Status:** Planned

## 1. Overview

This refactor addresses recurring inconsistencies and complexities arising from the current client-side model normalization strategy. The goal is to shift the responsibility of normalizing model geometry (grounding at Y=0, centering X/Z at origin, scaling to a standard size) to the **backend** during the model upload/processing phase. The normalized geometry will then be stored in the database, becoming the single source of truth for all subsequent operations (rendering, interpretation, constraints).

## 2. Goals

-   Eliminate the need for client-side runtime normalization logic in `Viewer.tsx` / `<Model>`.
-   Establish the geometry stored in the `scene_analysis` database column as the **normalized** representation of the model.
-   Simplify client-side code and state management related to automatic offsets.
-   Simplify backend Scene Interpreter logic by providing it with consistent, normalized coordinates.
-   Improve overall system robustness and reduce potential bugs related to coordinate system mismatches.
-   Maintain the user's ability to apply manual vertical adjustments (`userVerticalAdjustment`), which will be stored separately.

## 3. Affected Components & Systems

-   Backend Model Processing/Upload Service (Requires new logic)
-   Database Schema (`models` table: `scene_analysis` column interpretation changes, potentially add `original_scene_analysis` or `normalization_transform` for reference)
-   Data Migration Strategy (For existing models)
-   Client: `src/components/viewer/Viewer.tsx` (Normalization removal, state changes)
-   Client: `src/components/viewer/<Model>` component within `Viewer.tsx` (Simplification)
-   Client: `src/store/viewerStore.ts` (Remove `modelVerticalOffset` state)
-   Client: `src/components/viewer/CameraAnimationSystem.tsx` & Lock Logic (Adjust data saved to `environmental_metadata`)
-   Backend: `/api/camera-path/route.ts` (Ensure correct data fetching)
-   Backend: `src/features/p2p/scene-interpreter/interpreter.ts` (Update target resolution and potentially constraint logic)
-   Backend: `src/features/p2p/metadata-manager/` & Adapter (Ensure correct data handling if schema changes)

## 4. Implementation Phases

### Phase 1: Backend Normalization Implementation

- [ ] 1.  **Choose GLTF Library:** Select and integrate a suitable Node.js library for parsing, manipulating, and saving GLTF/GLB files (e.g., `gltf-transform`, `@gltf-transform/core`).
- [ ] 2.  **Modify Processing Logic:** Update the backend service/function responsible for handling model uploads *after* initial analysis (`SceneAnalyzer`) but *before* saving the final data.
- [ ] 3.  **Calculate Transform:**
    -   [ ] Use the original `scene_analysis` data (bounding box min/max/center, dimensions) calculated by `SceneAnalyzer`.
    -   [ ] Determine the required `scale` factor to achieve the target normalized size (e.g., height = 2 units).
    -   [ ] Determine the required `translation` vector (offsetX = `-center.x`, offsetY = `-min.y`, offsetZ = `-center.z`). Remember to apply scale *before* calculating the final translation needed based on the scaled bounds.
- [ ] 4.  **Apply Transform:**
    -   [ ] Load the original GLB file data into the chosen library.
    -   [ ] Apply the calculated `scale` and `translation` transformations directly to the relevant nodes or vertex data within the GLTF structure.
- [ ] 5.  **Save Normalized GLB:** Save the *modified* GLB data back to storage, replacing or versioning the original file.
- [ ] 6.  **Re-Analyze (Optional but Recommended):** Run `SceneAnalyzer` *again* on the *normalized* geometry data to get accurate bounding box, dimensions, center, etc., for the *normalized* state.
- [ ] 7.  **Update Database Logic:** Modify the code that saves data to the `models` table:
    -   [ ] The `scene_analysis` column should now store the analysis results from the **normalized** geometry (where `min.y ≈ 0`, `center.x/z ≈ 0`).
    -   [ ] *(Decision Point):* Decide whether to store original analysis/transform. Option A (simpler) seems feasible given the testing nature of current models.

### Phase 2: Client Viewer Refactor

- [ ] 1.  **File:** `src/components/viewer/Viewer.tsx`
- [ ] 2.  **`<Model>` Component:**
    -   [ ] Remove the `useMemo` hook containing the normalization logic (container group, scaling, translation).
    -   [ ] Remove the call to `setModelVerticalOffset`.
    -   [ ] The component should simplify to essentially just loading the `url` via `useGLTF` and rendering `<primitive object={scene} />` (potentially cloned).
    -   [ ] The `modelRef` should point directly to the loaded (and now pre-normalized) scene or its container if one is still needed for structure.
- [ ] 3.  **`Viewer` Component:**
    -   [ ] Remove the `useEffect` hook that previously stored the "default" camera state based on the now-removed client normalization.
    -   [ ] The `<group position-y={userVerticalAdjustment}>` wrapper around `<Model />` remains to handle manual adjustments.
    -   [ ] The `handleCameraReset` logic needs updating (see Phase 4).

### Phase 3: State and Metadata Updates

- [ ] 1.  **File:** `src/store/viewerStore.ts`
    -   [ ] Remove the `modelVerticalOffset` state property.
    -   [ ] Remove the `setModelVerticalOffset` action.
- [ ] 2.  **File:** `src/components/viewer/CameraAnimationSystem.tsx` (and potentially `Viewer.tsx`'s lock logic if it moves)
    -   [ ] Modify `handleLockToggle` (or the function calling the server action):
        -   [ ] Remove the retrieval of `automaticOffset` from the store (it no longer exists).
        -   [ ] Calculate the value to be saved for the backend's `modelOffset` field in `environmental_metadata`. This should now **only** be the `userVerticalAdjustment` value from the `Viewer` state. *(Consider renaming this field in `EnvironmentalMetadata` and the DB to `userOffset` or similar for clarity)*.
        -   [ ] Ensure the server action (`updateEnvironmentalMetadataAction`) correctly receives and saves this `userVerticalAdjustment` value under the appropriate field name.

### Phase 4: Backend Interpreter Refactor

- [ ] 1.  **File:** `src/features/p2p/scene-interpreter/interpreter.ts`
- [ ] 2.  **`_resolveTargetPosition` Function:**
    -   [ ] Remove the `modelOffset` parameter from its signature.
    -   [ ] Inside the function, use the coordinates directly from the `sceneAnalysis` bounding box/center (which are now normalized).
    -   [ ] **Crucially:** Fetch or receive the `userVerticalAdjustment` (potentially renamed, e.g., `userOffset`) from the `envAnalysis` object.
    -   [ ] **Apply ONLY the `userVerticalAdjustment`** to the Y-coordinate calculated from the (normalized) `sceneAnalysis` data before returning the final `Vector3`.
- [ ] 3.  **Other Logic (`pedestal`, `truck`, constraints):**
    -   [ ] Review logic that uses `sceneAnalysis` dimensions or bounding box data (e.g., `_calculateEffectiveDistance`, `_mapDescriptorToValue`, `_clampPositionWithRaycast`, height/distance constraints). Ensure they are correctly interpreting the now-normalized values from `scene_analysis`. The logic might become simpler as the base `min.y` is 0.
    -   [ ] Ensure the `userVerticalAdjustment` is correctly factored in where necessary (e.g., when checking against height constraints defined relative to the world, the object's effective min/max Y are `0 + userAdjustment` and `normalizedHeight + userAdjustment`).

### Phase 5: API Route Verification

- [ ] 1.  **File:** `/api/camera-path/route.ts`
- [ ] 2.  **Verify Data Passing:** Double-check that it fetches the **normalized `scene_analysis`** and the **`environmental_metadata` containing the `userVerticalAdjustment`** and passes these correctly packaged within the `envAnalysis` object (or separately) to `interpreter.interpretPath`. Remove the code that was manually injecting `modelOffset` into `envAnalysis`.

### Phase 6: Testing

- [ ] 1.  **Normalization:** Verify models load visually grounded and centered without client-side adjustments.
- [ ] 2.  **User Adjustment:** Verify the manual offset slider still works correctly.
- [ ] 3.  **Reset Camera:** Verify it resets to the correct default view relative to the normalized model.
- [ ] 4.  **Locking:** Verify the correct `userVerticalAdjustment` is saved to `environmental_metadata`.
- [ ] 5.  **Path Generation:** Thoroughly test various prompts involving geometric targets (top, bottom, center), destination targets, and constraints to ensure the backend interpreter uses the normalized coordinates + user adjustment correctly.

## 5. Assistant/KB Impact

   **Likely None:** The Assistant operates on semantic concepts ("orbit around bottom edge"). The mapping from these concepts to standardized targets (`object_bottom_center`) remains the same. The *interpretation* of those targets happens in the backend interpreter, which is what we're fixing. The Assistant and Knowledge Base likely do not need updates for this specific refactor.

## 6. Rollback Strategy

   If significant issues arise, revert the backend processing changes and database migration.
   Revert the client-side and backend interpreter code changes using version control (Git).
   The previous state (client-side normalization) can be restored. 