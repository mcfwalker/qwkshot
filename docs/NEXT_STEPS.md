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
- ✅ Refactor animation loop to use useFrame hook
- ✅ Lift animation state/refs from CameraAnimationSystem to Viewer
- ✅ Fix static video download issue by forcing render
- ✅ Fix Lock state UI/control bug (controls stay disabled)
- ✅ Fix Generate Shot button state reset
- ✅ Fix floor texture application and Add/Remove button logic
- ✅ Fix model offset toast message spam
- ✅ Implement Full Reset Logic for Clear Stage button
- ✅ Fix video download filename format and takeCount reset
- ✅ Configure toast notification position and base styling
- ✅ Fix post-login redirect and dropzone hover/drag states
- ✅ Refine LockButton & Generate Shot appearance/behavior
- ✅ Improve disabled input styling
- ✅ Fix Environmental Metadata Capture (FOV)
- ✅ Address UI inconsistencies (Tooltips, Create New Shot, Playback Reset)

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
  - [x] Refactor Animation Logic (Processing vs. Playback)
    - [x] Extract CameraAnimationSystem logic -> Path *processing* moved to backend `SceneInterpreter`; Playback *interpolation/execution* moved to client-side `AnimationController` (`useFrame`). ✅
    - [x] Create animation service layer -> Backend processing service (`SceneInterpreter`) created; Client playback execution component (`AnimationController`) created. ✅
    - [x] Set up state management (Interpreter manages internal state, `Viewer`/`AnimationController` manage client state) ✅
    - [ ] Add event system (Deferred - still deferred)

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

### Phase 3: UI/UX Refactor (2-3 weeks) ✅ **(Substantially Complete - Minor issues remain)**
- [ ] Improve core interactions
  - [ ] Enhance lock mechanism UX (Deferred)
  - [ ] Improve animation controls (Partially done - playback logic refactored) ✅
  - [ ] Add better feedback systems
  - [ ] Streamline user flow (Tab structure implemented) ✅

- [ ] Enhance visual feedback
  - [ ] Add progress indicators (Existing progress bar adapted)
  - [ ] Improve error messages (API errors handled via toast) ✅
  - [ ] Create success states (Path generation success handled via toast & tab switch) ✅
  - [ ] Implement loading states (Existing loader adapted) ✅

- [x] Optimize component structure
  - [x] Reorganize component hierarchy (Tabs, AnimationController added) ✅
  - [x] Improve state management (Lifted state to Viewer) ✅
  - [x] Clean up event handling (Basic handlers adapted/created) ✅
  - [x] Enhance performance (Component extraction helps) ✅
- **Note:** `CameraAnimationSystem` refactored, `AnimationController` created using `useFrame`. Playback/Recording fixed. Lock UI state fixed. Generate button state fixed. UI controls adapted. Needs scrubbing reimplementation, hover states, easing refinement, lock/validation strategy definition, visual cleanup, testing.

- [ ] **Functional Completion & Testing (New Subsection)**
  - [x] Re-test API data flow (`curl` with RLS disabled) to ensure backend still behaves as expected. ✅
  - [~] Define strategy for Lock/Validation conflict -> Potential future issue if strict constraints are added/enabled, but not currently blocking. ⚠️ 
  - [~] Implement/restore correct hover states for interactive UI elements.
  - [x] Implement rendering of controls within the "Playback" tab view. ✅
  - [x] Test UI Triggers: Verify drag-and-drop (`ModelLoader`), lock action (`CameraAnimationSystem`), scene controls (`SceneControls`), etc., still function correctly and trigger appropriate actions.
  - [ ] Address miscellaneous visual cleanup items.
  - [x] Debug and fix animation playback stuttering/incorrect motion (`CameraAnimationSystem`). ✅ 
  - [x] Fix video download (static content). ✅
  - [x] Fix Generate Shot button state reset after playback. ✅
  - [x] Fix floor texture application and Add/Remove button logic. ✅
  - [x] Implement Full Reset Logic for Clear Stage button. ✅
  - [ ] Audit and refine toast notifications (remove unnecessary, ensure consistency).
  - [ ] Implement refined easing logic in playback (if needed after testing).
  - [x] Test end-to-end flow within the UI (generate path -> switch to playback tab -> playback controls work).
