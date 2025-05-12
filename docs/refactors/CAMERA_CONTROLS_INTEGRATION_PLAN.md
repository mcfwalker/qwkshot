# Camera Controls Integration Plan (Attempt 3)

**Status:** Proposed

## 1. Goals
- Implement smooth, cinematic camera animations based on natural language input.
- Ensure smooth and visually appealing transitions between different sequential motion primitives (e.g., dolly-to-orbit, pedestal-to-pan).
- Achieve this by leveraging the `camera-controls` library (via `@react-three/drei`) to handle complex state transitions and interpolation.
- Refactor the P2P pipeline to output high-level control instructions instead of low-level keyframes.

## 2. Rationale & Background
Previous attempts (Attempts 1 & 2, see `M3DV-SR-2025-05-07-1849-SmoothingAttempt1Postmortem.md`) using a custom frontend solution involving Catmull-Rom splines for position and Slerp for orientation encountered significant challenges:
- Difficulty synchronizing decoupled position and orientation interpolation, leading to visual artifacts (jitter, focus drift during transitions).
- Complex interactions with backend waypoint density and frontend blending logic.
- Regressions in basic primitive functionality during development.

Research identified the `camera-controls` library as a robust, well-maintained solution within the R3F ecosystem specifically designed for smooth camera transitions and programmatic control. Adopting this library shifts the burden of complex interpolation and transition management from custom code to the library itself.

## 3. Proposed Architecture

**Core Change:** Replace manual frontend interpolation (`PathProcessor`, complex `AnimationController` logic) with the `<CameraControls />` component from `@react-three/drei`. Refactor backend handlers to output high-level instructions for this component.

**Data Flow:**

```mermaid
graph TD
    subgraph "User Interface (Client)"
        UI[React UI]
        AnimController[AnimationController <br> (Hosts Drei Comp, Calls API)]
        DreiCamControls[< CameraControls /> <br> (from @react-three/drei)]
        ThreeJS[Three.js Camera]
    end

    subgraph "Backend (Next.js API Route)"
        API["/api/camera-path"]
        subgraph "LLM Engine"
            OAIAdapter[OpenAIAssistantAdapter]
        end
        subgraph "Scene Interpreter"
             Interpreter[SceneInterpreterImpl <br> (Calls Refactored Handlers)]
        end
        MetadataMgr[Metadata Manager]
    end

    subgraph "External Services"
        OpenAI[OpenAI Assistants API]
        MotionKB[(Motion KB File)]
    end

    %% Data Flow Changes
    UI -- "1. User Prompt" --> API
    API -- "2. Fetch Context" --> MetadataMgr
    API -- "3. generatePlan()" --> OAIAdapter
    OAIAdapter -- "4. MotionPlan" --> API
    API -- "5. interpretPath(Plan, Context)" --> Interpreter
    Interpreter -- "6. Refactored Handlers Output -> **ControlInstruction[]**" --> API
    API -- "7. Response: ControlInstruction[]" --> UI
    UI -- "8. Update State (instructions)" --> AnimController
    AnimController -- "9. Loop: await controlsRef.current.method(...args)" --> DreiCamControls
    DreiCamControls -- "10. Internally updates Camera (SmoothDamp)" --> ThreeJS
    ThreeJS -- "11. Renders Updated View" --> UI

    classDef client fill:#ccf,stroke:#333;
    class UI,AnimController,DreiCamControls,ThreeJS client;
    classDef backend fill:#cfc,stroke:#333;
    class API,OAIAdapter,Interpreter,MetadataMgr backend;
    classDef external fill:#f9f,stroke:#333;
    class OpenAI,MotionKB external;
```

**Component Roles:**

*   **UI / LLM Engine / MetadataManager:** Unchanged.
*   **Scene Interpreter / Primitive Handlers:** **Major Refactor.** Handlers must be rewritten to calculate target states or deltas and output `ControlInstruction[]` instead of `CameraCommand[]`. Constraint logic needs review.
*   **Backend API:** Minor change to handle returning `ControlInstruction[]`.
*   **`PathProcessor.ts`:** **Removed.**
*   **`AnimationController.tsx`:** **Major Refactor/Simplification.**
    *   Renders `<CameraControls />` from `drei`.
    *   Gets ref to `camera-controls` instance.
    *   Receives `ControlInstruction[]`.
    *   Executes instructions sequentially using `async/await` on the library's API methods (e.g., `await controls.dollyTo(distance, true)`).
    *   `useFrame` loop likely only calls `controls.update(delta)`.

## 4. New API Contract: `ControlInstruction`

Define a type for the instructions passed from backend to frontend:

```typescript
// Example definition (place in appropriate types file)
// Consider using specific types for args based on method if possible
interface ControlInstruction {
  method: string; // e.g., 'dollyTo', 'rotateTo', 'setLookAt'
  args: any[]; // Arguments for the method call
}

// Example Output from Backend API:
// [
//   { method: 'dollyTo', args: [5, true] }, 
//   { method: 'rotateTo', args: [1.57, 0.78, true] } 
// ]
```

## 5. Phased Rollout Plan (Attempt 3)

### Phase 0: Setup & Basic Integration
*   [ ] Create new feature branch (`feature/frontend-smoothing-v3`).
*   [ ] Install/confirm `@react-three/drei` dependency.
*   [ ] Basic setup of `<CameraControls />` in `AnimationController.tsx`. Get a `ref` working. Ensure basic user interaction works.
*   [ ] Define `ControlInstruction` type.
*   *Goal:* Basic library component integrated, ready for programmatic control.

