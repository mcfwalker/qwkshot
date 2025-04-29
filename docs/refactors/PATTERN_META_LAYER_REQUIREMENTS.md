# Pattern Meta Layer Requirements

### 1. Introduction
Implement a **Pattern Meta Layer** on top of the existing motion pipeline to allow users to invoke high‑level cinematic moves ("zigzag", "fly_by", etc.) that expand into sequences of atomic motion primitives. This document provides rock‑solid context and direction for developers to implement:
- **Pattern KB** structure and storage
- **System Instructions** updates for the Assistant
- **Function specification** for `compose_pattern`
- **Composer module** responsibilities and APIs
- **Pipeline flow** from user prompt to SceneInterpreter
- **Testing & validation** requirements

### 2. Definitions
- **Primitive**: An atomic camera operation (e.g., `dolly`, `rotate`, `truck`, `parallel`). Defined in `motion_kb.json`.  
- **Pattern**: A macro or recipe that maps to a series (or parallel set) of primitives. Examples: `zigzag`, `fly_by`, `spiral`. Stored in the **Pattern KB**.  
- **Pattern KB**: A JSON document listing pattern names, descriptions, parameter schemas and defaults. Accessible via File Search or Assistant Files.  
- **compose_pattern**: A function that takes a pattern name + args and deterministically returns a flat list of primitives.  
- **Composer module**: Back‑end code that implements the logic of each pattern macro, reading from the Pattern KB.  
- **SceneInterpreter**: Existing module that maps descriptors to world units, applies smoothing/blending, and outputs keyframes to Three.js.

### 3. Pattern KB
**Location**: Upload `pattern_kb.json` under Assistant Files or store in Supabase and expose via File Search.

**Schema** (example entry):
```jsonc
{
  "patterns": {
    "zigzag": {
      "description": "Alternating lateral trucks while advancing/retreating.",
      "parameters": {
        "segments": { "type": "integer", "default": 4, "min": 2, "max": 10 },
        "amplitude": { "type": "string", "enum": ["tiny","small","medium","large","huge"], "default": "small" }
      },
      "macro": "zigzagComposer"
    },
    "fly_by": {
      "description": "Approach, climb above target, descend, exit on same heading.",
      "parameters": {
        "apex_height": { "type": "string", "enum": ["tiny","small","medium","large","huge"], "default": "large" },
        "speed":       { "type": "string", "enum": ["slow","normal","fast"], "default": "fast" },
        "second_pass": { "type": "boolean", "default": true }
      },
      "macro": "flyByComposer"
    }
    // ... other patterns ...
  }
}
```

### 4. System Instructions Updates
- **Primitive schema** remains unchanged, embedded in System tab.
- **Function spec**:
  ```jsonc
  { "name":"compose_pattern", "description":"Expand a pattern into primitives", "parameters":{ "type":"object", "properties":{ "pattern":{"type":"string","enum":["zigzag","fly_by", ...]}, "segments":{"type":"integer"}, "amplitude":{"type":"string","enum":["tiny", ...]}, ... }, "required":["pattern"] }}
  ```
- **System prompt snippet**:
  > "If the user's phrasing implies a cinematic pattern, call `compose_pattern` with the pattern name and parameters. Pattern definitions are in `pattern_kb.json`. Otherwise emit primitives directly."
- **Examples** (few‑shot):
  ```text
  User: "Zoom out in a zig-zag"
  Assistant: (function-call) {"name":"compose_pattern","arguments":{"pattern":"zigzag","segments":4,"amplitude":"small"}}
  ```

### 5. Composer Module
**Location**: `/src/composers/` (New directory)

**API**:
```ts
// Define argument types based on Pattern KB
interface ZigzagArgs { pattern: 'zigzag'; segments?: number; amplitude?: string; }
interface FlyByArgs { pattern: 'fly_by'; apex_height?: string; speed?: string; second_pass?: boolean; }
// ... other pattern args
type PatternArgs = ZigzagArgs | FlyByArgs // | ...

// Define necessary scene context type
interface SceneMeta { boundingBox: any; objectRadius: number; /* ... */ }

// Define Primitive type matching interpreter input
interface Primitive { type: string; parameters: Record<string, any>; duration_ratio?: number; }

// Main composer function signature
function composePattern(args: PatternArgs, sceneMeta: SceneMeta): Primitive[]
```
- **PatternArgs**: Typed to match Function spec.
- **SceneMeta**: `{ boundingBox, objectRadius, ... }` for context-aware maps.
- **Behavior**:
  1. Lookup pattern KB entry by `args.pattern`.
  2. Invoke corresponding composer function (`zigzagComposer(args)`, `flyByComposer(args, sceneMeta)`).
  3. Return a **flat** `Primitive[]`, potentially including parallel steps if needed by the pattern.

**Example `zigzagComposer`**:
```ts
export function zigzagComposer({segments = 4, amplitude = 'small'}: Omit<ZigzagArgs, 'pattern'>): Primitive[] {
  const prim: Primitive[] = [];
  // Example: Simple back-and-forth truck with backward dolly
  // Needs refinement for proper geometry/duration
  for (let i = 0; i < segments; i++) {
    prim.push({ type: "truck", parameters: { direction: i % 2 ? "right" : "left", distance_descriptor: amplitude } });
    prim.push({ type: "dolly", parameters: { direction: "backward", distance_descriptor: amplitude } });
  }
  // TODO: Calculate appropriate duration_ratios for composed primitives
  return prim;
}
```

### 6. Pipeline Flow
```mermaid
graph LR
  U[User prompt] --> A[Assistant run()]
  A -->|function call?| B{resp.tool_calls[0].function.name === 'compose_pattern'?}
  B -->|yes| C[Composer.composePattern(args)]
  C -->|Primitive[]| E[SceneInterpreter(primitives)]
  B -->|no| D[JSON.parse(resp.content)]
  D -->|MotionPlan| E
  E -->|CameraCommand[]| F[AnimationController]
  F --> G[Three.js]
```
- **Integration** (in `/api/camera-path` or adapter):
  1. Call Assistant API (ensure `tool_choice` or function definitions enable function calling).
  2. Check the response for `tool_calls`.
  3. If `tool_calls` contains `compose_pattern`:
     - Parse the `arguments` string into an object.
     - Call the backend `composePattern` function with the parsed arguments (and necessary `sceneMeta`).
     - Assign the returned `Primitive[]` to a variable representing the steps for the interpreter.
  4. Else (no function call):
     - Extract and parse the JSON `MotionPlan` from the message content (using robust extraction).
     - Assign `parsedMotionPlan.steps` to the variable for the interpreter.
  5. Pass the resulting primitive steps array to `SceneInterpreter.interpretPath()`.

### 7. Testing & Validation
- **Unit tests** for each composer function: given args → expected primitives list.
- **Regression prompts**: Set of prompts targeting patterns (zigzag, fly-by variants) run through the full pipeline; verify the final generated `CameraCommand[]` shape and visual output.
- **Error handling**:
  - If Assistant calls `compose_pattern` with an unknown pattern name: Log error, potentially return user-facing error.
  - If composer function fails: Log error, return user-facing error.

### 8. Deliverables
- `pattern_kb.json` file definition and initial content.
- Updated System Instructions including the function specification for `compose_pattern`.
- New `/src/composers/` directory with at least two composer function implementations (e.g., `zigzag`, `fly_by`).
- Updated backend logic (`/api/camera-path` or adapter) to handle Assistant function calls.
- Unit tests for composers and integration tests for the updated pipeline flow.

---
_End of document_ 