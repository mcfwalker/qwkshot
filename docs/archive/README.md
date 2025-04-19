# Path-to-Path (p2p) Pipeline

## Overview
The Path-to-Path (p2p) pipeline is a sophisticated system that transforms natural language instructions into dynamic camera paths within a Three.js scene. This feature enables users to create cinematic camera movements through simple text descriptions, with support for custom start positions and smooth animations.

## Quick Start

### Basic Usage
```typescript
// Example of using the p2p pipeline
const pipeline = new P2PPipeline();
const result = await pipeline.generatePath({
  instruction: "Orbit around the model focusing on the front",
  duration: 10,
  scene: currentScene,
  startPosition: {
    position: new Vector3(0, 2, 5),
    target: new Vector3(0, 0, 0),
    fov: 50
  }
});
```

### Key Features
- Natural language to camera path translation
- Cinematic-quality camera movements
- Scene-aware path generation
- Interactive preview and editing
- Export capabilities
- Performance monitoring
- Custom camera start positions
- Smooth animation transitions
- Start position validation
- Animation path optimization

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
- [Camera Animation System](./viewer-integration/CameraAnimationSystem.tsx)
- [Start Position Hint](./viewer-integration/StartPositionHint.tsx)

### Development
- [Getting Started](./ARCHITECTURE.md#development-guidelines)
- [Testing](./ARCHITECTURE.md#integration-testing)
- [Performance](./ARCHITECTURE.md#performance-considerations)

## Examples

### Basic Camera Path
```typescript
// Simple orbit around the model with start position
const path = await pipeline.generatePath({
  instruction: "Orbit around the model",
  duration: 5,
  startPosition: {
    position: new Vector3(0, 2, 5),
    target: new Vector3(0, 0, 0),
    fov: 50
  }
});
```

### Complex Movement
```typescript
// Cinematic sequence with custom start position
const path = await pipeline.generatePath({
  instruction: "Start with a wide shot, push in to focus on the details, then orbit slowly",
  duration: 15,
  style: "cinematic",
  startPosition: {
    position: new Vector3(0, 3, 8),
    target: new Vector3(0, 0, 0),
    fov: 60
  }
});
```

### Interactive Preview
```typescript
// Preview and edit a path with start position
const path = await pipeline.generatePath({
  instruction: "Show the model from all angles",
  duration: 10,
  startPosition: {
    position: new Vector3(0, 2, 5),
    target: new Vector3(0, 0, 0),
    fov: 50
  }
});
await pipeline.previewPath(path);
await pipeline.editPath(path);
```

### Animation Controls
```typescript
// Control animation playback and timing
const animation = await pipeline.startAnimation(path);
await animation.play();
await animation.pause();
await animation.setSpeed(1.5);
await animation.seek(0.5);
```

## Contributing
See [Development Guidelines](./ARCHITECTURE.md#development-guidelines) for information on contributing to the p2p pipeline.

## Related Features
- [Camera Controls](../camera-controls/README.md)
- [Animation System](../animation/README.md)
- [Scene Analysis](../scene-analysis/README.md)
- [Start Position System](./viewer-integration/StartPositionHint.tsx)
- [Camera Animation](./viewer-integration/CameraAnimationSystem.tsx) 