### Phase 1: Refactor One Primitive End-to-End (e.g., Dolly)
*   **Size:** Medium (M)
*   **Value:** Validates the core architecture and API mapping.
*   **Tasks:**
    *   [ ] Refactor `handleDollyStep.ts`: Calculate target distance, output `[{ method: 'dollyTo', args: [distance, true] }]`.
    *   [ ] Update `SceneInterpreterImpl` and API route to handle/return `ControlInstruction[]`.
    *   [ ] Update `AnimationController` to receive `ControlInstruction[]` and execute the `dollyTo` method on the `camera-controls` ref.
    *   [ ] Test "dolly" command thoroughly. Is it smooth? Does it respect distance?
*   *Goal:* Demonstrate end-to-end functionality for a single primitive using the new architecture.

### Phase 2: Refactor Remaining Primitives
*   **Size:** Large (L)
*   **Value:** Enables all core motion types with built-in smoothing.
*   **Tasks:**
    *   [ ] Incrementally refactor other handlers (`handleOrbitStep`, `handlePanStep`, `handleTiltStep`, `handlePedestalStep`, `handleTruckStep`, `handleZoomStep`, `handleMoveToStep`) to output corresponding `ControlInstruction[]` (e.g., `rotateTo`, `truck`, `zoomTo`, `moveTo`, `setPosition`, `setTarget`). Map parameters carefully.
    *   [ ] Test each primitive individually after refactoring. Ensure smoothness and correctness.
*   *Goal:* All supported motion primitives work correctly via `camera-controls`.

### Phase 3: Sequence Testing & Tuning
*   **Size:** Medium (M)
*   **Value:** Validates transition smoothness - the primary goal.
*   **Tasks:**
    *   [ ] Test various sequences thoroughly (dolly+orbit, pedestal+orbit, pan+tilt, etc.).
    *   [ ] Evaluate transition smoothness.
    *   [ ] Tune `camera-controls` parameters (`smoothTime`, `draggingSmoothTime`) via props if necessary for desired feel.
    *   [ ] Re-evaluate constraint handling – does it need to happen in handlers before generating instructions, or can `camera-controls` boundaries suffice?
*   *Goal:* Smooth, visually pleasing transitions between sequential primitives.

### Phase 4: Address Remaining Features/Polish (Post-MVP)
*   [ ] Re-evaluate need for explicit "blend hints" (`easeHint`, `allowCornerBlending`) in `CameraCommand` - `camera-controls` might handle this implicitly or have its own parameters.
*   [ ] Consider advanced `camera-controls` features (boundaries, fitToBox, etc.).
*   [ ] Address UI polish (fading grid, etc.).

### Phase 5: Post-MVP Refinements & Deferred Items (NEW)
*   **Goal:** Address items deferred during earlier phases and further refine the camera control experience.
*   **Tasks:**
    *   [ ] **Precise Duration Control:** Investigate methods to achieve more exact animation durations, or finalize UX for qualitative duration inputs (e.g., "fast", "slow") if precise timing remains elusive with `camera-controls` transitions.
    *   [ ] **Enhanced Progress Reporting:** Implement more granular progress updates *during* camera-controls transitions, if feasible (e.g., by listening to library events or estimating progress based on state changes).
    *   [ ] **Advanced Easing Control:** Explore if/how `camera-controls` allows for custom easing profiles or further tuning beyond the default SmoothDamp behavior influenced by `smoothTime`.
    *   [ ] **Initial Camera Focus on Model Load:** Ensure the camera correctly frames the model (respecting normalization and adjusted center) when a model is first loaded and `<CameraControls />` initializes.
    *   [ ] **"Reset Camera" Button Functionality:** Update the existing "Reset Camera" button in the UI to work correctly with the `cameraControlsRef.current` API (e.g., using its `reset()` method to revert to its saved default state, or using `setLookAt()` to a predefined default view).

## 6. Testing Strategy
*   **Phase 1:** Verify refactored Dolly works smoothly end-to-end. No regressions for *other* (un-refactored) primitives yet.
*   **Phase 2:** Test *each* primitive thoroughly immediately after its handler is refactored.
*   **Phase 3:** Focus on testing diverse *sequences* and visually evaluating transition quality. Test edge cases (zero duration, immediate transitions).
*   **General:** Maintain broad testing of all primitives throughout.

## 7. Open Questions & Risks
*   **API Coverage:** Does the `camera-controls` API fully cover the nuances of all our defined primitives (especially qualitative descriptors, different axes for orbit)? Requires careful mapping in handlers.
*   **Constraint Handling:** How will complex constraints (min/max height/distance, bounding box raycasting) be implemented? Can they be mapped to `camera-controls` features (like `.boundary`), or do they still need pre-calculation in handlers?
*   **Performance:** Impact of the library itself (should be minimal, generally performant).
*   **Refactor Effort:** Backend handler refactor is significant.
*   **Loss of Fine Control:** We lose direct control over spline shape (no more Catmull-Rom tension tuning or manual blend point injection), relying on the library's SmoothDamp. Is this acceptable? (Likely yes, given the benefits).
*   **"Dip" / Overshoot:** Does the library's internal smoothing exhibit similar artifacts? How tunable is it? 