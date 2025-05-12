# Frontend Animation Smoothing Refactor Plan

## 1. Goals & Non-Goals

### Goals
- Significantly improve the visual quality and fluidity of generated camera animations.
- Eliminate or drastically reduce perceived jerks, hitches, and pacing issues during transitions between different motion types.
- Achieve a more "cinematic" feel for camera movements, aligning better with user expectations.
- Leverage the existing backend refactor (LLM Engine -> Scene Interpreter) for generating semantically correct waypoints.
- Implement smoothing and blending logic primarily on the frontend for efficiency and better integration with rendering.

### Measurable Goals (KPIs)
- **Max jerk** (‖d³x/dt³‖): ≤ `J_scene` m s⁻³ (to be tuned per scene scale, guarantees no visible hitches).
- **Max angular‑velocity step:** ≤ 15 ° s⁻¹ (prevents whip‑pans at segment joins).
- **End‑to‑end smoothing latency:** ≤ 80 ms for ≤ 20 way‑points (desktop, keeps UI responsive).
- **Bundle size impact:** ≤ +20 kB (gzip) per added maths library (mobile‑friendly).

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
*   **Web Worker (Future Phase):** For more complex solvers (like Min-Snap), `PathSmoother` logic can be moved into a Web Worker to avoid blocking the main thread.
*   **Service Worker Cache (Future Phase):** Consider caching previously smoothed paths (keyed by waypoint hash) in a Service Worker for faster re-runs during prompt tweaking.

## 3. Component Roles in New Architecture (REVISED)

*   **React UI:** Largely unchanged. Triggers request, receives waypoint data.
*   **LLM Engine (Adapter):** Unchanged. Focus remains on generating the best possible `MotionPlan`.
*   **Scene Interpreter:** **Role refined.** Focuses on waypoint generation based on plan steps, target resolution, and critical constraint enforcement. **Lesson:** Handler output format and density are crucial. For primitives involving continuous motion (orbit, pan, tilt), handlers MUST generate sufficient intermediate steps with appropriate durations and target changes for frontend interpolation (LERP or Slerp) to work correctly. For smooth frontend *blending* between primitives, handlers should ideally generate sparser, essential keyframes for continuous movements to allow the frontend blend logic more geometric space.
*   **`PathProcessor` (New Frontend Logic - Renamed from `PathSmoother`):** Implemented as a class (`src/features/p2p/animation/PathProcessor.ts`). Responsible for:
    *   Receiving `CameraCommand[]` waypoints and initial camera orientation.
    *   **Filtering:** Removing consecutive duplicate positional waypoints, accumulating durations.
    *   **Orientation Keyframes:** Calculating `lookAt` quaternions for each unique filtered waypoint based on its position and target.
    *   **(Phase 2+) Corner Detection & Blending:** Analyzing angles between filtered segments, detecting sharp corners, injecting blend points (`B1`, `B2`) into the waypoint list to create an `augmentedWaypoints` list.
    *   Generating the final `CatmullRomCurve3` for positions using `augmentedWaypoints`.
    *   Providing `ProcessedPathData` containing sampled positions (from the augmented spline), the original filtered segment durations (for easing sync), total duration, and the calculated keyframe quaternions (for Slerp).
*   **`AnimationController` (Frontend):** **Role significantly changed.**
    *   Receives `CameraCommand[]`, manages clock/playback state.
    *   Calls `PathProcessor.process()` with commands and current orientation.
    *   Stores `ProcessedPathData`.
    *   **`useFrame` Loop:**
        *   Samples position from `ProcessedPathData.sampledPositions` based on elapsed time / total duration.
        *   Calculates the current logical segment index based on `elapsedTime` and `ProcessedPathData.segmentDurations`.
        *   Performs `Quaternion.slerp()` between the corresponding `keyframeQuaternions` from `ProcessedPathData` for the current segment, applying segment-specific easing to the interpolation factor.
        *   Updates the Three.js camera position and orientation.
    *   **(Lesson):** Using a dynamic `lookAt` instead of Slerp based on processed quaternions breaks primitives like pan/tilt. Slerp using quaternions derived from the original commands' targets is essential for correct orientation.

## 4. API Contracts / Schemas

*   **Backend Output (`/api/camera-path`):** Remains `CameraCommand[]`, but the commands represent **essential waypoints**. The interpreter *may* output fewer points than currently.
*   **`CameraCommand` Interface (Potential Enhancements):** Consider adding optional fields for richer frontend control:
    ```typescript
    interface CameraCommand {
      position: { x: number; y: number; z: number }; // Serialized Vec3
      target: { x: number; y: number; z: number }; // Serialized Vec3
      duration: number;
      easing: EasingFunctionName;
      fov?: number; // Optional FOV control per waypoint
      concurrent?: boolean; // Hint for blending: true = blend with next, false/default = sequential
      easeHint?: 'auto' | 'hardStop' | 'blend'; // Further hint for PathSmoother
      allowCornerBlending?: boolean; // Hint: If false, force linear join even if angle is sharp
    }
    ```
