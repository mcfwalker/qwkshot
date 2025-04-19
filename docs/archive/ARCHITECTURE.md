# Path-to-Path (p2p) Pipeline Architecture

## Overview
The Path-to-Path (p2p) pipeline is a sophisticated system that translates natural language instructions into dynamic camera paths within a Three.js scene. This document outlines the overall architecture and component interactions.

> 🔄 For current implementation details and status, see [P2P Pipeline Overview v2](./P2P_OVERVIEW_v2.md)

## Pipeline Components

### Component Implementation Status
Current implementation status and detailed flow diagrams are maintained in P2P_OVERVIEW_v2.md. This document focuses on architectural principles, requirements, and guidelines.

### 1. Scene Analyzer
- **Purpose**: Analyze and understand 3D scene structure and spatial relationships
- **Key Features**:
  - GLB file parsing and analysis
  - Spatial reference point extraction
  - Safety boundary calculation
  - Basic scene understanding
- **Status**: ✅ Fully functional
- **Interface**: See [Scene Analyzer Documentation](./scene-analyzer/README.md)

### 2. Environmental Analyzer
- **Purpose**: Analyze environmental factors and constraints
- **Key Features**:
  - Lighting analysis and optimization
  - Material property analysis
  - Environmental constraint detection
  - Performance optimization
- **Status**: ⚠️ Functional but with storage issues
- **Known Issues**:
  - Data persistence challenges
  - Complex nested structure handling
  - Integration with metadata storage
- **Interface**: See [Environmental Analyzer Documentation](./environmental-analyzer/README.md)

### 3. Metadata Manager
- **Purpose**: Handle user-specified metadata and model information
- **Key Features**:
  - User metadata storage and retrieval
  - Model orientation handling
  - Feature point tracking
  - Database integration (Supabase)
  - Scene analysis data persistence
- **Status**: ✅ Core functionality complete
- **Recent Improvements**:
  - Enhanced data persistence reliability
  - Optimized database integration
  - Improved error handling
- **Known Issues**:
  - Analysis data storage optimization needed
- **Interface**: See [Metadata Manager Documentation](./metadata-manager/README.md)

### 4. Prompt Compiler
- **Purpose**: Transform user instructions into optimized LLM prompts
- **Key Features**:
  - Natural language processing
  - Scene context integration
  - Token optimization
  - Metadata tracking
- **Status**: ✅ Fully functional
- **Interface**: See [Prompt Compiler Documentation](./prompt-compiler/README.md)

### 5. LLM Engine ✅ (Substantially Complete)
- **Purpose**: Manage interaction with external LLM services
- **Key Features**:
  - Provider communication abstraction (`ThinLLMEngine`)
  - Standardized API request/response handling (`LLMResponse`)
  - Centralized error management
- **Status**: ✅ Substantially Complete (Refactor done, provider selection deferred)
- **Current Implementation**: 
    - `ThinLLMEngine` class encapsulates provider calls.
    - Takes `CompiledPrompt`.
    - Uses helpers from `lib/llm/providers`.
    - Returns `LLMResponse<CameraPath>`.
    - Integrated into API route.
- **Interface**: See [LLM Engine Documentation](./llm-engine/README.md) (Needs Update)

### 6. Scene Interpreter ✅ (Substantially Complete)
- **Purpose**: Convert LLM output (`CameraPath`) into executable camera commands
- **Key Features**:
  - Path processing (smoothing/easing structure added, execution is client-side)
  - Detailed input path validation (incl. speed, bounds, etc.)
  - Basic output command validation structure
  - Safety constraint enforcement (partially implemented via validation, incl. bounding box check with known limitations)
- **Status**: ✅ Substantially Complete (Core structure done, refinement TODOs remain)
- **Current Implementation**: 
    - `SceneInterpreterImpl` class (Note: Previous docs referenced `CoreSceneInterpreter`).
    - `interpretPath` method processes `CameraPath` into `CameraCommand[]`.
    - `validateInputPath` performs detailed checks.
    - Integrated into API route after LLM Engine.
