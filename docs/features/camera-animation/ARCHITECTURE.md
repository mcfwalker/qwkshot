# 📽️ Prompt-to-Path Pipeline Overview (v3 - Assistants API Refactor)

**Status:** Reflects the architecture after the Scene Interpreter Refactor (May 2025).

## High-Level Explanation

Our Prompt-to-Path (P2P) pipeline translates a user's natural language request (e.g., "Orbit the model slowly") into a smooth, executable camera animation within the 3D viewer.

The process leverages the OpenAI Assistants API for high-level planning and a local "Scene Interpreter" for precise geometric execution:

1.  The user provides a **text prompt**.
2.  The backend interacts with a configured **OpenAI Assistant** (via our `OpenAIAssistantAdapter`).
3.  The Assistant consults its **Motion Knowledge Base (KB)** (a file defining available camera moves like "zoom", "orbit", "pan", and their parameters) using OpenAI's Retrieval tool.
4.  The Assistant generates a structured **`MotionPlan`** (a JSON object detailing a sequence of steps).
5.  This `MotionPlan` is passed to the **Scene Interpreter** on our backend.
6.  Crucially, the Scene Interpreter *also* receives detailed **local context** about the 3D model (**SceneAnalysis**) and its environment (**EnvironmentalAnalysis**), fetched via the **Metadata Manager**.
7.  The Scene Interpreter (`SceneInterpreterImpl`) processes each step in the `MotionPlan`:
    *   It uses the `type` (e.g., "orbit") in a `switch` statement to **dispatch** the step to the appropriate **external handler function** located in `src/features/p2p/scene-interpreter/primitive-handlers/` (e.g., `handleOrbitStep`).
    *   Each handler function receives the step details, current camera state (position, target), step duration, and the full scene/environmental context.
    *   **Inside the handler:**
        *   The handler performs all necessary calculations, using shared helper functions imported from `src/features/p2p/scene-interpreter/interpreter-utils.ts` (e.g., `resolveTargetPosition`, `mapDescriptorToValue`, `clampPositionWithRaycast`).
        *   It resolves targets (e.g., 'object_center', feature names), including applying `userVerticalAdjustment`.
        *   It handles quantitative, qualitative, and goal-based magnitude parameters with specific priority orders.
        *   It enforces constraints (e.g., height, distance, bounding box).
        *   It determines appropriate easing.
    *   The handler returns an object containing the calculated `CameraCommand[]` for that step and the resulting `nextPosition` and `nextTarget` camera state at the end of the step.
8.  The `SceneInterpreterImpl.interpretPath` method receives the result from the handler. It appends the returned commands to the main list and **updates its internal `currentPosition` and `currentTarget`** based on the `nextPosition` and `nextTarget` returned by the handler, preparing for the next step in the loop.
9.  After processing all steps, the interpreter returns the complete list of **`CameraCommand[]`** objects (keyframes) to the API route.
10. These commands are sent to the frontend client.
11. A dedicated **AnimationController** component within the React Three Fiber render loop reads these commands and smoothly interpolates the Three.js camera between keyframes.

This architecture separates AI planning (Assistant) from deterministic execution (Interpreter + Handlers), with the Interpreter now acting as a lean orchestrator.

## 🔄 Pipeline Data Flow (v3)

