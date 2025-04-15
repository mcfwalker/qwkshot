# Assistants API Pipeline Refactor Plan

## 1. Goals & Non-Goals

### Goals
- Integrate OpenAI Assistants API for motion planning.
- Delegate motion segmentation and high-level parameterization to the Assistant using a Knowledge Base (KB).
- Shift deterministic geometric path generation and constraint enforcement to the `Scene Interpreter`.
- Improve reliability and consistency of camera path generation, especially regarding constraints.
- Reduce prompt token complexity and cost.
- Enhance modularity and maintainability of the pipeline components.

### Non-Goals (Initial Refactor)
- Implementing *all* conceivable motion types immediately (start with core set).
- Major UI changes beyond adapting to the new pipeline's output/errors.
- Optimizing Assistant latency beyond basic implementation.

## 1.5 Target Example Scenario

To guide the design and evaluate success, we aim to reliably translate complex natural language prompts into smooth, cinematic camera movements. A benchmark example is:

**"Push in rapidly as if attached to an attacking fighter jet, race past the edge of the model, then fly away while looking back at the object."**

This example requires:
- Understanding multiple sequential actions.
- Interpreting qualitative descriptions ("rapidly", "fighter jet feel", "race past").
- Handling specific geometric references ("edge of the model").
- Maintaining target focus during movement ("looking back at the object").
- Implicitly respecting constraints (like not crashing into the model).

The proposed architecture aims to achieve this by having the Assistant generate a high-level plan based on its KB, and the Scene Interpreter execute the detailed geometric maneuvers reliably.

## 2. High-Level Architecture

```
[ React UI ]
    ↓ (user prompt)
[ LLM Engine (middleware) ]
    - Manages Assistant interaction (threads, runs)
    - Sends user prompt to Assistant
    - Receives structured motion plan (JSON)
    ↓ (structured motion plan)
[ Scene Interpreter (frontend/shared lib) ]
    - Receives motion plan
    - Accesses LOCAL Scene/Environmental Analysis data (from Metadata Manager)
    - Uses geometry & analysis data to generate deterministic keyframes/commands
    - Handles interpolation, easing, constraints during generation
    ↓ (executable commands/keyframes)
[ Camera Animation System (Three.js) ]
    - Executes commands/plays animation
```

## 3. Component Roles in New Architecture

*   **React UI:** Largely unchanged, provides user prompt, triggers generation, displays results/errors. Needs adaptation for potential new error modes or plan previews.
*   **Metadata Manager:** **Retained.** Crucial role continues. Fetches model metadata, including stored `SceneAnalysis` data and `EnvironmentalMetadata` (constraints, initial camera state if applicable). Makes this data available *locally* for the Scene Interpreter.
*   **Scene Analyzer:** **Retained.** The analysis it performs and stores (via `Metadata Manager`) provides the essential geometric understanding (bounding box, center, features, etc.) that the *Scene Interpreter* needs to execute motion plans correctly.
*   **Environmental Analyzer:** **Retained.** Continues to analyze the relationship between the camera and the scene *locally*. Its output (`EnvironmentalAnalysis` - distances, relative positions, constraint violations) is critical context for the *Scene Interpreter* during path generation (e.g., calculating zoom distances, orbit radii, checking constraints).
*   **Prompt Compiler:** **Likely Deprecated/Simplified.** Its main role was to bundle complex context *for the LLM*. In the new model, the LLM (Assistant/Agent) receives only the user prompt. The context is used locally by the Interpreter. May retain a minimal role for structuring the *initial* request to the LLM Engine if needed, but not for context injection.
*   **LLM Engine:** **Refactored.** Becomes an adapter layer implementing a standardized internal `MotionPlannerService` interface. Specific implementations (e.g., `VertexAIAdapter`, `OpenAIAssistantAdapter`) will contain the provider-specific logic (API calls, KB interaction, response parsing). Manages interaction with the chosen underlying AI service (Vertex AI or OpenAI Assistants). Sends simple prompts, receives structured JSON plan, and returns it via the standard interface. No longer deals with complex context injection itself.
*   **Scene Interpreter:** **Major Refactor/Rewrite.** Becomes the core geometric engine. No longer calls LLM. Takes a *structured plan* (via the standard `MotionPlan` schema) and *local context* (Scene/Environmental Analysis) and generates executable paths deterministically. Implements motion primitives (zoom, orbit, etc.). Enforces constraints.
*   **Camera Animation System:** Largely unchanged. Consumes the output from the `Scene Interpreter` (likely still `CameraCommand[]` or similar) and drives the Three.js camera.

## 4. API Contracts / Schemas

