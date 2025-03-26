# Session Initialization Guide

## Pre-Session Checklist

### 1. Documentation Review
- [ ] Read the [Product Requirements Document](./PRD.md)
- [ ] Review the latest [Status Report](./status-reports/)
- [ ] Check the [Development Roadmap](./DEVELOPMENT_ROADMAP.md)
- [ ] Review [Development Setup](./DEVELOPMENT_SETUP.md)
- [ ] Understand [Branch Strategy](./BRANCH_STRATEGY.md)

### 2. Project State Assessment
- [ ] Verify current branch 
- [ ] Review any open pull requests
- [ ] Check recent commits
- [ ] Review any pending issues or tasks
- [ ] Verify environment variables in `.env.local`

### 3. Development Environment Setup
- [ ] Verify if server has been launched in background mode: `npm run dev &`
- [ ] Verify health checks at `/api/health`
- [ ] Monitor server logs for environment validation
- [ ] Check Supabase connection status
- [ ] Verify development tools and services

## Session Initialization Process

1. **Status Update**
   ```
   Please provide:
   - Current branch name (should be 'stable' or a feature branch)
   - Last status report reference
   - Current development priority
   - Any specific constraints or requirements
   - Environment status (all variables set correctly)
   ```

2. **AI Assistant Review**
   The AI will:
   - Confirm review of documentation
   - Perform thorough code review of relevant components
   - Analyze current codebase state
   - Verify environment setup
   - Check health monitoring status
   - Propose next steps

3. **Alignment Check**
   - AI presents summary and proposed plan
   - Developer reviews and approves/adjusts plan
   - Agree on immediate next steps
   - Verify all required tools and services are running

## Best Practices

### Branch Management
- Start new features from `stable` branch
- Follow feature branch naming: `feature/descriptive-name`
- Regular rebasing against `stable`
- Keep commits focused and well-documented
- Regular pushes to remote

### Server Management
- Use background mode for development server
- Monitor health checks (30-second intervals)
- Watch for environment validation messages
- Check server logs for warnings/errors
- Keep terminal window open during development

### Documentation Updates
- Update status reports after significant changes
- Document any new technical decisions
- Keep development roadmap current
- Note any deviations from PRD
- Update technical debt document as needed

### Communication Protocol
1. **AI Assistant's Initial Response**
   ```
   I've reviewed:
   - Current documentation state
   - Project codebase
   - Development priorities
   - Environment status
   - Health check status
   
   Current Status:
   [Summary of current state]
   
   Branch Information:
   - Current: [branch name]
   - Based on: stable ([commit hash])
   
   Environment Status:
   - Server: [running/stopped]
   - Health checks: [passing/failing]
   - Variables: [validated/issues]
   
   Proposed Next Steps:
   1. [Step 1]
   2. [Step 2]
   3. [Step 3]
   
   Would you like to proceed with this plan?
   ```

2. **Developer's Confirmation**
   - Review AI's assessment
   - Approve or adjust plan
   - Provide any additional context
   - Give explicit go-ahead

### Essential Context for AI Assistant
1. **Technical Context**
   - Current branch and its origin
   - Server running mode (background/standard)
   - Health check status
   - Environment validation status
   - Recent codebase changes
   - Testing requirements

2. **Project Context**
   - Sprint/milestone goals
   - Dependencies on other features
   - Performance requirements
   - User experience considerations

3. **Constraints**
   - Time limitations
   - Resource constraints
   - Technical limitations
   - Business requirements

## Session Workflow

1. **Initialization**
   ```
   Developer: Provides session context
   AI: Reviews and verifies environment
   Developer: Confirms environment status
   AI: Proposes plan
   Developer: Confirms plan
   ```

2. **Development Loop**
   ```
   AI: Implements/suggests changes
   Developer: Reviews changes
   AI: Adjusts based on feedback
   Developer: Approves implementation
   ```

3. **Session Closure**
   ```
   AI: Summarizes changes made
   Developer: Confirms completion
   AI: Suggests next steps
   Developer: Updates documentation
   ```

## Troubleshooting

### Common Issues
1. **Environment Setup**
   - Verify `.env.local` configuration
   - Check Supabase connectivity
   - Validate environment variables
   - Monitor health check responses

2. **Development Server**
   - Use background mode to prevent interruptions
   - Monitor server logs for warnings
   - Check health endpoint responses
   - Verify server process status

3. **State Management**
   - Confirm correct branch (`stable` or feature branch)
   - Verify database migrations
   - Check dependency versions
   - Monitor for cookie warnings

4. **Documentation Gaps**
   - Update relevant docs
   - Create missing documentation
   - Link related documents
   - Add new findings to technical debt

## Additional Resources

- [Branch Strategy](./BRANCH_STRATEGY.md)
- [Technical Architecture Overview](./PRD.md#technical-architecture)
- [Development Setup Guide](./DEVELOPMENT_SETUP.md)
- [Testing Strategy](./PRD.md#testing-strategy)
- [Error Handling Guidelines](./PRD.md#error-handling--edge-cases)
- [Technical Debt](./TECHNICAL_DEBT.md)

Remember: The key to a successful session is clear communication and mutual understanding of goals and constraints. Always verify understanding before proceeding with implementation. 