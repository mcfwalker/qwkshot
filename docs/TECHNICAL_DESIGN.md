### **Content for: `TECHNICAL_DESIGN.md` (New File)**

```markdown
# Modern 3D Viewer - Technical Design Document

This document details the technical architecture, implementation specifics, and design decisions for the Modern 3D Viewer application. It complements the [Product Requirements Document](./PRD.md).

## 1. Frontend Architecture

### 1.1. Framework & Language
- **Framework:** Next.js (App Router)
- **Language:** TypeScript

### 1.2. Project Structure (Illustrative)
```
src/
├── app/
│   ├── layout.tsx           # Main app layout (providers, base HTML structure)
│   ├── page.tsx             # Landing page / Root route handler
│   ├── (marketing)/         # Marketing pages (unauthenticated)
│   ├── (auth)/              # Authentication routes (sign-in, callback)
│   │   ├── layout.tsx       # Auth-specific layout
│   │   └── ...
│   ├── (protected)/         # Routes requiring authentication
│   │   ├── viewer/          # Core viewer application routes
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx     # Default viewer
│   │   │   └── [modelId]/   # Dynamic route for specific models
│   │   │       └── page.tsx
│   │   ├── library/         # User model library
│   │   │   └── page.tsx
│   │   ├── generate/        # AI generation features (paths, models)
│   │   └── ...
│   └── api/                 # API Route handlers
│       ├── auth/
│       ├── camera-paths/
│       └── ...
├── components/
│   ├── ui/                  # Reusable UI components (likely using shadcn/ui)
│   ├── viewer/              # Components specific to the 3D viewer experience
│   ├── layout/              # Layout-specific components (header, sidebar)
│   └── ...
├── lib/                     # Shared utilities, helpers, client libraries
│   ├── supabase.ts          # Supabase client setup (client-side)
│   ├── supabase-server.ts   # Supabase client setup (server-side)
│   ├── three-utils.ts       # Three.js specific helpers
│   └── ...
├── hooks/                   # Custom React hooks
├── store/                   # State management (e.g., Zustand store)
├── styles/                  # Global styles, Tailwind config
├── types/                   # TypeScript type definitions (e.g., supabase types)
└── middleware.ts            # Next.js middleware (e.g., for auth checks)
```
*(See also: [Routing Documentation](./docs/routing/README.md))*

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
- **Approach:** Use Supabase RPC (Remote Procedure Calls) for data modifications
- **Benefits:**
  - Centralized business logic in database functions
  - Better error handling and type safety
  - Atomic operations with proper validation
- **Implementation:**
```typescript
// Example RPC Function (SQL)
create or replace function update_model_name(
  model_id uuid,
  new_name text
) returns void as $$
begin
  -- Verify ownership
  if not exists (
    select 1 from models 
    where id = model_id 
    and user_id = auth.uid()
  ) then
    raise exception 'Model not found or unauthorized';
  end if;

  -- Update the model
  update models 
  set name = new_name,
      updated_at = now()
  where id = model_id;
end;
$$ language plpgsql security definer;

