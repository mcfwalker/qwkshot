### **Content for: `TECHNICAL_DESIGN.md` (New File)**

```markdown
# Modern 3D Viewer - Technical Design Document

This document details the technical architecture, implementation specifics, and design decisions for the Modern 3D Viewer application. It complements the [Product Requirements Document](./PRD.md).

## 1. Frontend Architecture

### 1.1. Framework & Language
- **Framework:** Next.js 15.2.3 (App Router)
- **Language:** TypeScript
- **UI Libraries:**
  - React 19
  - Radix UI components
  - Framer Motion for animations
  - Sonner for toast notifications
  - Tailwind CSS for styling

### 1.2. Project Structure (Current)
```
src/
├── app/
│   ├── layout.tsx           # Main app layout
│   ├── page.tsx            # Landing page
│   ├── auth/               # Authentication routes
│   │   ├── layout.tsx
│   │   ├── sign-in/
│   │   └── callback/
│   ├── (protected)/        # Protected routes
│   │   ├── viewer/
│   │   ├── library/
│   │   └── generate/
│   └── api/                # API routes
├── components/
│   ├── ui/                 # Reusable UI components
│   └── viewer/             # Viewer-specific components
│       ├── Viewer.tsx               # Primary R3F viewer component (ACTIVE for main route)
│       ├── ModelViewerClient.tsx    # Older vanilla Three.js viewer (May be used elsewhere or deprecated)
│       ├── LockButton.tsx             # Added
│       ├── ShotCallerPanel.tsx        # Added
│       ├── PlaybackPanel.tsx          # Added
│       ├── AnimationController.tsx    # Added
│       └── ...                 
├── features/               # Feature-specific code
├── lib/                    # Shared utilities
├── store/                  # State management
└── types/                  # TypeScript types
```

### 1.3. State Management
- **Library:** Zustand (or similar lightweight global state manager)
- **Approach:** Centralized store for global viewer state (e.g., current model, camera settings, UI state), potentially combined with local component state or React Context for more localized needs.

```typescript
// Example Zustand Store Interface (illustrative)
interface ViewerState {
  // Scene State
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  // ... other Three.js core objects

  // Model State
  currentModelId: string | null;
  isModelLoading: boolean;
  // ... methods to load/unload models

  // Camera Path State
  activeCameraPath: CameraPath | null;
  isAnimating: boolean;
  // ... methods for path generation/playback

  // UI State
  activeSidebarTab: string | null;
  // ... methods to control UI visibility/state
}

