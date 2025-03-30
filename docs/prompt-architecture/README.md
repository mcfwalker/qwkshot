# Prompt Architecture

## Overview
This document describes the prompt architecture used in the Path-to-Path (p2p) pipeline's Prompt Compiler component. The system uses a structured approach to transform user instructions into optimized prompts for LLM-based camera path generation.

## Core Components

### 1. Prompt Compiler Interface
```typescript
interface PromptCompiler {
  // Core functionality
  compilePrompt: (params: PromptParams) => Promise<CompiledPrompt>;
  optimizeTokens: (prompt: string) => Promise<string>;
  trackMetadata: (prompt: CompiledPrompt) => Promise<void>;
  
  // Advanced features
  addSceneContext: (prompt: string, scene: SceneGeometry) => string;
  formatForLLM: (prompt: string, format: 'chatml' | 'json' | 'markdown') => string;
}
```

### 2. Prompt Structure
The compiler maintains a two-part prompt structure with clear separation of concerns:

#### System Message
```typescript
Core constraints:
1. Duration Constraint:
   - The total animation duration MUST EXACTLY match the user's requested duration
   - Break down the total duration into appropriate keyframes for smooth, cinematic movement
   - You have full control over individual keyframe timing to achieve the best result

2. Spatial Constraints:
   - Camera must stay above the floor (y > ${sceneGeometry.floor.height})
   - Camera must maintain safe distance from model (between ${sceneGeometry.safeDistance.min} and ${sceneGeometry.safeDistance.max} units)
   - Camera should generally point towards the model's center

3. Motion Constraints:
   - Support for different motion types (push-in, orbit, crane, track, static)
   - Smooth transitions between motion segments
   - Proper easing for natural movement
   - Safety checks for collision avoidance
```

#### User Prompt
```typescript
Generate camera keyframes for the following instruction: "[user instruction]"

Required animation duration: [duration] seconds

Scene information:
- Model center: (x, y, z)
- Model size: (x, y, z)
- Bounding sphere radius: r
- Floor height: h
- Safe distance range: min to max units

Current camera state:
- Position: (x, y, z)
- Looking at: (x, y, z)
- Current view: [front/back/side]

Model orientation:
- Front direction: (x, y, z)
- Up direction: (x, y, z)
```

## Design Decisions

### 1. Prompt Optimization
- **Token Management**: Optimize prompt length while maintaining essential information
- **Context Relevance**: Prioritize most relevant scene information
- **Format Flexibility**: Support different LLM input formats (ChatML, JSON, Markdown)
- **Metadata Tracking**: Track prompt versions and performance metrics

### 2. Scene Context Integration
- **Dynamic Updates**: Real-time scene geometry information
- **Safety Constraints**: Built-in safety checks and boundaries
- **Motion Context**: Current camera state and model orientation
- **Spatial Awareness**: Model dimensions and boundaries

### 3. Response Format
```json
{
  "keyframes": [
    {
      "position": {"x": number, "y": number, "z": number},
      "target": {"x": number, "y": number, "z": number},
      "duration": number,
      "easing": "linear" | "ease-in" | "ease-out" | "ease-in-out",
      "type": "push-in" | "orbit" | "crane" | "track" | "static"
    }
  ]
}
```

## Implementation Details

### 1. Prompt Compilation Process
1. **Input Processing**
   - Parse user instruction
   - Extract key parameters
   - Validate constraints

2. **Context Integration**
   - Add scene geometry
   - Include current camera state
   - Apply safety constraints

3. **Format Optimization**
   - Structure for LLM
   - Optimize token usage
   - Add metadata

4. **Output Generation**
   - Format for target LLM
   - Validate structure
   - Track version

### 2. Quality Assurance
- **Validation**: Ensure all required information is present
- **Safety**: Verify constraints are properly communicated
- **Format**: Check response format compatibility
- **Performance**: Monitor prompt effectiveness

### 3. Error Handling
- **Missing Data**: Graceful handling of incomplete scene information
- **Invalid Input**: Clear error messages for invalid instructions
- **Format Issues**: Recovery from malformed prompts
- **LLM Errors**: Fallback strategies for LLM failures

## Future Improvements

### 1. Enhanced Context
- Add model semantic information
- Include previous animation history
- Provide style preferences
- Support multiple languages

### 2. Advanced Features
- Dynamic prompt optimization
- A/B testing capabilities
- Performance analytics
- Style transfer support

### 3. Integration
- Better LLM provider support
- Enhanced error recovery
- Improved monitoring
- Training data collection

## Related Documentation
- [Path-to-Path Pipeline Overview](../features/p2p/ARCHITECTURE.md)
- [LLM Engine Documentation](../features/p2p/llm-engine/README.md)
- [Scene Interpreter Documentation](../features/p2p/scene-interpreter/README.md)
- [Viewer Integration Documentation](../features/p2p/viewer-integration/README.md)
- [Feedback System Documentation](../features/p2p/feedback/README.md) 