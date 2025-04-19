# Scene Interpreter

## Overview
The Scene Interpreter is responsible for converting LLM-generated camera paths into executable movements within the Three.js scene. It handles motion segment parsing, advanced interpolation, safety validation, and integrates with the camera start position system and animation features.

## Status
🚧 **Current Status**: Planned
- Interface defined
- Implementation planned
- Integration requirements documented
- Start position integration planned
- Animation system integration planned

## Interface

### Core Functions
```typescript
interface SceneInterpreter {
  // Convert path to executable movements
  interpretPath(path: CameraPath, startPosition?: CameraPosition): Promise<ExecutablePath>;
  
  // Parse motion segments
  parseSegments(segments: MotionSegment[], startPosition?: CameraPosition): Promise<ParsedSegment[]>;
  
  // Validate path safety
  validateSafety(path: ExecutablePath, startPosition?: CameraPosition): Promise<SafetyResult>;
  
  // Generate preview data
  generatePreview(path: ExecutablePath): Promise<PreviewData>;

  // Interpret animation path
  interpretAnimationPath(path: AnimationPath): Promise<ExecutablePath>;
}
```

### Types
```typescript
interface ExecutablePath {
  keyframes: Keyframe[];
  duration: number;
  metadata: ExecutionMetadata;
  startPosition?: CameraPosition;
}

interface Keyframe {
  time: number;
  position: Vector3;
  target: Vector3;
  up: Vector3;
  fov: number;
  easing: EasingFunction;
  startPosition?: CameraPosition;
}

interface ParsedSegment {
  type: MotionType;
  keyframes: Keyframe[];
  constraints: SegmentConstraints;
  metadata: SegmentMetadata;
  startPosition?: CameraPosition;
}

interface SafetyResult {
  isSafe: boolean;
  violations: SafetyViolation[];
  recommendations: string[];
  startPositionValidation?: StartPositionValidation;
}

interface StartPositionValidation {
  isValid: boolean;
  distance: number;
  angle: number;
  height: number;
  suggestions: string[];
}

interface PreviewData {
  pathPoints: Vector3[];
  targetPoints: Vector3[];
  duration: number;
  metadata: PreviewMetadata;
  startPosition?: CameraPosition;
}

interface AnimationPath {
  keyframes: Keyframe[];
  duration: number;
  easing: EasingFunction;
  constraints: PathConstraints;
  startPosition: CameraPosition;
}
```

## Implementation Details

### 1. Path Interpretation Process
1. **Segment Processing**
   - Parse motion types
   - Generate keyframes
   - Apply constraints
   - Validate start position

2. **Interpolation**
   - Calculate intermediate frames
   - Apply easing functions
   - Ensure smoothness
   - Consider start position

3. **Safety Validation**
   - Check collision avoidance
   - Validate speed limits
   - Ensure visibility
   - Verify start position

### 2. Motion Types
- **Linear**: Straight-line movement
- **Spline**: Curved path movement
- **Orbital**: Circular movement
- **Composite**: Combined movements
- **Start Position**: Initial camera setup
- **Animation**: Smooth transitions

### 3. Error Handling
- Invalid path data
- Safety violations
- Performance issues
- Interpolation errors
- Start position validation
- Animation path validation

## Integration

### LLM Engine Integration
```typescript
// Interpret path from LLM with start position
const executablePath = await interpreter.interpretPath(llmPath, startPosition);

// Validate safety
const safety = await interpreter.validateSafety(executablePath, startPosition);

// Generate preview if safe
if (safety.isSafe) {
  const preview = await interpreter.generatePreview(executablePath);
}

// Interpret animation path
const animationPath = await interpreter.interpretAnimationPath(animationPath);
```

## Usage Examples

### Basic Usage
```typescript
const interpreter = new SceneInterpreter();

// Interpret path with start position
const executablePath = await interpreter.interpretPath(path, startPosition);

// Validate safety
const safety = await interpreter.validateSafety(executablePath, startPosition);

// Generate preview
const preview = await interpreter.generatePreview(executablePath);

// Interpret animation path
const animationPath = await interpreter.interpretAnimationPath(animationPath);
```

## Planned Implementation
1. **Core Features**
   - Path interpretation
   - Motion parsing
   - Safety validation
   - Preview generation
   - Start position integration
   - Animation system integration

2. **Integration**
   - LLM Engine integration
   - Viewer Integration
   - Metadata Manager integration
   - Error handling
   - Start position validation
   - Animation path validation

## Future Improvements
1. **Path Interpretation**
   - Enhanced motion types
   - Better interpolation
   - Improved safety checks
   - Performance optimization
   - Start position optimization
   - Animation path optimization

2. **Integration**
   - Better component coordination
   - Enhanced error handling
   - Improved logging
   - Performance monitoring
   - Start position validation
   - Animation path validation

## Testing
The interpreter will include tests covering:
- Path interpretation
- Motion parsing
- Safety validation
- Preview generation
- Error handling
- Integration testing
- Start position validation
- Animation path validation

## Related Components
- LLM Engine
- Viewer Integration
- Metadata Manager
- Environmental Analyzer
- Camera Controller
- CameraAnimationSystem
- StartPositionHint 