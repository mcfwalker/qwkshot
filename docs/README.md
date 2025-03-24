# Modern 3D Viewer Documentation

## Quick Start
- [Getting Started Guide](./GET_STARTED.md) - Start here for new development sessions
- [Development Setup](./DEVELOPMENT_SETUP.md) - Environment and project setup
- [Session Management](./SESSION_MANAGEMENT.md) - Development session workflow
- [Troubleshooting Guide](./troubleshooting/README.md) - Common issues and solutions

## Project Documentation
- [Product Requirements Document](./PRD.md) - Complete product specification
- [Development Roadmap](./DEVELOPMENT_ROADMAP.md) - Development plan and timeline
- [Technical Debt](./TECHNICAL_DEBT.md) - Known issues and future improvements
- [Branch Strategy](./BRANCH_STRATEGY.md) - Git workflow and branch management
- [Test Suite Plan](./testing/README.md) - Testing strategy and implementation

## Feature Documentation
- [Authentication](./features/auth/README.md) - Auth implementation and security
- [Storage Security](./features/storage/README.md) - Storage configuration and security

## Development Resources
- [Status Reports](./status-reports/) - Development progress and updates
- Latest Status: [M3DV-SR-2025-03-24-1229.md](./status-reports/M3DV-SR-2025-03-24-1229.md)

## Documentation Structure
```
docs/
├── features/                    # Feature-specific documentation
│   ├── auth/                   # Authentication documentation
│   │   └── README.md
│   └── storage/                # Storage documentation
│       └── README.md
├── status-reports/             # Development status reports
├── testing/                    # Testing documentation
│   └── README.md              # Test suite plan
├── troubleshooting/            # Troubleshooting guides
│   └── README.md
├── README.md                   # This file
├── BRANCH_STRATEGY.md          # Git workflow documentation
├── DEVELOPMENT_ROADMAP.md      # Development timeline
├── DEVELOPMENT_SETUP.md        # Setup instructions
├── GET_STARTED.md             # Session initialization guide
├── PRD.md                     # Product requirements
├── SESSION_MANAGEMENT.md      # Development session workflow
└── TECHNICAL_DEBT.md          # Known issues
```

## Documentation Updates
When updating documentation:
1. Keep status reports current
2. Update technical debt for new issues
3. Maintain cross-references between docs
4. Add new features under `features/`
5. Keep troubleshooting guide updated

## Getting Help
1. Start with the [Troubleshooting Guide](./troubleshooting/README.md)
2. Check recent [Status Reports](./status-reports/)
3. Review [Technical Debt](./TECHNICAL_DEBT.md) for known issues
4. Create detailed bug reports if needed 