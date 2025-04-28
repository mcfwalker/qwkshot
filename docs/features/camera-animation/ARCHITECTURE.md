# 📽️ Prompt-to-Path Pipeline Overview (v3 - Assistants API Refactor)

**Status:** Reflects the architecture after completing the core Phase 3 refinements and initial Phase 4 E2E testing/bug fixing.

## High-Level Explanation

Our Prompt-to-Path (P2P) pipeline translates a user's natural language request (e.g., "Orbit the model slowly") into a smooth, executable camera animation within the 3D viewer.

The process leverages the OpenAI Assistants API for high-level planning and a local "Scene Interpreter" for precise geometric execution:

1.  The user provides a **text prompt**.
2.  The backend interacts with a configured **OpenAI Assistant** (via our `OpenAIAssistantAdapter`).
3.  The Assistant consults its **Motion Knowledge Base (KB)** (a file defining available camera moves like "zoom", "orbit", "pan", and their parameters) using OpenAI's Retrieval tool.
4.  The Assistant generates a structured **`MotionPlan`** (a JSON object detailing a sequence of steps, like `[{ type: "orbit", direction: "left", angle: 90, duration_ratio: 1.0 }]`).
    *   For "move to destination" requests (e.g., 'pedestal to the top'), the Assistant includes a `destination_target` parameter (e.g., `object_top_center`) instead of a `distance` parameter.
    *   For "move to proximity" requests (e.g., 'dolly in close'), the Assistant includes a `target_distance_descriptor` parameter.
5.  This `MotionPlan` is passed to the **Scene Interpreter** on our backend.
6.  Crucially, the Scene Interpreter *also* receives detailed **local context** about the 3D model (**SceneAnalysis**) and its environment (**EnvironmentalAnalysis**), fetched via the **Metadata Manager**. The EnvironmentalAnalysis context provided to the interpreter includes the userVerticalAdjustment.
7.  The Scene Interpreter processes each step in the `MotionPlan`:
    *   It uses the `type` (e.g., "orbit") to select the correct internal logic.
    *   It uses the step's `parameters` (e.g., direction, angle) combined with the local scene/environmental context to calculate precise camera movements.
    *   It resolves targets (e.g., 'object_center', feature names). **Crucially, it resolves spatial references like 'object_top_center' using the *normalized coordinates* from `SceneAnalysis` and applies the `userVerticalAdjustment` (from `EnvironmentalAnalysis`)** to the Y-component, ensuring alignment with the model's visually adjusted position. It also handles `'current_target'` for applicable motions.
    *   **It handles quantitative, qualitative, and goal-based magnitude parameters** with a specific priority order for each motion type, utilizing helper functions like `_mapDescriptorToValue` and `_mapDescriptorToGoalDistance` to convert canonical descriptors (`tiny`...`huge`) into context-aware numeric values.
        *   For example, in `dolly`, it prioritizes `target_distance_descriptor` (calculating required distance), then `destination_target` (calculating distance), then `distance_override` (direct numeric input), then `distance_descriptor` (mapped qualitative input).
        *   For `zoom`, it prioritizes `factor_override`, then `factor_descriptor`, then `target_distance_descriptor` (calculating required factor).
    *   It enforces constraints (like not colliding with the model bounding box or exceeding maximum camera distance/height) during calculation, using dynamic offsets for collision avoidance.
    *   It determines appropriate easing based on parameters (`speed`, `easing`), potentially overriding easing based on the speed hint.
8.  The Interpreter outputs a list of **`CameraCommand[]`** objects, typically representing **keyframes** (often a start and end state for each logical motion step, or multiple intermediate steps for smoother rotations like orbits).
9.  These commands are sent to the frontend client.
10. A dedicated **AnimationController** component within the React Three Fiber render loop reads these commands and smoothly interpolates the Three.js camera between keyframes, producing the final animation.

This architecture separates the AI's natural language understanding and planning from the deterministic, context-aware geometric execution, improving reliability and control.

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
    API -- "11. interpretPath(MotionPlan, SceneAnalysis, EnvAnalysis, InitialCameraState)" --> Interpreter
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
*   **Scene Interpreter:** (`src/features/p2p/scene-interpreter/`) **(Major Refactor/Rewrite & Refinement)**
    *   Receives the `MotionPlan` object AND local context (`SceneAnalysis`, `EnvironmentalAnalysis`, `initialCameraState`) from the API route.
    *   **Does NOT call any LLM.**
    *   Loops through `MotionPlan.steps`.
    *   For each step:
        *   Selects the appropriate internal generator logic based on `step.type`.
        *   Uses `step.parameters` and local context to calculate precise camera movements.
        *   Resolves targets: Handles `'current_target'`. Resolves geometric landmarks (e.g., 'object_center', 'object_top_center') **using the normalized coordinates from `SceneAnalysis` and applying the `userVerticalAdjustment` from the provided `EnvironmentalAnalysis` to the Y coordinate**, ensuring alignment with the normalized visual model.
        *   **Handles quantitative/qualitative/goal parameters (with priority):**
            *   Uses helper functions like `_normalizeDescriptor`, `_mapDescriptorToValue`, and `_mapDescriptorToGoalDistance` for calculations.
            *   **`dolly/truck/pedestal` Priority:**
                1.  `destination_target` (Calculates required distance/direction)
                2.  `distance_override` (Uses direct number)
                3.  `distance_descriptor` (Maps descriptor to distance via `_mapDescriptorToValue`)
                4.  `target_distance_descriptor` (For `dolly` only; maps descriptor to goal distance via `_mapDescriptorToGoalDistance`, then calculates required distance/direction)
            *   **`zoom` Priority:**
                1.  `factor_override` (Uses direct number)
                2.  `factor_descriptor` (Maps descriptor to factor via `_mapDescriptorToValue`)
                3.  `target_distance_descriptor` (Maps descriptor to goal distance via `_mapDescriptorToGoalDistance`, then calculates required factor)
            *   **`fly_by` Priority (Placeholder):**
                1.  `pass_distance_override`
                2.  `pass_distance_descriptor` (Defaults 'medium', maps via `_mapDescriptorToValue`)
            *   **`fly_away` Priority (Placeholder):**
                1.  `distance_override`
                2.  `distance_descriptor` (Maps via `_mapDescriptorToValue`)
        *   Applies constraints (height, distance, bounding box via raycasting with **dynamic offset**) during calculation.
        *   Determines appropriate **effective easing function** (using `d3-ease`) based on speed/easing parameters, potentially overriding explicit easing.
        *   Handles duration allocation.
    *   Outputs an array of `CameraCommand` objects representing **keyframes** (often start/end pairs per step, or multiple intermediate steps for rotations like `orbit`) defining the path.
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

-   This v3 architecture prioritizes separating AI planning from deterministic execution.
-   Context is used *locally* by the Scene Interpreter, not sent to the LLM.
-   The `MotionPlan` schema is the key interface between the LLM Engine and Scene Interpreter.
-   The `CameraCommand` schema is the key interface between the Scene Interpreter and the client-side Animation Controller, with the array now representing a sequence of keyframes defining the path segments.
-   `d3-ease` is used for standardized easing functions.