// const useViewerStore = create<ViewerState>((set, get) => ({ ... }));
```

### 1.4. Data Mutation Patterns
- **Primary Approach:** Use Next.js Server Actions (`src/app/actions/...`) for all client-initiated data mutations (creating, updating, deleting data).
- **Benefits:**
  - Colocates client calls and server logic.
  - Provides clear separation of concerns (client prepares data, server validates and persists).
  - Leverages Next.js infrastructure for security and data handling.
  - Simplifies client-side logic (no manual `fetch` calls needed for actions).
- **Specific Implementations:**
    - **Model Upload & Metadata:** The `ModelLoader.tsx` component calls the `prepareModelUpload` Server Action in `src/app/actions/models.ts`. This action handles:
        - Creating an initial `models` table record.
        - Generating a signed URL for client-side file upload directly to storage.
        - Calling the server-side `MetadataManager` to store the full `ModelMetadata` (including `sceneAnalysis`) using the appropriate database adapter logic (saving to `metadata` and `scene_analysis` columns).
    - **Environmental Metadata:** The `CameraAnimationSystem.tsx` component calls the `updateEnvironmentalMetadataAction` Server Action in `src/app/actions/models.ts` when the scene is locked. This action handles:
        - Calling the server-side `MetadataManager` to update/store the `EnvironmentalMetadata` (which includes camera state and `userVerticalAdjustment`) in the `models` table (`environmental_metadata` column).
    - **Other Mutations (Example):** Simpler updates like changing a model name might still use Supabase RPC functions called directly from Server Actions if complex validation/logic resides in the database.
- **Client Usage (Server Action Example):**
```typescript
// Inside a Client Component (e.g., handleSaveModel)
import { prepareModelUpload } from '@/app/actions/models';
// ...
const result = await prepareModelUpload({ /* ...args... */ });
if (result.error) { /* handle error */ }
// Use result.signedUploadUrl for client-side storage upload
```

### 1.5. Cache Management
- **Strategy:** Multi-path revalidation with delayed navigation
- **Implementation:**
  - Use Next.js's `revalidatePath` for cache invalidation
  - Parallel revalidation for related routes
  - Delayed navigation to ensure data consistency
- **Example:**
```typescript
// Revalidate multiple paths in parallel
await Promise.all([
  fetch('/api/revalidate?path=/library', { method: 'POST' }),
  fetch(`/api/revalidate?path=/library/edit/${modelId}`, { method: 'POST' })
])
router.refresh()
await new Promise(resolve => setTimeout(resolve, 500))
```

### 1.6. Error Handling Strategy
- **Client-Side:**
  - Use React Error Boundaries for component tree errors
  - Handle RPC errors with proper user feedback
  - Implement loading states and progress indicators
  - Use toast notifications for user feedback
  - Use tooltips to explain the reason for disabled interactive elements
  - Handle animation state errors with clear user guidance
  - Provide contextual help for lock state requirements
  - Implement graceful fallbacks for animation playback

- **Server-Side:**
  - Implement RPC functions with proper validation
  - Return appropriate HTTP status codes
  - Include CORS headers in all responses
  - Log errors with sufficient context
  - Validate environmental metadata integrity
  - Ensure proper lock state synchronization

- **Database:**
  - Use RPC functions for data validation
  - Implement proper error messages
  - Handle transactions appropriately
  - Verify ownership before operations
  - Maintain data consistency for environmental metadata

- **Animation-Specific Error Handling:**
  ```typescript
  // Example error handling for animation playback
  const handleAnimationError = (error: AnimationError) => {
    switch (error.type) {
      case 'lock_state':
        if (error.requiresUnlock) {
          toast.error('Please unlock the scene to play the animation', {
            action: {
              label: 'Unlock',
              onClick: () => handleLockToggle()
            }
          });
        }
        break;
      case 'position_validation':
        toast.error('Invalid camera position. Please adjust the view.');
        break;
      case 'path_generation':
        toast.error('Failed to generate animation path. Please try again.');
        break;
      case 'playback':
        toast.error('Animation playback failed. Please try again.');
        break;
    }
  };

  // Example validation for animation state
  const validateAnimationState = (state: AnimationState): ValidationResult => {
    if (state.isLocked && !state.hasValidPosition) {
      return {
        isValid: false,
        error: 'Please set a valid camera position before locking',
        details: {
          type: 'lock_state',
          requiresUnlock: false
        }
      };
    }
    return { isValid: true };
  };
  ```

- **UX Considerations:**
  - Provide clear feedback about lock state requirements
  - Offer contextual help for animation playback (including tooltips on disabled elements)
  - Implement graceful degradation for locked state
  - Consider auto-unlock options for better UX
  - Maintain state consistency across components
  - Handle edge cases in animation transitions

### 1.7. 3D Rendering
- **Library:** Three.js
- **Integration:** Using `@react-three/fiber` and `@react-three/drei` for declarative scene graph management within React components.

## 2. UI Implementation Details

*(Extracted code examples from original PRD Section 4)*

### 2.1. Overall Application Layout Example
```tsx
// Example: src/app/layout.tsx or a nested layout
import { ThemeProvider } from '@/components/providers/theme-provider';
import { AuthProvider } from '@/components/providers/auth-provider'; // Example
// ... other imports

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider> {/* Hypothetical */}
            <div className="h-screen flex flex-col">
              <header className="border-b h-14 flex items-center px-4">
                {/* Header Content: Logo, Nav, User Menu */}
              </header>
              <div className="flex-1 flex overflow-hidden">
                {/* Sidebar (optional, context-dependent) */}
                <aside className="w-80 border-r p-4 overflow-y-auto">
                  {/* Control Panels */}
                </aside>
                {/* Main Content Area */}
                <main className="flex-1 relative">
                  {children} {/* Or specific Viewer Canvas component */}
                </main>
              </div>
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### 2.2. Example Control Panel (shadcn/ui)
```tsx
// Example: src/components/viewer/ModelControls.tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
// ... other imports (hooks for state)

const ModelControls = () => {
  // const { models, currentModelId, setCurrentModelId } = useViewerStore(); // Example state access

  return (
    <Card>
      <CardHeader>
        <CardTitle>Model Controls</CardTitle>
        <CardDescription>Adjust model settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="model-select">Select Model</Label>
          <Select
            // value={currentModelId}
            // onValueChange={setCurrentModelId}
          >
            <SelectTrigger id="model-select">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {/* {models.map(model => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))} */}
              <SelectItem value="placeholder1">Placeholder Model 1</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Other controls: Textures, Variants, etc. */}
      </CardContent>
    </Card>
  );
};
```
*(Similar detailed examples for Camera Path Controls, Terrain Options, AI Path Generation Interface would follow here, extracted from the original PRD)*

