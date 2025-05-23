# Troubleshooting Guide

## Common Issues and Solutions

### 1. Authentication Issues

#### Cookie Warning in Library Route
```
[Error: Route "/library" used `cookies().get()`. `cookies()` should be awaited before using its value.]
```

**Cause**: Synchronous cookie access in server components.
**Impact**: Warning only, functionality still works.
**Solution**: 
- This issue has been fixed in [Status Report M3DV-SR-2025-03-24-1557](../status-reports/M3DV-SR-2025-03-24-1557.md)
- The fix involved properly awaiting the cookies() function in createServerClient:
```typescript
// Create a server component client that uses cookies for auth
export async function createServerClient() {
  // Next.js cookies() returns a Promise as of Next.js 14
  const cookieStore = await cookies()
  
  // Create the client using the awaited cookie store
  return createServerComponentClient<Database>({
    cookies: () => {
      // Return properly typed cookie handler
      return {
        get: cookieStore.get.bind(cookieStore),
        getAll: cookieStore.getAll.bind(cookieStore)
      } as any
    }
  })
}
```

#### Session Management
1. **Invalid Session**
   - Clear browser cookies
   - Sign out and sign back in
   - Check browser console for auth errors

2. **Authentication Failures**
   - Verify Supabase URL and key in `.env.local`
   - Check network tab for failed auth requests
   - Review [Authentication Documentation](../features/auth/README.md)

#### OpenAI API Authentication
```
Error: Authentication error with OpenAI API. You are using a project-based API key (sk-proj-*). 
Make sure OPENAI_ORGANIZATION is set correctly in your environment variables.
```

**Cause**: Issues with OpenAI API key configuration or format
**Impact**: Camera path generation and other OpenAI features fail
**Solutions**: 
1. Verify API key format:
   - Check for correct key format (should start with `sk-proj-`)
   - Ensure no extra spaces or quotes in `.env.local`
   - Verify key matches exactly with OpenAI dashboard

