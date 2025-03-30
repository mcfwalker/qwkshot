# Branch Strategy & Development Workflow

## Current Branch Structure

### Main Branches
- `main` - Primary development and production branch
  - Purpose: Contains all stable, working code
  - Source of truth for production deployments
  - All new feature branches should be created from here

- `deployment/vercel` - Deployment-specific branch
  - Purpose: Contains Vercel-specific configurations and optimizations
  - Used for testing production deployment fixes
  - Should be regularly synchronized with `main`

### Feature Branches
- Created as needed using pattern `feature/*`
- Always branched from `main`
- Merged back to `main` when complete
- Deleted after successful merge

## Development Workflow

### Branch Usage Guidelines

1. **Main Branch (`main`)**
   - Primary branch for all development
   - Source of truth for production code
   - Must maintain a working state at all times
   - All feature branches created from here
   - Regular testing and validation required

2. **Deployment Branch (`deployment/vercel`)**
   - Special purpose branch for deployment-specific issues
   - Used ONLY for:
     - Testing Vercel configuration changes
     - Debugging production-only issues
     - Implementing deployment-specific optimizations
   - NOT used for regular feature development
   - Workflow for deployment fixes:
     ```bash
     # When encountering a production-specific issue:
     git checkout deployment/vercel
     git pull origin main            # Get latest changes
     # Make deployment-specific fixes
     git commit -m "fix: describe deployment fix"
     git push origin deployment/vercel
     # Test in Vercel preview deployment
     # If successful, merge back to main:
     git checkout main
     git merge deployment/vercel
     git push origin main
     ```

3. **Feature Branches (`feature/*`)**
   - Created from `main` branch
   - Follow naming convention: `feature/descriptive-name`
   - Should be focused on a single feature or improvement
   - Regular rebasing against `main` recommended
   - Deleted after successful merge

### Development Process

1. **Starting New Work**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/new-feature-name
   ```

2. **Regular Development**
   - Commit regularly with descriptive messages
   - Keep changes focused and atomic
   - Test changes locally before pushing

3. **Updating Feature Branches**
   ```bash
   git checkout feature/your-feature
   git rebase main
   ```

4. **Merging Changes**
   - Create pull request against `main` branch
   - Ensure all tests pass
   - Get code review
   - Squash and merge to maintain clean history
   - Delete feature branch after successful merge

5. **Updating Deployment Branch**
   ```bash
   git checkout deployment/vercel
   git merge main
   # Test deployment branch
   git push origin deployment/vercel
   ```

### Best Practices
1. Always check environment variables before starting development
2. Run health checks to verify server status
3. Keep documentation updated with new findings
4. Regular commits with descriptive messages
5. Use test branches for critical merges
6. Clear caches after major dependency updates
7. Create backup branches before major changes if needed
8. Document any force pushes and their reasons

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

3. Dependency Updates
   - Clear caches when updating major dependencies
   - Test in clean environment after updates
   - Verify configuration compatibility
   - Document breaking changes

## Future Considerations

1. **Branch Strategy Maintenance**
   - Regular review of branch structure
   - Clean up of merged feature branches
   - Monitor deployment branch synchronization

2. **Documentation Updates**
   - Regular reviews of this document
   - Update as new patterns emerge
   - Keep aligned with team practices

## References
- [DEVELOPMENT_SETUP.md](./DEVELOPMENT_SETUP.md) - Detailed setup instructions
- [TECHNICAL_DEBT.md](./TECHNICAL_DEBT.md) - Known issues and planned improvements
- Latest status report: [M3DV-SR-2025-03-27-1806.md](./status-reports/M3DV-SR-2025-03-27-1806.md)

### Deployment Process

1. **Regular Feature Deployments**
   - Feature branches get automatic preview deployments
   - Merged to `main` for production deployment
   - Vercel automatically deploys `main` to production

2. **Production-Specific Issues**
   - Use `deployment/vercel` branch
   - Test changes in preview deployment
   - Merge working fixes back to `main`
   - Vercel deploys to production

3. **Vercel Environments**
   - Preview Deployments:
     - Created for every push to any branch
     - Used for testing before production
     - URL format: `project-name-git-branch-name.vercel.app`
   
   - Production Deployment:
     - Only from the `main` branch
     - Your live site
     - URL: `your-domain.com` or `project-name.vercel.app` 