# Critical Paths and Protected Areas

This document outlines the critical paths and protected areas of the MiniMav codebase. These components require careful consideration and testing before any modifications.

## 📋 When To Use This Document

### 1. Development Planning
- Before starting work on new features
- When planning infrastructure changes
- During sprint/task planning
- When estimating complexity of changes

### 2. During Active Development
- **IMMEDIATELY** when about to modify any protected area:
  - Route structures
  - Authentication flows
  - P2P pipeline components
  - LLM provider integrations
- When changes in one component affect another
- Before committing significant changes
- When experiencing cascading errors

### 3. Code Review & Testing
- Before creating pull requests
- During code review sessions
- Before merging branches
- When resolving merge conflicts
- Before deployment to production

### 4. Red Flag Situations (Stop and Consult)
- Making frequent changes to the same component
- Entering "fix loops" where one fix leads to another
- Unexpected side effects in seemingly unrelated components
- Multiple failed deployment attempts
- Recurring issues in protected areas

### 5. Documentation & Communication
- When onboarding new team members
- During technical discussions
- When documenting new features
- When updating testing protocols

### 6. Quick Reference Checklist
Ask yourself:
- [ ] Am I modifying a protected area?
- [ ] Will this change affect multiple components?
- [ ] Does this touch the P2P pipeline?
- [ ] Are there existing tests for this area?
- [ ] Do I need to update acceptance criteria?
- [ ] Have I reviewed the required testing?

### 7. Share This Document When
- Starting a new development session
- Discussing major changes
- Encountering persistent issues
- Planning testing strategies
- Reviewing system architecture

## 🚨 Protected Areas

### 1. Route Structure
- **Protected Routes (`src/app/(protected)/*`)**: 
  - Authentication-required routes
  - Core application flow
  - DO NOT modify route structure without thorough testing
  - When adding new routes, follow existing patterns

### 2. API Routes (`src/app/api/*`)
- **LLM Provider Routes**:
  - `/api/llm/*` - Provider management and switching
  - `/api/chat/*` - Chat functionality
  - Changes here affect core application functionality
  - Must maintain consistent response formats

### 3. P2P Pipeline Components (`src/features/p2p/*`, `src/lib/motion-planning/*`)
- **Core Components**:
  - Scene Analyzer ✅
    - Spatial analysis
    - Safety zones calculation
    - Reference point extraction
  - Environmental Analyzer ✅
    - Environment bounds validation
    - Camera constraints definition
    - Movement boundaries
    - Position validation through lock mechanism
  - Metadata Manager ✅
    - User preferences and settings
    - Scene analysis data persistence
    - Feature point tracking
    - Environmental metadata storage and retrieval
    - Supabase integration
  - LLM Engine (Adapter) ✅
    - Implemented via `OpenAIAssistantAdapter` (`src/lib/motion-planning/providers/openai-assistant.ts`)
    - Handles interaction with OpenAI Assistants API (threads, runs, messages)
    - Manages polling and timeouts.
    - Parses and validates `MotionPlan` JSON response.
    - Provider abstraction via `MotionPlannerService` interface.
    - Handles API errors.
  - Scene Interpreter ✅
    - Implemented via `SceneInterpreterImpl` (`src/features/p2p/scene-interpreter/interpreter.ts`)
    - Receives `MotionPlan` and local context (Scene/Env Analysis, Initial State).
    - Deterministically generates `CameraCommand[]` keyframes based on plan steps.
    - Resolves targets (including spatial references).
    - Calculates distance based on `destination_target` or `distance` parameter.
    - Applies constraints and easing.
    - Validates generated commands against bounding box.
  - Three.js Viewer / Animation Controller ✅
    - Executes `CameraCommand[]` keyframes.
    - Handles interpolation and easing via `d3-ease`.
    - Manages animation playback state (play, pause, progress).
    - Lock mechanism for camera position ✅
    - Coordinates lock state with animation playback.
  - Changes here affect the entire pipeline flow
  - Must maintain data structure consistency between components (`MotionPlan`, `CameraCommand`)
  - Requires thorough testing of component interactions

### 4. Authentication (`src/lib/supabase-server.ts`, `src/middleware.ts`)
- Supabase client configuration
- Session management
- Protected route handlers
- Critical for application security

## 🧪 Required Testing

### Before Any Merge
1. **Authentication Flow**
   - [ ] Login/Logout functionality
   - [ ] Protected route access
   - [ ] Session persistence

