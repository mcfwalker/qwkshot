# Cache and Revalidation Patterns

## Overview
This document outlines our standardized approach to cache invalidation and data revalidation in the Modern 3D Viewer application. These patterns ensure that data remains consistent across the application while providing a smooth user experience.

## Key Concepts

### 1. Cache Invalidation
- Uses Next.js's revalidation API
- Triggered after successful data modifications
- Path-based invalidation for specific routes

### 2. Router Refresh
- Forces Next.js to refresh cached data
- Updates client-side UI immediately
- Works in conjunction with cache invalidation

### 3. Delayed Navigation
- Ensures revalidation completes before route changes
- Prevents stale data from appearing briefly
- Improves user experience

## Standard Revalidation Sequence

### 1. Basic Pattern
```typescript
// After successful data modification
await fetch('/api/revalidate?path=/library', { method: 'POST' })
router.refresh()
await new Promise(resolve => setTimeout(resolve, 500))
router.push('/destination')
```

### 2. With Error Handling
```typescript
try {
  // Perform data modification
  const { error } = await supabase.from('models').update(data)
  if (error) throw error

  // Revalidate and refresh
  await fetch('/api/revalidate?path=/library', { method: 'POST' })
  router.refresh()
  
  // Wait for revalidation
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // Show success and navigate
  toast.success('Operation successful')
  router.push('/library')
} catch (error) {
  console.error('Error:', error)
  toast.error('Operation failed')
}
```

## Implementation Details

### 1. Revalidation API
```typescript
// app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path')
    
    if (!path) {
      return NextResponse.json(
        { message: 'Missing path parameter' },
        { status: 400 }
      )
    }

    revalidatePath(path)
    return NextResponse.json({ revalidated: true, now: Date.now() })
  } catch (error) {
    return NextResponse.json(
      { message: 'Error revalidating' },
      { status: 500 }
    )
  }
}
```

### 2. Usage in Components
```typescript
async function handleModelUpdate() {
  setIsLoading(true)
  try {
    // 1. Update data
    const { error } = await supabase
      .from('models')
      .update({ name: newName })
      .eq('id', modelId)

    if (error) throw error

    // 2. Revalidate cache
    await fetch('/api/revalidate?path=/library', { method: 'POST' })
    
    // 3. Refresh router
    router.refresh()
    
    // 4. Wait for revalidation
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 5. Show success and navigate
    toast.success('Model updated successfully')
    router.push('/library')
  } catch (error) {
    toast.error('Failed to update model')
  } finally {
    setIsLoading(false)
  }
}
```

## Best Practices

### 1. Always Use the Full Sequence
- Data modification
- Cache invalidation
- Router refresh
- Revalidation wait
- Navigation

### 2. Error Handling
- Catch and handle errors appropriately
- Show meaningful error messages
- Maintain loading states

### 3. User Feedback
- Show loading states during operations
- Provide success/error messages
- Use consistent timing for operations

## Common Pitfalls

### 1. Premature Navigation ❌
```typescript
// DON'T do this
await supabase.from('models').update(data)
router.push('/library') // No revalidation!
```

### 2. Missing Error Handling ❌
```typescript
// DON'T do this
const { error } = await supabase.from('models').update(data)
await fetch('/api/revalidate?path=/library', { method: 'POST' })
// No error handling!
```

### 3. Insufficient Wait Time ❌
```typescript
// DON'T do this
await fetch('/api/revalidate?path=/library', { method: 'POST' })
router.refresh()
router.push('/library') // No wait for revalidation!
```

## Related Documentation
- [Next.js Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)
- [Dynamic Parameters](./dynamic-params.md)
- [Protected Routes](./protected-routes.md) 