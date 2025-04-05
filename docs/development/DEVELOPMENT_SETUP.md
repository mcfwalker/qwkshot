# Modern 3D Viewer - Development Setup Guide

## Prerequisites

### Required Software
- Node.js (v18 or higher)
- npm (comes with Node.js)
- Git

### Environment Variables
The application requires the following environment variables to be set in `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

For detailed information about authentication implementation and security considerations, see the [Authentication Documentation](./features/auth/README.md).

## Getting Started

1. **Clone the Repository**
```bash
git clone [repository-url]
cd modern-3d-viewer
```

2. **Install Dependencies**
```bash
npm install
```

3. **Start Development Server**
There are two ways to start the development server:

a. Standard mode:
```bash
npm run dev
```

b. Background mode (recommended for AI assistant sessions):
```bash
npm run dev &
```
Background mode prevents terminal interactions from interrupting the server.

The application will be available at http://localhost:3000

## Environment Validation

The server performs automatic environment validation on startup:

1. **Client-side Checks**
   ```
   Client - ENV check - NEXT_PUBLIC_SUPABASE_URL exists: true
   Client - ENV check - NEXT_PUBLIC_SUPABASE_ANON_KEY exists: true
   Client - ENV check - Key length: 208
   ```

2. **Server-side Checks**
   ```
   Server - Environment: development
   Server - Supabase URL: [your-url]
   Server - API Key exists: true
   Server - API Key length: 208
   ```

## Health Monitoring

The application includes built-in health monitoring:

1. **Health Check Endpoint**
   - Endpoint: `/api/health`
   - Automatic checks every 30 seconds
   - Typical response time: 2-7ms
   - Monitors server responsiveness

2. **Status Monitoring**
   - Check server logs for health status
   - Monitor response times
   - Track successful/failed health checks

## Troubleshooting

For detailed troubleshooting guidance, see our [Troubleshooting Guide](./troubleshooting/README.md).

Common issues:
1. **Environment Setup**
   - Verify `.env.local` exists and has correct values
   - Check server logs for environment validation results
   - Monitor health check responses

2. **Development Server**
   - Use background mode (`npm run dev &`) to prevent interruptions
   - Clear `.next` cache if you see build issues
   - Monitor health checks for server status

3. **Major Dependency Updates**
   When updating major versions of core dependencies (e.g., Tailwind, Next.js):
   ```bash
   # Clean installation steps
   rm -rf node_modules .next
   npm install
   npm run dev
   ```
   
   Important considerations:
   - Always test in a clean environment
   - Verify configuration compatibility
   - Check for breaking changes in dependency documentation
   - Test in a browser without extensions for accurate error reporting

## Additional Resources

- [Product Requirements Document](./PRD.md)
- [Development Roadmap](./DEVELOPMENT_ROADMAP.md)
- [Branch Strategy](./BRANCH_STRATEGY.md)
- [Troubleshooting Guide](./troubleshooting/README.md)
- [Authentication Documentation](./features/auth/README.md)