- **Interface**: See [Scene Interpreter Documentation](./scene-interpreter/README.md) (Needs Update)

### 7. Client-Side Animation & UI (Formerly Viewer Integration)
- **Purpose**: Receive camera commands, manage playback state, execute animation within R3F context, and handle UI interactions.
- **Key Components & Features**:
  - **`Viewer` Component:** 
      - Renders the R3F `<Canvas>`.
      - Holds lifted animation state (`isPlaying`, `commands`, `progress`, `duration`, `playbackSpeed`).
      - Holds core refs (`cameraRef`, `controlsRef`, `canvasRef`, `modelRef`).
      - Passes state/refs/callbacks down to child components.
  - **`AnimationController` Component (New):**
      - Rendered inside `<Canvas>`.
      - Uses `useFrame` hook for synchronized frame-by-frame execution.
      - Performs interpolation (lerp) and applies easing based on `CameraCommand[]`.
      - Updates `cameraRef` directly (`position.copy`, `lookAt`).
      - Manages internal animation timing (`startTimeRef`, `progressRef`).
      - Handles playback speed adjustment.
      - Calls `onProgressUpdate` and `onComplete` callbacks.
      - Manages `OrbitControls.enabled` state during playback.
  - **`CameraAnimationSystem` Component:**
      - Renders UI panels (Shot Caller, Playback).
      - Handles user inputs (prompt, duration, speed slider, play/pause, download, lock buttons).
      - Displays animation progress and state.
      - Communicates user actions and receives state via props/callbacks from `Viewer`.
- **Status**: ✅ Core playback/recording functional using `useFrame`. UI adapted. State lifted.
- **Recent Improvements**:
  - Refactored animation execution to use R3F `useFrame` hook via `AnimationController`.
  - Lifted animation state/refs to `Viewer` component.
  - Resolved visual playback glitches.
  - Resolved static video recording issue (by forcing render in `useFrame`).
- **Known Issues**:
  - Lock state and animation playback coordination (Lock/Validation conflict).
  - Slider scrubbing needs reimplementation after state lifting.
  - Easing function refinement/testing needed.
  - Hover states and minor UI cleanup pending.
- **Interface**: N/A (Internal component structure)

### 8. Feedback System
- **Purpose**: Monitor and improve pipeline performance
- **Key Features**:
  - Session logging
  - User feedback collection
  - Health monitoring
  - Training data preparation
- **Status**: 🚧 Planned
- **Interface**: See [Feedback System Documentation](./feedback/README.md)

## Component Interactions

```mermaid
graph TD
    subgraph Current Refactored State (API Level)
        A1[User Input] --> R1[API Route /api/camera-path]
        R1 -- modelId --> F1[MetadataManager]
        R1 -- instruction, context --> C1[PromptCompiler]
        C1 --> R1
        R1 -- CompiledPrompt --> E1[LLM Engine]
        E1 --> P1[LLM Provider]
        P1 --> E1
        E1 -- CameraPath --> R1
        R1 -- CameraPath --> G1[Scene Interpreter]
        G1 -- CameraCommand[] --> R1
        R1 --> Client[UI / Caller]
        
        subgraph Placeholders/Deferred
            X1(SceneAnalyzer Integration)
            X2(EnvAnalyzer Integration / Refinement)
            X3(API Authentication / RLS)
        end
    end

    subgraph Target Architecture
        A2[User Input] --> B2[Pipeline Controller]
        B2 --> C2[Scene Analysis Layer] 
        C2 --> D2[Metadata Manager]
        D2 --> E2[Prompt Compiler]
        E2 --> F2[LLM Engine]
        F2 --> G2[Scene Interpreter]
        G2 --> H2[Viewer]
    end
```

## Data Flow (Updated)

1.  **Scene/Env/Metadata Analysis** (Partially Integrated / Placeholder)
    - GLB potentially analyzed by `SceneAnalyzer` (Placeholder in current API flow).
    - Environmental factors potentially analyzed by `EnvironmentalAnalyzer` (Called in API flow, input is placeholder).
    - Context data fetched via `MetadataManager`.

