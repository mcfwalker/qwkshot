# Development Session Management

## Session Start Checklist

### 1. Environment Setup
- [ ] Review `GET_STARTED.md` for any new setup requirements
- [ ] Verify environment variables are correctly set
- [ ] Check development server status
- [ ] Review recent status reports for ongoing issues

### 2. Documentation Review
- [ ] Check `TECHNICAL_DEBT.md` for known issues
- [ ] Review relevant feature documentation
- [ ] Check `DEVELOPMENT_ROADMAP.md` for current priorities

### 3. Development State
- [ ] Confirm current branch
- [ ] Check for uncommitted changes
- [ ] Review recent commits
- [ ] Check for any pending PRs

## Session End Checklist

### 1. Code Management
- [ ] Commit any changes
- [ ] Push to remote repository
- [ ] Create/update PRs if needed
- [ ] Update branch status

### 2. Documentation Updates
- [ ] Update status report with progress
- [ ] Add new issues to `TECHNICAL_DEBT.md`
- [ ] Update relevant feature documentation
- [ ] Document any new environment requirements

### 3. Next Steps
- [ ] Document pending tasks
- [ ] Note any blockers
- [ ] Plan next session priorities
- [ ] Update roadmap if needed

## Required Documents for Each Session

### Session Start
1. `GET_STARTED.md` - For environment setup
2. `TECHNICAL_DEBT.md` - For known issues
3. Most recent status report
4. Relevant feature documentation

### Session End
1. New status report
2. Updated `TECHNICAL_DEBT.md`
3. Updated feature documentation if modified
4. Updated roadmap if priorities changed

## Documentation Patterns

### 1. Issue Documentation
```markdown
## Issue Title
**Status**: [Open/In Progress/Resolved]
**Priority**: [High/Medium/Low]
**Impact**: [Description of impact]
**Reproduction Steps**:
1. [Step 1]
2. [Step 2]
**Expected Behavior**: [Description]
**Actual Behavior**: [Description]
**Environment**:
- OS: [OS Version]
- Browser: [Browser Version]
- Node: [Node Version]
**Related Issues**: [Links to related issues]
```

### 2. Feature Documentation
```markdown
## Feature Name
**Status**: [In Development/Complete/Planned]
**Description**: [Brief description]
**Implementation Details**:
- [Key point 1]
- [Key point 2]
**Dependencies**:
- [Dependency 1]
- [Dependency 2]
**Testing Requirements**:
- [Test case 1]
- [Test case 2]
**Related Documentation**:
- [Link to related doc 1]
- [Link to related doc 2]
```

### 3. Environment Issue
```markdown
## Environment Issue
**Component**: [Component Name]
**Error Message**: [Full error message]
**Frequency**: [Always/Intermittent]
**Environment Variables**:
- [Variable 1]: [Status]
- [Variable 2]: [Status]
**Logs**:
```[Relevant log snippet]```
**Resolution Steps**:
1. [Step 1]
2. [Step 2]
```

## Status Report Template

```markdown
# Status Report: [DATE]

## Session Overview
- Duration: [TIME]
- Focus Area: [AREA]
- Key Achievements: [LIST]

## Technical Updates
- Code Changes: [SUMMARY]
- New Issues: [LIST]
- Resolved Issues: [LIST]

## Environment Status
- Server Status: [STATUS]
- Environment Variables: [STATUS]
- Dependencies: [STATUS]
- Log Issues: [LIST OF LOG ISSUES]

## Performance Metrics
- Compilation Time: [TIME]
- Health Check Response: [TIME]
- Error Rate: [RATE]
- Memory Usage: [USAGE]

## Next Steps
- Immediate Tasks: [LIST]
- Blockers: [LIST]
- Dependencies: [LIST]

## Notes
[ANY ADDITIONAL INFORMATION]
``` 