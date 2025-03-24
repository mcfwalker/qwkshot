# Authentication

## Overview
Authentication in Modern 3D Viewer is implemented using Supabase Auth, providing a secure and scalable solution for user management and session handling.

## Implementation Details

### Core Components
- `createServerClient` - Server-side Supabase client
- `createClientComponentClient` - Client-side Supabase client
- Protected route middleware
- Authentication layout and pages

### File Structure
```
src/
├── app/
│   ├── auth/
│   │   ├── layout.tsx       # Split-screen auth layout
│   │   ├── sign-in/        # Sign-in page
│   │   └── callback/       # OAuth callback handling
│   └── (protected)/        # Protected routes group
├── lib/
│   ├── supabase.ts         # Client-side Supabase setup
│   └── supabase-server.ts  # Server-side Supabase setup
└── middleware.ts           # Route protection
```

### Authentication Flow
1. User accesses protected route
2. Middleware checks for valid session
3. If no session, redirect to sign-in
4. After successful sign-in, redirect to original route

### Protected Routes
- `/library/*`
- `/viewer/*`
- Any route under `(protected)/`

### Known Issues
See [TECHNICAL_DEBT.md](../../TECHNICAL_DEBT.md) for current issues and planned improvements.

## Usage

### Server Components
```typescript
// In server component
const supabase = await createServerClient()
const { data: { session } } = await supabase.auth.getSession()
```

### Client Components
```typescript
// In client component
const supabase = createClientComponentClient()
const { data: { user } } = await supabase.auth.getUser()
```

### Middleware
```typescript
// Protected route check
const session = await supabase.auth.getSession()
if (!session && isProtectedRoute) {
  return NextResponse.redirect('/auth/sign-in')
}
```

## Security Considerations
- CSRF protection enabled
- Secure cookie handling
- XSS prevention measures
- Session timeout handling

## Testing
- Authentication flow tests
- Protected route tests
- Session management tests
- Error handling tests 