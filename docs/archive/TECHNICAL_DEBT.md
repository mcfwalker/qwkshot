# Technical Debt & Future Improvements

> **NOTE**: This document has been migrated to Asana. All active issues have been moved to the project management system. This document is kept for reference only and will be archived.

## Camera Path Recording

### MediaRecorder Implementation
**Status**: ~~Working with Timer-Based Solution~~ MOVED TO ASANA
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
- **Status**: MOVED TO ASANA

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
- **Status**: MOVED TO ASANA

## Current Workarounds
- ~~Using synchronous cookie access in server components~~ (RESOLVED)
- Running development server in background mode
- Manual monitoring of health checks
- ~~Warning appears in console but doesn't affect functionality~~ (RESOLVED)
- Authentication and session management still working as expected

## Future Improvements
1. ~~Implement proper async cookie handling~~ (RESOLVED)
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
- **Status**: MOVED TO ASANA

## Branch Management
- Current stable branch established from commit `2b45a92`
- Need to plan migration strategy for feature branches
- Consider making `stable` the default branch
- Document process for handling legacy code
- **Status**: MOVED TO ASANA

## Notes
- Document created: March 24, 2025
- Last updated: March 29, 2025
- Related issues:
  - Cookie warning in library page (RESOLVED)
  - Server component async patterns (RESOLVED)
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
**Status**: ~~Open~~ MOVED TO ASANA
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
- **Status**: MOVED TO ASANA

## CSS and UI Component Styling
**Status**: Needs Review
**Priority**: Medium
**Impact**: UI consistency and maintainability
**Description**: Current CSS implementation has several issues:
- Complex style overrides and specificity conflicts
- Inconsistent button variant implementations
- Duplicate UI elements appearing in some components
- Lack of systematic approach to component styling

**Location**: Multiple components, primarily:
- `src/components/ui/button.tsx`
- `src/components/viewer/CameraAnimationSystem.tsx`
- `src/components/viewer/FloorControls.tsx`

**Current Implementation**:
- Using a mix of Tailwind utilities and custom CSS
- Button variants defined in `buttonVariants` cva
- Component-specific style overrides

**Future Improvements**:
1. Implement a comprehensive style guide
2. Review and simplify CSS architecture
3. Standardize component styling patterns
4. Create documentation for variant usage
5. Consider implementing a design system
6. Add visual regression testing

**Reference**: See [Status Report M3DV-SR-2025-03-27-1031](./status-reports/M3DV-SR-2025-03-27-1031.md)
**Notes**:
- Current solution works but needs better organization
- Consider creating a UI component library
- Need better documentation for styling patterns
- **Status**: MOVED TO ASANA

## Vercel Deployment

### Linting and Type Checking During Build
**Status**: ~~Temporarily Disabled~~ MOVED TO ASANA
**Priority**: High
**Impact**: Technical debt, potential issues in production
**Description**: ESLint and TypeScript validation had to be disabled during the build process to successfully deploy to Vercel
**Location**: `next.config.js`
**Current Implementation**:
```js
eslint: {
  // Disabled ESLint during build process
  ignoreDuringBuilds: true,
},
typescript: {
  // Disabled TypeScript checking during build
  ignoreBuildErrors: true,
},
```
**Fix Required**: 
- Address all 73+ ESLint/TypeScript errors properly
- Re-enable linting and type checking in the build process
- Document common patterns that cause linting issues

**Reference**: See [Status Report M3DV-SR-2025-03-28-1623](./status-reports/M3DV-SR-2025-03-28-1623.md)

### Synchronous Cookie Access in API Routes
**Status**: ~~Open~~ MOVED TO ASANA
**Priority**: Medium
**Impact**: Warnings, potential issues in production
**Description**: Multiple API routes still use synchronous cookie access despite the fix in server components
**Location**: Multiple API routes including `/api/dev-info`
**Warning Message**: `Route "/api/dev-info" used cookies().get(...). cookies() should be awaited before using its value.`
**Current Implementation**:
- API routes are using cookies synchronously via Supabase auth helpers
- Warning messages appear in logs but functionality works
**Fix Required**:
- Update all API routes to properly await cookie access
- Update `createRouteSupabaseClient` to properly handle async cookies
- Follow patterns established in the server component fix