2. If key verification fails:
   - Generate new API key at https://platform.openai.com/api-keys
   - Copy key immediately (it won't be shown again)
   - Update `.env.local` with new key
   - Restart development server

3. Diagnostic steps:
   - Check API key in OpenAI dashboard
   - Verify organization ID is set correctly
   - Restart server after any changes
   - Clear browser cache if needed

### 2. Development Server Issues

#### Terminal Interruptions
**Symptom**: Server stops responding during AI assistant interactions
**Solution**: Use background mode
```bash
npm run dev &
```

#### Server Health Monitoring
Normal health check patterns:
```
GET /api/health 200 in 2-7ms
```

Troubleshooting steps if health checks fail:
1. Check server logs
2. Verify port 3000 is available
3. Clear development caches:
   ```bash
   rm -rf .next
   npm install
   ```

### 3. Environment Setup

#### Environment Validation
Expected validation output:
```
Client - ENV check - NEXT_PUBLIC_SUPABASE_URL exists: true
Client - ENV check - NEXT_PUBLIC_SUPABASE_ANON_KEY exists: true
Client - ENV check - Key length: 208

Server - Environment: development
Server - Supabase URL: [your-url]
Server - API Key exists: true
Server - API Key length: 208
```

If validation fails:
1. Check `.env.local` exists
2. Verify all required variables are set
3. Confirm API key format and length
4. Restart development server

### 4. Build and Compilation

#### Common Build Errors
1. **Module Not Found**
   - Run `npm install`
   - Clear node_modules: `rm -rf node_modules && npm install`
   - Check package.json for correct dependencies

2. **TypeScript Errors**
   - Check for type mismatches
   - Update type definitions
   - Review recent code changes

3. **Compilation Warnings**
   Normal compilation pattern:
   ```
   ✓ Compiled in 100-200ms (1141 modules)
   ```
   
   If compilation is slow or failing:
   - Clear Next.js cache
   - Check for infinite loops
   - Review recent component changes

### 5. Performance Issues

#### Slow Response Times
Normal response times:
- Health checks: 2-7ms
- Page loads: 50-1500ms
- API routes: <500ms

If responses are slow:
1. Check development machine resources
2. Monitor browser console for errors
3. Review network requests
4. Check for unnecessary re-renders

#### Memory Usage
If the application becomes unresponsive:
1. Check browser memory usage
2. Review large data structures
3. Monitor WebGL context
4. Consider implementing pagination

### 6. Git and Branch Management

#### Branch Issues
1. **Wrong Branch**
   ```bash
   git checkout stable
   git pull origin stable
   git checkout -b feature/your-feature
   ```

2. **Conflicts with Stable**
   ```bash
   git checkout your-feature-branch
   git rebase stable
   ```

3. **Lost Changes**
   ```bash
   git reflog  # Find lost commits
   git reset --hard HEAD@{n}  # Restore to specific point
   ```

### 7. Vercel Deployment Issues

#### Static Generation Errors
```
Error: Dynamic server usage: Route /library couldn't be rendered statically because it used `cookies`
```

**Cause**: Next.js attempts to statically generate routes that use dynamic features.
**Impact**: Deployment build fails.
**Solution**: 
- Add the `force-dynamic` directive to page route:
  ```typescript
  // Add to the top of the route file
  export const dynamic = 'force-dynamic';
  ```
- For multiple related routes, consider using a route group with a shared layout that sets the directive

#### Suspense Boundary Errors
```
Error: useSearchParams() should be wrapped in a suspense boundary at page "/auth/sign-in"
```

**Cause**: Components using `useSearchParams()` require a Suspense boundary.
**Impact**: Build fails.
**Solution**:
- Wrap components using `useSearchParams()` in a Suspense boundary:
  ```jsx
  import { Suspense } from 'react';
  
  // ... in your component
  <Suspense fallback={<div>Loading...</div>}>
    <ComponentUsingSearchParams />
  </Suspense>
  ```

#### Serverless Function Timeouts
```
Failed to load resource: the server responded with a status of 504 ()
```

**Cause**: LLM API routes exceed the default 10-second Vercel function timeout.
**Impact**: API calls for camera path generation fail.
**Solutions**:
1. In Vercel Dashboard:
   - Go to Project > Settings > Functions
   - Increase the timeout under "General" from default 10s to 60s
   - Save changes and redeploy

2. For local development:
   - Test with longer operations to identify potential timeout issues
   - Consider implementing optimistic UI updates

#### Linting and Type Checking Errors
```
ESLint: Error count increased to XX
TypeScript error: Type 'X' is not assignable to type 'Y'
```

**Cause**: Stricter validation in production build compared to dev environment.
**Impact**: Build fails.
**Temporary Solution**:
- Disable checks in `next.config.js`:
  ```js
  module.exports = {
    eslint: {
      ignoreDuringBuilds: true,
    },
    typescript: {
      ignoreBuildErrors: true,
    },
  };
  ```

**Proper Solution**:
- Fix all ESLint errors locally
- Address all TypeScript type issues
- Re-enable checks in config before production launch

#### Cookie Warning in API Routes
```
Route "/api/some-route" used cookies().get(...). cookies() should be awaited before using its value.
```

**Cause**: Synchronous cookie access in server components or API routes.
**Impact**: Warning messages, potential issues in production.
**Solution**:
- Update all API routes to use async cookie handling:
  ```typescript
  // Before
  const cookieStore = cookies();
  
  // After
  const cookieStore = await cookies();
  ```
- Update Supabase auth client creation to properly handle async cookies

## Debugging Tools

### 1. Server Logs
- Watch for environment validation
- Monitor health check responses
- Check for authentication issues
- Review compilation warnings

### 2. Browser Tools
- Network tab for API calls
- Console for JavaScript errors
- Application tab for cookies/storage
- Performance tab for rendering issues

### 3. Development Commands
```bash
# Clear development cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules
npm install

# Run server with logs
npm run dev > server.log 2>&1 &

# Check server status
lsof -i :3000
```

## Getting Help

1. Check documentation:
   - [Development Setup](../DEVELOPMENT_SETUP.md)
   - [Technical Debt](../TECHNICAL_DEBT.md)
   - [Authentication Guide](../features/auth/README.md)

2. Review recent:
   - Status reports
   - Git commits
   - Pull requests

3. Create detailed bug reports including:
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Environment details
   - Relevant logs 