### 2.3 UI Component Styling
- Primarily use Tailwind CSS utility classes.
- Leverage `shadcn/ui` component primitives and styling conventions.
- Define custom styles or overrides in `globals.css` or component-specific CSS modules where necessary.
- Maintain themeability (light/dark modes).
*(See also: [UI Documentation](./docs/UI/README.md))*

## 3. Authentication Architecture

### 3.1. Provider
- Supabase Auth

### 3.2. Client Setup
```typescript
// src/lib/supabase.ts (Client Components)
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/supabase' // Assuming type generation
export const supabase = createClientComponentClient<Database>()

// src/lib/supabase-server.ts (Server Components/Actions/Route Handlers)
import { createServerComponentClient, createRouteHandlerClient, createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

export const createServerSupabaseClient = () => {
  return createServerComponentClient<Database>({ cookies })
}

export const createRouteHandlerSupabaseClient = () => {
  // Ensure cookies are mutable if needed in Route Handlers
  return createRouteHandlerClient<Database>({ cookies })
}

export const createServerActionSupabaseClient = () => {
  // Ensure cookies are mutable if needed in Server Actions
  return createServerActionClient<Database>({ cookies })
}
```
*(Note: Updated structure based on recent Supabase helpers)*

### 3.3. Authentication Flow
1. User attempts access to a protected route.
2. Middleware (`src/middleware.ts`) intercepts the request.
3. Middleware checks for a valid session using `createMiddlewareClient`.
4. If no valid session, redirect to the sign-in page (`/auth/sign-in`), potentially passing the intended destination as a query parameter (`redirectTo`).
5. User authenticates via Email/Password or OAuth provider (e.g., Google).
6. **Email/Password:** Server Action or API route handles sign-in, sets session cookies.
7. **OAuth:** User is redirected to the provider, then back to the defined callback URL (`/auth/callback`).
8. **Callback Route Handler (`src/app/auth/callback/route.ts`):** Exchanges the OAuth code for a session using `createRouteHandlerClient`, sets session cookies.
9. User is redirected from sign-in/callback to their original destination (`redirectTo`) or a default page (e.g., `/viewer`).

### 3.4. Middleware for Protected Routes
```typescript
// src/middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const { data: { session } } = await supabase.auth.getSession()

  const { pathname } = req.nextUrl

  // Defined Protected Routes:
  // - /library/*
  // - /viewer/*
  // - /generate/* 
  // - Any route within (protected) group
  const isProtectedRoute = pathname.startsWith('/viewer') || pathname.startsWith('/library') || pathname.startsWith('/generate');

  if (!session && isProtectedRoute) {
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = '/auth/sign-in'
      redirectUrl.searchParams.set(`redirectTo`, pathname)
      return NextResponse.redirect(redirectUrl)
  }

  // Redirect authenticated users away from auth pages
  if (session && pathname.startsWith('/auth/sign-in')) {
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = '/library' // Or use redirectTo param if present
      redirectUrl.search = '' // Clear search params like redirectTo
      return NextResponse.redirect(redirectUrl)
  }

  return res
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - /api/auth (allow auth api routes) - Adjust if needed
     */
    '/((?!_next/static|_next/image|favicon.ico|api/auth).*)',
  ],
}
```

