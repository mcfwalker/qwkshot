# Next Steps

## Completed Tasks
- ✅ Reorganized documentation structure
- ✅ Created `LLM_CONTEXT.md` for consistent LLM assistance
- ✅ Developed `FOR_HUMAN.md` as a developer checklist
- ✅ Moved outdated documentation to archive directory
- ✅ Updated status report with documentation work
- ✅ Established documentation protocol for future sessions
- ✅ Investigated P2P pipeline architecture
- ✅ Created P2P_OVERVIEW_v2.md with current and target architecture
- ✅ Updated ARCHITECTURE.md to reflect current state
- ✅ Migrated development tasks to Asana
- ✅ Archived DEVELOPMENT_ROADMAP.md

## Upcoming Tasks

### Phase 1: Thin LLM Engine Implementation (1-2 weeks) ✅ **(Substantially Complete)**
- [x] Create minimal wrapper layer
  - [x] Define basic interface between API routes and UI (`LLMEngine`, `LLMResponse`)
  - [x] Create standard response type (`LLMResponse`)
  - [x] Add basic error type definitions (`LLMEngineError`)
  - [ ] Keep provider logic in API routes -> **Refactored:** Provider logic encapsulated in Engine, API uses Engine. ✅

- [x] Implement basic validation
  - [x] Add response structure validation (Placeholder added)
  - [x] Implement simple error checks (`try...catch` structure) ✅
  - [x] Create basic error messages (`LLMEngineError` used) ✅
  - [x] Set up simple logging ✅

- [x] Clean up current implementation
  - [x] Document API route structure (Implicitly improved via refactor)
  - [x] Clean up API route response handling ✅
  - [x] Standardize API route error formats ✅
  - [x] Remove duplicate provider call logic ✅
- **Remaining TODOs:** Implement actual provider calls inside Engine; Refine metadata/duration handling.

### Phase 2: Scene Interpreter Core (2-3 weeks) ✅ **(Substantially Complete)**
- [x] Create base structure
  - [x] Define core interfaces (`SceneInterpreter`, `CameraCommand`)
  - [x] Set up component architecture (`CoreSceneInterpreter`)
  - [x] Create testing framework (Deferred)
  - [x] Add basic validation types (`validateInputPath`, `validateCommands` structure)

- [ ] Move animation logic from UI
  - [ ] Extract CameraAnimationSystem logic -> **Partially Done:** Path *processing* responsibility moved, playback interpolation remains. Structure for smoothing/easing added. ⚠️
  - [ ] Create animation service layer (Covered by Interpreter structure) ✅
  - [ ] Set up state management (Interpreter manages internal state) ✅
  - [ ] Add event system (Deferred)

- [x] Implement path processing
  - [x] Create path validation system (`validateInputPath` implemented with detailed checks) ✅
  - [x] Add motion segment processing (Basic mapping to `CameraCommand`, smoothing/easing placeholders added) ✅
  - [x] Set up interpolation system (Structure for Catmull-Rom & easing added) ✅

- [x] Add basic safety validation
  - [x] Implement boundary checking (Height, distance checks added) ✅
  - [x] Add collision detection (Restricted zones check added) ✅
  - [x] Create speed limit validation (Linear & angular velocity checks added) ✅
  - [x] Set up constraint system (Validation uses constraints from metadata) ✅
- **Remaining TODOs:** Implement detailed smoothing algorithms, refine easing, implement `restrictedAngles` check, add command validation details.

### Phase 2.5: Backend Integration & Validation (New) ✅ (Substantially Complete)
- [x] Integrate `SceneInterpreter` into `camera-path` API route
  - [x] Initialize `SceneInterpreter` in API route
  - [x] Pass `CameraPath` from `LLMEngine` to `SceneInterpreter.interpretPath`
  - [x] Call `SceneInterpreter.validateCommands`
  - [x] Return `CameraCommand[]` (or error) from API route
- [x] (Optional) Integrate `PromptCompiler` call into API route
  - [x] Replace manual `CompiledPrompt` construction (structurally, uses mock context)
- [x] Perform basic end-to-end validation of the API route flow (with mock context)
- **Note:** Completed structurally, but relies on mock context data.

### Phase 2.7: Real Context Integration (New) (1-2 weeks)
- [ ] Remove mock data logic from `camera-path` API route
- [ ] Implement real data fetching in API route:
  - [ ] Instantiate `MetadataManager` (and potentially `SceneAnalyzer`, `EnvironmentalAnalyzer` if needed)
  - [ ] Call manager/analyzers to fetch `ModelMetadata`, `EnvironmentalMetadata`, `SceneAnalysis` based on `modelId`
  - [ ] Handle potential authentication/RLS issues for data fetching
