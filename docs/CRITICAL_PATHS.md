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

### 3. P2P Pipeline Components (`src/features/p2p/*`)
- **Core Components**:
  - Scene Analyzer
    - Spatial analysis
    - Safety zones calculation
    - Reference point extraction
  - Environmental Analyzer
    - Environment bounds validation
    - Camera constraints definition
    - Movement boundaries
    - Camera position validation through lock mechanism
  - Metadata Manager
    - User preferences and settings
    - Scene analysis data persistence
    - Feature point tracking
    - Environmental metadata storage and retrieval
  - Prompt Compiler
    - System and user prompt merging
    - Scene metadata integration
    - Safety constraint embedding
  - LLM Engine
    - Provider management and switching
    - Response validation and parsing
    - Error handling and retries
  - Scene Interpreter (In Development)
    - Camera segment parsing
    - Motion interpolation
    - Safety validation
  - Three.js Viewer
    - Camera animation execution
    - Scene visualization
    - Path preview and controls
    - Lock mechanism for camera position capture
    - Animation playback with lock state coordination
  - Feedback & Logging Layer
    - Input/output logging
    - Performance metrics
    - User feedback collection
  - Changes here affect the entire pipeline flow
  - Must maintain data structure consistency between components
  - Requires thorough testing of component interactions

### 4. Authentication (`src/lib/supabase-server.ts`)
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
     - [ ] Supabase integration
       - ✓ Handles network interruptions
       - ✓ Maintains data consistency
       - ✓ Efficient batch operations
     - [ ] Analysis data persistence
       - ✓ Complete data recovery
       - ✓ Version control for updates
       - ✓ Handles large datasets
     - [ ] Environmental metadata handling
       - ✓ Stores camera position on lock
       - ✓ Retrieves metadata for path generation
       - ✓ Maintains metadata consistency
       - ✓ Handles metadata updates

   - Prompt Compiler Tests
     - [ ] System/user prompt merging
       - ✓ Maintains prompt hierarchy
       - ✓ Preserves all constraints
       - ✓ Handles multi-part prompts
     - [ ] Scene metadata integration
       - ✓ Includes all required context
       - ✓ Updates with scene changes
       - ✓ Efficient metadata formatting
     - [ ] Token length management
       - ✓ Stays under model limits
       - ✓ Preserves critical information
       - ✓ Handles truncation gracefully
     - [ ] Safety constraint inclusion
       - ✓ All constraints represented
       - ✓ Priority ordering maintained
       - ✓ Clear constraint formatting
     - [ ] Start position context
       - ✓ Accurate position encoding
       - ✓ Handles all coordinate spaces
       - ✓ Updates with position changes

   - LLM Engine Tests
     - [ ] Provider switching functionality
       - ✓ Sub-second switch time
       - ✓ Maintains session state
       - ✓ Handles API key validation
     - [ ] API request/response handling
       - ✓ < 500ms average latency
       - ✓ Proper error propagation
       - ✓ Handles rate limiting
     - [ ] Response validation
       - ✓ Catches all malformed responses
       - ✓ Validates JSON structure
       - ✓ Handles partial responses
     - [ ] Error handling and recovery
       - ✓ Auto-retries on temporary errors
       - ✓ Graceful provider fallback
       - ✓ Clear error messaging
     - [ ] Keyframe data parsing
       - ✓ Validates all required fields
       - ✓ Handles complex paths
       - ✓ Efficient parsing of large responses

   - Scene Interpreter Tests
     - [ ] Camera segment parsing
       - ✓ Supports all movement types
       - ✓ Validates segment connections
       - ✓ Handles complex sequences
     - [ ] Motion interpolation
       - ✓ 60 FPS smooth playback
       - ✓ Accurate spline generation
       - ✓ Maintains target focus
     - [ ] Path safety validation
       - ✓ No safety violations
       - ✓ Smooth collision avoidance
       - ✓ Maintains minimum distances
     - [ ] Easing/duration handling
       - ✓ Natural acceleration/deceleration
       - ✓ Accurate timing control
       - ✓ Smooth speed transitions
     - [ ] Lock mechanism validation
       - ✓ Validates camera position on lock
       - ✓ Handles lock state transitions
       - ✓ Coordinates with animation playback

   - Three.js Viewer Tests
     - [ ] Camera animation execution
       - ✓ 60 FPS minimum performance
       - ✓ No visual stuttering
       - ✓ Accurate path following
     - [ ] Scene rendering
       - ✓ Correct material display
       - ✓ Proper shadow rendering
       - ✓ Maintains scale accuracy
     - [ ] Path preview functionality
       - ✓ Real-time path updates
       - ✓ Clear visual indicators
       - ✓ Interactive manipulation
     - [ ] User control responsiveness
       - ✓ < 16ms input latency
       - ✓ Smooth camera control
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
     - [ ] Input/output logging
       - ✓ Captures all interactions
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
     - [ ] Training data flagging
       - ✓ Correct classification
       - ✓ Efficient data extraction
       - ✓ Proper version tracking
     - [ ] System health monitoring
       - ✓ Real-time status updates
       - ✓ Accurate error detection
       - ✓ Proper alert triggering

   - End-to-End Pipeline Tests
     - [ ] Complete prompt-to-path flow
       - ✓ < 5 second total processing
       - ✓ All components integrated
       - ✓ Proper error propagation
     - [ ] Component interaction validation
       - ✓ Clean data handoffs
       - ✓ No interface violations
       - ✓ Proper state management
     - [ ] Data consistency checks
       - ✓ No data loss between steps
       - ✓ Proper type validation
       - ✓ Version compatibility
     - [ ] Error propagation handling
       - ✓ Clear error sources
       - ✓ Proper cleanup on failure
       - ✓ Useful error messages
     - [ ] Performance benchmarking
       - ✓ Meets latency targets
       - ✓ Resource usage within limits
       - ✓ Scales with load

3. **LLM Provider Integration**
   - [ ] Provider switching
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