### 3.5. Sign-In Page Implementation
- Use client components for interactivity.
- Employ `useState` for form inputs (email, password) and loading/error states.
- Use `useRouter` for navigation.
- Implement handlers for email/password sign-in and OAuth provider sign-in, calling Supabase client methods.
- Display user-friendly error messages (e.g., using toasts).
- Optionally use `onAuthStateChange` listener for reactive redirects upon successful sign-in, although redirects from handlers/middleware are often sufficient.

### 3.6. OAuth Callback Route Handler
```typescript
// src/app/auth/callback/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirectTo = requestUrl.searchParams.get('state') || '/viewer' // Updated default

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    try {
      await supabase.auth.exchangeCodeForSession(code)
    } catch (error) {
      console.error("OAuth code exchange failed:", error)
      // Redirect to an error page or sign-in page with error message
      return NextResponse.redirect(`${requestUrl.origin}/auth/sign-in?error=OAuth+failed`)
    }
  } else {
     console.error("OAuth callback called without code.")
     // Redirect to sign-in page with error message
     return NextResponse.redirect(`${requestUrl.origin}/auth/sign-in?error=OAuth+callback+error`)
  }

  // Redirect back to the app, ensuring it's a relative path within the origin
  const safeRedirectPath = redirectTo.startsWith('/') ? redirectTo : '/viewer'; // Updated default
  return NextResponse.redirect(`${requestUrl.origin}${safeRedirectPath}`)
}
```
*(Note: Using `state` parameter for `redirectTo` is a common pattern)*

### 3.7. Security Implementation Details
- Rely on Supabase Auth's secure HTTPOnly cookies for session management
- Ensure CORS protection with proper headers
- Validate and sanitize user inputs on server-side (API routes, Server Actions)
- Implement Rate Limiting on sensitive API endpoints
- Use RPC functions with `security definer` for sensitive operations
- Perform environment variable validation on startup
- Verify model ownership in database functions

*(See also: [Storage Security Documentation](../features/storage/README.md))*

## 4. API Structure

- **Primary Mechanism:** Utilize Next.js Server Actions (`src/app/actions/...`) for handling client requests that involve data persistence or complex backend logic.
- **Alternative:** API Routes (`src/app/api/...`) can be used for standard RESTful endpoints, webhook handlers, or specific cases where Server Actions are not suitable.
- **Database Interaction Layer:**
    - Server Actions and API Routes SHOULD interact with the database via the `MetadataManager` abstraction layer (`src/features/p2p/metadata-manager/`).
    - The `MetadataManager` uses a `DatabaseAdapter` (currently `SupabaseAdapter`) to handle the specific database operations.
    - **Instantiation:** Server-side components (Actions, API Routes) obtain `MetadataManager` instances via the `MetadataManagerFactory`, typically requesting the **service role client** for necessary permissions.

### 4.1 Server Actions
- **Purpose:** Handle client-initiated operations like saving models, updating environmental metadata, generating paths (if moved server-side later).
- **Location:** `src/app/actions/`
- **Implementation:**
    - Marked with `'use server';`.
    - Use `createServerActionClient` from `@supabase/auth-helpers-nextjs` for user-context operations if needed, or directly use the service role client via the `MetadataManager` for elevated privilege tasks.
    - Perform necessary validation on input arguments.
    - Call appropriate `MetadataManager` methods.
    - Return results or errors to the client.
- **Examples:**
    - `prepareModelUpload` (in `models.ts`): Coordinates initial record creation, signed URL generation, and full metadata storage.
    - `updateEnvironmentalMetadataAction` (in `models.ts`): Updates the environmental metadata for a given model.

### 4.2 API Routes
- **Purpose:** Handle camera path generation (`/api/camera-path`), system info/health checks (`/api/system/...`), authentication callbacks (`/api/auth/callback`).
- **Implementation:**
    - Use Route Handlers (GET, POST, etc.).
    - Use `createRouteHandlerClient` or `createServerComponentClient` (if applicable) for Supabase interactions.
    - Implement necessary authentication checks.
    - Standardize request validation and response formats.

