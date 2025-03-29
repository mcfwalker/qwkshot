# Branch Strategy & Development Workflow

## Current Branch Structure

### Main Branches
- `main` - Original main branch containing the full project history
- `stable` - Primary development branch
  - Purpose: Contains all stable, working code including deployment improvements
  - Created: March 24, 2025
  - Base commit: `2b45a92` (docs: Reorganize documentation structure)
- `deployment/vercel` - Deployment-specific branch
  - Purpose: Contains Vercel-specific configurations and optimizations
  - Created: March 28, 2025
  - Base commit: From `stable` branch
  - Note: This branch should be regularly updated with improvements from `stable`

### Backup Branches
- `stable-backup-YYYY-MM-DD` - Backup of known-good stable state
  - Purpose: Safety net for restoring from a known-good state
  - Created: Before major changes or merges
  - Naming convention: Include date for easy reference
  - Example: `stable-backup-2025-03-29`

### Feature Branches
- `feature/ui-revamp-layout` - UI modernization and layout improvements
- `feature/llm-provider-switching` - LLM provider integration and switching
- `feature/ui-revamp` - Base UI improvements
- `feature/ui-revamp-integration` - Integration components
- `feature/ui-revamp-shoot` - Camera and shooting features
- `feature/ui-revamp-stage` - Stage and scene management

## Development Workflow

### Branch Usage Guidelines

1. **Stable Branch (`stable`)**
   - Primary branch for new feature development
   - Contains all stable code including deployment improvements
   - All new feature branches should be created from here
   - Must maintain a working state at all times
   - Regular testing and validation required

2. **Deployment Branch (`deployment/vercel`)**
   - Contains Vercel-specific configurations
   - Should be regularly updated with improvements from `stable`
   - Used for Vercel deployments
   - Maintains deployment-specific optimizations

3. **Feature Branches (`feature/*`)**
   - Created from `stable` branch
   - Follow naming convention: `feature/descriptive-name`
   - Should be focused on a single feature or improvement
   - Regular rebasing against `stable` recommended
   - IMPORTANT: Always test after major dependency updates

4. **Main Branch (`main`)**
   - Historical branch
   - Currently maintained for reference
   - May be deprecated in favor of `stable` in future

### Development Process

1. **Creating Backup (Before Major Changes)**
   ```bash
   # Create backup branch with date
   git checkout stable
   git checkout -b stable-backup-$(date +%Y-%m-%d)
   git push origin stable-backup-$(date +%Y-%m-%d)
   
   # Return to stable for changes
   git checkout stable
   ```

2. **Starting New Work**
   ```bash
   git checkout stable
   git pull origin stable
   git checkout -b feature/new-feature-name
   ```

3. **Regular Development**
   - Commit regularly with descriptive messages
   - Keep changes focused and atomic
   - Test changes locally before pushing

4. **Updating Feature Branches**
   ```bash
   git checkout feature/your-feature
   git rebase stable
   ```

5. **Merging Changes**
   - Create pull request against `stable` branch
   - Ensure all tests pass
   - Get code review
   - Squash and merge to maintain clean history
   - For critical changes, use test branch first:
     ```bash
     git checkout -b test/stable-merge
     git merge feature/your-feature
     # Test thoroughly before merging to stable
     ```

6. **Updating Deployment Branch**
   ```bash
   git checkout deployment/vercel
   git merge stable
   # Test deployment branch
   git push origin deployment/vercel
   ```

7. **Restoring from Backup (If Needed)**
   ```bash
   # If things go wrong, restore from backup
   git checkout stable
   git reset --hard stable-backup-YYYY-MM-DD
   git push origin stable --force
   # Note: Only use force push if absolutely necessary and you're sure about the backup
   ```

### Best Practices
1. Always check environment variables before starting development
2. Run health checks to verify server status
3. Keep documentation updated with new findings
4. Regular commits with descriptive messages
5. Use test branches for critical merges
6. Clear caches after major dependency updates
7. Create backup branches before major changes or merges
8. Keep backup branches for at least a week before cleanup
9. Document any force pushes and their reasons

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

### Best Practices
1. Always check environment variables before starting development
2. Run health checks to verify server status
3. Keep documentation updated with new findings
4. Regular commits with descriptive messages
5. Use test branches for critical merges
6. Clear caches after major dependency updates
7. Create backup branches before major changes or merges
8. Keep backup branches for at least a week before cleanup
9. Document any force pushes and their reasons

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
- Latest status report: [M3DV-SR-2025-03-27-1806.md](./status-reports/M3DV-SR-2025-03-27-1806.md) 