### Motion Knowledge Base (`motion_kb.json` - FINALIZED STRUCTURE)

*This file will be uploaded to the OpenAI Assistant via the File API. It defines the vocabulary of motions the Assistant can plan.* 
*The Assistant uses the `description`, `parameters` definitions, and `examples` to map user prompts to motion types and parameters.*
*(Note: Reference external datasets like MultiCamVideo for diverse motion type definitions and parameters during KB population.)*

```json
[
  {
    "name": "static",
    "description": "Holds the camera at its current position and target for a specified duration.",
    "parameters": [
      {
        "name": "duration",
        "type": "number",
        "description": "Time in seconds to hold the position (Note: Assistant should use duration_ratio in plan, Interpreter calculates this).",
        "required": false
      }
    ],
    "examples": [
      "Hold position for 2 seconds",
      "Pause briefly"
    ]
  },
  {
    "name": "zoom",
    "description": "Moves the camera closer to (zoom in) or further from (zoom out) a target point along the camera's line of sight.",
    "parameters": [
      {
        "name": "direction",
        "type": "string",
        "enum": ["in", "out"],
        "description": "Whether to zoom 'in' or 'out'.",
        "required": true
      },
      {
        "name": "factor",
        "type": "number",
        "description": "Relative amount to zoom (e.g., 0.5 for halfway towards target, 2.0 for doubling distance). Interpreter defines precise calculation.",
        "required": true
      },
      {
        "name": "target",
        "type": "string",
        "description": "Reference point for zooming (e.g., 'object_center', 'current_target'). Default: 'current_target'. Interpreter resolves.",
        "required": false,
        "default": "current_target"
      },
      {
        "name": "speed",
        "type": "string",
        "enum": ["slow", "medium", "fast", "very_fast"],
        "description": "Qualitative speed hint for easing selection.",
        "required": false,
        "default": "medium"
      },
      {
        "name": "easing",
        "type": "string",
        "enum": ["linear", "easeIn", "easeOut", "easeInOut"],
        "description": "Easing function type hint.",
        "required": false,
        "default": "easeInOut"
      }
    ],
    "examples": [
      "Zoom in close",
      "Slowly zoom out halfway",
      "Push in fast towards the object center"
    ]
  },
  {
    "name": "orbit",
    "description": "Rotates the camera around a central axis while keeping the target point in view.",
    "parameters": [
      {
        "name": "direction",
        "type": "string",
        "enum": ["clockwise", "counter-clockwise"],
        "description": "Direction of rotation.",
        "required": true
      },
      {
        "name": "angle",
        "type": "number",
        "description": "Total angle in degrees to rotate.",
        "required": true
      },
      {
        "name": "axis",
        "type": "string",
        "enum": ["x", "y", "z", "custom"],
        "description": "Axis of rotation relative to the scene or target. Default: 'y'.",
        "required": false,
        "default": "y"
      },
      {
        "name": "target",
        "type": "string",
        "description": "Reference point to orbit around (e.g., 'object_center'). Default: 'object_center'. Interpreter resolves.",
        "required": false,
        "default": "object_center"
      },
      {
        "name": "speed",
        "type": "string",
        "enum": ["slow", "medium", "fast"],
        "description": "Qualitative speed hint.",
        "required": false,
        "default": "medium"
      },
      {
        "name": "easing",
        "type": "string",
        "enum": ["linear", "easeIn", "easeOut", "easeInOut"],
        "description": "Easing function type hint.",
        "required": false,
        "default": "easeInOut"
      }
    ],
    "examples": [
      "Orbit 90 degrees clockwise",
      "Slowly circle the object completely",
      "Pan around the model" 
    ]
  }
  // TODO: Define other core motion types: pan, tilt, dolly, truck, pedestal, fly_by, fly-away, follow_path?
]
```

### Structured Motion Plan (Assistant Output / Interpreter Input - FINALIZED)

*This defines the JSON object the Assistant is expected to return, which serves as the input for the Scene Interpreter.*

