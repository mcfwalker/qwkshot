# For Human Developers

## Before Starting a Session

### Documentation to Share with LLM
- [ ] `docs/LLM_CONTEXT.md` (universal project context)
- [ ] Latest status report from `docs/status-reports/`
- [ ] `docs/NEXT_STEPS.md` (if it exists)
- [ ] Any feature-specific documentation relevant to today's tasks

### Environment Setup
- [ ] Verify you're on the correct branch
- [ ] Pull latest changes from remote
- [ ] Start development server in background: `npm run dev &`
- [ ] Verify server is running and health checks pass

## During the Session
- [ ] Be specific about your goals for the session
- [ ] Reference specific files and line numbers when discussing code
- [ ] Ask for explanations when needed
- [ ] Request incremental changes rather than large refactors

## Ending a Session

### Documentation Updates
- [ ] Ask LLM to generate a status report if significant progress was made
- [ ] Ask LLM to update `docs/NEXT_STEPS.md` with:
  - Completed tasks
  - Remaining tasks
  - Any blockers or issues encountered
  - Next session's priorities

### Code Management
- [ ] Commit all changes with descriptive messages
- [ ] Push changes to remote repository
- [ ] Create or update issues in project management software if needed

### Session Wrap-up
- [ ] Stop the development server
- [ ] Document any environment issues encountered
- [ ] Note any follow-up tasks for next session

*This document is designed to be a quick reference checklist for human developers working with the LLM assistant.* 