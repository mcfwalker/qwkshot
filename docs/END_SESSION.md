# End of Session Checklist

This document provides a systematic approach to wrapping up development sessions. Following these steps ensures proper documentation, code quality, and smooth continuation in the next session.

## 1. Documentation Updates

### Status Report
```bash
# Get current timestamp
date "+%Y-%m-%d-%H%M"
```
- IMPORTANT: Read `/docs/status-reports/README.md` for required format and naming convention
- Create new status report in `/docs/status-reports` using format: `M3DV-SR-YYYY-MM-DD-HHMM.md`
- Update README.md in status-reports directory with new entry
- Use template format from README.md in that directory
- Include: Summary, Achievements, Challenges, Next Steps, Notes

### Technical Debt
- Review and update `TECHNICAL_DEBT.md`:
  - [ ] Add new issues discovered
  - [ ] Update status of existing items
  - [ ] Add any workarounds implemented
  - [ ] Note any performance concerns

### Feature Documentation
- For each modified feature:
  - [ ] Update relevant docs in `/docs/features/`
  - [ ] Update API documentation if endpoints changed
  - [ ] Update usage examples if behavior changed
  - [ ] Add new configuration options

### Development Roadmap
- Review `DEVELOPMENT_ROADMAP.md`:
  - [ ] Mark completed milestones
  - [ ] Update timeline estimates
  - [ ] Note any scope changes
  - [ ] Update success criteria

## 2. Code Quality

### Linting & Debug
- [ ] Fix remaining linter errors
- [ ] Remove debug console.log statements
- [ ] Address TODO comments added during session
- [ ] Check error handling implementation

### Testing Requirements
- Note needed testing:
  ```markdown
  - [ ] Unit tests for new functions
  - [ ] Integration tests for modified flows
  - [ ] Browser compatibility testing
  - [ ] Mobile responsiveness verification
  ```

## 3. Environment & Dependencies

### Environment Updates
- Document any new:
  - [ ] Environment variables
  - [ ] Configuration settings
  - [ ] Third-party API keys
  - [ ] Service dependencies

### Package Management
- If dependencies modified:
  - [ ] Update package documentation
  - [ ] Note any version constraints
  - [ ] Document breaking changes
  - [ ] Update installation instructions

## 4. Next Session Planning

### Blockers & Dependencies
- List items blocking progress:
  ```markdown
  - External dependencies:
    - Third-party services
    - Team decisions needed
    - Resource requirements
  - Internal blockers:
    - Technical limitations
    - Missing information
    - Required refactoring
  ```

### Research & Questions
- Document:
  - [ ] Areas needing research
  - [ ] Questions for team/stakeholders
  - [ ] Technical spikes required
  - [ ] Performance investigations needed

## 5. Security & Performance

### Security Checklist
- [ ] Review security implications of changes
- [ ] Check for exposed secrets/credentials
- [ ] Verify API endpoint protection
- [ ] Document new security considerations

### Performance Review
- [ ] Note performance impacts
- [ ] Document optimization needs
- [ ] List resource usage concerns
- [ ] Update rate limiting documentation

## 6. Version Control

### Git Hygiene
- [ ] Commit all changes
- [ ] Update .gitignore if needed
- [ ] Document branch strategy changes
- [ ] Note any large files added to LFS

### Final Steps
1. Review this checklist
2. Mark completed items
3. Note any skipped items and why
4. Add any project-specific items for next time

## Template for Quick Copy

```markdown
## End of Session Quick Checklist

1. [ ] Create status report
2. [ ] Update technical debt
3. [ ] Update feature docs
4. [ ] Review roadmap
5. [ ] Clean up code
6. [ ] Note testing needs
7. [ ] Document env changes
8. [ ] List blockers
9. [ ] Check security
10. [ ] Commit changes
```

Remember: This checklist is a living document. Add or modify items based on project needs and team feedback. 