2.  **Input Processing**
    - User provides natural language instruction.

3.  **Prompt Generation** (Integrated Structurally)
    - API Route calls `PromptCompiler`.
    - Compiler uses fetched/placeholder context to create `CompiledPrompt`.

4.  **LLM Interaction & Path Generation** (Integrated)
    - API Route calls `LLM Engine` with `CompiledPrompt`.
    - Engine uses configured provider helper to call external LLM.
    - Engine receives response, standardizes into `CameraPath`.

5.  **Path Interpretation & Validation** (Integrated)
    - API Route calls `Scene Interpreter` with `CameraPath`.
    - Interpreter validates input path (speed, bounds, etc.).
    - Interpreter processes path (smoothing/easing structure added).
    - Interpreter validates output commands (basic structure added).
    - Interpreter returns `CameraCommand[]`.

6.  **Execution** (Client-Side - Refactored)
    - API Route returns `CameraCommand[]` to client.
    - `Viewer` component receives response (via handler like `handleNewPathGenerated`), stores `commands` and `duration` in state.
    - `Viewer` passes `commands`, `isPlaying`, `playbackSpeed`, `cameraRef`, `controlsRef` etc. as props to `AnimationController`.
    - `AnimationController` uses `useFrame` hook:
        - Calculates current time/progress based on `isPlaying` and internal refs.
        - Finds the relevant command segment(s).
        - Interpolates `position` and `target` vectors using easing.
        - Updates `cameraRef.current.position` and `cameraRef.current.lookAt`.
        - Calls `onProgressUpdate` callback (updates `Viewer` state, which updates `CameraAnimationSystem` UI).
        - Calls `onComplete` callback when finished (updates `Viewer` state).
    - `CameraAnimationSystem` displays progress/state received from `Viewer` and handles UI interactions (play/pause etc.) which call back up to `Viewer` to modify state.

7.  **Feedback Loop** (Planned)

## Error Handling

### 1. Component-Level Errors
- Each component handles its own errors
- Provides meaningful error messages
- Implements fallback strategies
- ⚠️ Enhanced error handling needed for metadata operations

### 2. Pipeline-Level Errors
- Graceful degradation
- State preservation
- Recovery mechanisms
- ⚠️ Improved error tracking for data persistence issues

## Performance Considerations

### 1. Optimization Points
- GLB parsing efficiency
- Environmental analysis
- Metadata management
  - ⚠️ Complex structure optimization
  - ⚠️ Database operation efficiency
- Prompt token management
- Path generation efficiency
- Animation smoothness
- Memory usage

### 2. Monitoring
- Response times
- Error rates
- Resource usage
- User satisfaction
- ⚠️ Enhanced logging for metadata operations

## Development Guidelines

### 1. Component Development
- Follow TypeScript best practices
- Implement comprehensive testing
- Document interfaces thoroughly
- Maintain backward compatibility
- ⚠️ Focus on data persistence reliability

### 2. Integration Testing
- Test component interactions
- Validate data flow
- Check error handling
- Measure performance
- ⚠️ Verify metadata storage reliability

## Current Focus Areas

1.  **Lock/Validation Conflict Resolution:** Decide and implement strategy.
2.  **UI Functional Testing & Refinement:** Re-implement scrubbing, test all interactions, fix hover states, finalize easing.
3.  **API Authentication:** Implement proper auth for API routes.

## Future Enhancements

### 1. Planned Features
- Advanced GLB analysis
- Enhanced environmental understanding
- Improved metadata management
- Better performance monitoring

### 2. Research Areas
- GLB processing optimization
- Environmental analysis improvement
- User experience enhancement
- Performance optimization
- Database integration refinement

## Related Documentation
- [Product Requirements Document](../../PRD.md)
- [Technical Design Document](../../TECHNICAL_DESIGN.md)
- [Development Roadmap](../../DEVELOPMENT_ROADMAP.md)
- [P2P Development Roadmap](./P2P_DEVELOPMENT_ROADMAP.md)
- [Original Pipeline Overview](./P2P_OVERVIEW.md) 