// Client Usage
const { error } = await supabase.rpc('update_model_name', {
  model_id: modelId,
  new_name: name.trim()
})
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
  - Offer contextual help for animation playback
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
9. User is redirected from sign-in/callback to their original destination (`redirectTo`) or a default page (e.g., `/library`).

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

  // Protect specific routes/patterns
  if (!session && (pathname.startsWith('/viewer') || pathname.startsWith('/library') || pathname.startsWith('/generate'))) {
      // Redirect to sign-in, preserving the intended destination
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
  const redirectTo = requestUrl.searchParams.get('state') || '/library' // Assuming state might hold redirect

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
  const safeRedirectPath = redirectTo.startsWith('/') ? redirectTo : '/library';
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

*(See also: [Authentication Feature Documentation](./features/auth/README.md), [Storage Security Documentation](./features/storage/README.md))*

## 4. API Structure
- Utilize Next.js API Routes (`src/app/api/.../route.ts`) for backend logic.
- Group routes logically by feature (e.g., `auth`, `camera-paths`, `models`).
- Use Route Handlers (GET, POST, PUT, DELETE).
- Implement authentication checks within API routes using `createRouteHandlerClient`.
- Validate request bodies/params (e.g., using Zod).
- Standardize response formats (e.g., `{ data: ... }` or `{ error: ... }`).

### 4.1 RPC Endpoints
- **Purpose:** Handle data mutations with proper validation and security
- **Location:** Defined in Supabase migrations
- **Implementation:**
  - Use `security definer` for elevated privileges
  - Include ownership verification
  - Return appropriate error messages
  - Handle transaction management
- **Example:**
```sql
-- Example RPC function for model deletion
create or replace function delete_model(
  model_id uuid
) returns void as $$
begin
  -- Verify ownership
  if not exists (
    select 1 from models 
    where id = model_id 
    and user_id = auth.uid()
  ) then
    raise exception 'Model not found or unauthorized';
  end if;

  -- Delete associated data first
  delete from model_metadata where model_id = model_id;
  delete from models where id = model_id;
end;
$$ language plpgsql security definer;
```

### 4.2 API Routes
- **Purpose:** Handle client-side operations and cache management
- **Implementation:**
  - Include proper CORS headers
  - Handle authentication
  - Manage cache invalidation
  - Return standardized responses
- **Example:**
```typescript
// Example revalidation route
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path')
    
    if (!path) {
      return NextResponse.json(
        { message: 'Missing path parameter' },
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }

    revalidatePath(path)
    return NextResponse.json(
      { revalidated: true, now: Date.now() },
      {
        headers: {
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  } catch (error) {
    return NextResponse.json(
      { message: 'Error revalidating' },
      { status: 500 }
    )
  }
}
```

## 5. Feature Specifications (Data Structures)

*(Extracted interfaces from original PRD Section 6)*

### 5.1. P2P Pipeline Architecture

#### 5.1.1 Component Hierarchy
```typescript
interface P2PPipeline {
  initialize(config: P2PPipelineConfig): Promise<void>;
  processModel(input: ModelInput): Promise<{
    modelId: string;
    analysis: SceneAnalysis;
    metadata: ModelMetadata;
  }>;
  generatePath(modelId: string, instruction: UserInstruction): Promise<AnimationOutput>;
  previewKeyframe(modelId: string, keyframeIndex: number, animation: AnimationOutput): Promise<void>;
  executeAnimation(modelId: string, animation: AnimationOutput): Promise<void>;
  getPerformanceMetrics(): PerformanceMetrics;
}

interface P2PPipelineConfig {
  sceneAnalyzer: SceneAnalyzerConfig;
  metadataManager: MetadataManagerConfig;
  promptCompiler: PromptCompilerConfig;
  llmEngine: LLMEngineConfig;
  sceneInterpreter: SceneInterpreterConfig;
  viewerIntegration: ViewerIntegrationConfig;
}

interface ViewerIntegrationConfig {
  lockMechanism: {
    enabled: boolean;
    storePositionOnLock: boolean;
    validatePosition: boolean;
  };
  animation: {
    requireUnlock: boolean;
    autoUnlock: boolean;
    easingFunctions: boolean;
  };
}
```

#### 5.1.2 Scene Analysis
```typescript
interface SceneAnalysis {
  glb: {
    fileInfo: {
      name: string;
      size: number;
      format: string;
      version: string;
    };
    geometry: {
      vertexCount: number;
      faceCount: number;
      boundingBox: Box3;
      center: Vector3;
      dimensions: Vector3;
    };
    materials: Material[];
    metadata: Record<string, any>;
    performance: PerformanceMetrics;
  };
  spatial: {
    bounds: {
      min: Vector3;
      max: Vector3;
      center: Vector3;
      dimensions: Vector3;
    };
    referencePoints: {
      center: Vector3;
      highest: Vector3;
      lowest: Vector3;
      leftmost: Vector3;
      rightmost: Vector3;
      frontmost: Vector3;
      backmost: Vector3;
    };
    symmetry: {
      hasSymmetry: boolean;
      symmetryPlanes: any[];
    };
    complexity: 'simple' | 'moderate' | 'high';
    performance: PerformanceMetrics;
  };
  featureAnalysis: {
    features: Feature[];
    landmarks: Landmark[];
    constraints: Constraint[];
    performance: PerformanceMetrics;
  };
  safetyConstraints: {
    minDistance: number;
    maxDistance: number;
    minHeight: number;
    maxHeight: number;
    restrictedZones: Box3[];
  };
  orientation: {
    front: Vector3;
    up: Vector3;
    right: Vector3;
    center: Vector3;
    scale: number;
  };
  features: Feature[];
  performance: PerformanceMetrics;
}
```

#### 5.1.3 Environmental Analysis
```typescript
interface EnvironmentalAnalysis {
  environment: {
    bounds: {
      min: Vector3;
      max: Vector3;
      center: Vector3;
      dimensions: Vector3;
    };
    floor: {
      center: Vector3;
      normal: Vector3;
      size: Vector3;
    };
  };
  object: {
    bounds: {
      min: Vector3;
      max: Vector3;
      center: Vector3;
      dimensions: Vector3;
    };
    position: Vector3;
    rotation: Vector3;
    scale: Vector3;
  };
  distances: {
    toBoundary: {
      front: number;
      back: number;
      left: number;
      right: number;
      top: number;
      bottom: number;
    };
    safeRange: {
      min: number;
      max: number;
    };
  };
  cameraConstraints: {
    minHeight: number;
    maxHeight: number;
    minDistance: number;
    maxDistance: number;
    restrictedZones: Box3[];
  };
  camera: {
    position: Vector3;
    target: Vector3;
    fov: number;
    isLocked: boolean;
  };
  performance: PerformanceMetrics;
}

interface EnvironmentalMetadata {
  camera: {
    position: Vector3;
    target: Vector3;
    fov: number;
  };
  lighting: {
    intensity: number;
    color: string;
  };
  constraints: {
    minDistance: number;
    maxDistance: number;
    minHeight: number;
    maxHeight: number;
  };
}
```

#### 5.1.4 Error Handling
```typescript
interface P2PError extends Error {
  code: string;
  component: string;
  details?: any;
}

interface ValidationResult {
  isValid: boolean;
  error?: string;
  details?: any;
}

interface PerformanceMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  operations: {
    name: string;
    duration: number;
    success: boolean;
    error?: string;
  }[];
}

interface AnimationError extends P2PError {
  type: 'lock_state' | 'position_validation' | 'path_generation' | 'playback';
  requiresUnlock: boolean;
  currentState: {
    isLocked: boolean;
    hasValidPosition: boolean;
  };
}
```

### 5.2. Camera Path
```typescript
interface CameraPath {
  id: string;
  name: string;
  description?: string;
  keyframes: CameraKeyframe[];
  metadata: {
    generatedFromPrompt?: string;
    complexity?: 'simple' | 'medium' | 'high';
    totalDuration: number;
    authorId: string;
    createdAt: string;
    updatedAt: string;
    version?: string;
    environmentalMetadata?: EnvironmentalMetadata;
  };
  isPublic?: boolean;
}

interface CameraKeyframe {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  duration: number;
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  up?: { x: number; y: number; z: number };
  fov?: number;
}

interface PathGenerationParams {
  prompt: string;
  duration: number;
  complexity?: 'simple' | 'medium' | 'high';
  sceneContext: {
    modelCenter: { x: number; y: number; z: number };
    modelBoundingBox: { min: {x,y,z}, max: {x,y,z} };
    environmentalMetadata: EnvironmentalMetadata;
    currentCameraState: {
      position: { x: number; y: number; z: number };
      target: { x: number; y: number; z: number };
      fov: number;
      isLocked: boolean;
    };
  };
  constraints?: {
    avoidClipping?: boolean;
    maintainHorizon?: boolean;
    requireUnlock?: boolean;
    autoUnlock?: boolean;
  };
}

interface AnimationState {
  isPlaying: boolean;
  isPaused: boolean;
  currentProgress: number;
  isLocked: boolean;
  hasValidPosition: boolean;
  error?: AnimationError;
}
```
*(See also: [Prompt Architecture Documentation](./docs/prompt-architecture/README.md))*

### 5.3. Model Generation
```typescript
interface ModelGenerationJob {
  id: string; // Job ID from the generation service
  userId: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  progress: number; // 0-100
  sourceImageUrls?: string[]; // URLs if stored temporarily
  generationParams: GenerationParams;
  estimatedCompletionTime?: string; // ISO timestamp
  resultModelId?: string; // ID of the final model in our library
  error?: {
    code: string;
    message: string;
  };
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

interface GenerationParams { // Params sent to the generation service
  quality: 'draft' | 'standard' | 'high';
  style?: 'realistic' | 'stylized' | 'low-poly'; // Depending on service capabilities
  // ... other service-specific options (texturing, background removal, scale)
}

interface GeneratedModel { // Our internal representation after generation
  id: string; // Our library model ID
  userId: string;
  name: string;
  description?: string;
  storagePath: string; // Path in our Supabase storage
  thumbnailUrl?: string;
  polygonCount?: number;
  textureResolution?: number;
  sourceJobId: string; // Link back to the generation job
  createdAt: string;
  updatedAt: string;
}
```

## 6. External Integrations

### 6.1. LLM Service (e.g., OpenAI)
- **Purpose:** Camera path generation from text, potentially scene analysis.
- **Implementation:**
    - Use official client libraries (`openai` npm package).
    - Store API key securely (environment variable, `OPENAI_API_KEY`).
    - Implement service layer (`src/lib/openai-service.ts` or similar) abstracting API calls.
    - Centralize prompt construction logic.
    - Handle API errors (rate limits, auth errors, timeouts).
    - Implement response parsing and validation (ensure JSON format if requested).

```typescript
// Example service structure
// src/lib/llm-service.ts
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateCameraPathFromLLM(params: PathGenerationParams): Promise<CameraKeyframe[]> {
  // Get scene and environmental analysis
  const sceneAnalysis = await analyzeScene(params.modelId);
  const envAnalysis = await analyzeEnvironment(sceneAnalysis);

  // Compile prompt with context
  const compiledPrompt = await compilePrompt(
    params.prompt,
    sceneAnalysis,
    envAnalysis
  );

  const systemPrompt = `You are a helpful assistant designing camera paths... Your output MUST be a JSON array of keyframes: [{ position: {x,y,z}, target: {x,y,z}, duration: number }]. Total duration must sum to ${params.duration}.`;
  const userPrompt = `Generate keyframes for: "${params.prompt}". Scene context: ${JSON.stringify(params.sceneContext)}. Environmental constraints: ${JSON.stringify(envAnalysis.cameraConstraints)}. Total duration: ${params.duration}s.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("LLM returned empty content");
    }

    const parsed = JSON.parse(content);
    if (!parsed.keyframes || !Array.isArray(parsed.keyframes)) {
      throw new Error("LLM response missing keyframes array");
    }

    // Validate against environmental constraints
    const validatedKeyframes = validateKeyframes(parsed.keyframes, envAnalysis.cameraConstraints);
    return validatedKeyframes;

  } catch (error) {
    console.error("LLM service error:", error);
    throw new Error("Failed to generate camera path from LLM");
  }
}
```

### 6.2. Model Generation Service (e.g., Meshy, Hypothetical)
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

## 7. Error Handling Strategy
- **Client-Side:**
  - Use React Error Boundaries for component tree errors
  - Handle RPC errors with proper user feedback
  - Implement loading states and progress indicators
  - Use toast notifications for user feedback
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
  - Offer contextual help for animation playback
  - Implement graceful degradation for locked state
  - Consider auto-unlock options for better UX
  - Maintain state consistency across components
  - Handle edge cases in animation transitions

## 8. Testing Strategy Implementation
- **Unit Tests:** Jest + React Testing Library for individual components and utility functions. Mock dependencies (Supabase client, external APIs, Three.js specifics where needed).
- **Integration Tests:** Test interactions between components, state management, and API mocks (using MSW - Mock Service Worker).
- **End-to-End (E2E) Tests:** Cypress or Playwright to simulate full user workflows (sign-in, upload model, generate path, view animation).
- **Visual Regression Tests:** Percy or similar tools integrated into CI to catch unintended UI changes.
- **Code Coverage:** Aim for >80% coverage on critical paths, tracked via tools like `istanbul` or built-in Jest coverage.

### 8.1 P2P Pipeline Testing
```typescript
// Example test structure for P2P components
describe('P2P Pipeline Integration', () => {
  let pipeline: P2PPipeline;
  let sceneAnalyzer: SceneAnalyzer;
  let environmentalAnalyzer: EnvironmentalAnalyzer;
  let promptCompiler: PromptCompiler;

  beforeEach(() => {
    // Initialize components with mock data
    sceneAnalyzer = new SceneAnalyzerImpl(mockConfig, mockLogger);
    environmentalAnalyzer = new EnvironmentalAnalyzerImpl(mockConfig, mockLogger);
    promptCompiler = new PromptCompilerImpl(mockConfig);
    pipeline = new P2PPipelineImpl(
      mockConfig,
      mockLogger,
      sceneAnalyzer,
      environmentalAnalyzer,
      promptCompiler,
      mockLLMEngine,
      mockSceneInterpreter
    );
  });

  describe('Scene Analysis', () => {
    it('should analyze GLB file correctly', async () => {
      const analysis = await sceneAnalyzer.analyzeScene(mockGLBFile);
      expect(analysis.spatial.bounds).toBeDefined();
      expect(analysis.features).toBeDefined();
    });
  });

  describe('Environmental Analysis', () => {
    it('should calculate correct environment bounds', async () => {
      const sceneAnalysis = await sceneAnalyzer.analyzeScene(mockGLBFile);
      const envAnalysis = await environmentalAnalyzer.analyzeEnvironment(sceneAnalysis);
      expect(envAnalysis.environment.bounds).toBeDefined();
      expect(envAnalysis.cameraConstraints).toBeDefined();
    });
  });

  describe('Prompt Compilation', () => {
    it('should compile prompt with scene context', async () => {
      const sceneAnalysis = await sceneAnalyzer.analyzeScene(mockGLBFile);
      const envAnalysis = await environmentalAnalyzer.analyzeEnvironment(sceneAnalysis);
      const compiledPrompt = await promptCompiler.compilePrompt(
        'Show me the front of the model',
        sceneAnalysis,
        mockModelMetadata
      );
      expect(compiledPrompt.systemMessage).toContain('camera path');
      expect(compiledPrompt.constraints).toBeDefined();
    });
  });
});
```

*(See the [Test Suite Plan](./docs/testing/README.md) for detailed structure and goals)*

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
