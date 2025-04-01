# LLM Engine

## Overview
The LLM Engine is responsible for generating camera paths from compiled prompts. It handles intent parsing, motion segment composition, and spatial reasoning to create natural and cinematic camera movements.

## Status
🚧 **Current Status**: In Development
- Core interface defined
- Basic implementation started
- Integration with other components planned

## Interface

### Core Functions
```typescript
interface LLMEngine {
  // Generate camera path from prompt
  generatePath(prompt: ContextualPrompt): Promise<CameraPath>;
  
  // Parse motion segments from LLM response
  parseSegments(response: LLMResponse): Promise<MotionSegment[]>;
  
  // Validate generated path
  validatePath(path: CameraPath): Promise<ValidationResult>;
  
  // Optimize path for smoothness
  optimizePath(path: CameraPath): Promise<OptimizedPath>;
}
```

### Types
```typescript
interface CameraPath {
  segments: MotionSegment[];
  duration: number;
  metadata: PathMetadata;
}

interface MotionSegment {
  type: 'orbit' | 'dolly' | 'crane' | 'static';
  duration: number;
  startState: CameraState;
  endState: CameraState;
  easing: EasingFunction;
  constraints: SegmentConstraints;
}

interface CameraState {
  position: Vector3;
  target: Vector3;
  up: Vector3;
  fov: number;
}

interface PathMetadata {
  generationTime: Date;
  model: string;
  tokenUsage: TokenUsage;
  quality: PathQuality;
}

interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  suggestions: string[];
}
```

## Implementation Details

### 1. Path Generation Process
1. **Intent Analysis**
   - Parse user instructions
   - Identify key movements
   - Determine timing

2. **Segment Composition**
   - Create motion segments
   - Apply constraints
   - Optimize transitions

3. **Quality Control**
   - Validate smoothness
   - Check safety
   - Ensure cinematic quality

### 2. Motion Types
- **Orbit**: Circular movement around target
- **Dolly**: Linear movement in/out
- **Crane**: Vertical movement
- **Static**: Stationary shots
- **Composite**: Combined movements

### 3. Error Handling
- Invalid prompt format
- Unsafe movements
- Performance issues
- Quality violations

## Integration

### Prompt Compiler Integration
```typescript
// Generate path from compiled prompt
const path = await llmEngine.generatePath(compiledPrompt);

// Validate generated path
const validation = await llmEngine.validatePath(path);

// Optimize if needed
if (validation.isValid) {
  const optimized = await llmEngine.optimizePath(path);
}
```

## Usage Examples

### Basic Usage
```typescript
const engine = new LLMEngine();

// Generate path
const path = await engine.generatePath(prompt);

// Validate path
const validation = await engine.validatePath(path);

// Optimize path
const optimized = await engine.optimizePath(path);
```

## Current Development Focus
1. **Core Implementation**
   - Path generation logic
   - Motion segment parsing
   - Path validation
   - Path optimization

2. **Integration**
   - Prompt Compiler integration
   - Scene Interpreter integration
   - Metadata Manager integration
   - Error handling

## Future Improvements
1. **Path Generation**
   - Enhanced motion types
   - Better transitions
   - Improved quality
   - Performance optimization

2. **Integration**
   - Better component coordination
   - Enhanced error handling
   - Improved logging
   - Performance monitoring

## Testing
The engine includes tests covering:
- Basic path generation
- Motion segment parsing
- Path validation
- Path optimization
- Error handling
- Integration testing

## Related Components
- Prompt Compiler
- Scene Interpreter
- Metadata Manager
- Viewer Integration
- Camera Controller 