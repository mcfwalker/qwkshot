# Refactor Specification: Backend Model Normalization

**Original Date:** 2025-04-22
**Updated Date:** 2025-04-24
**Status:** Testing - Implementation Complete

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

### Phase 0: Critical Infrastructure Fixes (ADDED)

> **Note:** Based on the initial refactor attempt, addressing these infrastructure issues is now a prerequisite phase.

- [x] 1. **File Storage Path Construction:**
   - [x] Review storage path construction in server actions to ensure proper paths without doubled prefixes
   - [x] Fix path construction in `prepareModelUpload` (`src/app/actions/models.ts`)
   - [ ] Test storage operations with correct paths (Covered in Phase 6 Testing)
   - [x] Correct pattern: `${userId}/${modelId}/${fileName}` (within `models` bucket context)

- [x] 2. **Supabase Storage Access:**
   - [x] Document the current storage bucket access strategy (private bucket, signed URLs for access)
   - [x] Ensure all components needing to access files use consistent access patterns (Verified via `loadModel` usage)
   - [x] Add missing `UPDATE` RLS policy for `storage.objects` on `models` bucket to allow `upsert` during normalization.
   - [ ] Test thoroughly before continuing with primary refactor (Covered in Phase 6 Testing)

- [x] 3. **Next.js Environment Compatibility:**
   - [x] Upgrade Next.js to latest version (^15.x) to take advantage of improved server actions (Verified `15.2.3`)
   - [x] Update `next.config.js` to properly configure serverActions under the experimental block (Confirmed no config needed for Next.js >= 14)
   - [x] Add necessary polyfills for browser APIs used in server components/actions (Added `self` polyfill for `SceneAnalyzer`)
   - [x] Ensure `self` and other browser globals are handled correctly in both client and server contexts (Addressed `self` error)

### Phase 1: Backend Normalization Implementation

- [x] 1.  **Choose GLTF Library:** Select and integrate a suitable Node.js library for parsing, manipulating, and saving GLTF/GLB files (Selected and installed `@gltf-transform/core`, `@gltf-transform/extensions`, `@gltf-transform/functions`).
- [x] 2.  **Modify Processing Logic:** Update the backend service/function responsible for handling model uploads *after* initial analysis (`SceneAnalyzer`) but *before* saving the final data.
    > **Note:** Implemented as a *new* server action `normalizeModelAction` in `src/app/actions/normalization.ts`, triggered by the client (`ModelLoader.tsx`) after successful initial file upload.
- [x] 3.  **Calculate Transform:**
    - [x] Use the original `scene_analysis` data (bounding box min/max/center) fetched by `normalizeModelAction`.
    - [x] Determine the required `scale` factor to achieve the target normalized size (height = 2.0 units).
    - [x] Determine the required `translation` vector (offsetX = `-center.x * scale`, offsetY = `-min.y * scale`, offsetZ = `-center.z * scale`). (Implemented via vertex manipulation based on original bounds).
- [x] 4.  **Apply Transform:**
    - [x] Load the original GLB file data into the chosen library (`NodeIO.readBinary`).
    - [x] Apply the calculated `scale` and `translation` transformations directly to vertex data.
- [x] 5.  **Save Normalized GLB:** Save the *modified* GLB data back to storage, replacing the original file (`NodeIO.writeBinary` then `supabase.storage.upload` with `upsert: true`).
- [x] 6.  **Re-Analyze (Optional but Recommended):** Run `SceneAnalyzer` *again* on the *normalized* geometry data (`normalizedFile`) to get accurate bounding box, dimensions, center, etc., for the *normalized* state.
- [x] 7.  **Update Database Logic:** Modify the code that saves data to the `models` table:
    - [x] The `scene_analysis` column is now updated (`supabase.from('models').update`) with the analysis results from the **normalized** geometry (where `min.y ≈ 0`, `center.x/z ≈ 0`).
    - [x] *(Decision Point):* Decided not to store original analysis/transform for now.

### Phase 2: Client Viewer Refactor

- [x] 1.  **File:** `src/components/viewer/Viewer.tsx`
- [x] 2.  **`<Model>` Component:**
    - [x] Remove the `useMemo` hook containing the normalization logic (container group, scaling, translation).
    - [x] Remove the call to `setModelVerticalOffset`.
    - [x] The component now simplifies to loading the `url` via `useGLTF` and rendering `<primitive object={clonedScene} />`.
    - [x] The `modelRef` points directly to the loaded (and now pre-normalized) cloned scene.
    - [x] Ensured React hook ordering rules maintained.