- **Note:** Phase substantially complete. Known minor issues with disabled state consistency (tooltips/cursors) and hover states remain.

### Phase 4: Pipeline Optimization (Ongoing)
- [ ] Enhance validation systems
  - [ ] Improve path validation
  - [ ] Add comprehensive safety checks
  - [ ] Implement advanced constraints
  - [ ] Add validation visualization
  - [ ] Implement Real-time Validation Feedback (Client-side)
  - [ ] Define strategy for *potential* Lock/Validation Conflict.
  - [ ] Ensure accurate camera state capture (FOV, etc.) on lock.

- [ ] Performance improvements
  - [ ] Optimize computation (SceneInterpreter, other?)
  - [ ] Improve animation smoothness (Further smoothing/easing refinement?)
  - [ ] Enhance response times (LLM Engine, API)
  - [ ] Reduce resource usage
  - [ ] Implement LLM Engine Monitoring (Response time, error rates)
  - [ ] Implement System Alerting
  - [ ] Implement Monitoring Dashboard
  - [ ] (Potential) Refine prompt to ensure motion utilizes full requested duration (address "dead time").

- [ ] Feature Enhancements
  - [ ] Implement Interactive Orientation Setup
  - [ ] Implement Prompt Pre-processing Step
  - [ ] Implement Path Preview
  - [ ] Implement Editable Path Controls
  - [ ] Implement Viewer Background Color Picker
  - [ ] Implement Aspect Ratio Options for Download (16:9, 9:16)
  - [ ] Implement MP4 Format Option for Download
  - [ ] Implement LLM Seamless Texture Generator
  - [ ] Implement Image-to-3D Model Generation (Meshy API)
  - [ ] Implement Session Tracking & Analytics System
  - [ ] Implement User Feedback System (Rating/Comments)
  - [ ] Implement Animation Storage & History
  - [ ] (Enhancement) Allow Reapplying Saved Animations to Different Models

- [ ] Documentation & Process
  - [ ] Document Prompt Architecture & Engineering Strategy

## Current Priorities (Updated)
1.  Integrate real `SceneAnalyzer` component. -> Utilize Full SceneAnalysis Data in Path Generation.
    *   Note: Currently uses basic geometry + placeholders. Need to fetch/reconstruct full analysis data (complexity, reference points, features, initial constraints) from upload process for use by Env. Analyzer & Prompt Compiler.
2.  Implement proper Authentication/Authorization for API route data fetching.
3.  Address remaining TODOs in Engine/Interpreter (Smoothing, validation details, etc. - now Phase 4).
4.  **Define strategy for *potential* Lock/Validation Conflict.** (Moved to Phase 4)

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
- **Type errors currently exist on `main` branch due to previous merge (Commit `632c3b0`). Needs fixing before proceeding.**
- API route requires proper Auth strategy to work with RLS enabled.
- `SceneAnalysis` placeholder limits accuracy -> Use of simplified SceneAnalysis data in path generation limits context accuracy.
- LLM not consistently following prompt instructions regarding target coordinates. (Monitor)
- Potential conflict exists between allowing lock in any position and planned backend path validation constraints.
- ~~Inconsistent disabled state styling/tooltips (esp. LockButton) due to component/event interactions.~~ (Resolved)

## Next Session Focus (Updated)
1.  Fix type errors on `main` branch.
2.  Begin Scene Analyzer Integration (Implement storage/retrieval of full analysis).
3.  Implement proper Authentication/Authorization for API route data fetching.
4.  ~~Fix Environmental Metadata Capture (FOV issue).~~ (Resolved)
5.  ~~Address remaining UI inconsistencies (LockButton tooltip/cursor, hover states, visual cleanup).~~ (Resolved)

*This document will be updated at the end of each session to reflect progress and adjust priorities.* 