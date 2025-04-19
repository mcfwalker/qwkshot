# Technical Debt Log

This document tracks acknowledged technical debt within the Modern 3D Viewer project. While detailed task tracking, assignment, and status updates reside in Asana, this file serves as a high-level index and reference point within the repository.

## Process
- Significant technical debt items that require action should have a corresponding task created in Asana.
- List major items here with a concise description and a **direct link to the Asana task**.
- Minor items or areas for future investigation not yet warranting an Asana task can also be noted briefly.
- Mark items as [Archived] and move details to `TECHNICAL_DEBT_ARCHIVE.md` (or link to commit/PR) when resolved.

---

## Current Items

### 1. Fix Failing Test Suite
- **Status:** Open
- **Priority:** High
- **Description:** The `npm run test` command currently fails with ~24 failed tests and 5 unhandled errors across multiple suites (MetadataManager, EnvironmentalAnalyzer, SceneAnalyzer, PromptCompiler, Integration tests). Errors seem related to initialization (loggers, DB), configuration (Supabase credentials), outdated tests (PromptCompiler), and potentially flawed test logic.
- **Impact:** Reduces confidence in code changes, prevents automated regression testing.
- **Asana Task:** [Link to Asana Task Here]
- **Notes:** Needs immediate investigation and resolution post-Assistants-Refactor merge.

### 2. Resolve `npm audit` Vulnerabilities
- **Status:** Open
- **Priority:** Medium/Low (Depending on vulnerability severity)
- **Description:** Running `npm audit` reveals vulnerabilities. A specific low-severity vulnerability in `next@15.2.3` (requiring update to `15.3.0`) was noted in `ASSISTANTS_API_REFACTOR_PLAN.md` and deferred.
A full `npm audit` should be run and all actionable vulnerabilities addressed.
- **Impact:** Potential security risks if vulnerabilities are exploitable.
- **Asana Task:** [Link to Asana Task Here - Optional, or track via dependency updates]
- **Notes:** Requires running `npm audit` and potentially `npm audit fix` or manual dependency updates. 