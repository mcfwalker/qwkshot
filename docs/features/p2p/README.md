# Path-to-Path (p2p) Pipeline

## Overview
The Path-to-Path (p2p) pipeline is a sophisticated system that transforms natural language instructions into dynamic camera paths within a Three.js scene. This feature enables users to create cinematic camera movements through simple text descriptions.

## Quick Start

### Basic Usage
```typescript
// Example of using the p2p pipeline
const pipeline = new P2PPipeline();
const result = await pipeline.generatePath({
  instruction: "Orbit around the model focusing on the front",
  duration: 10,
  scene: currentScene
});
```

### Key Features
- Natural language to camera path translation
- Cinematic-quality camera movements
- Scene-aware path generation
- Interactive preview and editing
- Export capabilities
- Performance monitoring

## Documentation

### Architecture
- [Pipeline Overview](./ARCHITECTURE.md)
- [Component Documentation](./ARCHITECTURE.md#pipeline-components)
- [Pipeline Overview (Original)](./P2P_OVERVIEW.md)

### Components
- [Prompt Compiler](./prompt-compiler/README.md)
- [LLM Engine](./llm-engine/README.md)
- [Scene Interpreter](./scene-interpreter/README.md)
- [Viewer Integration](./viewer-integration/README.md)
- [Feedback System](./feedback/README.md)

### Development
- [Getting Started](./ARCHITECTURE.md#development-guidelines)
- [Testing](./ARCHITECTURE.md#integration-testing)
- [Performance](./ARCHITECTURE.md#performance-considerations)

## Examples

### Basic Camera Path
```typescript
// Simple orbit around the model
const path = await pipeline.generatePath({
  instruction: "Orbit around the model",
  duration: 5
});
```

### Complex Movement
```typescript
// Cinematic sequence
const path = await pipeline.generatePath({
  instruction: "Start with a wide shot, push in to focus on the details, then orbit slowly",
  duration: 15,
  style: "cinematic"
});
```

### Interactive Preview
```typescript
// Preview and edit a path
const path = await pipeline.generatePath({
  instruction: "Show the model from all angles",
  duration: 10
});
await pipeline.previewPath(path);
await pipeline.editPath(path);
```

## Contributing
See [Development Guidelines](./ARCHITECTURE.md#development-guidelines) for information on contributing to the p2p pipeline.

## Related Features
- [Camera Controls](../camera-controls/README.md)
- [Animation System](../animation/README.md)
- [Scene Analysis](../scene-analysis/README.md) 