- [x] 3.  **`Viewer` Component:**
    - [x] Removed the `useEffect` hook that previously stored the "default" camera state based on the now-removed client normalization (Confirmed no specific effect existed for this).
    - [x] The `<group position-y={userVerticalAdjustment}>` wrapper around `<Model />` remains to handle manual adjustments (Verified).
    - [ ] The `handleCameraReset` logic needs updating (Deferred to Phase 6 Testing/Refinement).
> **Note:** Updated `ModelLoader.tsx` to only call `onModelLoad` *after* backend normalization completes and the final signed URL is fetched via `loadModel`, preventing visual "snap".

### Phase 3: State and Metadata Updates

- [x] 1.  **File:** `src/store/viewerStore.ts`
    - [x] Remove the `modelVerticalOffset` state property.
    - [x] Remove the `setModelVerticalOffset` action.
- [x] 2.  **File:** `src/components/viewer/CameraAnimationSystem.tsx`
    - [x] Modify `handleLockToggle` (or the function calling the server action):
        - [x] Remove the retrieval of `automaticOffset` (`modelVerticalOffset`) from the store.
        - [x] Calculate the value to be saved for the backend's field in `environmental_metadata`. Changed to save only `userVerticalAdjustment` under the key `userVerticalAdjustment`.
        - [x] Updated `EnvironmentalMetadata` type definition accordingly.
        - [x] Ensured the server action (`updateEnvironmentalMetadataAction`) correctly receives and saves this object.

### Phase 4: Backend Interpreter Refactor

- [x] 1.  **File:** `src/features/p2p/scene-interpreter/interpreter.ts`
- [x] 2.  **`_resolveTargetPosition` Function:**
    - [x] Remove the `modelOffset` parameter from its signature.
    - [x] Inside the function, use the coordinates directly from the `sceneAnalysis` bounding box/center (which are now normalized).
    - [x] Fetch `userVerticalAdjustment` from the `envAnalysis` object (passed into `interpretPath`).
    - [x] **Apply ONLY the `userVerticalAdjustment`** to the Y-coordinate calculated from the (normalized) `sceneAnalysis` data before returning the final `Vector3`.
- [x] 3.  **Other Logic (`pedestal`, `truck`, constraints):**
    - [x] Reviewed logic that uses `sceneAnalysis` dimensions or bounding box data. Logic should now correctly interpret normalized values from `scene_analysis` (e.g., `min.y` ≈ 0).
    - [x] Ensured `_clampPositionWithRaycast` accounts for `userVerticalAdjustment` when checking against the (normalized) `objectBounds`.

### Phase 5: API Route Verification

- [x] 1.  **File:** `/api/camera-path/route.ts`
- [x] 2.  **Verify Data Passing:** Double-checked that it fetches the **normalized `scene_analysis`** and the **`environmental_metadata` containing the `userVerticalAdjustment`** and passes these correctly packaged within the `envAnalysis` object to `interpreter.interpretPath`. Removed manual injection of `modelOffset`.

### Phase 6: Testing

- [x] 1.  **Normalization:** Verify models load visually grounded and centered without client-side adjustments. (Initial tests confirm grounding works after client-side loading fix).
- [ ] 2.  **User Adjustment:** Verify the manual offset slider still works correctly.
- [ ] 3.  **Reset Camera:** Verify it resets to the correct default view relative to the normalized model. (Refinement needed).
- [ ] 4.  **Locking:** Verify the correct `userVerticalAdjustment` is saved to `environmental_metadata`.
- [ ] 5.  **Path Generation:** Thoroughly test various prompts involving geometric targets (top, bottom, center), destination targets, and constraints to ensure the backend interpreter uses the normalized coordinates + user adjustment correctly.
- [ ] 6.  **React Component Stability:** Verify all component changes maintain proper hooks ordering and React patterns.

## 5. Assistant/KB Impact

   **Likely None:** The Assistant operates on semantic concepts ("orbit around bottom edge"). The mapping from these concepts to standardized targets (`object_bottom_center`) remains the same. The *interpretation* of those targets happens in the backend interpreter, which is what we're fixing. The Assistant and Knowledge Base likely do not need updates for this specific refactor.