*   **Frontend Internal:** New interfaces might be needed between `PathSmoother` and `AnimationController` to pass curve data or sampling functions/arrays.

## 5. Phased Rollout Plan (REVISED based on Attempt 1)

### Phase 0: Planning & Setup
*   [X] Define Hybrid Architecture.
*   [X] Outline Phased Implementation Strategy.
*   [ ] Create dedicated feature branch (`feature/frontend-smoothing-v2`). *(Pending)*
*   *Goal:* Clear plan, defined architecture, new branch created.

### Phase 1: Foundational Smoothing (Position Spline + Orientation Slerp)
*   **Size:** Large (L)
*   **Value:** Smoother intra-segment motion, correct orientation handling for all primitives.
*   **Risk:** Transitions between segments will still be abrupt (C0 continuity). Performance impact of `PathProcessor`.
*   **Tasks (Attempt 2):**
    *   [ ] Implement `PathProcessor` class.
        *   [ ] Basic filtering (duplicate positions).
        *   [ ] Generate `CatmullRomCurve3` from filtered waypoints.
        *   [ ] Pre-sample positions (`sampledPositions`).
        *   [ ] Calculate `keyframeQuaternions` from filtered waypoints/targets.
        *   [ ] Return `ProcessedPathData { sampledPositions, keyframeQuaternions, segmentDurations, totalDuration }`.
    *   [ ] Refactor `AnimationController`:
        *   [ ] Integrate `PathProcessor`.
        *   [ ] Implement robust clock management (handling start/stop/resume/speed).
        *   [ ] Update `useFrame` to use `sampledPositions`.
        *   [ ] Update `useFrame` to use `Quaternion.slerp` between `keyframeQuaternions` based on original `segmentDurations` and easing.
        *   [ ] **Broad Testing:** Verify ALL core primitives (pan, tilt, pedestal, dolly, orbit, zoom) function correctly. Verify basic sequences.
    *   [ ] Basic visual testing: Orbits, pans, tilts should appear significantly smoother *within* the segment.
*   *Goal:* Stable animation system with smooth intra-segment motion via splines/Slerp, compatible with all primitives.

### Phase 2: Frontend Transition Blending (Corner Injection)
*   **Size:** Large (L)
*   **Value:** Smooths transitions *between* different motion segments.
*   **Risk:** Blend algorithm tuning (corner detection threshold, offset calculation, clamping) needed to achieve desired visual radius without artifacts ("dip"). Geometric limitations from short segments can cap blend size.
*   **Tasks:**
    *   [ ] Enhance `PathProcessor`:
        *   [ ] Implement corner detection logic (angle check between filtered segments).
        *   [ ] Implement blend point (`B1`, `B2`) calculation (e.g., based on offset fraction, min/max clamps).
        *   [ ] Augment waypoint list passed to `CatmullRomCurve3` by replacing corner points with `B1, B2`.
    *   [ ] Test cases with sharp transitions (dolly-orbit, pan-tilt, etc.).
    *   [ ] Tune blend constants (`CORNER_ANGLE_THRESHOLD_RADIANS`, `BLEND_OFFSET_FRACTION`, `MIN_BLEND_OFFSET`, `MAX_BLEND_OFFSET_FACTOR`) iteratively based on visual feedback to minimize artifacts like the "dip".
*   *Goal:* Eliminate or significantly reduce visual jerks/hitches *between* different motion segments.

### **BETA GATE:** Proposed Pause Point (After Phase 2 Tuning)
*   **Action:** Merge completed Phases 1 & 2 to `stable`/`main`. Deploy to staging/beta.
*   **Goal:** Gather user feedback on overall animation quality and transition smoothness.

### Phase 3: Backend Handler Optimization (Conditional)
*   **Size:** Small (S) to Medium (M) - Depends on number of handlers needing adjustment.
*   **Condition:** Only if Phase 2 frontend blending is insufficient for certain transitions due to dense backend waypoints or very short segments limiting blend radius.
*   **Tasks:** Review relevant Scene Interpreter handlers (`orbit`, `pan`, `tilt`?), modify logic to generate fewer, more essential keyframes (e.g., increase `anglePerStep`).
*   *Goal:* Optimize backend waypoints to better support frontend blending where necessary.

