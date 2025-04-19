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
- ✅ **Integrate Scene Analyzer Data Pipeline:** Refactored model saving & env metadata updates to use Server Actions; added dedicated `scene_analysis` DB column; implemented serialization/deserialization; fixed related client-side state bugs.
- ✅ Investigated P2P component architecture (`EnvironmentalAnalyzer`, `PromptCompiler`, `MetadataManager`) and data flow.
- ✅ Refactored `EnvironmentalAnalyzer` & `PromptCompiler` to use camera-relative context (`distanceToCenter`, `distanceToBoundingBox`) in prompt.
- ✅ Implemented backend bounding box validation check in `SceneInterpreter`.
- ✅ Implemented client-side retry mechanism for bounding box validation failures.
- ✅ Fixed bug where `modelOffset` was not applied during backend validation.
- ✅ Resolved code execution issues related to singleton pattern in `getSceneInterpreter`.
- ✅ Cleaned up debug logs in `/api/camera-path` route.
- ✅ **Fixed Interpreter Logging & Validated Retry:** Resolved issue preventing SceneInterpreter logs from appearing by correcting logger instantiation in the API route; confirmed backend bounding box validation and client-side retry mechanism function correctly.

## Current Work & Future Phases

> **❗ Focus Shift (2025-04-14):** Project focus has shifted to a major pipeline rearchitecture using the OpenAI Assistants API, as detailed in [`docs/refactors/ASSISTANTS_API_REFACTOR_PLAN.md`](./refactors/ASSISTANTS_API_REFACTOR_PLAN.md). The immediate next steps listed below are **paused** pending the completion and evaluation of this refactor.

### Immediate Next Steps (PAUSED)
1.  **Refactor Validation Failure UI:** Change the client-side notification for `PATH_VIOLATION_BOUNDING_BOX` from a transient toast to a persistent modal dialog, offering "Try Again".
2.  **Implement Robust Clipping Prevention:** Enhance clipping prevention (e.g., stronger prompt instructions, explore validation padding/buffer, investigate pre-generation checks).
3.  **Implement API Authentication/Authorization:** Secure the `/api/camera-path` route (and review Server Action auth).
4.  **Address React Warning:** Investigate the low-priority "Cannot update a component (`SceneControls`)..." warning.
5.  **Address remaining TODOs** in Engine/Interpreter (Further validation details, etc. - Part of Phase 4 validation enhancements).

### Phase Status Overview

*   **Phase 1: Thin LLM Engine Implementation:** ✅ (Substantially Complete)
*   **Phase 2: Scene Interpreter Core:** ✅ (Substantially Complete)
*   **Phase 2.5: Backend Integration & Validation:** ✅ (Substantially Complete - Relied on mock context/service key)
*   **Phase 2.7: Real Context Integration:** ✅ (Substantially Complete - Real data fetching works, `SceneAnalysis` input handled, API Auth pending)
*   **Phase 3: UI/UX Refactor:** ✅ (Substantially Complete - Minor UI issues remain)
*   **Phase 4: Pipeline Optimization:** ⏳ (Ongoing - See details below)

### Phase 4: Pipeline Optimization (Details - Ongoing)
- [ ] Enhance validation systems
  - [ ] Improve path validation
  - [X] Add comprehensive safety checks (Bounding box check implemented)
  - [ ] Implement advanced constraints
  - [ ] Add validation visualization
  - [ ] Implement Real-time Validation Feedback (Client-side)
  - [ ] Define strategy for *potential* Lock/Validation Conflict.

- [ ] Performance improvements
  - [ ] Optimize computation (SceneInterpreter, other?)
  - [ ] Improve animation smoothness (Further smoothing/easing refinement?)
  - [ ] Enhance response times (LLM Engine, API)
  - [ ] Reduce resource usage
  - [ ] Implement LLM Engine Monitoring (Response time, error rates)
  - [ ] Implement System Alerting
  - [ ] Implement Monitoring Dashboard
  - [ ] (Potential) Refine prompt to ensure motion utilizes full requested duration (address "dead time").
  - [ ] Address UI Responsiveness/Freeze on Initial Load (Investigate client-side pipeline init).

- [ ] Feature Enhancements
  - [ ] Refine Serialization/Deserialization for Omitted Fields (`materials`, `symmetryPlanes`, `restrictedZones`) if needed.
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

## Architectural Decisions
- Keep provider logic in API routes
- Maintain thin LLM Engine approach
- Separate business logic from UI
- Focus on clean interfaces

## Blockers and Issues
- Type errors currently exist on `main` branch due to previous merge (Commit `632c3b0`). Needs fixing before proceeding.
- API route requires proper Auth strategy to work with RLS enabled.
- LLM not consistently following prompt instructions regarding target coordinates or boundary avoidance. (Monitor, address via Prompt Engineering/Clipping Prevention task).
- Potential conflict exists between allowing lock in any position and planned backend path validation constraints.
- React Warning: "Cannot update a component (`SceneControls`) while rendering a different component (`Viewer`)" appears in browser console on model load/URL change. Likely due to `Viewer`'s `useEffect` updating Zustand store (`setModelId`), causing `SceneControls` (subscribed to store) to attempt an update during `Viewer`'s render. Needs investigation (React DevTools, Zustand selectors, Tooltip interaction). (Low priority if app functions correctly).

## Next Session Focus (Updated)

> Focus has shifted to the tasks outlined in [`docs/refactors/ASSISTANTS_API_REFACTOR_PLAN.md`](./refactors/ASSISTANTS_API_REFACTOR_PLAN.md), starting with Phase 0 (Planning & Design).

*This document will be updated at the end of each session to reflect progress and adjust priorities.* 