## 6. Rollback Strategy

   If significant issues arise, revert the backend processing changes and database migration.
   Revert the client-side and backend interpreter code changes using version control (Git).
   The previous state (client-side normalization) can be restored.

## 7. Post-Mortem of Refactor Attempts

### Attempt #1 (2025-04-23): Infrastructure Issues Derailed Implementation

#### Chronology of Events
1. **Next.js Upgrade** - Initially upgraded Next.js to version ^15.3.1 using `npm install next@latest` to gain access to improved server actions support.

2. **Next.js Configuration** - The refactor began with updating the Next.js configuration to properly configure serverActions by moving them under the `experimental` block in `next.config.js`. Despite the upgrade, the server was still reporting `serverActions` as an unrecognized key.

3. **Cache Clearing and Server Restarts** - Multiple attempts to clear the Next.js cache with `rm -rf .next` and restarting the server were performed, but the warnings persisted.

4. **Unexpected Environment Error** - When trying to upload models, encountered `Error: self is not defined` in the ModelLoader component. This indicated browser code being executed in a Node.js environment without the expected globals.

5. **Path Construction Issue** - After implementing a polyfill for the missing `self` global, uploads began working but model loading failed with a 400 error:
   ```
   Error: Could not load https://mmoqqgsamsewsbocqxbi.supabase.co/storage/v1/object/public/models/models/[id]/file.glb...
   ```
   The doubled "models/models/" path revealed an issue with path construction when uploading files.

6. **Storage URL Pattern Confusion** - Identified that the implementation was constructing paths incorrectly:
   ```typescript
   // Problem code
   const modelPath = `models/${userId}/${modelId}/${fileName}`;
   ```
   Which resulted in doubled paths because the bucket name was already "models".

7. **Private vs. Public Bucket Misunderstanding** - Initially assumed the bucket was public and tried implementing fixes using public URLs. Later discovered the bucket was actually private, requiring a different access pattern.

8. **Architectural Mismatch** - Implemented signed URL generation, but the changes to the React component violated the React Rules of Hooks by rendering conditionally before certain hooks:
   ```
   Error: React has detected a change in the order of Hooks called by Model
   ```

9. **Refactor Attempt Abandoned** - The architectural changes had grown too complex and diverged from the original plan, introducing new bugs instead of solving the original normalization goal.

#### Root Causes
1. **Next.js Configuration Issues** - Despite upgrading to the latest version, configuration problems persisted with serverActions recognition.

2. **Inadequate Environment Preparation** - The server-side execution environment lacked necessary globals for the client-side code that was moved to server actions.

3. **Path Construction Oversight** - Path construction was not properly accounting for bucket names, causing doubled prefixes.

4. **Access Pattern Confusion** - The refactor didn't properly understand or document how the existing system accessed private bucket files.

5. **React Component Refactoring Errors** - The changes violated React's requirements for hooks execution order.

6. **Scope Creep** - What started as a focused normalization refactor expanded to address various infrastructure issues.

#### Lessons Learned
1. **Framework Updates Require Testing** - When upgrading frameworks like Next.js, test all affected functionality before proceeding with feature work.

2. **Infrastructure First** - Critical infrastructure issues should be identified and addressed in a separate phase before attempting feature refactoring.

3. **Small, Testable Changes** - Make targeted changes and test thoroughly before moving on.

4. **Respect React Patterns** - When refactoring React components, maintain consistent hooks ordering and be careful with conditional rendering.

5. **Document Existing Patterns** - Better document how existing systems work before trying to modify them.

6. **Separate Concerns** - Keep infrastructure fixes separate from feature development to avoid scope creep.

This post-mortem led to the creation of "Phase 0: Critical Infrastructure Fixes" in the updated refactor plan to address these issues before proceeding with the core normalization work. 

## 8. Limitations (NEW)

-   **Single Model Focus:** The current normalization strategy (scaling individual models to a fixed height, centering at origin) is optimized for the single-model viewer context. It simplifies camera defaults and interpreter logic.
-   **Not Suitable for Multi-Model Scenes:** This approach discards the inherent relative scale between different models. Loading multiple models normalized this way into the same scene would result in incorrect relative sizing and positional overlap at the origin. A different normalization/loading strategy would be required to support multi-model scenarios. 