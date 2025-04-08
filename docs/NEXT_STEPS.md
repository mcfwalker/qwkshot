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

### Phase 2.7: Real Context Integration (New) ✅ (Substantially Complete)
- [x] Remove mock data logic from `camera-path` API route
- [x] Implement real data fetching in API route:
  - [x] Instantiate `MetadataManager`, `EnvironmentalAnalyzer`
  - [x] Call manager/analyzers to fetch `ModelMetadata`, `EnvironmentalMetadata`
  - [x] Handle potential authentication/RLS issues for data fetching (Used Service Role Key as temporary solution for testing)
- [x] Pass real context data to `PromptCompiler.compilePrompt` (Data fetched, but `SceneAnalysis` still uses placeholder derived from `ModelMetadata`)
- [x] Re-validate API route with real context data to ensure correct `CameraCommand[]` output (Validated flow, failed on speed constraint as expected).
- **Note:** Completed structurally. Real data fetching works with Service Key. `SceneAnalysis` input is still placeholder. Proper API auth needed.

### Phase 3: UI/UX Refactor (2-3 weeks) ⚠️ **(In Progress)**
- [ ] Improve core interactions
  - [ ] Enhance lock mechanism UX (Deferred)
  - [ ] Improve animation controls (Partially done - basic playback logic adapted) ✅
  - [ ] Add better feedback systems (Deferred)
  - [ ] Streamline user flow (Tab structure implemented) ✅

- [ ] Enhance visual feedback
  - [ ] Add progress indicators (Existing progress bar adapted)
  - [ ] Improve error messages (API errors handled via toast) ✅
  - [ ] Create success states (Path generation success handled via toast & tab switch) ✅
  - [ ] Implement loading states (Existing loader adapted) ✅

- [x] Optimize component structure
  - [x] Reorganize component hierarchy (Tabs implemented) ✅
  - [ ] Improve state management (Basic state adapted, further review maybe needed)
  - [x] Clean up event handling (Basic handlers adapted/created) ✅
  - [x] Enhance performance (Component extraction helps) ✅
- **Note:** `CameraAnimationSystem` refactored to use new API contract (`CameraCommand[]`) and tabbed layout. Core playback logic adapted. Panel components extracted. Initial styling pass complete. Needs easing implementation, detailed styling match, testing.

- [ ] **Functional Completion & Testing (New Subsection)**
  - [ ] Re-test API data flow (`curl` with RLS disabled) to ensure backend still behaves as expected. ✅
  - [~] Fix "Lock Composition" button functionality (`onLockToggle` interaction, state updates, potentially related `storeEnvironmentalMetadata` call). (Disabled when no model, but underlying validation conflict remains) ⚠️
  - [ ] Implement/restore correct hover states for interactive UI elements.
  - [x] Implement rendering of controls within the "Playback" tab view. ✅
  - [ ] Test UI Triggers: Verify drag-and-drop (`ModelLoader`), lock action (`CameraAnimationSystem`), scene controls (`SceneControls`), etc., still function correctly and trigger appropriate actions (even if underlying logic like SceneAnalyzer integration is pending).
  - [ ] Address miscellaneous visual cleanup items.
  - [-] Debug and fix animation playback stuttering/incorrect motion (`CameraAnimationSystem`). ⚠️
  - [ ] Implement refined easing logic in playback.
  - [ ] Test end-to-end flow within the UI (generate path -> switch to playback tab -> playback controls work).

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
1.  **Debug Animation Playback:** (Phase 3 Subsection)
    *   Diagnose and resolve stuttering/incorrect motion in `CameraAnimationSystem`.
2.  **Resolve Lock/Validation Conflict:** (Phase 3 Subsection)
    *   Decide strategy (e.g., pre-validation, constrain lock) for handling locking in invalid positions.
    *   Implement chosen solution.
3.  **Complete UI Functional Completion & Testing:** (Phase 3 Subsection)
    *   Test UI triggers and basic end-to-end flow (once playback works).
    *   Implement/restore correct hover states.
    *   Implement refined easing logic in playback.
    *   Address miscellaneous visual cleanup.
4.  Implement proper Authentication/Authorization for API route data fetching.
5.  Integrate real `SceneAnalyzer` component.
6.  Address remaining TODOs in Engine/Interpreter.

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

### Phase 2.7 Implementation Plan (Completed)
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
- API route requires proper Auth strategy to work with RLS enabled.
- `SceneAnalysis` placeholder limits accuracy of `PromptCompiler` and `EnvironmentalAnalyzer` output.
- LLM not consistently following prompt instructions regarding target coordinates.
- Client-side animation playback exhibits stuttering/incorrect motion despite recent fixes.
- Conflict exists between allowing lock in invalid positions and subsequent path validation.

## Next Session Focus (Updated)
1. Add detailed logging to `CameraAnimationSystem`'s `animate` function.
2. Analyze logs to pinpoint cause of playback stuttering/incorrect motion.
3. Implement fix for playback logic.
4. Re-evaluate strategy for handling invalid locked camera positions.

*This document will be updated at the end of each session to reflect progress and adjust priorities.* 