### Phase 4: Min-Snap Solver (Optional - Future)
*   **Size:** Extra Large (XL)
*   **Value:** Film-quality smoothness, handles ~100 waypoints.
*   **Risk:** Web Worker integration, bundle size.
*   **Tasks:** Research/select library (e.g., `minsnap-trajectories`), integrate into `PathSmoother` (likely in Web Worker), replace spline sampling, address performance/build.
*   *Goal:* Achieve C²/C³ continuity if necessary.

## 6. Testing Strategy (REVISED)
*   **Phase 1:** **CRITICAL:** Test *all* individual primitives thoroughly after initial spline/Slerp implementation. Test simple 2-step sequences. Verify no regressions from `main` branch functionality. Focus on correct execution and intra-segment smoothness.
*   **Phase 2:** Test sharp transition prompts (dolly-orbit, etc.). Visually verify blend curve radius and smoothness. Iterate on blend constant tuning. Test for artifacts ("dip"). **CRITICAL:** Re-verify all individual primitives after blending logic is added.
*   **Phase 3:** If implemented, verify transitions involving modified backend handlers are improved. Full regression test.
*   **General:** Add headless tests asserting max jerk/angular velocity step (as originally planned). Ensure tests cover both individual primitives and key transition sequences.

## 7. Open Questions & Risks (REVISED)
*   Performance impact of `PathProcessor` (filtering, corner detection, spline generation)? (Mitigated by pre-calculation outside `useFrame`).
*   Robustness & Tuning: Achieving desired blend radius without artifacts ("dip") via constant tuning (`BLEND_OFFSET_FRACTION`, `MIN_BLEND_OFFSET`, `MAX_BLEND_OFFSET_FACTOR`) might be difficult due to geometric constraints (short segments). `MAX_BLEND_OFFSET_FACTOR` might need careful adjustment.
*   **Backend Handler Dependency:** Visual quality of frontend blending is sensitive to the density and spacing of waypoints provided by backend handlers. May require backend adjustments (Phase 3) for optimal results across all transitions.
*   **Orientation-Only Primitives:** Ensure `PathProcessor` filtering and orientation keyframe generation correctly handles primitives like pan/tilt where position doesn't change but target does.
*   Best blend algorithm? (Current plan uses simple offset points; others like Bezier/arcs are more complex).
*   Need for additional math libraries?
*   Web Worker for PathProcessor? (Still relevant for Phase 4 or if Phase 2 calculations become too heavy).
*   **Caching Strategy:** Should smoothed samples be cached client-side (e.g., Service Worker based on waypoint hash) to speed up re-runs, or recomputed each time?
*   **Mobile Fallback:** If complex solvers (WASM) aren't available/performant on mobile, what's the fallback (linear lerp + slerp)?

## 8. Implementation Examples (Illustrative)

### PathSmoother in Web Worker
```javascript
// main-thread.js
const worker = new Worker('/pathSmoother.js');
worker.postMessage({ waypoints });
worker.onmessage = ({ data }) => {
  animationController.loadSamples(data.samples); // Float32Array
};

// pathSmoother.js (Web Worker)
import { CatmullRomCurve3, Vector3, Quaternion } from 'three';
// import minSnap from 'minsnap-trajectories'; // Phase 4

self.onmessage = ({ data }) => {
  const wps = data.waypoints; // Assuming CameraCommand[] format

  // 1. Inject corner/blend logic (Phase 2+)
  const expandedWps = injectTransitions(wps);

  // 2. Generate Splines / Solve Polynomials
  const positionCurve = new CatmullRomCurve3(expandedWps.map(wp => new Vector3(wp.position.x, wp.position.y, wp.position.z)), false, 'centripetal');
  // TODO: Calculate quaternions for orientation at each expandedWp
  const orientations = calculateOrientations(expandedWps);
  // const posPolynomial = solveMinSnap(expandedWps); // Phase 4

  // 3. Pre-sample N frames
  const fps = 60;
  const totalDuration = expandedWps.reduce((sum, wp) => sum + wp.duration, 0);
  const N = Math.ceil(fps * totalDuration);
  // Allocate buffer for position (x,y,z) and orientation (x,y,z,w quaternion)
  const samples = new Float32Array(N * 7); 

  let accumulatedTime = 0;
  let segmentIndex = 0;
  for (let i = 0; i < N; i++) {
    const timeInAnimation = (i / Math.max(1, N - 1)) * totalDuration;
    
    // Find current segment and time within segment
    while (segmentIndex < expandedWps.length - 1 && accumulatedTime + expandedWps[segmentIndex + 1].duration < timeInAnimation) {
        accumulatedTime += expandedWps[segmentIndex + 1].duration;
        segmentIndex++;
    }
    const segmentStartTime = accumulatedTime;
    const segmentDuration = expandedWps[segmentIndex + 1].duration;
    const timeInSegment = timeInAnimation - segmentStartTime;
    let t = segmentDuration > 1e-6 ? timeInSegment / segmentDuration : 1.0; // Normalized time in segment (0-1)
    t = Math.max(0, Math.min(1, t)); // Clamp t

    // --- Calculate Sampled Position --- 
    // Map t to curve parameter (assuming curve represents full path)
    const curveT = (timeInAnimation / totalDuration);
    const p = positionCurve.getPointAt(curveT); // Sample position curve
    // const p = posPolynomial.pos(timeInAnimation); // Phase 4
    samples.set([p.x, p.y, p.z], i * 7); // Store position (3 floats)

    // --- Calculate Sampled Orientation --- 
    // SLERP between quaternions of the current segment
    const qStart = orientations[segmentIndex];
    const qEnd = orientations[segmentIndex + 1];
    const sampledQuaternion = new Quaternion();
    Quaternion.slerp(qStart, qEnd, sampledQuaternion, t);
    samples.set([sampledQuaternion.x, sampledQuaternion.y, sampledQuaternion.z, sampledQuaternion.w], i * 7 + 3); // Store orientation (4 floats)
  }

  self.postMessage({ samples }, [samples.buffer]);
};

// Placeholder - Needs proper implementation
function injectTransitions(wps: any[]): any[] { return wps; }
function calculateOrientations(wps: any[]): Quaternion[] { 
    return wps.map(wp => new Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(new Vector3(wp.position.x, wp.position.y, wp.position.z), new Vector3(wp.target.x, wp.target.y, wp.target.z), new Vector3(0,1,0))));
}
```

