# Prompt Architecture

## Overview
This document describes the prompt architecture used for camera path generation in the Modern 3D Viewer. The system uses a two-part prompt structure with clear separation of concerns between system constraints and user inputs.

## Core Components

### 1. System Message
The system message establishes the fundamental rules and constraints for camera path generation:

```typescript
Core constraints:
1. Duration Constraint:
   - The total animation duration MUST EXACTLY match the user's requested duration
   - Break down the total duration into appropriate keyframes for smooth, cinematic movement
   - You have full control over individual keyframe timing to achieve the best result

2. Spatial Constraints:
   - Camera must stay above the floor
   - Camera must maintain safe distance from model
   - Camera should generally point towards the model's center
```

### 2. User Prompt
The user prompt provides specific instructions and requirements for a particular animation:

```typescript
Generate camera keyframes for the following instruction: "[user instruction]"

Required animation duration: [duration] seconds

Scene information:
- Model center: (x, y, z)
- Model size: (x, y, z)
- Bounding sphere radius: r
- Floor height: h
- Safe distance range: min to max units
...
```

## Design Decisions

### 1. Separation of Concerns
- **System Message**: Handles core constraints and rules
- **User Prompt**: Communicates specific requirements
- **LLM Freedom**: System has control over internal timing decisions

### 2. Duration Management
- User specifies total animation duration
- System ensures exact duration matching
- LLM has freedom to determine individual keyframe durations
- No prescriptive rules about keyframe duration ranges

### 3. Response Format
```json
{
  "keyframes": [
    {
      "position": {"x": number, "y": number, "z": number},
      "target": {"x": number, "y": number, "z": number},
      "duration": number
    }
  ]
}
```

## Implementation Details

### 1. Duration Handling
- Duration is a core constraint in the system message
- User's requested duration is prominently placed in the user prompt
- System validates that keyframe durations sum to requested total
- No redundant duration specifications

### 2. Scene Context
- Current camera position and orientation
- Model dimensions and boundaries
- Safety constraints (floor height, distance ranges)
- Model orientation (front/up vectors)

### 3. Quality Assurance
- System message emphasizes smooth, cinematic movement
- Spatial constraints ensure camera stays within safe bounds
- Duration constraints ensure timing accuracy
- Response format ensures consistent, parseable output

## Future Improvements

### 1. Enhanced Context
- Add model semantic information
- Include previous animation history
- Provide style preferences

### 2. Response Enrichment
- Add keyframe transition types
- Include camera movement curves
- Support multiple movement styles

### 3. Validation
- Add pre-execution validation of generated paths
- Implement runtime safety checks
- Add fallback behaviors for edge cases

## Related Documentation
- [Camera Path Generation](../features/camera-path/README.md)
- [Animation System](../features/animation/README.md)
- [Status Report M3DV-SR-2025-03-26-1012](../status-reports/M3DV-SR-2025-03-26-1012.md) 