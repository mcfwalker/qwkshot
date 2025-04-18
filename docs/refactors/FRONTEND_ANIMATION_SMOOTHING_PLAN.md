# Frontend Animation Smoothing Refactor Plan

## 1. Goals & Non-Goals

### Goals
- Significantly improve the visual quality and fluidity of generated camera animations.
- Eliminate or drastically reduce perceived jerks, hitches, and pacing issues during transitions between different motion types.
- Achieve a more "cinematic" feel for camera movements, aligning better with user expectations.
- Leverage the existing backend refactor (LLM Engine -> Scene Interpreter) for generating semantically correct waypoints.
- Implement smoothing and blending logic primarily on the frontend for efficiency and better integration with rendering.

### Non-Goals (Initial Phases)
- Rewriting the core LLM planning logic (Assistant instruction tuning is handled separately).
- Implementing the most complex smoothing algorithms (e.g., Min-Snap) *unless* justified by initial feedback.
- Fundamentally changing the API contract (`CameraCommand[]` waypoints) between backend and frontend initially.
- Handling complex concurrent motion planning (focus is on smoothing sequential waypoints).

## 2. High-Level Architecture (Hybrid Approach)

The core backend architecture remains: `React UI -> LLM Engine (Adapter) -> Scene Interpreter`. However, the *responsibility* for fine-grained smoothing and transitions shifts:

```mermaid
graph TD
    subgraph "User Interface (Client)"
        UI[React UI]
        AnimController[AnimationController <br> (R3F useFrame)]
        PathSmoother[Path Smoother <br> (New: Analyze, Blend, Spline)]
        ThreeJS[Three.js Camera]
    end

    subgraph "Backend (Next.js API Route)"
        API["/api/camera-path"]
        subgraph "LLM Engine"
            OAIAdapter[OpenAIAssistantAdapter]
        end
        subgraph "Scene Interpreter"
            Interpreter[SceneInterpreterImpl <br> (Waypoints & Constraints)]
        end
        MetadataMgr[Metadata Manager]
    end

    subgraph "External Services"
        OpenAI[OpenAI Assistants API]
        MotionKB[(Motion KB File)]
    end

    %% Data Flow
    UI -- "1. User Prompt" --> API
    API -- "2. Fetch Context" --> MetadataMgr
    MetadataMgr -- "3. Scene/Env Analysis" --> API
    API -- "4. generatePlan()" --> OAIAdapter
    OAIAdapter -- "5. Prompt" --> OpenAI
    OpenAI -- "6. Use KB" --> MotionKB
    OpenAI -- "7. MotionPlan (JSON)" --> OAIAdapter
    OAIAdapter -- "8. Parsed MotionPlan" --> API
    API -- "9. interpretPath(Plan, Context)" --> Interpreter
    Interpreter -- "10. Waypoints (CameraCommand[])" --> API
    API -- "11. Response: Waypoints" --> UI
    UI -- "12. Update State (Waypoints)" --> PathSmoother
    PathSmoother -- "13. Analyze, Blend, Generate Spline" --> AnimController
    AnimController -- "14. Sample Spline & Update Camera (useFrame)" --> ThreeJS
    ThreeJS -- "15. Renders Updated View" --> UI

    %% Styling (Optional)
    classDef client fill:#ccf,stroke:#333;
    class UI,AnimController,PathSmoother,ThreeJS client;
    classDef backend fill:#cfc,stroke:#333;
    class API,OAIAdapter,Interpreter,MetadataMgr backend;
    classDef external fill:#f9f,stroke:#333;
    class OpenAI,MotionKB external;

```

*   **Backend (`Scene Interpreter`):** Focuses on interpreting the LLM plan, resolving targets, applying hard constraints, and generating a lean sequence of essential **waypoints** (`CameraCommand[]` defining key states). Complex sampling (like intermediate orbit steps) can potentially be removed.
*   **Frontend (`PathSmoother` / `AnimationController`):** Receives the waypoints. Analyzes transitions, potentially injects corner blend points, generates high-quality splines (`CatmullRomCurve3` or better) for position and uses `Quaternion.slerp` for orientation, then samples these frame-by-frame to drive the camera.

## 3. Component Roles in New Architecture

*   **React UI:** Largely unchanged. Triggers request, receives waypoint data.
*   **LLM Engine (Adapter):** Unchanged. Focus remains on generating the best possible `MotionPlan`.
*   **Scene Interpreter:** **Role simplified.** Focuses on waypoint generation based on plan steps, target resolution, and critical constraint enforcement. Does *not* need to handle fine-grained sampling or complex blending logic itself (potential code removal).
*   **`PathSmoother` (New Frontend Logic):** Likely a new class or integrated logic within/used by `AnimationController`. Responsible for:
    *   Receiving waypoints from the API.
    *   Analyzing velocity/angle changes between waypoints.
    *   (Phase 2+) Injecting additional points for corner blending if needed.
    *   Generating the final `CatmullRomCurve3` (or other spline) for positions.
    *   Providing methods/data for the `AnimationController` to sample the path and orientation.
*   **`AnimationController` (Frontend):** **Role enhanced.** Instead of simple `lerp`, it will:
    *   Utilize the `PathSmoother`'s output curve/spline.
    *   Sample the position curve based on elapsed animation time.
    *   Perform `Quaternion.slerp` for smooth orientation changes between key waypoint orientations.
    *   Update the Three.js camera in `useFrame`.