```typescript
// Overall Plan Structure
interface MotionPlan {
  /**
   * An ordered list of motion steps. The Scene Interpreter will
   * execute these steps one after the other.
   */
  steps: MotionStep[];

  /**
   * Optional: Extra information about the overall plan.
   */
  metadata?: {
    /**
     * The total duration (in seconds) the user originally requested.
     * Helps the Scene Interpreter scale the duration_ratios correctly.
     */
    requested_duration: number;
    // Add other metadata as needed (e.g., original prompt for debugging)
  };
}

// Structure for a Single Step in the Plan
interface MotionStep {
  /**
   * Identifies the type of camera motion for this step.
   * This MUST match a 'name' defined in our Motion Knowledge Base (KB).
   * Examples: "zoom", "orbit", "pan", "static", "fly_by"
   */
  type: string;

  /**
   * Contains the specific settings for this motion step.
   * The keys and expected value types inside this object will depend
   * on the 'type' of motion and should be defined in the Motion KB.
   * Examples:
   *   For "zoom": { "target": "object_center", "factor": 0.5, "speed": "fast" }
   *   For "orbit": { "direction": "clockwise", "axis": "y", "angle": 90, "speed": "medium" }
   *   For "static": {} (might have no parameters, just holds position)
   */
  parameters: {
    [key: string]: string | number | boolean; // Allows string, number, or boolean values
  };

  /**
   * Specifies what proportion of the total animation duration
   * this step should take (value between 0.0 and 1.0).
   * The Scene Interpreter will calculate the actual duration for this step
   * based on this ratio and the total requested_duration from the metadata.
   * All ratios in the plan should ideally sum to 1.0.
   */
  duration_ratio: number;
}
```

## 5. Phased Rollout Plan

### Phase 0: Planning & Design
*   [X] Finalize Motion Plan JSON schema. *(Completed)*
*   [X] Finalize Motion KB JSON structure & create initial content for core motions. *(Completed)*
*   [X] Design `MotionPlannerService` Interface: Define the standard internal interface for generating motion plans. *(Completed)*
*   [X] **Research & Provider Choice:** Initial research compared OpenAI Assistants API and Google Vertex AI. **Decision: Target OpenAI Assistants API for the *first* adapter implementation, prioritizing simplicity for the POC.** *(Vertex AI remains a future option.)*.
*   [X] **Initial Provider Setup (OpenAI):** Perform basic setup for OpenAI Assistants (e.g., Create Assistant, upload initial KB file, get Assistant ID/API Keys). *(Completed)*
*   [X] Create dedicated feature branch (`feature/assistants-pipeline-refactor`). *(Completed)*
*   [X] *Goal:* Detailed plan, defined schemas & interface, **initial provider chosen (OpenAI)**, basic provider setup. *(Phase 0 COMPLETE)*

### Phase 1: LLM Engine Refactor (Adapter Implementation)
*   [X] **Evaluate Vercel AI SDK:** Investigate if the Vercel AI SDK Core library effectively simplifies the OpenAI Assistants API workflow (threads, runs, retrieval) compared to the standard `openai` Node.js library. Decide whether to use it for the adapter. *(Decision: Use `openai` library directly for Assistants API)*.
*   [X] Implement the **`OpenAIAssistantAdapter`** adhering to the `MotionPlannerService` interface. *(Implemented in `src/lib/motion-planning/providers/openai-assistant.ts`)*.
*   [X] Include logic for sending the prompt to the OpenAI Assistant service (using threads, runs) and ensuring the KB file is utilized via the Retrieval tool. *(Core API flow implemented)*.
*   [X] Implement parsing and validation of the Assistant's response to ensure it conforms to the standard `MotionPlan` JSON schema (robust prompting needed). *(Basic parsing/validation implemented)*.
*   [X] Set up basic error handling for OpenAI API calls and response processing. *(Implemented basic try/catch and error reporting)*.
*   [X] (Mocking) Temporarily log the received `MotionPlan` object instead of sending to Interpreter. *(API Route `src/app/api/camera-path/route.ts` updated to return raw MotionPlan)*.
*   [X] *Goal:* A functioning **`OpenAIAssistantAdapter`** for the chosen provider that implements the internal interface and returns a valid `MotionPlan` object. *(Phase 1 COMPLETE as of 2025-04-14)*

### Phase 2: Scene Interpreter Core & Basic Execution
*   [X] Refactor `Scene Interpreter` interface/class structure (`interpretPath` signature updated). *(Completed)*
*   [X] Implement mechanism to accept Motion Plan object (from adapter). *(Completed)*
*   [X] Implement mechanism to access local Scene/Environmental analysis data (passed as parameters to `interpretPath`). *(Completed)*
*   [X] Implement core loop to process plan steps sequentially. *(Completed)*
*   [X] Implement 2 simple motion generators (`static`, `zoom`). *(Completed)*
*   [X] Connect output to `CameraAnimationSystem` (Interpreter returns `CameraCommand[]`, API route updated). *(Completed)*
*   [X] *Goal:* Basic E2E backend flow working: Prompt -> Assistant Plan -> Interpreter -> API returns `CameraCommand[]`. *(Phase 2 COMPLETE as of Session End)*

