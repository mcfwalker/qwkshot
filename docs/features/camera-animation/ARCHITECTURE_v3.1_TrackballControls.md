# 📽️ Prompt-to-Path Pipeline Overview (v3.1 - TrackballControls & Roll)

**Status:** Reflects the architecture after swapping interactive controls to `<TrackballControls>` and successfully implementing visual `roll`.

## High-Level Explanation

Our Prompt-to-Path (P2P) pipeline translates a user's natural language request (e.g., "Orbit the model slowly") into a smooth, executable camera animation within the 3D viewer.

The process leverages the OpenAI Assistants API for high-level planning and a local "Scene Interpreter" for precise geometric execution:

1.  The user provides a **text prompt**.
2.  The user optionally adjusts the initial camera view using **`<TrackballControls>`** (which allow free rotation, including roll, but are disabled during animation playback).
3.  The user **locks the scene**, saving the current camera state (`position`, `target`, `fov`) and `userVerticalAdjustment` via the `MetadataManager`.
4.  The backend interacts with a configured **OpenAI Assistant** (via our `OpenAIAssistantAdapter`).
5.  The Assistant consults its **Motion Knowledge Base (KB)** using Retrieval.
6.  The Assistant generates a structured **`MotionPlan`** (JSON sequence of steps).
7.  This `MotionPlan` is passed to the **Scene Interpreter**.
8.  The Scene Interpreter also receives **local context** (`SceneAnalysis`, `EnvironmentalAnalysis`, `initialCameraState` [including a `Camera` object initialized from the locked state]) from the `MetadataManager`.
9.  The Scene Interpreter processes each step:
    *   Calculates precise camera movements based on primitives, parameters, and context.
    *   Resolves targets (including normalized + adjusted landmarks like `'object_top_center'`).
    *   Handles magnitude parameters (quantitative, qualitative, goal-based).
    *   Enforces constraints (height, distance, bounding box).
    *   Determines easing.
    *   **Crucially, for `rotate` with `axis: 'roll'`, it calculates and includes start/end `orientation` Quaternions.** For other rotations (`yaw`, `pitch`), `orientation` is left `null`.
10. The Interpreter outputs a list of **`CameraCommand[]`** keyframes (now including optional `orientation` quaternions).
11. Commands are serialized (including orientation) and sent to the client.
12. Client (`CameraAnimationSystem`) deserializes commands, **reconstructing `Vector3` and `Quaternion` objects.**
13. A dedicated **AnimationController** component (`useFrame` loop) consumes the commands:
    *   Reads `command.orientation`. If present for the segment (i.e., a roll), it uses `Quaternion.slerp` to interpolate orientation and applies it directly to `camera.quaternion`.
    *   If `command.orientation` is absent (e.g., pan, tilt, orbit), it interpolates the `target`, resets `camera.up` to `(0, 1, 0)`, and uses `camera.lookAt()` to set orientation.
    *   It interpolates `position` using `Vector.lerpVectors` (or potentially curve interpolation for orbits in the future).
    *   It applies the specified `easing` function.

This architecture separates AI planning from deterministic execution, using `<TrackballControls>` for setup and direct camera manipulation via `AnimationController` during locked playback to achieve all motion primitives, including roll.

## 🔄 Pipeline Data Flow (v3.1 - Trackball)

```mermaid
graph TD
    subgraph "User Interface (Client)"
        UI[React UI]
        ;;-- Interactive Setup --> Trackball[TrackballControls <br> (User Setup Phase - Enabled)]
        Trackball -- Sets Initial View --> ThreeJS[Three.js Camera]
        UI -- Locks Scene --> MetadataMgrClient[Metadata Save via Server Action]
        AnimController[AnimationController <br> (R3F useFrame - Playback Phase)]
        ;; ThreeJS -- Read State --> MetadataMgrClient
        ;; MetadataMgrClient -- Initial State --> API
    end

    subgraph "Backend (Next.js API Route)"
        API["/api/camera-path"]
        subgraph "LLM Engine"
            OAIAdapter[OpenAIAssistantAdapter]
        end
        subgraph "Scene Interpreter"
            Interpreter[SceneInterpreterImpl <br> (interpretPath)]
        end
        MetadataMgrBE[Metadata Manager <br> (DB Access)]
    end

    subgraph "External Services"
        OpenAI[OpenAI Assistants API <br> (GPT-4 + Retrieval) <br> **Note:** Instructions & KB <br> configured externally]
        MotionKB[(Motion KB File)] -- Uploaded To --> OpenAI
    end

    %% Data Flow
    UI -- "1. User Prompt, Duration, ModelID" --> API
    API -- "2. Fetch Context (ModelID)" --> MetadataMgrBE
    MetadataMgrBE -- "3. SceneAnalysis, EnvAnalysis, InitialCameraState" --> API
    API -- "4. Instantiate Adapter" --> OAIAdapter
    API -- "5. generatePlan(Prompt, Duration)" --> OAIAdapter
    OAIAdapter -- "6. Create Thread/Run (Prompt, AssistantID)" --> OpenAI
    OpenAI -- "7. Use KB via Retrieval" --> MotionKB
    OpenAI -- "8. MotionPlan (JSON)" --> OAIAdapter
    OAIAdapter -- "9. Parsed MotionPlan Object" --> API
    API -- "10. Instantiate Interpreter" --> Interpreter
    API -- "11. interpretPath(MotionPlan, SceneAnalysis, EnvAnalysis, InitialCameraState)" --> Interpreter
    Interpreter -- "12. CameraCommand[] (incl. Orientation)" --> API
    API -- "13. Response: Serialized CameraCommand[]" --> UI
    UI -- "14. Update State (isPlaying=true, deserialize commands incl. Quaternions)" --> AnimController
    AnimController -- "15. Interpolates Pos & Quat/LookAt & Updates Camera Ref" --> ThreeJS
    ThreeJS -- "16. Renders Updated View" --> UI
    %% Link Trackball to Camera for setup phase view
    Trackball -.-> ThreeJS

    %% Styling (Optional)
    classDef external fill:#f9f,stroke:#333,stroke-width:2px;
    class OpenAI,MotionKB external;
    classDef client fill:#ccf,stroke:#333;
    class UI,AnimController,ThreeJS,Trackball,MetadataMgrClient client;
    classDef api fill:#cfc,stroke:#333;
    class API,OAIAdapter,Interpreter,MetadataMgrBE api;

```