2. **P2P Pipeline**
   - Scene Analyzer Tests
     - [ ] GLB file parsing
       - ✓ Successfully loads files up to 100MB
       - ✓ Extracts all geometries and materials
       - ✓ Handles complex nested structures
     - [ ] Spatial analysis completion
       - ✓ Identifies all major object boundaries
       - ✓ Calculates accurate center points
       - ✓ Completes within 30 seconds for large models
     - [ ] Safety zone calculations
       - ✓ No camera positions inside object geometry
       - ✓ Maintains minimum 1.5x object size distance
       - ✓ Accounts for all scene boundaries
     - [ ] Reference point extraction
       - ✓ Identifies key visual landmarks
       - ✓ Maintains consistent point IDs
       - ✓ Handles symmetrical features correctly
     - [ ] Large file handling
       - ✓ Memory usage stays under 2GB
       - ✓ Graceful failure for oversized files
       - ✓ Progress reporting during processing

   - Environmental Analyzer Tests
     - [ ] Environment bounds calculation
       - ✓ Accurate min/max coordinates
       - ✓ Handles irregular shapes
       - ✓ Updates with scene changes
     - [ ] Camera constraint validation
       - ✓ Prevents clipping through geometry
       - ✓ Maintains minimum safe distances
       - ✓ Handles dynamic constraint updates
     - [ ] Distance calculations
       - ✓ Sub-millimeter accuracy
       - ✓ Handles large coordinate values
       - ✓ Efficient for real-time updates
     - [ ] Movement boundary enforcement
       - ✓ No out-of-bounds positions
       - ✓ Smooth boundary approach behavior
       - ✓ Handles complex boundary shapes
     - [ ] Height restriction validation
       - ✓ Respects min/max heights
       - ✓ Adapts to model scale
       - ✓ Handles terrain variations

   - Metadata Manager Tests
     - [ ] User preference persistence
       - ✓ Saves all settings instantly
       - ✓ Recovers after session restart
       - ✓ Handles concurrent updates
     - [ ] Model orientation tracking
       - ✓ Maintains accuracy during rotation
       - ✓ Updates in real-time
       - ✓ Preserves custom orientations
     - [ ] Feature point storage/retrieval
       - ✓ Sub-second access times
       - ✓ Maintains point relationships
       - ✓ Handles bulk operations
     - [ ] Supabase integration ✅
       - ✓ Handles network interruptions
       - ✓ Maintains data consistency
       - ✓ Efficient batch operations
     - [ ] Analysis data persistence ✅
       - ✓ Complete data recovery
       - ✓ Version control for updates
       - ✓ Handles large datasets
     - [ ] Environmental metadata handling ✅
       - ✓ Stores camera position on lock
       - ✓ Retrieves metadata for path generation
       - ✓ Maintains metadata consistency
       - ✓ Handles metadata updates

   - OpenAI Assistant Adapter Tests (`LLM Engine`)
     - [ ] Assistant API Interaction
       - ✓ Creates threads
       - ✓ Adds messages
       - ✓ Creates runs with correct Assistant ID
       - ✓ Polls run status correctly
       - ✓ Handles run timeouts
     - [ ] Response Handling
       - ✓ Parses valid MotionPlan JSON
       - ✓ Rejects malformed JSON
       - ✓ Handles markdown code fences in response
       - ✓ Extracts relevant data from Assistant messages
       - ✓ Handles missing Assistant responses
     - [ ] Error Handling
       - ✓ Catches and wraps OpenAI API errors (auth, rate limit, server errors)
       - ✓ Handles failed/cancelled run statuses
       - ✓ Throws specific error types (`AssistantInteractionError`, `MotionPlanParsingError`)
     - [ ] Configuration
       - ✓ Uses correct API Key and Assistant ID from config
       - ✓ `validateConfiguration` check works
       - ✓ `getCapabilities` check works

   - Scene Interpreter Tests (`SceneInterpreterImpl`)
     - [ ] MotionPlan Processing
       - ✓ Handles empty or invalid `MotionPlan` input
       - ✓ Iterates through steps correctly
       - ✓ Calculates step durations based on `duration_ratio` and total duration
       - ✓ Normalizes durations correctly
     - [ ] Motion Generators (Per Type: `static`, `zoom`, `orbit`, `pan`, `tilt`, `dolly`, `truck`, `pedestal`)
       - ✓ Generates correct `CameraCommand[]` structure (start/end keyframes or intermediate steps for orbit)
       - ✓ Handles valid numerical parameters correctly (angle, factor, distance)
       - ✓ Handles qualitative `distance` parameters correctly (calls `_calculateEffectiveDistance`)
       - ✓ Handles `destination_target` parameter correctly, overriding `distance`
       - ✓ Handles `direction` parameters and aliases correctly
       - ✓ Resolves `target` parameters (current_target, object_center, spatial refs, features) using `_resolveTargetPosition`
       - ✓ Applies `speed` parameter influence on easing correctly
       - ✓ Applies `easing` parameter correctly (uses `d3-ease`)
     - [ ] Constraint Enforcement (Within Generators)
       - ✓ Applies min/max height constraints
       - ✓ Applies min/max distance constraints (relative to target/center where applicable)
       - ✓ Applies bounding box collision avoidance using `_clampPositionWithRaycast`
     - [ ] Helper Functions
       - ✓ `_resolveTargetPosition` works for all target types
       - ✓ `_calculateEffectiveDistance` provides reasonable values for qualitative terms
       - ✓ `_clampPositionWithRaycast` correctly prevents intersection/containment
     - [ ] Command Validation
       - ✓ `validateCommands` correctly detects bounding box violations

   - Three.js Viewer / Animation Controller Tests
     - [ ] Camera animation execution
       - ✓ 60 FPS minimum performance
       - ✓ No visual stuttering
       - ✓ Accurate path following for generated `CameraCommand[]`
     - [ ] Scene rendering
       - ✓ Correct material display
       - ✓ Proper shadow rendering
       - ✓ Maintains scale accuracy
     - [ ] User control responsiveness
       - ✓ < 16ms input latency
       - ✓ Smooth camera control (OrbitControls)
       - ✓ Accurate position updates
     - [ ] Animation playback controls
       - ✓ Frame-accurate seeking
       - ✓ Smooth speed adjustment
       - ✓ Reliable pause/resume
     - [ ] Lock mechanism functionality
       - ✓ Captures position on lock
       - ✓ Validates position before lock
       - ✓ Coordinates with animation state
       - ✓ Handles unlock transitions

   - Feedback & Logging Tests
     - [ ] Input/output logging (Adapter & Interpreter)
       - ✓ Captures prompts, plans, commands, errors
       - ✓ Proper data sanitization
       - ✓ Efficient storage usage
     - [ ] Performance metric collection
       - ✓ < 1% performance impact
       - ✓ Accurate timing data
       - ✓ Proper metric aggregation
     - [ ] User feedback capture
       - ✓ Instant feedback storage
       - ✓ Handles all feedback types
       - ✓ Links to relevant sessions
     - [ ] System health monitoring
       - ✓ Real-time status updates
       - ✓ Accurate error detection
       - ✓ Proper alert triggering

   - End-to-End Pipeline Tests
     - [ ] Complete prompt-to-path flow (API Route -> Adapter -> Interpreter -> Commands)
       - ✓ < N second total processing (Define N based on expectation)
       - ✓ All components integrated correctly
       - ✓ Proper error propagation (e.g., Assistant error, Interpreter error)
     - [ ] Component interaction validation
       - ✓ Clean data handoffs (`MotionPlan`, `CameraCommand`)
       - ✓ No interface violations
       - ✓ Proper state management (initial state used correctly)
     - [ ] Data consistency checks
       - ✓ Correct Scene/Env data passed to Interpreter
       - ✓ No data loss between steps
       - ✓ Proper type validation
     - [ ] Performance benchmarking
       - ✓ Meets latency targets
       - ✓ Resource usage within limits
       - ✓ Scales with load