### 4.3 Database Storage (`models` Table)
- **Metadata Storage:** Model-specific metadata is stored across multiple columns for clarity and potential query performance:
    - `metadata` (jsonb): Stores general metadata fields like `orientation`, `preferences`, `geometry`, `performance_metrics` (excluding `sceneAnalysis`).
    - `scene_analysis` (jsonb): Stores the detailed, serialized `SceneAnalysis` object generated during model processing (reflecting the **normalized** geometry).
    - `environmental_metadata` (jsonb): Stores the latest camera/environment state captured when the scene is locked (including `userVerticalAdjustment`).
- **Adapter Logic (`SupabaseAdapter.ts`):
    - `storeModelMetadata`:** Separates the `sceneAnalysis` from the rest of the `ModelMetadata` object and saves them to the `scene_analysis` and `metadata` columns respectively in a single `update` call.
    - `getModelMetadata`:** Selects `id`, `created_at`, `metadata`, `scene_analysis`, `user_id`, `file_url` and reconstructs the full `ModelMetadata` object, combining data from the `metadata` and `scene_analysis` columns.
    - `storeEnvironmentalMetadata`/`updateEnvironmentalMetadata`: Target the dedicated `environmental_metadata` column.

## 5. Feature Specifications (Data Structures)

### 5.1. P2P Pipeline Architecture
- **Overview:** Translates user prompts into camera commands. Leverages the OpenAI Assistants API for planning and a deterministic Scene Interpreter which uses crucial local context (`SceneAnalysis` and `EnvironmentalAnalysis` - including the final `userVerticalAdjustment`) for accurate geometric execution.
- **Client Interaction:**
    - **Model Processing/Saving:** Client (`ModelLoader`) runs analysis via `P2PPipeline.processModel`, then calls `prepareModelUpload` Server Action with results and file info. Client uploads file directly to storage using signed URL from action response.
    - **Environment Saving:** Client (`CameraAnimationSystem`) calls `updateEnvironmentalMetadataAction` Server Action on lock, passing current camera state and `userVerticalAdjustment` (user's manual offset) in the metadata payload.
    - **Path Generation:** Client (`CameraAnimationSystem`) calls `/api/camera-path` API route with prompt, duration, and model ID.
- **Backend Flow (`/api/camera-path`):**
    1. Route handler receives request.
    2. Initializes server-side components (`MetadataManager`).
    3. Calls `MetadataManager.getModelMetadata` (fetches from `metadata` and `scene_analysis` columns) and `MetadataManager.getEnvironmentalMetadata` (fetches locked state including camera state and `userVerticalAdjustment`).
    4. Calls `deserializeSceneAnalysis` (utility function) on fetched `scene_analysis` data to get `SceneAnalysis` object.
    5. Constructs `initialCameraState` from fetched environmental metadata.
    6. Instantiates the `OpenAIAssistantAdapter` (LLM Engine implementation) with necessary configuration (API Key, Assistant ID).
    7. Calls `adapter.generatePlan(prompt, duration)`, which handles interaction with the OpenAI Assistants API:
        - Creates a thread.
        - Adds the user message (prompt).
        - Creates and polls a run using the configured Assistant ID.
        - The Assistant uses its instructions and the associated Motion KB file (via Retrieval) to generate a structured `MotionPlan` JSON.
        - The adapter parses and validates the `MotionPlan` JSON response.
    8. Instantiates the `SceneInterpreterImpl`.
    9. Calls `interpreter.interpretPath(motionPlan, sceneAnalysis, environmentalAnalysis, initialCameraState)`. The interpreter:
        - Processes the `MotionPlan` steps sequentially.
        - Resolves targets: Handles `'current_target'`. Resolves geometric landmarks (e.g., 'object_center', 'object_top_center') **using the normalized coordinates from `SceneAnalysis` and applying the `userVerticalAdjustment` from the provided `EnvironmentalAnalysis` to the Y coordinate**, ensuring alignment with the user-adjusted visual model.
        - **Handles quantitative/qualitative/goal parameters (with priority):**
            *   Uses helper functions like `_normalizeDescriptor`, `_mapDescriptorToValue`, and `_mapDescriptorToGoalDistance`.
            *   **`fly_away` Priority (Placeholder):**
                1.  `distance_override`
                2.  `distance_descriptor` (Maps via `_mapDescriptorToValue`)
        - Applies constraints and easing.
        - Generates `CameraCommand[]` (keyframes).
    10. Calls `interpreter.validateCommands` passing the generated commands and the **normalized** bounding box from `SceneAnalysis`.
    11. If validation fails (e.g., bounding box violation), returns specific 422 error.
    12. Otherwise, returns final serialized `CameraCommand[]` to client (or other error).

## 6. External Integrations

### 6.1. AI Services
- **OpenAI Assistants API:** Used for camera path *planning*.
  - Integration via `openai` package (using Assistants API features: threads, runs, messages, retrieval).
  - An `OpenAIAssistantAdapter` implements the internal `MotionPlannerService` interface.
  - Adapter handles interaction, polling, and parsing the structured `MotionPlan` response based on the configured Assistant ID and its associated Motion KB.
  - Manages API errors and rate limits (basic handling).

- **Google Generative AI:** Potentially used for other AI features like scene analysis or initial model generation concepts (Verify specific usage).
  - Integration via `@google/generative-ai` package.
  - Handles prompt construction and response parsing for its specific tasks.

### 6.2. Model Generation Service
- **Purpose:** Convert images to 3D models.
- **Implementation:**
    - Use official SDK or standard HTTP requests.
    - Store API key securely.
    - Implement service layer abstracting API calls (submit job, check status, download result).
    - Handle asynchronous nature: submit job -> poll status -> process result.
    - Implement robust error handling for API failures, processing errors.
    - Manage temporary storage for source images if needed.
    - Securely transfer generated models to our Supabase storage.

```typescript
// Example service structure (Illustrative)
// src/lib/model-generation-service.ts
const MODEL_GEN_API_KEY = process.env.MODEL_GEN_API_KEY;
const MODEL_GEN_API_URL = 'https://api.examplemodelgen.com/v1'; // Hypothetical

interface SubmitJobResponse { jobId: string; estimatedTime?: number; }
interface JobStatusResponse { status: 'pending' | 'processing' | 'complete' | 'failed'; progress?: number; resultUrl?: string; error?: string; }

export async function submitImageToModelJob(imageFiles: File[], params: GenerationParams): Promise<SubmitJobResponse> {
  const formData = new FormData();
  imageFiles.forEach(file => formData.append('images', file));
  formData.append('params', JSON.stringify(params));

  const response = await fetch(`${MODEL_GEN_API_URL}/generate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${MODEL_GEN_API_KEY}` },
    body: formData,
  });
  if (!response.ok) throw new Error(`Model generation submission failed: ${response.statusText}`);
  return await response.json();
}

export async function checkModelGenerationStatus(jobId: string): Promise<JobStatusResponse> {
  const response = await fetch(`${MODEL_GEN_API_URL}/status/${jobId}`, {
    headers: { 'Authorization': `Bearer ${MODEL_GEN_API_KEY}` },
  });
  if (!response.ok) throw new Error(`Failed to check job status: ${response.statusText}`);
  return await response.json();
}

// Add function to download result and upload to Supabase storage
```

## 8. Testing Strategy Implementation
- **Framework:** Vitest with React Testing Library
- **Environment:** JSDOM for browser environment simulation
- **Coverage:** Using `@vitest/coverage-v8` for code coverage reporting
- **Component Testing:** `@testing-library/react` for component testing
- **Test Organization:** Tests are located in `__tests__` directory with a global setup file
- **Configuration:** Vitest config includes path aliases and JSDOM environment setup

```typescript
// Example test structure for P2P components
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SceneInterpreterImpl } from '@/features/p2p/scene-interpreter/interpreter';
import { OpenAIAssistantAdapter } from '@/lib/motion-planning/providers/openai-assistant';

describe('P2P Pipeline Integration (Conceptual Example)', () => {
  let sceneInterpreter: SceneInterpreterImpl;
  let assistantAdapter: OpenAIAssistantAdapter;
  // Mock dependencies like MetadataManager, OpenAI API client
  const mockOpenAI = { /* ... mock methods ... */ };
  const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  const mockAdapterConfig = { apiKey: 'test', assistantId: 'test-id' };
  const mockInterpreterConfig = { /* ... */ };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Initialize components with mocks
    assistantAdapter = new OpenAIAssistantAdapter(mockAdapterConfig);
    // Potentially mock internal openai client if needed for specific tests
    // assistantAdapter.openai = mockOpenAI as any; 

    sceneInterpreter = new SceneInterpreterImpl(mockInterpreterConfig, mockLogger);
    // Mock MetadataManager, etc.
  });

  it('should generate commands from a prompt', async () => {
    // Arrange
    const userPrompt = "Orbit left 90 degrees";
    const mockMotionPlan: MotionPlan = { steps: [/* ... */] }; 
    const mockCameraCommands: CameraCommand[] = [/* ... */];

    // Mock adapter response
    const generatePlanSpy = vi.spyOn(assistantAdapter, 'generatePlan').mockResolvedValue(mockMotionPlan);
    // Mock interpreter response
    const interpretPathSpy = vi.spyOn(sceneInterpreter, 'interpretPath').mockReturnValue(mockCameraCommands);
    
    // Act (Simulate API route logic)
    // 1. Call adapter
    const motionPlan = await assistantAdapter.generatePlan(userPrompt);
    // 2. Call interpreter (using mock scene/env data)
    const commands = sceneInterpreter.interpretPath(motionPlan, mockSceneAnalysis, mockEnvAnalysis, mockInitialState);

    // Assert
    expect(generatePlanSpy).toHaveBeenCalledWith(userPrompt, undefined); // Or with duration
    expect(interpretPathSpy).toHaveBeenCalledWith(motionPlan, mockSceneAnalysis, mockEnvAnalysis, mockInitialState);
    expect(commands).toEqual(mockCameraCommands);
    // ... other assertions
  });

  // ... other tests for specific interpreter logic, adapter error handling etc. 
});
```

### 8.1 Test Configuration
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['__tests__/setup.ts'],
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

### 8.2 Test Setup
```typescript
// __tests__/setup.ts
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Extend matchers
expect.extend({});

// Cleanup after each test
afterEach(() => {
  cleanup();
});
```

## 9. Deployment & Infrastructure
- **Platform:** Vercel (preferred for Next.js) or other suitable cloud provider (AWS Amplify, Netlify, etc.).
- **CI/CD:** GitHub Actions (or provider's built-in CI/CD) for automated testing, building, and deployment triggered by pushes/merges to main/stable branches.
- **Environment Variables:** Manage secrets (API keys, Supabase keys) securely using platform's environment variable system. Differentiate between build-time and runtime variables.
- **Database & Storage:** Supabase (Postgres, Storage).
- **Scaling:** Leverage serverless functions (Vercel Functions / API Routes) for backend logic. Utilize CDN for static assets and potentially models. Consider database connection pooling if needed.

```yaml
# Example GitHub Actions Workflow Snippet (ci.yaml)
name: CI Pipeline

on:
  push:
    branches: [ stable, main ] # Or your main development branch
  pull_request:
    branches: [ stable, main ]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18' # Or your target version
          cache: 'npm'
      - name: Install Dependencies
        run: npm ci
      - name: Run Linter
        run: npm run lint

  test:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      # ... setup steps ...
      - name: Run Unit & Integration Tests
        run: npm test -- --coverage # Example command
      # - name: Upload coverage reports (e.g., to Codecov)

  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      # ... setup steps ...
      - name: Build Project
        env: # Provide necessary build-time env vars
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL_PROD }}
          # ... other public vars
        run: npm run build

  # Optional: Deploy step (e.g., using Vercel CLI action or provider integration)
  # deploy_preview:
  #   if: github.event_name == 'pull_request'
  #   ... deploy preview environment ...
  # deploy_production:
  #   if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  #   ... deploy to production ...
```

## 10. Analytics & Monitoring Implementation
- **Analytics:** Integrate a service like Vercel Analytics, Google Analytics, PostHog, or Plausible. Track key user events (model loads, feature usage, errors) and performance metrics (LCP, FID, CLS). Implement custom events for specific feature interactions.
- **Monitoring:** Use platform's built-in monitoring (e.g., Vercel logs, Supabase metrics). Consider external services like Sentry or LogRocket for more detailed error tracking and session replay, especially in production.
- **Health Checks:** Implement `/api/health` endpoint checking database connectivity and basic server health.

```typescript
// Example Analytics Tracking Hook (Illustrative)
// src/hooks/useAnalytics.ts
import { useEffect } from 'react';
// Assuming an analytics library like 'analytics' or custom setup
// import analytics from '@/lib/analytics';

export const useAnalyticsPageview = (pageName: string, params?: Record<string, any>) => {
  useEffect(() => {
    // analytics.page(pageName, params);
    console.log(`Analytics Pageview: ${pageName}`, params); // Placeholder
  }, [pageName, params]);
};

export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  // analytics.track(eventName, properties);
  console.log(`Analytics Event: ${eventName}`, properties); // Placeholder
};

export const trackError = (error: Error, context?: Record<string, any>) => {
    console.error("Tracking Error:", error, context);
    // Integrate with Sentry or similar: Sentry.captureException(error, { extra: context });
};
```

## 11. Mobile & Responsive Design Implementation
- **Approach:** Mobile-first or graceful degradation from desktop.
- **Layout:** Use Tailwind CSS responsive modifiers (`sm:`, `md:`, `lg:`) extensively. Employ CSS Flexbox and Grid for fluid layouts.
- **UI Components:** Ensure shadcn/ui components adapt well or provide alternative layouts/components for smaller screens (e.g., drawer navigation instead of sidebar).
- **Touch Controls:** Implement specific touch event handlers for 3D viewport interaction (pinch-to-zoom, two-finger-rotate, one-finger-pan) using libraries or custom logic. Ensure `touch-action: none;` is applied to the canvas to prevent default browser gestures.
- **Performance:** Use adaptive quality settings (Section 11.C from original PRD) based on device capabilities or performance monitoring. Load lighter assets or simplified models on mobile if necessary.

```typescript
// Example Responsive Component Structure
// src/components/layout/ResponsiveSidebar.tsx
import { useMediaQuery } from '@/hooks/useMediaQuery'; // Hypothetical hook
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"; // Drawer
import { Button } from "@/components/ui/button";
import { MenuIcon } from "lucide-react";
import { ControlPanels } from './ControlPanels'; // Component containing all controls

export const ResponsiveSidebar = () => {
  const isDesktop = useMediaQuery('(min-width: 768px)'); // Example breakpoint

  if (isDesktop) {
    return (
      <aside className="w-80 border-r p-4 overflow-y-auto">
        <ControlPanels />
      </aside>
    );
  }

  // Mobile: Use a drawer
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="fixed bottom-4 right-4 z-50 md:hidden">
           <MenuIcon className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] sm:w-[400px] p-4 overflow-y-auto">
         <ControlPanels />
      </SheetContent>
    </Sheet>
  );
};
```
*(Include details on Touch Controls and Adaptive Quality Manager as extracted from original PRD Section 14 if needed)*

## 12. Accessibility Implementation
- **Semantic HTML:** Use appropriate HTML5 tags (`<nav>`, `<main>`, `<aside>`, `<button>`, etc.).
- **ARIA Attributes:** Use ARIA roles and properties where semantic HTML is insufficient (e.g., `aria-label` for icon buttons, `aria-live` for status updates, roles for custom widgets).
- **Focus Management:** Ensure logical focus order. Manage focus programmatically in modals and dynamic UI changes. Use visible focus indicators (`focus-visible`).
- **Keyboard Navigation:** Ensure all interactive elements are reachable and operable via keyboard (Tab, Shift+Tab, Enter, Space, Arrow Keys where appropriate). Implement custom keyboard controls for 3D interaction (Section 15.A from original PRD).
- **Screen Reader Support:** Provide descriptive text alternatives for non-text content (e.g., `alt` text for informative images, ARIA labels). Use `sr-only` class for visually hidden text beneficial to screen readers (Section 15.B from original PRD).
- **Color Contrast & Themes:** Ensure sufficient contrast ratios (AA standard minimum). Test themes (light, dark, high-contrast) for accessibility (Section 15.C from original PRD).
