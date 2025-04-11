# 📽️ Prompt-to-Path Pipeline Overview (v2)

This document outlines the re-imagined architecture of the LLM-driven camera control system, reflecting the current implementation and planned improvements. This version incorporates learnings from our initial implementation and investigation findings.

## High-Level Explanation
"Our Prompt-to-Path pipeline takes a user's natural language request, analyzes the 3D scene and environment context, and compiles a detailed prompt for an LLM. The LLM generates a sequence of camera keyframes. This sequence is then processed on our backend by a 'Scene Interpreter' which validates the path, applies cinematic smoothing, and translates it into a precise list of frame-by-frame camera commands. These commands are sent to the client, where a dedicated controller running within the React Three Fiber render loop executes them, ensuring smooth, synchronized camera animation in the 3D viewer."

## 🔄 Pipeline Data Flow

### Current Working Flow
```
1. Model Upload:
User Upload → Scene Analyzer → Metadata Manager → DB

2. Scene Setup:
Camera/Model Adjustments → Lock Scene → Environmental Analyzer → Metadata Manager → DB

3. Path Generation:
User Prompt → Prompt Compiler → Metadata Manager (fetch) → API Route → LLM Engine → Scene Interpreter
                                                                            ↓
                                               Viewer State ← API Response (CameraCommand[])

4. Animation:
Viewer State → AnimationController (useFrame) → Camera/Scene Updates
  ↑                   ↓
  |--- UI Controls --- CameraAnimationSystem
```

### Target Architecture Flow
```
1. Model Upload:
User Upload → Scene Analyzer → Metadata Manager → DB

2. Scene Setup:
Camera/Model Adjustments → Lock Scene → Environmental Analyzer → Metadata Manager → DB

3. Path Generation:
User Prompt → Prompt Compiler → Metadata Manager (fetch) → LLM Engine → Provider
                                                                ↓
                                                        Scene Interpreter

4. Animation:
Scene Interpreter → API → Viewer (state) → AnimationController (execution) → Camera/Scene
```

## 🎯 Core Components

### 1. Scene Analyzer ✅ (Implemented)
| **Task**                | **Current Status** | **What it does**                                              |
|------------------------|-------------------|--------------------------------------------------------------|
| Parse GLB files        | ✅ Complete      | Extract geometry, materials, and scene information            |
| Spatial Analysis       | ✅ Complete      | Identify key points, boundaries, and spatial relationships    |
| Safety Zones           | ✅ Complete      | Calculate safe camera distances and movement boundaries       |
| Reference Points       | ✅ Complete      | Extract important features and landmarks                      |

### 2. Environmental Analyzer ⚠️ (Functional with Issues)
| **Task**                | **Current Status** | **What it does**                                              |
|------------------------|-------------------|--------------------------------------------------------------|
| Environment Bounds     | ✅ Complete      | Calculate environment boundaries and constraints              |
| Camera Constraints     | ⚠️ Needs Work    | Define and validate safe camera positioning                   |
| Movement Boundaries    | ⚠️ Needs Work    | Define safe movement zones and restricted areas              |
| Position Validation    | ⚠️ Needs Work    | Validate camera positions against constraints                 |

### 3. Metadata Manager ⚠️ (Mostly Complete)
| **Task**                | **Current Status** | **What it does**                                              |
|------------------------|-------------------|--------------------------------------------------------------|
| Data Persistence       | ✅ Complete      | Store and retrieve scene metadata and preferences             |
| Database Integration   | ✅ Complete      | Interface with Supabase for persistent storage               |
| User Preferences      | ✅ Complete      | Manage camera settings and viewing preferences                |
| Analysis Data Storage | ⚠️ Needs Work    | Store scene and environmental analysis results               |

### 4. Prompt Compiler ✅ (Implemented)
| **Task**                | **Current Status** | **What it does**                                              |
|------------------------|-------------------|--------------------------------------------------------------|
| Context Assembly       | ✅ Complete      | Combine system prompt, user prompt, and scene context         |
| Metadata Integration   | ✅ Complete      | Embed scene data and constraints into prompts                 |
| Token Management       | ✅ Complete      | Optimize prompts for token limits                             |
| Safety Parameters      | ✅ Complete      | Include safety constraints in prompts                         |

### 5. LLM Engine ✅ (Substantially Complete)
| **Task**                | **Current Status** | **What it does**                                              |
|------------------------|-------------------|--------------------------------------------------------------|
| Provider Abstraction   | ✅ Implemented   | Abstracts provider communication via `ThinLLMEngine`           |
| Response Processing    | ✅ Implemented   | Standardizes response into `CameraPath` via `LLMResponse`    |
| Error Management      | ✅ Implemented   | Centralizes provider API error handling                     |
- **Note:** Takes `CompiledPrompt`, uses helpers from `lib/llm/providers`, returns `LLMResponse<CameraPath>`.

