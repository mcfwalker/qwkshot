# Dynamic Route Parameters in Next.js App Router

## Overview
In Next.js 14's App Router, dynamic route parameters are provided as Promise objects that must be properly awaited before accessing their properties. This document outlines our standardized approach to handling these parameters in server components.

## Current Implementation
Our application uses dynamic routes in several places, most notably in the model viewer (`/viewer/[modelId]`) and model editor (`/library/edit/[modelId]`). We handle dynamic parameters using a consistent pattern that ensures proper async handling, type safety, and ownership verification.

### Key Components
- Server Components with dynamic routes
- Metadata generation functions
- Error boundaries and fallbacks
- Resource ownership verification
- Cache invalidation and revalidation

## Best Practices

### 1. Awaiting Parameters
```typescript
export default async function ViewerPage({ params }: { params: { modelId: string } }) {
  const resolvedParams = await params
  const model = await getModelData(resolvedParams.modelId)
  // Use resolvedParams.modelId instead of params.modelId
}
```

### 2. Metadata Generation
```typescript
export async function generateMetadata({ params }: { params: { modelId: string } }) {
  const resolvedParams = await params
  const model = await getModelData(resolvedParams.modelId)
  return {
    title: model ? `${model.name} - Modern 3D Viewer` : 'Model Not Found'
  }
}
```

### 3. Error Handling with Auth
```typescript
try {
  const resolvedParams = await params
  const session = await getSession()
  
  // Verify ownership
  if (session.user.id !== model.user_id) {
    throw new Error('Not authorized to access this model')
  }
  
  // Use resolvedParams.propertyName
} catch (error) {
  console.error('Error:', error)
  return <ErrorComponent message={error.message} />
}
```

### 4. Data Revalidation
When updating data in dynamic routes:
```typescript
async function handleUpdate() {
  // Perform update
  const { error } = await supabase
    .from('models')
    .update({ name: newName })
    .eq('id', modelId)

  if (error) throw error

  // Revalidate and refresh
  await fetch('/api/revalidate?path=/library', { method: 'POST' })
  router.refresh()
  
  // Wait for revalidation
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // Navigate
  router.push('/library')
}
```

## Anti-patterns

### 1. Direct Property Access ❌
```typescript
// DON'T do this
const modelId = params.modelId // Will cause warning
```

### 2. Assuming Synchronous Access ❌
```typescript
// DON'T do this
function SomeComponent({ params }) {
  useEffect(() => {
    fetchData(params.id) // Will cause warning
  }, [])
}
```

### 3. Skipping Ownership Verification ❌
```typescript
// DON'T do this
async function updateModel() {
  await supabase.from('models').update(data) // Missing user_id check
}
```

## Implementation Guide

### Step 1: Type Definition
```typescript
interface PageParams {
  modelId: string
}

interface PageProps {
  params: PageParams
}
```

### Step 2: Parameter Resolution and Auth
```typescript
export default async function Page({ params }: PageProps) {
  const resolvedParams = await params
  const session = await getSession()
  
  // Verify ownership
  const { data: model } = await supabase
    .from('models')
    .select()
    .eq('id', resolvedParams.modelId)
    .eq('user_id', session.user.id)
    .single()
    
  if (!model) {
    throw new Error('Model not found or unauthorized')
  }
}
```

### Step 3: Error Handling
Always wrap param resolution and auth checks in try-catch blocks and provide appropriate fallbacks.

## Examples

### Model Edit Route
```typescript
// app/(protected)/library/edit/[modelId]/page.tsx
export default async function EditPage({ params }: { params: { modelId: string } }) {
  const resolvedParams = await params
  const session = await getSession()
  
  try {
    const { data: model } = await supabase
      .from('models')
      .select()
      .eq('id', resolvedParams.modelId)
      .eq('user_id', session.user.id)
      .single()
      
    if (!model) {
      throw new Error('Model not found or unauthorized')
    }
    
    return <ModelEditForm model={model} />
  } catch (error) {
    return <ErrorComponent message={error.message} />
  }
}
```

## Related Documentation
- [Next.js Dynamic Routes](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes)
- [Modern 3D Viewer Development Setup](../../DEVELOPMENT_SETUP.md)
- [Troubleshooting Guide](../../troubleshooting/README.md)

## Migration Guide
When updating existing dynamic routes:
1. Add async/await handling
2. Update type definitions
3. Implement proper error boundaries
4. Add ownership verification
5. Implement proper revalidation sequence
6. Test both happy and error paths
7. Update any related components that consume the parameters 