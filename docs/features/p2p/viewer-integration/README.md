# Viewer Integration

## Overview
The Viewer Integration component is responsible for executing and visualizing camera paths within the Three.js scene. It handles camera animation, path preview, interactive controls, and export capabilities.

## Status
🚧 **Current Status**: Planned
- Interface defined
- Implementation planned
- Integration requirements documented

## Interface

### Core Functions
```typescript
interface ViewerIntegration {
  // Execute camera path
  executePath(path: ExecutablePath): Promise<ExecutionResult>;
  
  // Preview path before execution
  previewPath(path: ExecutablePath): Promise<PreviewResult>;
  
  // Handle interactive controls
  handleControls(controls: ViewerControls): Promise<void>;
  
  // Export path data
  exportPath(path: ExecutablePath, format: ExportFormat): Promise<ExportedData>;
}
```

### Types
```typescript
interface ExecutionResult {
  success: boolean;
  duration: number;
  metadata: ExecutionMetadata;
  errors?: ExecutionError[];
}

interface PreviewResult {
  previewMesh: THREE.Mesh;
  pathPoints: Vector3[];
  duration: number;
  metadata: PreviewMetadata;
}

interface ViewerControls {
  play: boolean;
  pause: boolean;
  stop: boolean;
  speed: number;
  position: number;
}

interface ExportedData {
  format: ExportFormat;
  data: string | Blob;
  metadata: ExportMetadata;
}

interface ExecutionMetadata {
  startTime: Date;
  endTime: Date;
  frameCount: number;
  performance: PerformanceMetrics;
}
```

## Implementation Details

### 1. Path Execution Process
1. **Setup**
   - Initialize camera
   - Create preview mesh
   - Set up controls

2. **Animation**
   - Frame generation
   - Camera updates
   - Performance monitoring

3. **Cleanup**
   - Resource disposal
   - State reset
   - Event cleanup

### 2. Preview Features
- Path visualization
- Speed control
- Position scrubbing
- Frame stepping

### 3. Error Handling
- Animation errors
- Performance issues
- Resource failures
- Control conflicts

## Integration

### Scene Interpreter Integration
```typescript
// Execute path from interpreter
const result = await viewer.executePath(executablePath);

// Preview path before execution
const preview = await viewer.previewPath(executablePath);

// Handle playback controls
await viewer.handleControls({
  play: true,
  pause: false,
  stop: false,
  speed: 1,
  position: 0
});
```

## Usage Examples

### Basic Usage
```typescript
const viewer = new ViewerIntegration();

// Execute path
const result = await viewer.executePath(path);

// Preview path
const preview = await viewer.previewPath(path);

// Handle controls
await viewer.handleControls({
  play: true,
  pause: false,
  stop: false,
  speed: 1,
  position: 0
});
```

## Planned Implementation
1. **Core Features**
   - Path execution
   - Path preview
   - Interactive controls
   - Path export

2. **Integration**
   - Scene Interpreter integration
   - Metadata Manager integration
   - Camera Controller integration
   - Error handling

## Future Improvements
1. **Viewer Features**
   - Enhanced preview
   - Better controls
   - More export formats
   - Performance optimization

2. **Integration**
   - Better component coordination
   - Enhanced error handling
   - Improved logging
   - Performance monitoring

## Testing
The viewer will include tests covering:
- Path execution
- Path preview
- Control handling
- Export functionality
- Error handling
- Integration testing

## Related Components
- Scene Interpreter
- Metadata Manager
- Camera Controller
- Environmental Analyzer
- Scene Analyzer 