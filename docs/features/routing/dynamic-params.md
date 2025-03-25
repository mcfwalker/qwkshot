# Dynamic Route Parameters in Next.js App Router

## Overview
In Next.js 14's App Router, dynamic route parameters are provided as Promise objects that must be properly awaited before accessing their properties. This document outlines our standardized approach to handling these parameters in server components.

## Current Implementation
Our application uses dynamic routes in several places, most notably in the model viewer (`/viewer/[modelId]`). We handle dynamic parameters using a consistent pattern that ensures proper async handling and type safety.

### Key Components
- Server Components with dynamic routes
- Metadata generation functions
- Error boundaries and fallbacks

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

### 3. Error Handling
```typescript
try {
  const resolvedParams = await params
  // Use resolvedParams.propertyName
} catch (error) {
  console.error('Error resolving params:', error)
  return <ErrorComponent />
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

### Step 2: Parameter Resolution
```typescript
export default async function Page({ params }: PageProps) {
  const resolvedParams = await params
  // Now safe to use resolvedParams.modelId
}
```

### Step 3: Error Handling
Always wrap param resolution in try-catch blocks and provide appropriate fallbacks.

## Examples

### Simple Route
```typescript
// app/items/[itemId]/page.tsx
export default async function ItemPage({ params }: { params: { itemId: string } }) {
  const resolvedParams = await params
  return <div>Item ID: {resolvedParams.itemId}</div>
}
```

### Complex Route (Model Viewer)
See our implementation in:
- `src/app/(protected)/viewer/[modelId]/page.tsx`
- Test implementation in `src/app/(protected)/test-viewer/[id]/page.tsx`

## Related Documentation
- [Next.js Dynamic Routes](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes)
- [Modern 3D Viewer Development Setup](../../DEVELOPMENT_SETUP.md)
- [Troubleshooting Guide](../../troubleshooting/README.md)

## Migration Guide
When updating existing dynamic routes:
1. Add async/await handling
2. Update type definitions
3. Implement proper error boundaries
4. Test both happy and error paths
5. Update any related components that consume the parameters 