3. **LLM Provider Integration**
   - [ ] Provider switching (If multiple adapters implemented)
   - [ ] API key validation
   - [ ] Response handling
   - [ ] Error management

4. **Core Features**
   - [ ] Model loading and viewing
   - [ ] Library functionality
   - [ ] User settings persistence

## 🔄 Change Protocol

### High-Risk Changes (Require Full Testing)
1. Any modifications to:
   - Route structure
   - Authentication flow
   - P2P pipeline components
   - LLM provider integration

2. Changes affecting:
   - Data structures
   - API response formats
   - Core state management

### Medium-Risk Changes (Require Specific Testing)
1. UI component updates
2. Non-critical route additions
3. Feature enhancements

### Low-Risk Changes (Regular Testing)
1. Style updates
2. Documentation
3. Error message updates

## 🐛 Troubleshooting Guide

### Common Issues
1. **Authentication Errors**
   - Verify Supabase configuration
   - Check session management
   - Validate environment variables

2. **P2P Pipeline Issues**
   - Check component connections
   - Verify data formats
   - Review error logs
   - Validate environmental metadata
   - Check lock mechanism state
   - Verify animation coordination

3. **LLM Provider Problems**
   - Validate API keys
   - Check provider availability
   - Verify response formats

4. **Lock Mechanism Issues**
   - Verify camera position capture
   - Check lock state transitions
   - Validate animation coordination
   - Review environmental metadata
   - Check position validation rules

### Before Deployment
- [ ] Environment variables configured
- [ ] API endpoints validated
- [ ] Authentication flow tested
- [ ] Core features verified
- [ ] P2P pipeline operational
- [ ] Lock mechanism tested
- [ ] Environmental metadata validated

## 📝 Documentation Requirements

### When Modifying Protected Areas
1. Update relevant documentation
2. Add inline comments for complex logic
3. Update testing requirements if needed
4. Document any new environment variables

### When Adding Features
1. Document integration points
2. Update testing protocols
3. Add usage examples
4. Update deployment checklist if needed 