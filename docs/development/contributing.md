# Contributing Guidelines

Thank you for contributing to the Modern 3D Viewer project! These guidelines help ensure consistency and quality across the codebase and documentation.

## Code Contributions

### Branching Strategy
- Please follow the workflow outlined in [`BRANCH_STRATEGY.md`](./BRANCH_STRATEGY.md).

### Coding Style
- Follow standard TypeScript and React best practices.
- Use the project's configured linter (ESLint) and formatter (Prettier). Run `npm run lint` and `npm run format` before committing.
- Write clear, concise, and well-commented code where necessary.

### Commits
- Write descriptive commit messages.
- Consider using the [Conventional Commits](https://www.conventionalcommits.org/) format (e.g., `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`).

### Testing
- Add unit or integration tests for new features or bug fixes where appropriate.
- Ensure existing tests pass before submitting a Pull Request.
// The testing strategy is currently defined by the existing tests and the regression suite.

## Documentation Contributions

Maintaining up-to-date and consistent documentation is crucial for this project, especially when working with AI assistants.

### General Principles
- **Clarity and Conciseness**: Write clearly and avoid jargon where possible.
- **Accuracy**: Ensure documentation reflects the current state of the project.
- **Consistency**: Use the defined patterns and templates found in relevant READMEs or documents.
- **Cross-Linking**: Link related documents together for easier navigation.
- **Audience**: Consider the audience (developers, AI assistant, potentially future users).

### Updating Documentation
- Documentation updates should ideally be part of the same commit or PR that introduces the corresponding code change.
// Ad-hoc documentation updates are encouraged as needed during development.