### Phase 3: Scene Interpreter Motion Library Expansion
*   [/] Implement generators for core motion types. *(In Progress)*
    *   [X] `static` (from Phase 2)
    *   [X] `zoom` (from Phase 2)
    *   [X] `orbit` (updated)
    *   [X] `pan`
    *   [X] `tilt`
    *   [X] `dolly`
    *   [X] `truck`
    *   [X] `pedestal`
    *   [ ] `fly_by`
    *   [ ] `fly_away`
    *   [ ] `set_view`
    *   [ ] `focus_on`
    *   [ ] `arc`
    *   [ ] `reveal`
*   [/] Implement parameter handling within generators (speed, target resolution, direction aliases, hints). *(Partially started within generators)*
*   [/] Implement various easing function applications. *(Basic structure exists, needs integration)*
*   [/] Integrate robust constraint checking (bounding box, min/max distance/height) *within* generators. *(Basic clamping implemented)*
*   [ ] Refine duration allocation logic across steps.
*   [ ] *Goal:* Interpreter can execute diverse motion plans reliably and respects constraints.
*   *(Note: Reference external projects like ReCamMaster/MultiCamVideo for trajectory generation techniques and CameraCtrl for potential visualization tools during implementation.)*

### Phase 4: Integration, Testing & Refinement
*   [ ] Conduct thorough E2E testing with diverse and complex prompts.
*   [ ] Profile and address performance issues (Interpreter or Assistant interaction).
*   [ ] Refine Assistant instructions and Motion KB based on test results.
*   [ ] Implement robust error handling across the pipeline (UI, Engine, Interpreter).
*   [ ] Update project documentation.
*   [ ] Prepare for merge to `stable`/`main`.
*   [ ] *Goal:* Feature-complete, stable, documented, and ready for production use.

## 6. Testing Strategy
*   **Phase 1:** Unit tests for Assistants API client logic. Manual testing of prompt->plan retrieval.
*   **Phase 2:** Unit tests for Interpreter core logic, basic motion generators. Integration test for basic E2E flow.
*   **Phase 3:** Unit tests for each motion generator, including parameter variations and constraint checks. Integration tests combining multiple motion steps.
*   **Phase 4:** Comprehensive E2E testing with a suite of test prompts. Performance testing.

## 7. Open Questions & Risks
*   Assistants API costs (per-thread, retrieval, storage)?
*   Assistants API latency vs direct completion?
*   Robustness of Assistant correctly mapping prompts to KB and generating valid JSON?
*   Complexity of implementing sophisticated motion generators in `Scene Interpreter`.
*   Effort required to create and maintain a high-quality Motion KB.

## 8. Proposed Architecture Diagram (Mermaid)

```mermaid
graph TD
    subgraph "User Interface"
        UI[React UI]
    end

    subgraph "Backend / Middleware"
        subgraph "LLM Engine (Adapter Layer)"
            direction LR
            MotionPlanner[MotionPlannerService Interface]
            VertexAdapter[VertexAIAdapter implements MotionPlanner]
            OpenAIAdapter[(OpenAI Adapter)] -- Optional --> MotionPlanner
            MotionPlanner --> VertexAdapter
        end
        MetadataMgr[Metadata Manager]
        SceneAnalyzer[Scene Analyzer Data]
        EnvAnalyzer[Environmental Analyzer Data]
    end

    subgraph "External AI Service (Google Cloud)"
        VertexAI[Vertex AI Agent/Gemini+Search]
        MotionKB[Motion KB @ GCS Data Store]
    end

    subgraph "Frontend Rendering"
        SceneInterpreter[Scene Interpreter]
        AnimationSystem[Camera Animation System (Three.js)]
    end

    %% Data Flows
    UI -- "User Prompt, Duration" --> MotionPlanner
    VertexAdapter -- "Prompt, KB Config" --> VertexAI
    VertexAI -- "Retrieves from" --> MotionKB
    VertexAI -- "Structured Motion Plan (JSON)" --> VertexAdapter
    MotionPlanner -- "Structured Motion Plan (JSON)" --> SceneInterpreter
    MetadataMgr -- "Fetches" --> SceneAnalyzer
    MetadataMgr -- "Fetches" --> EnvAnalyzer
    MetadataMgr -- "SceneAnalysis, EnvMetadata (Local Context)" --> SceneInterpreter
    SceneInterpreter -- "Executable Commands/Keyframes" --> AnimationSystem
    AnimationSystem -- "Updates Camera" --> UI

    %% Style (Optional)
    classDef external fill:#f9f,stroke:#333,stroke-width:2px;
    class VertexAI,MotionKB external;
    classDef adapter fill:#lightgrey,stroke:#333;
    class LLM Engine (Adapter Layer) adapter
``` 