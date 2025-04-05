# Session Initialization Guide

This guide outlines the process for starting a new development session, ensuring both the developer and the AI assistant have the necessary context.

## Pre-Session Checklist (Developer)

### 1. Documentation Review (Essential Context)
*   [ ] **Review `TECHNICAL_DEBT.md`**: Understand current known issues, workarounds, and high-priority items.
*   [ ] **Review `DEVELOPMENT_ROADMAP.md`**: Check current priorities and upcoming milestones.
*   [ ] **Review the latest Status Report (`docs/status-reports/`)**: Catch up on the most recent progress and challenges.
*   [ ] **Consult `PRD.md` & `TECHNICAL_DESIGN.md`**: If working on a new feature or significant change, refresh understanding of requirements and technical plan.
*   [ ] **Consult Relevant Feature Docs (`docs/features/*`)**: If modifying an existing feature.
*   [ ] **Review `BRANCH_STRATEGY.md`**: Confirm understanding of current branching model.

### 2. Project State Assessment
*   [ ] **Verify current Git branch**: Ensure you are on the correct feature branch or `stable`. Use `git status` and `git branch`.
*   [ ] **Pull latest changes**: `git checkout stable && git pull origin stable && git checkout your-feature-branch && git rebase stable` (or equivalent workflow step).
*   [ ] **Review recent commits** on your branch and `stable`.
*   [ ] **Check for open Pull Requests** relevant to your work.
*   [ ] **Review assigned issues/tasks** in your project management tool (if applicable).

### 3. Development Environment Setup
*   [ ] **Verify `.env.local`**: Ensure all required environment variables are present and correct (Supabase keys, API keys, etc.). Refer to `DEVELOPMENT_SETUP.md` if needed.
*   [ ] **Start Development Server**: Use background mode: `npm run dev &`.
*   [ ] **Verify Server Status**:
    *   Check terminal output for successful startup and environment validation messages.
    *   Access the application locally (`http://localhost:3000`).
    *   Check the health endpoint (`/api/health`). Monitor for expected response times (e.g., 2-7ms).
*   [ ] **Check External Services**: Ensure connections (e.g., Supabase) are active if needed for the session's tasks.

## Session Initialization Process (with AI Assistant)

1.  **Provide Context to AI Assistant**:
    Use a prompt similar to this template:
    ```
    Starting a new development session for Modern 3D Viewer.

    - **Current Branch:** `[Your Branch Name]` (Based on `stable` commit `[relevant commit hash if known]`)
    - **Goal for this Session:** `[Describe the primary task, e.g., "Implement thumbnail generation for library view", "Fix bug described in TECHNICAL_DEBT item #X", "Refactor camera controls based on UI Revamp plan"]`
    - **Key Documents Reviewed:** `GET_STARTED.md`, `TECHNICAL_DEBT.md`, `[Relevant Feature/Design Doc]`, Latest Status Report (`[Report Filename]`).
    - **Environment Status:** Server running in background (`npm run dev &`), health checks passing, required ENV VARS verified.
    - **Potential Blockers/Questions:** `[List any known blockers or questions you have]`
    - **Relevant Technical Debt Items:** `[List IDs/titles from TECHNICAL_DEBT.md if applicable]`
    ```

2.  **AI Assistant Review & Plan Proposal**:
    The AI should confirm its understanding based on the provided context and its knowledge base (the project docs). It should:
    *   Acknowledge the goal and reviewed documents.
    *   Briefly summarize the relevant current state (e.g., related tech debt, roadmap priority).
    *   Propose a high-level plan or the immediate next steps for the session's goal.
    *   Ask for confirmation or clarification.
    *   *(AI Internal Check: Verify consistency between user context and its understanding of `TECHNICAL_DEBT.md`, `BRANCH_STRATEGY.md`, etc.)*

3.  **Developer Confirmation**:
    *   Review the AI's summary and proposed plan.
    *   Clarify any misunderstandings.
    *   Provide corrections or additional context if needed.
    *   Give explicit confirmation to proceed.

## Best Practices During Session
*   **Branch Management**: Follow `BRANCH_STRATEGY.md` (create features from `stable`, rebase regularly, small commits).
*   **Server Management**: Keep the server running in the background; monitor logs and health checks periodically.
*   **Communication**: Clearly state intentions and review AI suggestions/code carefully. Provide feedback on AI outputs.
*   **Incremental Commits**: Commit work frequently with descriptive messages.

## Troubleshooting Startup Issues
*   Refer to `DEVELOPMENT_SETUP.md` and `docs/troubleshooting/README.md`.
*   Common issues: Incorrect ENV VARS, port conflicts, outdated dependencies (`npm install`), stale cache (`rm -rf .next`).

*Remember: Clear context at the start prevents wasted effort and ensures alignment.*