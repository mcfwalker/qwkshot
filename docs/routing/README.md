# Routing in Modern 3D Viewer

## Overview
This directory contains documentation for routing patterns and implementations in the Modern 3D Viewer application. Our application uses Next.js App Router with a mix of static and dynamic routes.

## Key Features
- Dynamic route parameter handling
- Protected routes
- Error boundaries
- Metadata generation

## Documentation Index
- [Dynamic Parameters](./dynamic-params.md) - Handling dynamic route parameters
- Protected Routes (TODO)
- Error Handling (TODO)
- Metadata Generation (TODO)

## Common Patterns
1. Protected Routes
   - All routes under `(protected)` require authentication
   - Automatic redirect to login for unauthenticated users

2. Dynamic Routes
   - Model viewer: `/viewer/[modelId]`
   - Model editing: `/library/edit/[modelId]`
   - See [Dynamic Parameters](./dynamic-params.md) for implementation details

3. Static Routes
   - Home: `/`
   - Library: `/library`
   - Scene: `/viewer`

## Best Practices
- Follow dynamic parameter handling patterns
- Implement proper error boundaries
- Include loading states
- Add appropriate metadata

## Related Documentation
- [Development Setup](../../DEVELOPMENT_SETUP.md)
- [Authentication](../auth/README.md)
- [Troubleshooting](../../troubleshooting/README.md) 