```mermaid
graph TD
    subgraph "User Interface (Client)"
        UI[React UI]
        AnimController[AnimationController <br> (R3F useFrame)]
        ThreeJS[Three.js Camera]
    end

    subgraph "Backend (Next.js API Route)"
        API["/api/camera-path"]
        subgraph "LLM Engine"
            OAIAdapter[OpenAIAssistantAdapter]
        end
        subgraph "Scene Interpreter"
            Interpreter[SceneInterpreterImpl <br> (interpretPath)]
        end
        MetadataMgr[Metadata Manager <br> (DB Access)]
    end

    subgraph "External Services"
        OpenAI[OpenAI Assistants API <br> (GPT-4 + Retrieval) <br> **Note:** Instructions & KB <br> configured externally]
        MotionKB[(Motion KB File)] -- Uploaded To --> OpenAI
    end

    %% Data Flow
    UI -- "1. User Prompt, Duration, ModelID" --> API
    API -- "2. Fetch Context (ModelID)" --> MetadataMgr
    MetadataMgr -- "3. SceneAnalysis, EnvAnalysis, InitialCameraState" --> API
    API -- "4. Instantiate Adapter" --> OAIAdapter
    API -- "5. generatePlan(Prompt, Duration)" --> OAIAdapter
    OAIAdapter -- "6. Create Thread/Run (Prompt, AssistantID)" --> OpenAI
    OpenAI -- "7. Use KB via Retrieval" --> MotionKB
    OpenAI -- "8. MotionPlan (JSON)" --> OAIAdapter
    OAIAdapter -- "9. Parsed MotionPlan Object" --> API
    API -- "10. Instantiate Interpreter" --> Interpreter
    API -- "11. interpretPath(...) -> Calls appropriate handle<Primitive>Step(...) handler" --> Interpreter
    Interpreter -- "12. CameraCommand[]" --> API
    API -- "13. Response: Serialized CameraCommand[]" --> UI
    UI -- "14. Update State (isPlaying=true, commands - deserialize vectors)" --> AnimController
    AnimController -- "15. Interpolates & Updates Camera Ref (using d3-ease/keyframes)" --> ThreeJS
    ThreeJS -- "16. Renders Updated View" --> UI

    %% Styling (Optional)
    classDef external fill:#f9f,stroke:#333,stroke-width:2px;
    class OpenAI,MotionKB external;
    classDef client fill:#ccf,stroke:#333;
    class UI,AnimController,ThreeJS client;
    classDef api fill:#cfc,stroke:#333;
    class API,OAIAdapter,Interpreter,MetadataMgr api;

```

## 🎯 Core Components (v3 Roles)

*   **Scene Analyzer:** (`src/features/p2p/scene-analyzer/`) **(Retained)**
    *   Analyzes the 3D model geometry upon upload/processing.
    *   Generates detailed `SceneAnalysis` data (bounding box, center, features, etc.).
    *   Output is stored via Metadata Manager. Crucial *input* for the Scene Interpreter.
*   **Environmental Analyzer:** (`src/features/p2p/environmental-analyzer/`) **(Retained)**
    *   Analyzes the relationship between the camera and the scene *when the user locks the view*.
    *   Generates `EnvironmentalAnalysis` data (distances, relative positions, camera constraints based on locked view).
    *   Output is stored via Metadata Manager. Crucial *input* for the Scene Interpreter.
*   **Metadata Manager:** (`src/features/p2p/metadata-manager/`) **(Retained)**
    *   Stores and retrieves `SceneAnalysis` and `EnvironmentalAnalysis` data associated with a model ID (likely in a database like Supabase).
    *   Provides this essential *local context* to the API route, which then passes it to the Scene Interpreter.
*   **Prompt Compiler:** (`src/features/p2p/prompt-compiler/`) **(Deprecated)**
    *   Previously bundled scene context with the user prompt *for the LLM*.
    *   No longer needed as context is now used locally by the Scene Interpreter, and the Assistant only receives the raw user prompt.
*   **LLM Engine (Adapter):** (`src/lib/motion-planning/`) **(Refactored)**
    *   Implements the `MotionPlannerService` interface.
    *   Contains specific adapters, currently `OpenAIAssistantAdapter`.
    *   Handles interaction with the chosen AI service (OpenAI Assistants API):
        *   Manages threads, messages, and runs.
        *   Ensures the correct Assistant ID and Motion KB (via Retrieval) are used.
        *   Sends the user prompt.
        *   Receives and parses the structured `MotionPlan` JSON.
        *   Returns the validated `MotionPlan` object.
