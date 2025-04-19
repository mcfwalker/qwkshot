# For Human Developers

## Before Starting a Session

"Hi, let's continue working on [Current Focus Area, e.g., fixing test failures / implementing fly_by motion]. Please review these documents to get up to speed: docs/LLM_CONTEXT.md, docs/refactors/ASSISTANTS_API_REFACTOR_PLAN.md (for context/future items), docs/features/camera-animation/ARCHITECTURE.md. Note that for specifics on the Prompt-to-Path architecture, the architecture document contains the most current details..."

### Documentation to Share with LLM
- [X] `docs/LLM_CONTEXT.md` (Always share - provides universal project context)
- [X] **Latest Status Report** from `docs/status-reports/` (Always share - provides current state and next steps)
- [ ] **Key Architecture/Plan Docs (Share as needed):**
    - `docs/features/camera-animation/ARCHITECTURE.md` (If working on/discussing the P2P pipeline)
    - `docs/refactors/ASSISTANTS_API_REFACTOR_PLAN.md` (If referencing refactor decisions/history/future items)
    - `docs/TECHNICAL_DESIGN.md` (If discussing broader technical implementation)
    - `docs/PRD.md` (If discussing product requirements)
- [ ] **Specific Files (Share as needed):**
    - Any code files (`.ts`, `.tsx`) directly related to the session's task.
    - Specific documentation files relevant to the task (e.g., `REGRESSION_PROMPTS.md` if testing).

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

### Code Management
- [ ] Commit all changes with descriptive messages
- [ ] Push changes to remote repository
- [ ] Create or update issues in project management software if needed

### Session Wrap-up
- [ ] Stop the development server
- [ ] Document any environment issues encountered
- [ ] Note any follow-up tasks for next session

*This document is designed to be a quick reference checklist for human developers working with the LLM assistant.* 