- [ ] Pass real context data to `PromptCompiler.compilePrompt`
- [ ] Re-validate API route with real context data to ensure correct `CameraCommand[]` output.

### Phase 3: UI/UX Refactor (2-3 weeks)
- [ ] Improve core interactions
  - [ ] Enhance lock mechanism UX
  - [ ] Improve animation controls
  - [ ] Add better feedback systems
  - [ ] Streamline user flow

- [ ] Enhance visual feedback
  - [ ] Add progress indicators
  - [ ] Improve error messages
  - [ ] Create success states
  - [ ] Implement loading states

- [ ] Optimize component structure
  - [ ] Reorganize component hierarchy
  - [ ] Improve state management
  - [ ] Clean up event handling
  - [ ] Enhance performance

### Phase 4: Pipeline Optimization (Ongoing)
- [ ] Enhance validation systems
  - [ ] Improve path validation
  - [ ] Add comprehensive safety checks
  - [ ] Implement advanced constraints
  - [ ] Add validation visualization

- [ ] Performance improvements
  - [ ] Optimize computation
  - [ ] Improve animation smoothness
  - [ ] Enhance response times
  - [ ] Reduce resource usage

## Current Priorities (Updated)
1.  Implement real context data fetching in `camera-path` API route (Phase 2.7).
2.  Handle potential Auth/RLS issues for data fetching.
3.  Validate API route output with real data.
4.  Begin UI/UX Refactor (Phase 3) to consume `CameraCommand[]`.

## Implementation Strategy

### Branching Strategy
- Create feature branches for each phase
  ```
  main
  ├── feature/thin-llm-engine
  │   ├── feat/basic-interface
  │   ├── feat/validation-layer
  │   └── feat/cleanup
  ├── feature/scene-interpreter
  │   ├── feat/base-structure
  │   ├── feat/animation-logic
  │   └── feat/path-processing
  └── feature/ui-refactor
      ├── feat/core-interactions
      └── feat/visual-feedback
  ```

### Development Workflow
1. **Phase-Based Development**
   - Work in feature branches for each phase
   - Create smaller feature branches for specific tasks
   - Regular merges back to phase branch
   - PR reviews for each feature

2. **Incremental Implementation**
   - Start with thin LLM Engine (most isolated)
   - Use feature flags for gradual rollout
   - Maintain backward compatibility
   - Parallel development possible between phases

3. **Feature Flag Strategy**
   - Enable/disable new implementations
   - Control rollout of features
   - A/B testing capability
   - Easy rollback if needed

4. **Testing Approach**
   - Unit tests for new components
   - Integration tests for phase completion
   - E2E tests for critical paths
   - Performance benchmarks

### Phase 1 Implementation Plan (Completed)
1. Create `feature/thin-llm-engine` branch
2. Implement features in order:
   - Basic interface
   - Validation layer
   - Cleanup
3. Regular merges to main
4. Feature flag control for rollout

### Phase 2 Implementation Plan (Completed)
1. Create `feature/scene-interpreter` branch
2. Implement features in order:
   - Base structure
   - Animation logic
   - Path processing
3. Regular merges to main
4. Feature flag control for rollout

### Phase 2.5 Implementation Plan (Completed)
1. Create `feature/backend-integration` branch (or similar) from `feature/thin-llm-engine`.
2. Modify `src/app/api/camera-path/route.ts` to call `SceneInterpreter`.
3. Test API route with sample requests.
4. (Optional) Modify API route to call `PromptCompiler`.
5. Merge back to main branch upon successful validation.

### Phase 2.7 Implementation Plan (New)
1. Create `feature/real-context-integration` branch (or similar) from `feature/thin-llm-engine`.
2. Modify `src/app/api/camera-path/route.ts` to remove mocks and implement real data fetching.
3. Investigate and resolve Auth/RLS issues if they block data fetching.
4. Test API route with valid `modelId`s known to have data.
5. Commit changes.
6. Merge back to `feature/thin-llm-engine` upon successful validation.

## Architectural Decisions
- Keep provider logic in API routes
- Maintain thin LLM Engine approach
- Separate business logic from UI
- Focus on clean interfaces

## Blockers and Issues
- Potential Auth/RLS issues when fetching data in API route context.
- Ensuring correct data types/structures are passed between Manager/Analyzers and Compiler.

## Next Session Focus (Updated)
1. Begin Real Context Integration (Phase 2.7).
2. Plan data fetching strategy using MetadataManager/Analyzers.
3. Investigate potential Auth/RLS solutions for API route context.
4. Implement data fetching calls in `camera-path/route.ts`.

*This document will be updated at the end of each session to reflect progress and adjust priorities.* 