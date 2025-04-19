# LLM Engine

## Overview
The LLM Engine is responsible for generating camera paths from compiled prompts. It handles intent parsing, motion segment composition, and spatial reasoning to create natural and cinematic camera movements, integrating with the camera start position system and animation features.

## Status
🚧 **Current Status**: In Development
- Core interface defined
- Basic implementation started
- Integration with other components planned
- Start position integration planned
- Animation system integration planned

## Interface

### Core Functions
```typescript
interface LLMEngine {
  // Generate camera path from prompt
  generatePath(prompt: ContextualPrompt, startPosition?: CameraPosition): Promise<CameraPath>;
  
  // Parse motion segments from LLM response
  parseSegments(response: LLMResponse): Promise<MotionSegment[]>;
  
  // Validate generated path
  validatePath(path: CameraPath, startPosition?: CameraPosition): Promise<ValidationResult>;
  
  // Optimize path for smoothness
  optimizePath(path: CameraPath, startPosition?: CameraPosition): Promise<OptimizedPath>;

  // Generate animation path from start position
  generateAnimationPath(startPosition: CameraPosition, constraints: PathConstraints): Promise<AnimationPath>;
}
```

### Types
```typescript
interface CameraPath {
  segments: MotionSegment[];
  duration: number;
  metadata: PathMetadata;
  startPosition?: CameraPosition;
}

interface MotionSegment {
  type: 'orbit' | 'dolly' | 'crane' | 'static';
  duration: number;
  startState: CameraState;
  endState: CameraState;
  easing: EasingFunction;
  constraints: SegmentConstraints;
  startPosition?: CameraPosition;
}

interface CameraState {
  position: Vector3;
  target: Vector3;
  up: Vector3;
  fov: number;
  startPosition?: CameraPosition;
}

interface PathMetadata {
  generationTime: Date;
  model: string;
  tokenUsage: TokenUsage;
  quality: PathQuality;
  startPosition?: CameraPosition;
}

interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  suggestions: string[];
  startPositionValidation?: StartPositionValidation;
}

interface StartPositionValidation {
  isValid: boolean;
  distance: number;
  angle: number;
  height: number;
  suggestions: string[];
}

interface AnimationPath {
  keyframes: Keyframe[];
  duration: number;
  easing: EasingFunction;
  constraints: PathConstraints;
  startPosition: CameraPosition;
}

interface Keyframe {
  position: Vector3;
  target: Vector3;
  fov: number;
  timestamp: number;
  easing: EasingFunction;
}
```

## Implementation Details

### 1. Path Generation Process
1. **Intent Analysis**
   - Parse user instructions
   - Identify key movements
   - Determine timing
   - Consider start position

2. **Segment Composition**
   - Create motion segments
   - Apply constraints
   - Optimize transitions
   - Validate start position

3. **Quality Control**
   - Validate smoothness
   - Check safety
   - Ensure cinematic quality
   - Verify start position

### 2. Motion Types
- **Orbit**: Circular movement around target
- **Dolly**: Linear movement in/out
- **Crane**: Vertical movement
- **Static**: Stationary shots
- **Composite**: Combined movements
- **Start Position**: Initial camera setup
- **Animation**: Smooth transitions

### 3. Error Handling
- Invalid prompt format
- Unsafe movements
- Performance issues
- Quality violations
- Start position validation
- Animation path validation

## Integration

### Prompt Compiler Integration
```typescript
// Generate path from compiled prompt with start position
const path = await llmEngine.generatePath(compiledPrompt, startPosition);

// Validate generated path
const validation = await llmEngine.validatePath(path, startPosition);

// Optimize if needed
if (validation.isValid) {
  const optimized = await llmEngine.optimizePath(path, startPosition);
}

// Generate animation path
const animationPath = await llmEngine.generateAnimationPath(startPosition, constraints);
```

## Usage Examples

### Basic Usage
```typescript
const engine = new LLMEngine();

// Generate path with start position
const path = await engine.generatePath(prompt, startPosition);

// Validate path
const validation = await engine.validatePath(path, startPosition);

// Optimize path
const optimized = await engine.optimizePath(path, startPosition);

// Generate animation path
const animationPath = await engine.generateAnimationPath(startPosition, constraints);
```

## Current Development Focus
1. **Core Implementation**
   - Path generation logic
   - Motion segment parsing
   - Path validation
   - Path optimization
   - Start position integration
   - Animation system integration

2. **Integration**
   - Prompt Compiler integration
   - Scene Interpreter integration
   - Metadata Manager integration
   - Error handling
   - Start position validation
   - Animation path validation

## Future Improvements
1. **Path Generation**
   - Enhanced motion types
   - Better transitions
   - Improved quality
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
The engine includes tests covering:
- Basic path generation
- Motion segment parsing
- Path validation
- Path optimization
- Error handling
- Integration testing
- Start position validation
- Animation path validation

## Related Components
- Prompt Compiler
- Scene Interpreter
- Metadata Manager
- Viewer Integration
- Camera Controller
- CameraAnimationSystem
- StartPositionHint 