## 4. API Contracts / Schemas

*   **Backend Output (`/api/camera-path`):** Remains `CameraCommand[]`, but the commands represent **essential waypoints** rather than densely sampled points. The interpreter *may* output fewer points than currently (e.g., for orbits).
*   **Frontend Internal:** New interfaces might be needed between `PathSmoother` and `AnimationController` to pass curve data or sampling functions.

## 5. Phased Rollout Plan

### Phase 0: Planning & Setup
*   [X] Define Hybrid Architecture (Backend Waypoints, Frontend Smoothing). *(Completed)*
*   [X] Outline Phased Implementation Strategy. *(Completed)*
*   [ ] Create dedicated feature branch (`feature/frontend-animation-smoothing`) *after* merging current backend refactor. *(Pending)*
*   *Goal:* Clear plan, defined architecture, new branch created.

### Phase 1: Basic Frontend Smoothing (Catmull-Rom / Slerp)
*   **Size:** Medium (M)
*   **Tasks:**
    *   [ ] Modify `AnimationController` (`useFrame` loop).
    *   [ ] Replace position `lerp` with sampling from `THREE.CatmullRomCurve3` created from received waypoints. Use 'centripetal' option.
    *   [ ] Replace orientation logic with `THREE.Quaternion.slerp` between orientations derived from waypoints (e.g., `lookAt` applied to waypoint pos/target).
    *   [ ] Ensure correct time mapping for curve sampling (`t` from 0 to 1 over segment duration).
    *   [ ] Basic visual testing: Orbits, pans, tilts should appear significantly smoother *within* the segment.
*   *Goal:* Implement fundamental spline-based interpolation on the frontend for immediate smoothness improvement.

### Phase 2: Frontend Transition Blending
*   **Size:** Large (L)
*   **Tasks:**
    *   [ ] Implement logic (in `PathSmoother` or `AnimationController`) to analyze consecutive waypoints received from the backend.
    *   [ ] Calculate approximate entry/exit velocities (or tangent directions) at waypoints connecting different motion types.
    *   [ ] Implement angle check (`vA.angleTo(vB) > threshold`).
    *   [ ] If a sharp turn is detected, implement logic to inject intermediate blend points (start simple, e.g., points near the corner, or use Bézier/Dubins if necessary).
    *   [ ] Feed the *augmented* waypoint list (with blend points) into the `CatmullRomCurve3` generator from Phase 1.
    *   [ ] Test cases with sharp transitions (zoom-orbit, truck-reverse, etc.).
*   *Goal:* Eliminate or significantly reduce visual jerks/hitches *between* different motion segments.

### **BETA GATE:** Proposed Pause Point
*   **Action:** Merge completed Phases 1 & 2 to `stable`/`main`. Deploy to a staging/beta environment.
*   **Goal:** Gather user feedback on the significantly improved animation quality and identify if further refinements (Phase 3/4) are truly necessary based on real-world use.

### Phase 3: Backend Simplification (Optional - Post-Beta)
*   **Size:** Small (S)
*   **Tasks:**
    *   [ ] Review `Scene Interpreter` motion generators (`orbit`, etc.).
    *   [ ] Remove logic that generates dense intermediate points if the frontend spline sufficiently handles the curve.
    *   [ ] Remove backend blend/settle command logic if frontend handles transitions robustly.
    *   [ ] Ensure essential start/end waypoints and constraint checks remain correct.
*   *Goal:* Optimize backend by removing redundant logic now handled by the frontend smoother. Reduce API payload size.

### Phase 4: Min-Snap Solver (Optional - Post-Beta)
*   **Size:** Extra Large (XL)
*   **Tasks:**
    *   [ ] Research and select appropriate JS or WASM min-snap/min-jerk library.
    *   [ ] Integrate solver into the frontend `PathSmoother`.
    *   [ ] Replace `CatmullRomCurve3` with sampling the polynomial output from the solver.
    *   [ ] Address potential performance implications or build process changes (WASM).
*   *Goal:* Achieve C²/C³ continuity for ultimate smoothness, if deemed necessary after beta feedback.

## 6. Testing Strategy
*   **Phase 1:** Visual comparison of before/after smoothing on existing test prompts (especially orbits, pans, tilts). Ensure no regressions.
*   **Phase 2:** Create specific test prompts designed to cause sharp transitions (zoom-orbit, truck-dolly, truck-reverse). Visually verify the effectiveness of corner blending. Test edge cases (very short segments, back-to-back turns).
*   **Phase 3:** Regression testing using all previous E2E test suites to ensure backend simplification doesn't break waypoint generation. Verify API payload reduction.
*   **Phase 4:** Visual comparison against Phase 2 results. Performance testing.

## 7. Open Questions & Risks
*   Performance impact of frontend calculations, especially on lower-end devices?
*   Complexity of implementing robust corner-blending logic?
*   Choosing the right blend algorithm (Dubins vs. Bézier vs. simpler heuristics)?
*   Potential need for frontend math libraries if Three.js built-ins are insufficient for blending?
*   Latency impact if min-snap solver (especially WASM) has significant initialization time?
*   Ensuring perfect time synchronization between spline sampling and segment durations. 