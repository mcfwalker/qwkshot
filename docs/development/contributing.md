# Contributing Guidelines

Thank you for contributing to the Modern 3D Viewer project! These guidelines help ensure consistency and quality across the codebase and documentation.

## Code Contributions

### Branching Strategy
- Please follow the workflow outlined in [`BRANCH_STRATEGY.md`](../BRANCH_STRATEGY.md).
- Create feature branches from `stable`.
- Keep commits small and focused.
- Rebase your feature branch onto `stable` regularly.
- Submit Pull Requests against the `stable` branch.

### Coding Style
- Follow standard TypeScript and React best practices.
- Use the project's configured linter (ESLint) and formatter (Prettier). Run `npm run lint` and `npm run format`.
- Write clear, concise, and well-commented code where necessary.

### Commits
- Write descriptive commit messages. Consider using the [Conventional Commits](https://www.conventionalcommits.org/) format (e.g., `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`).

### Testing
- Add unit or integration tests for new features or bug fixes where appropriate.
- Ensure existing tests pass before submitting a Pull Request.
- Refer to the [`docs/testing/README.md`](./testing/README.md) for more details on the testing strategy.

## Documentation Contributions

Maintaining up-to-date and consistent documentation is crucial for this project, especially when working with AI assistants.

### General Principles
- **Clarity and Conciseness**: Write clearly and avoid jargon where possible.
- **Accuracy**: Ensure documentation reflects the current state of the project.
- **Consistency**: Use the defined patterns and templates.
- **Cross-Linking**: Link related documents together for easier navigation.
- **Audience**: Consider the audience (developers, AI assistant, potentially future users).

### Updating Documentation
- Documentation updates should ideally be part of the same commit or PR that introduces the corresponding code change.
- Follow the checklists in [`GET_STARTED.md`](../GET_STARTED.md) and [`END_SESSION.md`](../END_SESSION.md) regarding documentation updates during development sessions.

### Documentation Patterns & Templates

Use these templates for consistency when creating specific documentation items:

#### 1. Status Report Template (`docs/status-reports/M3DV-SR-YYYY-MM-DD-HHMM.md`)

```markdown
# Status Report: [Date YYYY-MM-DD HH:MM]

## Session Overview
- **Duration:** [e.g., 2.5 hours]
- **Focus Area(s):** [e.g., Authentication Flow, UI Styling]
- **Key Achievements:** [Bulleted list of significant accomplishments]
- **Commit(s):** [Link(s) to relevant commit(s) if applicable]

## Technical Updates
- **Code Changes:** [Brief summary of major code modifications]
- **New Issues/Tech Debt:** [Link or describe any new items added to TECHNICAL_DEBT.md]
- **Resolved Issues/Tech Debt:** [Link or describe items addressed]

## Environment Status (If relevant)
- **Server Status:** [e.g., Stable, Encountered build issues]
- **Dependencies:** [e.g., Added `new-package`, Updated `major-lib` to v2]
- **Log Issues:** [Note any persistent warnings or errors observed]

## Challenges & Blockers
- [Bulleted list of significant challenges faced during the session]
- [List any items blocking progress for the next session]

## Next Steps
- **Immediate Tasks:** [Bulleted list of concrete tasks for the next session]
- **Research/Questions:** [Note any areas needing investigation]

## Notes
- [Any additional relevant information, observations, or decisions made]

Remember to also update docs/status-reports/README.md with a link to the new report.

2. Technical Debt Item Format (TECHNICAL_DEBT.md)
## [Item Title - e.g., Performance Optimization: OrbitControls Event Listeners]
**Status**: [Open | In Progress | Resolved | Archived]
**Priority**: [High | Medium | Low]
**Impact**: [Brief description of the negative impact, e.g., Performance warning in console, potential scroll responsiveness issues]
**Description**: [Detailed explanation of the issue or debt]
**Location**: [Specific file(s) and line number(s) if applicable, e.g., `OrbitControls.js:311`, `src/components/viewer/CameraPanel/index.tsx`]
**Current Workaround (if any)**: [Describe how the issue is currently being managed]
**Proposed Solution / Future Improvement**: [Outline the ideal fix or improvement]
**Resolution (if Status is Resolved/Archived)**: [Brief summary of the fix and link to the Status Report or Commit, e.g., Fixed in commit `571ec45`, see M3DV-SR-2025-03-24-1557.md]
**Related Documentation**: [Links to relevant docs, e.g., `[Authentication Documentation](./features/auth/README.md)`]
**Notes**: [Any extra context]

3. Feature Documentation Structure (General Guide for docs/features/*)
Each feature directory (e.g., docs/features/auth/) should ideally contain a README.md covering:

Overview: What the feature is and its purpose.

Implementation Details: Key components, libraries used, architectural decisions specific to this feature.

Usage / API: How to use the feature (e.g., relevant hooks, API endpoints).

Configuration: Any specific setup or environment variables needed.

Security Considerations (if applicable).

Known Issues / Limitations: Link to relevant TECHNICAL_DEBT.md items.

Related Documentation: Links to PRD, Technical Design, etc.

4. Issue Documentation (e.g., for Bug Reports / Troubleshooting)
## Issue: [Concise Title]
**Component/Area**: [e.g., Viewer Canvas, Authentication, API Route `/api/models/upload`]
**Observed Behavior**: [Detailed description of what is happening]
**Expected Behavior**: [What should be happening instead]
**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
...
**Environment**:
- OS: [e.g., macOS Sonoma]
- Browser: [e.g., Chrome 123]
- Node Version: [e.g., v18.18.0]
**Error Message(s) / Logs**:
\`\`\`
[Paste relevant error messages or log snippets here]
\`\`\`
**Potential Cause / Investigation Notes**: [Any initial thoughts or findings]
**Related Issues/Docs**: [Links]