### 6. Scene Interpreter ✅ (Substantially Complete)
| **Task**                | **Current Status** | **What it does**                                              |
|------------------------|-------------------|--------------------------------------------------------------|
| Path Processing        | ✅ Implemented   | Processes `CameraPath` into `CameraCommand[]`                |
| Animation Logic        | ✅ Implemented   | Applies smoothing (Catmull-Rom), assigns easing types. (Execution is client-side) |
| Safety Enforcement     | ✅ Implemented   | Detailed input path validation added (velocity, bounds etc) |
| Viewer Integration     | ✅ Complete      | Provides `CameraCommand[]` via API for client consumption    |
- **Note:** Performs detailed validation and processing. Output format is `CameraCommand[]`.

### 7. Animation Controller (Client) ✅ (New)
| **Task**                | **Current Status** | **What it does**                                              |
|------------------------|-------------------|--------------------------------------------------------------|
| Frame Loop Execution   | ✅ Implemented   | Uses R3F `useFrame` for synchronized updates.                 |
| Interpolation          | ✅ Implemented   | Calculates position/target per frame using `lerpVectors`.     |
| Easing Application     | ✅ Implemented   | Applies easing functions based on command data.               |
| Camera Update          | ✅ Implemented   | Applies calculated state to camera ref (`position`, `lookAt`). |
| Playback Control       | ✅ Implemented   | Handles `isPlaying`, speed adjustments, progress reporting.   |
- **Note:** Lives inside R3F Canvas, receives state/commands via props.

## 🔄 Current Implementation vs. Target Architecture

### Current Implementation (Actual)
```
                                Scene Analyzer
                                     ↓
User Input → Prompt Compiler → Metadata Manager → API Route → LLM Engine → Scene Interpreter
     ↑                             ↑                                             ↓
     |                             |                                             |
Camera/Model                  Environmental                               API Response (Commands)
Adjustments                   Analyzer                                         ↓
                                                                      Viewer (State Management)
                                                                            ↙         ↘
                                                    CameraAnimationSystem (UI)   AnimationController (useFrame → Camera)
```

### Target Architecture (Goal)
```
User Input → Pipeline Controller
     ↓
Scene Analyzer → Environmental Analyzer → Metadata Manager
     ↓
Prompt Compiler → LLM Engine → Scene Interpreter → Viewer
```

## 🎯 Implementation Priorities

### Phase 1: Separation of Concerns (✅ Structurally Complete)
1. Create LLM Engine abstraction layer ✅
   - Abstract provider communication ✅
   - Standardize response handling ✅
   - Centralize error management ✅

2. Implement Scene Interpreter core ✅
   - Move animation logic from UI (Partially done - processing logic moved) ⚠️
   - Implement path processing (Structure complete, refinement needed) ✅
   - Add basic safety validation (Implemented) ✅

### Phase 2: Backend Integration (✅ Structurally Complete)
1. Integrate Engine and Interpreter in API route ✅
2. Integrate Prompt Compiler call (structurally) ✅
3. Validate flow with service role key / mock data ✅
- **Blocker:** Real data fetching requires Auth solution.
- **Blocker:** `SceneAnalysis` input uses placeholder.

### Phase 3: UI/UX Refactor (✅ Mostly Complete, Testing/Refinement Remaining)
1. Modify UI to consume `CameraCommand[]`. ✅
2. Adapt UI animation playback logic (Refactored to `useFrame` in `AnimationController`). ✅
3. Improve controls and feedback (In Progress - needs scrubbing, hover states, etc.). ⚠️

### Phase 4: Enhanced Safety & Reliability (Future / TODOs)
1. Improve Environmental Analyzer (Existing ⚠️)
2. Complete Scene Interpreter Refinements (Smoothing, easing, validation TODOs)
3. Integrate real Scene Analyzer.

### Phase 5: System Maturity (Future)
// ... (Adjust as needed) ...

## 📊 Success Metrics

### 1. Architecture Quality
- Clear separation of concerns
- No business logic in UI layer
- Standardized interfaces between components
- Proper error handling at each layer

### 2. System Performance
- Response time under 2 seconds
- Smooth animation playback
- Efficient resource usage
- Reliable provider communication

### 3. User Experience
- Natural camera movements
- Consistent path generation
- Clear error feedback
- Smooth interaction flow

### 4. Safety & Reliability
- Validated camera paths
- Enforced safety constraints
- Graceful error recovery
- Consistent behavior across providers

## 📝 Notes

- Implementation focuses on proper separation of concerns
- Each component has clear, single responsibility
- Safety and validation are distributed across appropriate layers
- Changes can be made incrementally while maintaining functionality

---

> 🔄 This document will be updated as implementation progresses and new insights are gained. 