**Reference**: See [Status Report M3DV-SR-2025-03-28-1623](./status-reports/M3DV-SR-2025-03-28-1623.md)

### Static vs. Dynamic Route Rendering
**Status**: ~~Using Workarounds~~ MOVED TO ASANA
**Priority**: Medium
**Impact**: Affects maintainability and performance
**Description**: Several routes need to be marked as `force-dynamic` to prevent static rendering errors with cookies
**Location**: All authenticated routes
**Current Implementation**:
```js
export const dynamic = 'force-dynamic'; // Added to routes using cookies
```
**Fix Required**:
- Better understand Next.js 15 rendering patterns
- Implement a more strategic approach to dynamic vs. static routes
- Consider using route groups or other Next.js patterns to better organize rendering strategies
- Evaluate performance implications of forcing dynamic rendering

**Reference**: See [Status Report M3DV-SR-2025-03-28-1623](./status-reports/M3DV-SR-2025-03-28-1623.md)

### Suspense Boundaries for useSearchParams
**Status**: ~~Implemented but needs review~~ MOVED TO ASANA
**Priority**: Medium
**Impact**: Required for build, potential UX issues
**Description**: Components using `useSearchParams` needed Suspense boundaries to prevent hydration errors
**Location**: All routes using search parameters, including `/auth/sign-in`
**Current Implementation**:
```jsx
<Suspense fallback={<div>Loading...</div>}>
  <ComponentUsingSearchParams />
</Suspense>
```
**Fix Required**:
- Review all implementations of Suspense boundaries
- Add proper loading states for better UX
- Ensure consistent implementation across components

**Reference**: See [Status Report M3DV-SR-2025-03-28-1623](./status-reports/M3DV-SR-2025-03-28-1623.md)

### Serverless Function Timeouts
**Status**: ~~Increased but requires review~~ MOVED TO ASANA
**Priority**: High
**Impact**: Affects reliability of LLM API calls
**Description**: LLM API routes exceed default 10-second Vercel timeout
**Location**: API routes for camera path generation and LLM interactions
**Current Implementation**:
- Manually increased timeouts in Vercel dashboard
- No fallback mechanisms for slow responses
**Fix Required**:
- Implement proper streaming responses for LLM calls
- Add timeout handling and recovery strategies
- Consider implementing background queue for long-running tasks
- Add client-side timeout handling and retry logic

**Reference**: See [Status Report M3DV-SR-2025-03-28-1623](./status-reports/M3DV-SR-2025-03-28-1623.md)

### Force Reload After Provider Switching
**Status**: ~~Working but not optimal~~ MOVED TO ASANA
**Priority**: Low
**Impact**: Affects user experience
**Description**: Provider switching requires a full page reload to ensure state consistency
**Location**: Admin panel
**Current Implementation**:
- Forcing page reload after provider change
- Loses client-side state during reload
**Fix Required**:
- Implement event-based state updates
- Improve client-side state management
- Consider using React context or global state solution

**Reference**: See [Status Report M3DV-SR-2025-03-28-1623](./status-reports/M3DV-SR-2025-03-28-1623.md)

## Notes
- Document created: March 24, 2025
- Last updated: April 5, 2025
- Related issues:
  - Cookie warning in API routes (MOVED TO ASANA)
  - Build-time linting errors (MOVED TO ASANA)
  - Static vs. dynamic rendering conflicts (MOVED TO ASANA)
  - Suspense boundary implementation (MOVED TO ASANA)
  - Serverless function timeouts (MOVED TO ASANA)
  - State management across server/client boundary (MOVED TO ASANA)