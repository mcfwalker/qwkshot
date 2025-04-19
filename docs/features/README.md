# Feature Documentation

This directory contains detailed documentation for each major feature of the Modern 3D Viewer.

## Structure
Each feature should ideally have its own directory containing detailed documentation (spec, design, etc.), though currently the main P2P documentation resides elsewhere.

## Current Features

### Authentication
- User authentication flow
- Session management
- Protected routes
- OAuth integration

### Model Viewer
- 3D model rendering
- Camera controls (OrbitControls, etc.)
- Lighting and materials
- Performance optimization

### Camera Animation (Prompt-to-Path Pipeline)
- AI-driven generation of camera paths from natural language prompts.
- See main overview: [`../features/camera-animation/ARCHITECTURE.md`](../features/camera-animation/ARCHITECTURE.md)
- Key components: OpenAI Assistant Adapter, Scene Interpreter, Animation Controller.

## Adding New Features
When adding a new feature:
1. Consider creating a new directory under `/docs/features/`
2. Include a README.md with feature overview
3. Add technical specifications
4. Document implementation details
5. Include usage examples 