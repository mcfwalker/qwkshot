# Technical Debt & Future Improvements

## Camera Path Recording

### MediaRecorder Implementation
**Status**: Working with Timer-Based Solution
**Priority**: Low
**Impact**: Functional but not optimal
**Description**: Current implementation uses a timer-based approach instead of responding to actual animation state
**Location**: `src/components/viewer/PlaybackPanel.tsx`
**Current Implementation**:
- Uses `setTimeout` based on animation duration to stop recording
- Adds 100ms buffer to ensure complete capture
- Works reliably but is not technically elegant

**Future Improvements**:
1. Investigate better integration with animation progress
2. Research alternative recording methods:
   - Frame-by-frame capture
   - WebRTC-based solutions
   - Custom MediaRecorder configurations
3. Add handling for edge cases:
   - Animation failures
   - Browser compatibility issues
   - Network/performance issues
4. Improve error handling and recovery

**Reference**: See [Status Report M3DV-SR-2025-03-26-1012](./status-reports/M3DV-SR-2025-03-26-1012.md) for full context
**Notes**:
- Current solution is functional and reliable
- Timer-based approach chosen after issues with MediaRecorder API and canvas stream capture
- Low priority as current implementation meets user needs

## Authentication & Session Management

### ~~Cookie Handling in Server Components~~ (RESOLVED)
- **Issue**: ~~Next.js warning about synchronous cookie access in server components~~
- **Location**: ~~Multiple server components, including `/library` route~~
- **Warning Message**: ~~`cookies()` should be awaited before using its value~~
- **Impact**: ~~Low - Warning only, functionality still works~~
- ~~**Fix Required**:~~ 
  - ~~Update server components to handle cookie access asynchronously~~
  - ~~Implement proper async patterns for `createServerClient`~~
  - ~~Reference: https://nextjs.org/docs/messages/sync-dynamic-apis~~
- ~~**Priority**: Low~~
- **Status**: RESOLVED on March 24, 2025 (see [Status Report M3DV-SR-2025-03-24-1557](./status-reports/M3DV-SR-2025-03-24-1557.md))
- **Solution**: Updated `createServerClient` in `src/lib/supabase-server.ts` to properly await cookies and implemented a custom cookie handler to ensure proper async cookie access

## Development Environment

### Terminal Interaction Issues
- **Issue**: Development server interruptions during AI assistant interactions
- **Location**: Terminal/development environment
- **Current Workaround**: Running server in background mode (`npm run dev &`)
- **Impact**: Medium - Affects development workflow
- **Future Improvement**:
  - Consider implementing a more robust development server script
  - Add process management for background services
  - Improve terminal handling in AI assistant context

### Environment Variable Validation
- **Status**: Implemented and working
- **Current Implementation**:
  - Client-side validation of Supabase credentials
  - Server-side environment checks
  - Automatic validation on startup
- **Future Improvements**:
  - Add more comprehensive validation
  - Implement structured logging
  - Add environment setup verification tools

## Current Workarounds
- ~~Using synchronous cookie access in server components~~
- Running development server in background mode
- Manual monitoring of health checks
- ~~Warning appears in console but doesn't affect functionality~~
- Authentication and session management still working as expected

## Future Improvements
1. ~~Implement proper async cookie handling~~
2. Update server component data fetching patterns
3. Consider implementing a more robust error boundary system
4. Add proper loading states for authentication transitions
5. Improve development server management
6. Enhance environment validation system
7. Add automated health check reporting
8. Document and standardize UI styling patterns:
   - Create guidelines for combining shadcn/ui with custom styles
   - Document common styling solutions and best practices
   - Establish pattern for handling component-specific styles
   - Create reference for ghost-like UI aesthetic implementation

## Branch Management
- Current stable branch established from commit `2b45a92`
- Need to plan migration strategy for feature branches
- Consider making `stable` the default branch
- Document process for handling legacy code

## Notes
- Document created: March 24, 2025
- Last updated: March 24, 2025
- Related issues:
  - Cookie warning in library page
  - Server component async patterns
  - Session management optimization
  - Terminal interaction handling
  - Branch strategy evolution

## High Priority Issues

### ~~1. Cookie Handling in Next.js Routes~~ (RESOLVED)
**Status**: ~~Open~~ Resolved
**Priority**: ~~High~~ Completed
**Impact**: ~~Warning messages in logs and potential performance impact~~
**Description**: ~~Routes using `cookies()` are not properly awaiting the result~~
**Location**: ~~`/library` route~~
**Error Message**: ~~`Route "/library" used cookies().get('sb-mmoqqgsamsewsbocqxbi-auth-token'). cookies() should be awaited before using its value.`~~
**Fix Required**: ~~Update cookie handling to use async/await pattern~~
**Resolution**: Fixed in commit 571ec45 by:
- Updated `createServerClient` to properly await cookie access
- Implemented custom cookie handler for proper async access
- Full details in [Status Report M3DV-SR-2025-03-24-1557](./status-reports/M3DV-SR-2025-03-24-1557.md)
**Related Documentation**: [Authentication Documentation](./features/auth/README.md), [Troubleshooting Guide](./troubleshooting/README.md)

### Performance Optimization: OrbitControls Event Listeners
**Status**: Open
**Priority**: Low
**Impact**: Performance warning in console, potential scroll responsiveness
**Description**: Non-passive event listeners on wheel events in OrbitControls
**Location**: `OrbitControls.js:311`

## Prompt Architecture Documentation
- **Status**: Initial Implementation
- **Priority**: Medium
- **Description**: While we have established a basic prompt architecture documentation structure, there are several areas that could be improved:
  - Need to document common prompt patterns and their use cases
  - Add examples of successful and failed prompts for reference
  - Create guidelines for prompt versioning and updates
  - Document prompt testing and validation procedures
  - Add metrics for prompt effectiveness
- **Impact**: Better documentation will help maintain consistency in prompt engineering and make it easier for new team members to understand the system
- **Proposed Solution**: Create additional documentation sections for patterns, examples, and testing procedures
- **Notes**: This is a new area that will evolve as we gather more experience with different prompt patterns and their effectiveness