## 🎯 Core Components (v3.1 Roles)

*   **Scene Analyzer:** (Unchanged)
*   **Environmental Analyzer:** (Unchanged)
*   **Metadata Manager:** (Unchanged)
*   **Prompt Compiler:** (Deprecated)
*   **LLM Engine (Adapter):** (Unchanged)
*   **Scene Interpreter:** (Refined)
    *   Receives context including `initialCameraState.camera`.
    *   Generates `CameraCommand[]` keyframes.
    *   **Calculates and includes `orientation` Quaternions** for `rotate` steps with `axis: 'roll'`. Leaves `orientation` as `null` for yaw/pitch.
    *   (Orbit logic generates multiple intermediate steps, pending curve refactor).
*   **TrackballControls (Client):** (`@react-three/drei`)
    *   Replaces `OrbitControls`.
    *   Used for **user interaction phase** (setting initial view before locking).
    *   Allows free rotation/tumbling.
    *   Set to `enabled={false}` during animation playback.
    *   Crucially, does not conflict with or override manual orientation changes applied by `AnimationController` when disabled, and accepts final rolled states.
*   **Animation Controller (Client):** (Refined)
    *   Receives `CameraCommand[]` (with `Vector3` and `Quaternion` objects correctly deserialized).
    *   Runs within `useFrame` loop during playback (`isPlaying=true`).
    *   **Checks `command.orientation`:**
        *   If present (Roll): Interpolates using `Quaternion.slerp` and updates `camera.quaternion`.
        *   If absent (Pan/Tilt/Orbit/Dolly/Zoom etc.): Interpolates `target`, resets `camera.up` to `(0,1,0)`, and uses `camera.lookAt()`.
    *   Interpolates `position` (currently linear, curve planned for orbit).
    *   Applies easing.

## 💾 Data Persistence (`models` Table Columns)

The pipeline relies on data stored (typically via `MetadataManager`) likely in a `models` table:

1.  **`metadata` (jsonb):** Core model info, user preferences, basic geometry derived from initial analysis.
2.  **`scene_analysis` (jsonb):** Stores the detailed, static analysis results from `SceneAnalyzer` (intrinsic geometry, features, model-based constraints). *Crucial input for Scene Interpreter*.
3.  **`environmental_metadata` (jsonb):** Stores the dynamic context captured when the user locks the scene (`EnvironmentalAnalyzer` output: camera state, derived constraints). *Crucial input for Scene Interpreter*.

*(Note: Other columns like `id`, `name`, `user_id` etc. also exist).*

## 📝 Notes

-   Architecture updated to use `<TrackballControls>` for user setup, resolving the orientation override conflict with `<OrbitControls>`/`<CameraControls>` that prevented visual roll.
-   Visual roll is now implemented using direct quaternion SLERP in `AnimationController` when `CameraCommand.orientation` is provided by the `SceneInterpreter`.
-   Pan/Tilt/Orbit use `camera.lookAt()` for orientation to maintain expected level movement (after resetting `camera.up`).
-   **Known Issue:** Orbit animations currently exhibit jitter due to linear interpolation between keyframes. Planned fix is to use curve interpolation (`CatmullRomCurve3`) in `AnimationController` based on fewer keypoints from the interpreter.
-   User interaction during setup uses `<TrackballControls>`, which has a different feel (free tumble) than `<OrbitControls>`. UX may need refinement.