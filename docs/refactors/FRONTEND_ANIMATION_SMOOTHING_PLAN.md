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

## 3. Component Roles in New Architecture

*   **React UI:** Largely unchanged. Triggers request, receives waypoint data.
*   **LLM Engine (Adapter):** Unchanged. Focus remains on generating the best possible `MotionPlan`.
*   **Scene Interpreter:** **Role simplified.** Focuses on waypoint generation based on plan steps, target resolution, and critical constraint enforcement. Does *not* need to handle fine-grained sampling or complex blending logic itself (potential code removal).
*   **`PathSmoother` (New Frontend Logic):** Likely a new class or integrated logic within/used by `AnimationController`. Responsible for:
    *   Receiving waypoints from the API.
    *   Analyzing velocity/angle changes between waypoints (using `vA.angleTo(vB) > threshold` logic, e.g., 20 degrees).
    *   (Phase 2+) Injecting additional points for corner blending if needed (e.g., using `buildCornerArc` logic or similar).
    *   Generating the final `CatmullRomCurve3` (or other spline, potentially Min-Snap in Phase 4) for positions.
    *   Providing methods/data for the `AnimationController` to sample the path and orientation.
    *   (Future) Potentially running within a Web Worker.
*   **`AnimationController` (Frontend):** **Role enhanced.** Instead of simple `lerp`, it will:
    *   Utilize the `PathSmoother`'s output curve/spline.
    *   Pre-sample the path to a Float32Array outside `useFrame` for performance (e.g., 60fps * duration samples).
    *   Sample the position curve based on elapsed animation time (using index lookup into pre-sampled array).
    *   Perform `Quaternion.slerp` for smooth orientation changes between key waypoint orientations.
    *   Update the Three.js camera in `useFrame`.

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

## 5. Phased Rollout Plan

### Phase 0: Planning & Setup
*   [X] Define Hybrid Architecture (Backend Waypoints, Frontend Smoothing). *(Completed)*
*   [X] Outline Phased Implementation Strategy. *(Completed)*
*   [ ] Create dedicated feature branch (`feature/frontend-animation-smoothing`). *(Pending)*
*   *Goal:* Clear plan, defined architecture, new branch created.

### Phase 1: Basic Frontend Smoothing (Catmull-Rom / Slerp)
*   **Size:** Medium (M)
*   **Value:** 80% of visible jerk gone.
*   **Risk:** High-speed orbits/pans might still stutter slightly.
*   **Tasks:**
    *   [ ] Modify `AnimationController` (`useFrame` loop).
    *   [ ] Implement `PathSmoother` logic (or integrate into `AnimationController`) to create `THREE.CatmullRomCurve3` from received waypoints (use 'centripetal').
    *   [ ] Implement orientation calculation (e.g., using `lookAt`) at each waypoint to create Quaternions.
    *   [ ] Implement `THREE.Quaternion.slerp` between waypoint orientations.
    *   [ ] Implement pre-sampling of the position curve and orientation (e.g., to Float32Arrays) outside `useFrame`.
    *   [ ] Update `useFrame` to sample pre-calculated position/orientation arrays based on time.
    *   [ ] Basic visual testing: Orbits, pans, tilts should appear significantly smoother *within* the segment.
*   *Goal:* Implement fundamental spline-based interpolation on the frontend.

### Phase 2: Frontend Transition Blending
*   **Size:** Large (L)
*   **Value:** Eliminates velocity spikes/jerks at segment joins.
*   **Risk:** Potential for algorithmic edge cases in corner detection/injection.
*   **Tasks:**
    *   [ ] Enhance `PathSmoother`: Implement logic to analyze consecutive waypoints.
    *   [ ] Calculate approximate entry/exit velocities/tangents.
    *   [ ] Implement angle check (e.g., `angle > 20 degrees`) to detect sharp corners.
    *   [ ] If sharp corner detected (and `allowCornerBlending` isn't false): Implement logic to inject intermediate blend points using a suitable method (e.g., spherical arc helper `buildCornerArc`, clothoid, Bézier).
    *   [ ] Feed the *augmented* waypoint list into the spline generation (Phase 1).
    *   [ ] Test cases with sharp transitions (zoom-orbit, truck-reverse, etc.). Add debug overlay showing detected corners.
*   *Goal:* Eliminate or significantly reduce visual jerks/hitches *between* different motion segments.

### **BETA GATE:** Proposed Pause Point
*   **Action:** Merge completed Phases 1 & 2 to `stable`/`main`. Deploy to staging/beta.
*   **Goal:** Gather user feedback on animation quality. Decide if Phase 3/4 needed.

### Phase 3: Backend Simplification (Optional - Post-Beta)
*   **Size:** Small (S)
*   **Tasks:** Review `Scene Interpreter`, remove dense sampling/blending logic, verify essential waypoints remain.
*   *Goal:* Optimize backend, reduce API payload.

### Phase 4: Min-Snap Solver (Optional - Post-Beta)
*   **Size:** Extra Large (XL)
*   **Value:** Film-quality smoothness, handles ~100 waypoints.
*   **Risk:** Web Worker integration, bundle size.
*   **Tasks:** Research/select library (e.g., `minsnap-trajectories`), integrate into `PathSmoother` (likely in Web Worker), replace spline sampling, address performance/build.
*   *Goal:* Achieve C²/C³ continuity if necessary.

## 6. Testing Strategy
*   **Phase 1:** Visual comparison before/after on existing prompts. No regressions.
*   **Phase 2:** Specific sharp transition prompts. Visual verification of blending. Edge case testing.
*   **Phase 3:** Full regression suite. API payload size verification.
*   **Phase 4:** Visual comparison vs Phase 2. Performance testing.
*   **General:** Add headless Jest tests asserting max jerk/angular velocity step using finite differencing on sampled path data (catches many smoothing bugs automatically).

## 7. Open Questions & Risks
*   Performance impact of frontend calculations (mitigated by pre-sampling, Web Worker)?
*   Complexity/robustness of corner-blending logic?
*   Best blend algorithm (Dubins vs. Bézier vs. spherical arc vs. others)?
*   Need for additional frontend math libraries?
*   Latency/build impact of WASM-based Min-Snap solver?
*   Time synchronization between sampling and durations.
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