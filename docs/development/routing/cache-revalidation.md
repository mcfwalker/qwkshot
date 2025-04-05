# Cache and Revalidation Patterns

## Overview
This document outlines our standardized approach to cache invalidation and data revalidation in the Modern 3D Viewer application. These patterns ensure that data remains consistent across the application while providing a smooth user experience.

## Key Concepts

### 1. Cache Invalidation
- Uses Next.js's revalidation API
- Triggered after successful data modifications
- Path-based invalidation for specific routes
- Multiple path revalidation when needed

### 2. Router Refresh
- Forces Next.js to refresh cached data
- Updates client-side UI immediately
- Works in conjunction with cache invalidation

### 3. Delayed Navigation
- Ensures revalidation completes before route changes
- Prevents stale data from appearing briefly
- Improves user experience

## Standard Revalidation Sequence

### 1. Basic Pattern with RPC
```typescript
// After successful data modification using RPC
const { error } = await supabase.rpc('update_model_name', {
  model_id: modelId,
  new_name: newName.trim()
})

if (!error) {
  // Revalidate both edit and library pages
  await Promise.all([
    fetch('/api/revalidate?path=/library', { method: 'POST' }),
    fetch(`/api/revalidate?path=/library/edit/${modelId}`, { method: 'POST' })
  ])
  
  router.refresh()
  await new Promise(resolve => setTimeout(resolve, 500))
  router.push('/destination')
}
```

### 2. With Error Handling
```typescript
try {
  // Perform data modification via RPC
  const { error } = await supabase.rpc('update_model_name', {
    model_id: modelId,
    new_name: newName.trim()
  })
  
  if (error) throw error

  // Revalidate multiple paths in parallel
  try {
    await Promise.all([
      fetch('/api/revalidate?path=/library', { method: 'POST' }),
      fetch(`/api/revalidate?path=/library/edit/${modelId}`, { method: 'POST' })
    ])
  } catch (revalidateError) {
    console.error('Revalidation error:', revalidateError)
    // Continue with navigation even if revalidation fails
  }
  
  router.refresh()
  await new Promise(resolve => setTimeout(resolve, 500))
  
  toast.success('Operation successful')
  router.push('/library')
} catch (error) {
  console.error('Operation error:', error)
  toast.error('Operation failed')
}
```

## Implementation Details

### 1. Revalidation API with CORS Support
```typescript
// app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Origin': '*'
    },
  })
}

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
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  }
}
```

### 2. Usage in Components with RPC
```typescript
async function handleModelUpdate() {
  setIsLoading(true)
  try {
    // Input validation
    if (!newName?.trim()) {
      toast.error('Model name cannot be empty')
      return
    }

    // 1. Update data using RPC
    const { error } = await supabase.rpc('update_model_name', {
      model_id: modelId,
      new_name: newName.trim()
    })

    if (error) throw error

    // 2. Revalidate multiple paths
    try {
      await Promise.all([
        fetch('/api/revalidate?path=/library', { method: 'POST' }),
        fetch(`/api/revalidate?path=/library/edit/${modelId}`, { method: 'POST' })
      ])
    } catch (revalidateError) {
      console.error('Revalidation error:', revalidateError)
      // Continue with navigation even if revalidation fails
    }
    
    // 3. Refresh router
    router.refresh()
    
    // 4. Wait for revalidation
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 5. Show success and navigate
    toast.success('Model updated successfully')
    router.push('/library')
  } catch (error) {
    console.error('Update error:', error)
    toast.error('Failed to update model')
  } finally {
    setIsLoading(false)
  }
}
```

## Best Practices

### 1. Use RPC for Data Modifications
- Prefer RPC over direct table operations
- Ensures consistent business logic
- Better error handling and type safety

### 2. Multiple Path Revalidation
- Identify all affected routes
- Use Promise.all for parallel revalidation
- Handle revalidation errors gracefully

### 3. Error Handling
- Validate inputs before operations
- Use try-catch blocks consistently
- Log errors for debugging
- Show user-friendly error messages

### 4. User Feedback
- Show loading states during operations
- Provide success/error messages
- Use consistent timing for operations

## Common Pitfalls

### 1. PGRST Errors
```typescript
// DON'T do this
const { error } = await supabase
  .from('models')
  .update({ name: newName })
  .select()
  .single() // Can cause PGRST116 error
```

### 2. Missing CORS Headers
```typescript
// DON'T do this
return NextResponse.json({ revalidated: true }) // Missing CORS headers
```

### 3. Insufficient Error Handling
```typescript
// DON'T do this
await Promise.all([
  fetch('/api/revalidate?path=/library', { method: 'POST' }),
  fetch(`/api/revalidate?path=/library/edit/${modelId}`, { method: 'POST' })
]) // Missing try-catch for revalidation
```

### 4. Premature Navigation
```typescript
// DON'T do this
await supabase.rpc('update_model_name', params)
router.push('/library') // Missing revalidation sequence
```

## Related Documentation
- [Next.js Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)
- [Dynamic Parameters](./dynamic-params.md)
- [Protected Routes](./protected-routes.md) 