*   **Scene Interpreter:** (`src/features/p2p/scene-interpreter/`) **(REFACTORED - May 2025)**
    *   **`interpreter.ts` (`SceneInterpreterImpl`):**
        *   Receives the `MotionPlan` object AND local context (`SceneAnalysis`, `EnvironmentalAnalysis`, `initialCameraState`) from the API route.
        *   **Does NOT call any LLM.**
        *   The `interpretPath` method loops through `MotionPlan.steps`.
        *   For each step, it performs target blending logic (if needed) and then **dispatches** to the appropriate handler function (e.g., `handleDollyStep`) located in `primitive-handlers/` based on `step.type`.
        *   Receives `{ commands, nextPosition, nextTarget }` from the handler.
        *   Appends `commands` to the main list.
        *   **Updates its internal `currentPosition` and `currentTarget`** based on the returned `nextPosition` and `nextTarget` to prepare for the next step.
        *   After the loop, performs final checks (e.g., velocity) and returns the complete `CameraCommand[]`.
    *   **`primitive-handlers/*.ts` (New Directory):**
        *   Contains one handler function per primitive type (e.g., `handleDollyStep.ts`).
        *   Each handler receives the step, current state, duration, context, and logger.
        *   **Handler Responsibilities:** Contains the specific logic for calculating the primitive's motion:
            *   Uses shared utility functions from `interpreter-utils.ts`.
            *   Resolves targets (including applying `userVerticalAdjustment`).
            *   Handles quantitative/qualitative/goal parameters.
            *   Applies constraints (height, distance, bounding box).
            *   Determines easing.
            *   Generates the `CameraCommand[]` for that *single* step (often start/end keyframes, or multiple for rotations).
            *   Returns `{ commands, nextPosition, nextTarget }` reflecting the state *after* the step.
    *   **`interpreter-utils.ts` (New File):**
        *   Contains shared helper functions (e.g., `resolveTargetPosition`, `clampPositionWithRaycast`, `mapDescriptorToValue`, `mapDescriptorToGoalDistance`, `normalizeDescriptor`) previously private to `SceneInterpreterImpl`.
        *   Functions accept context (sceneAnalysis, envAnalysis, logger, etc.) as arguments.
*   **Animation Controller (Client):** (`src/components/viewer/AnimationController.tsx`) **(Largely Unchanged Conceptually)**
    *   Receives the `CameraCommand[]` from the API response (via UI state).
    *   Runs within the React Three Fiber `useFrame` loop.
    *   Interpolates the camera's `position` and `target` between command keyframes over the specified `duration` for each segment.
    *   Looks up and applies the specified `easing` function (using `d3-ease`) during interpolation.
    *   Updates the Three.js camera object directly.

## 💾 Data Persistence (`models` Table Columns)

The pipeline relies on data stored (typically via `MetadataManager`) likely in a `models` table:

1.  **`metadata` (jsonb):** Core model info, user preferences, basic geometry derived from initial analysis.
2.  **`scene_analysis` (jsonb):** Stores the detailed, static analysis results from `SceneAnalyzer` (intrinsic geometry, features, model-based constraints). *Crucial input for Scene Interpreter*.
3.  **`environmental_metadata` (jsonb):** Stores the dynamic context captured when the user locks the scene (`EnvironmentalAnalyzer` output: camera state, derived constraints). *Crucial input for Scene Interpreter*.

*(Note: Other columns like `id`, `name`, `user_id` etc. also exist).*

## 📝 Notes

-   This v3 architecture (with the May 2025 interpreter refactor) prioritizes separating AI planning from deterministic execution.
-   Context is used *locally* by the Scene Interpreter's handlers, not sent to the LLM.
-   The `MotionPlan` schema is the key interface between the LLM Engine and Scene Interpreter.
-   The handler function signature and return type (`{ commands, nextPosition, nextTarget }`) are the key interface between the Scene Interpreter dispatcher and the individual primitive handlers.
-   The `CameraCommand` schema is the key interface between the Scene Interpreter and the client-side Animation Controller.
-   `d3-ease` is used for standardized easing functions.