# Branch Strategy & Development Workflow

## Current Branch Structure

### Main Branches
- `main` - Original main branch containing the full project history
- `stable` - New stable foundation branch created from commit `2b45a92`
  - Purpose: Provides a clean, working state for future development
  - Created: March 24, 2025
  - Base commit: `2b45a92` (docs: Reorganize documentation structure)

### Feature Branches
- `feature/video-export` - Video export functionality
- `feature/navigation-enhancements` - Navigation system improvements

## Development Workflow

### Branch Usage Guidelines

1. **Stable Branch (`stable`)**
   - Primary branch for new feature development
   - All new feature branches should be created from here
   - Must maintain a working state at all times
   - Regular testing and validation required

2. **Feature Branches (`feature/*`)**
   - Created from `stable` branch
   - Follow naming convention: `feature/descriptive-name`
   - Should be focused on a single feature or improvement
   - Regular rebasing against `stable` recommended

3. **Main Branch (`main`)**
   - Historical branch
   - Currently maintained for reference
   - May be deprecated in favor of `stable` in future

### Development Process

1. **Starting New Work**
   ```bash
   git checkout stable
   git pull origin stable
   git checkout -b feature/new-feature-name
   ```

2. **Regular Development**
   - Commit regularly with descriptive messages
   - Keep changes focused and atomic
   - Test changes locally before pushing

3. **Updating Feature Branches**
   ```bash
   git checkout feature/your-feature
   git rebase stable
   ```

4. **Merging Changes**
   - Create pull request against `stable` branch
   - Ensure all tests pass
   - Get code review
   - Squash and merge to maintain clean history

## Environment Setup

### Development Server
- Run with `npm run dev`
- Access at `http://localhost:3000`
- Health checks every 30 seconds
- Environment variables validated on startup

### Required Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Known Issues & Considerations

### Current Challenges
1. Cookie warning in `/library` route
   - Warning about synchronous cookie access
   - Planned for future sprint
   - Does not affect functionality

2. Development Server Interruptions
   - Solution: Run server in background using `npm run dev &`
   - Prevents chat interactions from interrupting server

### Best Practices
1. Always check environment variables before starting development
2. Run health checks to verify server status
3. Keep documentation updated with new findings
4. Regular commits with descriptive messages

## Future Considerations

1. **Branch Strategy Evolution**
   - Consider making `stable` the default branch
   - Plan migration path for existing feature branches
   - Document process for handling legacy code

2. **Documentation Updates**
   - Regular reviews of this document
   - Update as new patterns emerge
   - Keep aligned with team practices

## References
- [DEVELOPMENT_SETUP.md](./DEVELOPMENT_SETUP.md) - Detailed setup instructions
- [TECHNICAL_DEBT.md](./TECHNICAL_DEBT.md) - Known issues and planned improvements
- Latest status report: [M3DV-SR-2025-03-24-1229.md](./status-reports/M3DV-SR-2025-03-24-1229.md) 