### Corner Arc Helper (Conceptual)
```javascript
function buildCornerArc(wpStart: CameraCommand, wpEnd: CameraCommand): CameraCommand[] {
  const center = new Vector3(wpStart.target.x, wpStart.target.y, wpStart.target.z); // Assume target is the pivot
  const posStart = new Vector3(wpStart.position.x, wpStart.position.y, wpStart.position.z);
  const posEnd = new Vector3(wpEnd.position.x, wpEnd.position.y, wpEnd.position.z);

  const R = Math.max(posStart.distanceTo(center), posEnd.distanceTo(center));
  // Project points onto sphere if needed (or assume they are for simple orbit corners)
  const p1 = posStart; 
  const p2 = posEnd;

  const steps = 4; // Number of intermediate points
  const arc: CameraCommand[] = [];
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    // Use SLERP for position on sphere around center
    // This requires quaternion math or careful vector rotation
    const intermediatePos = new Vector3().copy(p1).lerp(p2, t); // Placeholder: Replace with spherical lerp
    arc.push({ 
        position: {x: intermediatePos.x, y: intermediatePos.y, z: intermediatePos.z},
        target: wpStart.target, // Keep looking at the center
        duration: 0, // Blend points have no duration themselves
        easing: 'linear' // Easing handled by overall curve
    });
  }
  return arc;
}
```

### Testing Harness Example (Conceptual)
```javascript
// In a Jest/Vitest test file
import { Vector3 } from 'three';

test('jerk within limits', () => {
  // Assume 'samples' is the Float32Array(N * 7) from PathSmoother worker
  const positions = [];
  for (let i = 0; i < samples.length / 7; i++) {
      positions.push(new Vector3(samples[i*7], samples[i*7+1], samples[i*7+2]));
  }
  const fps = 60;
  const dt = 1.0 / fps;
  let maxJerkSq = 0;

  if (positions.length < 4) {
      // Need at least 4 points for finite difference jerk
      maxJerkSq = 0;
  } else {
      for (let i = 1; i < positions.length - 2; i++) {
          const p0 = positions[i-1];
          const p1 = positions[i];
          const p2 = positions[i+1];
          const p3 = positions[i+2];

          // Simplified finite difference calculation (adjust factors for accuracy)
          const acc0 = new Vector3().subVectors(p1, p0).multiplyScalar(1 / (dt*dt)); // Approx acc at i-0.5
          const acc1 = new Vector3().subVectors(p2, p1).multiplyScalar(1 / (dt*dt)); // Approx acc at i+0.5
          const acc2 = new Vector3().subVectors(p3, p2).multiplyScalar(1 / (dt*dt)); // Approx acc at i+1.5
          
          const jerkVec = new Vector3().subVectors(acc2, acc1).sub(new Vector3().subVectors(acc1, acc0)).multiplyScalar(1 / (dt)); // Approx jerk at i+0.5
          maxJerkSq = Math.max(maxJerkSq, jerkVec.lengthSq());
      }
  }
  const maxJerk = Math.sqrt(maxJerkSq);
  const sceneJerkLimit = 10.0; // Example limit (tune this)
  expect(maxJerk).toBeLessThan(sceneJerkLimit);
});
``` 