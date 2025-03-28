# Modern 3D Viewer

A web-based 3D model viewer with AI-powered camera path generation and model creation capabilities.

## Documentation Index

This README serves as the central index for all project documentation.

### 🚀 Getting Started & Workflow
*   **[Development Setup](./DEVELOPMENT_SETUP.md)**: Environment and project setup instructions.
*   **[Session Initialization Guide](./GET_STARTED.md)**: **START HERE** for initiating a new development session (especially with AI assistant).
*   **[End of Session Checklist](./END_SESSION.md)**: **USE THIS** checklist to properly wrap up a development session.
*   **[Branch Strategy](./BRANCH_STRATEGY.md)**: Git workflow and branch management guidelines.
*   **[Contributing Guidelines](./docs/CONTRIBUTING.md)**: Code contribution standards and documentation patterns/templates.

### 📋 Project Planning & Status
*   **[Product Requirements (PRD)](./PRD.md)**: High-level goals, target users, core features, and requirements.
*   **[Development Roadmap](./DEVELOPMENT_ROADMAP.md)**: Prioritized development plan and timeline.
*   **[Status Reports](./docs/status-reports/)**: Directory containing detailed progress updates, decisions, and challenges. ([Latest Report Link Here - *Manual Update Needed*])
*   **[Technical Debt](./TECHNICAL_DEBT.md)**: Tracking known issues, areas for improvement, and workarounds. ([Archived Debt](./TECHNICAL_DEBT_ARCHIVE.md) - *Optional Link*)

### 🛠️ Technical Design & Implementation
*   **[Technical Design Document](./TECHNICAL_DESIGN.md)**: Detailed architecture, state management, API structure, integration specs, and implementation details.
*   **[Features](./docs/features/)**: Directory containing documentation specific to major features:
    *   [Authentication](./docs/features/auth/README.md)
    *   [Storage & Security](./docs/features/storage/README.md)
    *   [Model Thumbnails](./docs/features/UI/MODEL_THUMBNAILS.md) (*Example - verify location*)
    *   [Video Export](./docs/features/video-export/README.md) (*Example - verify location*)
    *   *(Add links to other feature READMEs here)*
*   **[UI Documentation](./docs/UI/README.md)**: UI design principles, component structure, and specific UI revamp plans.
*   **[Routing](./docs/routing/README.md)**: Documentation on routing patterns, including dynamic parameter handling.
*   **[Prompt Architecture](./docs/prompt-architecture/README.md)**: Design and structure for LLM prompts used in AI features.
*   **[Testing Strategy](./docs/testing/README.md)**: Plan and infrastructure for unit, integration, and E2E tests.

### 🆘 Support & Troubleshooting
*   **[Troubleshooting Guide](./docs/troubleshooting/README.md)**: Common issues and solutions encountered during development.

### 🤖 AI & Specific Strategies
*   **[Cinematic Language to Camera Motion Model](./docs/cinematic_model_brief.md)**: Strategy brief for the AI camera path generation model. (*Consider moving under `docs/design/` or `docs/features/camera-path/`*)

## Quick Navigation
- Need to start working? See **[Session Initialization Guide](./GET_STARTED.md)**.
- Finished working? Use the **[End of Session Checklist](./END_SESSION.md)**.
- Have a setup issue? Check **[Development Setup](./DEVELOPMENT_SETUP.md)** or **[Troubleshooting Guide](./docs/troubleshooting/README.md)**.
- Need to understand *what* we're building? See **[PRD.md](./PRD.md)**.
- Need to understand *how* we're building it? See **[Technical Design Document](./TECHNICAL_DESIGN.md)**.
- Found a bug or area for improvement? Document it in **[Technical Debt](./TECHNICAL_DEBT.md)**.

---
**Note:** Please keep this index updated as new documentation files or directories are added. Remember to manually update the link to the latest status report.