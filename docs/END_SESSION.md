# End of Session Checklist

Follow these steps systematically to wrap up a development session, ensuring code quality, documentation accuracy, and a smooth handover for the next session (whether by you or the AI).

*(Reference the new `docs/CONTRIBUTING.md` for documentation format guidelines if needed)*

## 1. Code Quality & Version Control

*   [ ] **Review Changes**: Briefly review all code modifications made during the session.
*   [ ] **Linting & Formatting**: Run `npm run lint` and `npm run format` (or equivalent commands) and fix any issues.
*   [ ] **Remove Debug Code**: Remove temporary `console.log` statements, commented-out code blocks, or test data unless explicitly intended to remain.
*   [ ] **Address TODOs**: Review and address any `// TODO:` comments added during the session, either resolving them or creating corresponding items in `TECHNICAL_DEBT.md` or your task tracker.
*   [ ] **Commit Changes**:
    *   Stage relevant changes (`git add .` or specific files).
    *   Write a clear, concise commit message summarizing the changes. Follow conventional commit standards if adopted. (`git commit -m "feat: Implement basic thumbnail generation"`).
    *   Ensure all logical units of work are committed.
*   [ ] **Push Changes**: Push your committed changes to the remote feature branch (`git push origin your-feature-branch`).
*   [ ] **Update Pull Request (if applicable)**: If a PR is open for your feature branch, ensure it's updated with the latest changes and description.

## 2. Documentation Updates

*   [ ] **Create Status Report**:
    *   Get current timestamp: `date "+%Y-%m-%d-%H%M"`.
    *   Create new report in `/docs/status-reports/` using format: `M3DV-SR-YYYY-MM-DD-HHMM.md`.
    *   Use the template format defined in `docs/CONTRIBUTING.md`.
    *   **Include**: Summary of work done, achievements, challenges faced, link to commit(s), blockers, and clear next steps.
    *   **Update `docs/status-reports/README.md`**: Add the new report to the top of the list.
*   [ ] **Update `TECHNICAL_DEBT.md`**:
    *   Add any *new* technical debt items identified during the session.
    *   Update the status or add notes to *existing* items that were worked on or affected.
    *   Document any new workarounds implemented.
*   [ ] **Update Feature Documentation (`docs/features/*`, `TECHNICAL_DESIGN.md`, `PRD.md` etc.)**:
    *   If core functionality or design of a feature was changed, update its relevant documentation.
    *   Update API documentation if endpoints were added or modified.
    *   Update usage examples if behavior changed.
    *   Ensure alignment between `PRD.md` (requirements) and `TECHNICAL_DESIGN.md` (implementation details).
*   [ ] **Update `DEVELOPMENT_ROADMAP.md`**:
    *   Mark completed milestones or tasks.
    *   Update timeline estimates if significant changes occurred.
    *   Note any scope changes relevant to the roadmap.
*   [ ] **Update Setup/Troubleshooting Guides (if applicable)**:
    *   If new environment variables, dependencies, or setup steps were added, update `DEVELOPMENT_SETUP.md`.
    *   If a common issue was resolved or a new one discovered, update `docs/troubleshooting/README.md`.

## 3. Environment & Dependencies

*   [ ] **Document Environment Changes**: Note any new ENV VARS, configuration settings, or required services in the Status Report and potentially `DEVELOPMENT_SETUP.md`.
*   [ ] **Document Dependency Changes**: If `package.json` was modified, note significant additions/updates (especially major versions) in the Status Report. Ensure `package-lock.json` is committed.

## 4. Next Session Planning

*   [ ] **Identify Blockers**: Clearly list any items preventing progress in the Status Report's "Next Steps" or "Blockers" section.
*   [ ] **Outline Next Steps**: Provide clear, actionable tasks for the beginning of the next session in the Status Report.
*   [ ] **Note Research Needed**: Document areas requiring further investigation or questions for the team/stakeholders in the Status Report.

## 5. Final Check

*   [ ] **Review this checklist**: Ensure all applicable steps have been completed.
*   [ ] **Note any skipped items** and the reason in your Status Report.
*   [ ] **Stop Development Server (Optional)**: If you don't need it running (`kill %1` if you used `npm run dev &`).

---
### Quick Checklist Template (Copy for Status Report or Notes)
```markdown
### End of Session Quick Check:
- [ ] Code Linted & Formatted
- [ ] Debug Code Removed
- [ ] Changes Committed & Pushed
- [ ] Status Report Created & Index Updated
- [ ] `TECHNICAL_DEBT.md` Updated
- [ ] Relevant Feature/Design Docs Updated
- [ ] Roadmap Updated (if applicable)
- [ ] Setup/Troubleshooting Updated (if applicable)
- [ ] ENV/Dependency Changes Documented
- [ ] Next Steps & Blockers Identified