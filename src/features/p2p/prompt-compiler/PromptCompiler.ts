import { Vector3 } from 'three';
import { PromptCompiler, PromptCompilerConfig, CompiledPrompt } from '@/types/p2p/prompt-compiler';
import { EnvironmentalAnalysis } from '@/types/p2p/environmental-analyzer';
import { SceneAnalysis } from '@/types/p2p/scene-analyzer';
import { Logger, ValidationResult, PerformanceMetrics } from '@/types/p2p/shared';
import { P2PError } from '@/types/p2p/shared';
import { ModelMetadata } from '@/types/p2p';

interface SceneContext {
  objectDimensions: {
    width: number;
    height: number;
    depth: number;
  };
  objectCenter: {
    x: number;
    y: number;
    z: number;
  };
  sceneScale: number;
}

interface CameraConstraints {
  minDistance: number;
  maxDistance: number;
  minHeight: number;
  maxHeight: number;
  maxSpeed: number;
  maxAngleChange: number;
  minFramingMargin: number;
}

// Helper function to format Vector3 for the prompt
const formatVector3 = (v: { x: number; y: number; z: number }, precision: number = 2): string => {
  if (!v) return '(unknown)';
  return `(${v.x.toFixed(precision)}, ${v.y.toFixed(precision)}, ${v.z.toFixed(precision)})`;
};

// Helper function to format Bounding Box for the prompt
const formatBounds = (b: any, precision: number = 2): string => {
  if (!b || !b.min || !b.max) return '(unknown)';
  // Use instance method within the helper
  return `min: ${formatVector3(b.min, precision)}, max: ${formatVector3(b.max, precision)}`;
};

interface LLMFriendlyCameraState {
  distance: number;      // Distance from object center
  height: number;       // Y-position relative to object
  angle: number;       // Horizontal angle around object (in degrees)
  tilt: number;       // Up/down angle (in degrees)
  fov: number;       // Field of view
}

export class PromptCompilerImpl implements PromptCompiler {
  private config: PromptCompilerConfig;
  private logger: Logger;
  private metrics: PerformanceMetrics = {
    startTime: 0,
    endTime: 0,
    duration: 0,
    operations: [],
    cacheHits: 0,
    cacheMisses: 0,
    databaseQueries: 0,
    averageResponseTime: 0
  };

  constructor(config: PromptCompilerConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    this.metrics.startTime = Date.now();
    this.logger.info('Initializing PromptCompiler');
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return this.metrics;
  }

  private transformCameraState(position: Vector3, target: Vector3, fov: number): LLMFriendlyCameraState {
    // Calculate distance from camera to target
    const distance = position.distanceTo(target);
    
    // Calculate height relative to target
    const height = position.y - target.y;
    
    // Calculate horizontal angle (in degrees)
    const angle = Math.atan2(position.x - target.x, position.z - target.z) * (180 / Math.PI);
    
    // Calculate tilt angle (in degrees)
    const horizontalDistance = Math.sqrt(
      Math.pow(position.x - target.x, 2) + Math.pow(position.z - target.z, 2)
    );
    const tilt = Math.atan2(height, horizontalDistance) * (180 / Math.PI);

    return {
      distance,
      height,
      angle,
      tilt,
      fov
    };
  }

  private generateSystemMessage(
    sceneAnalysis: SceneAnalysis,
    envAnalysis: EnvironmentalAnalysis,
    modelMetadata: ModelMetadata,
    rawCameraState: { position: Vector3; target: Vector3; fov: number } 
  ): string {
    const llmFriendlyCameraState = this.transformCameraState(
      rawCameraState.position,
      rawCameraState.target,
      rawCameraState.fov
    );
    this.logger.debug('[generateSystemMessage] Inputs:', { sceneAnalysis, envAnalysis, modelMetadata, rawCameraState });
    
    // Safely destructure envAnalysis...
    const { 
        environment = {}, 
        object = { dimensions: { width: 0, height: 0, depth: 0 }, floorOffset: 0 }, 
        distances = { fromObjectToBoundary: { front: 0, back: 0 } }, 
    } = envAnalysis || {};

    // Safely destructure modelMetadata...
    const { 
        lighting = { intensity: 1, color: '#ffffff' }, 
        scene = { background: '#000000', ground: '#808080', atmosphere: '#87CEEB' } 
    } = modelMetadata?.environment || {};

    // Format necessary strings (Object dimensions, Camera state, Env conditions)
    const dimString = object?.dimensions ? `${object.dimensions.width?.toFixed(2)}x${object.dimensions.height?.toFixed(2)}x${object.dimensions.depth?.toFixed(2)} units` : 'unknown dimensions';
    const floorOffsetString = typeof object?.floorOffset === 'number' ? object.floorOffset.toFixed(2) : 'unknown';
    const complexityString = sceneAnalysis?.spatial?.complexity ?? 'unknown'; // Keep complexity?
    const camDistString = typeof llmFriendlyCameraState?.distance === 'number' ? llmFriendlyCameraState.distance.toFixed(2) : 'unknown';
    const camHeightString = typeof llmFriendlyCameraState?.height === 'number' ? llmFriendlyCameraState.height.toFixed(2) : 'unknown';
    const camAngleString = typeof llmFriendlyCameraState?.angle === 'number' ? llmFriendlyCameraState.angle.toFixed(2) : 'unknown';
    const camTiltString = typeof llmFriendlyCameraState?.tilt === 'number' ? llmFriendlyCameraState.tilt.toFixed(2) : 'unknown';
    const camFovString = typeof llmFriendlyCameraState?.fov === 'number' ? llmFriendlyCameraState.fov.toFixed(2) : 'unknown';
    const lightingString = lighting ? `- Lighting: ${lighting.intensity} intensity, ${lighting.color} color` : '';
    const sceneString = scene ? `- Background: ${scene.background}\n- Ground: ${scene.ground}\n- Atmosphere: ${scene.atmosphere}` : '';
    const rawPosString = formatVector3(rawCameraState.position);
    const initialRawTargetString = formatVector3(rawCameraState.target);

    // *** Get Object Center Coordinates - PRIORITIZE GEOMETRY CENTER ***
    const objectCenter = sceneAnalysis?.glb?.geometry?.center || sceneAnalysis?.spatial?.bounds?.center;
    const objectCenterString = formatVector3(objectCenter || { x: 0, y: 1, z: 0 });
    this.logger.debug('[generateSystemMessage] Determined Object Center for TARGETING:', objectCenterString);

    const jsonOutputFormat = `\`\`\`json
{
  "keyframes": [
    {
      "position": {"x": number, "y": number, "z": number},
      "target": {"x": number, "y": number, "z": number}, // Target should be object center
      "duration": number // Duration > 0
    }
    // ... more keyframes ...
  ]
}
\`\`\`
`;

    // Updated system message
    return `You are a professional cinematographer generating a camera path for a 3D scene.
IMPORTANT: Respond ONLY with a valid JSON object matching the specified format. No other text.

JSON OUTPUT FORMAT:
${jsonOutputFormat}

Scene Information:
- Object dimensions: ${dimString}
- Object Center (x,y,z): ${objectCenterString}
- Floor offset: ${floorOffsetString} units
- Scene complexity: ${complexityString}

Current Camera State (Locked Starting Point):
- Position (x,y,z): ${rawPosString}
- Target (x,y,z): ${initialRawTargetString}
- Distance from object: ${camDistString} units
- Height above object: ${camHeightString} units
- Horizontal angle: ${camAngleString} degrees
- Tilt angle: ${camTiltString} degrees
- Field of view: ${camFovString} degrees

Environmental Conditions:
${lightingString}
${sceneString}

Please generate a camera path JSON based on the User Request below that:
1. Adheres strictly to the JSON OUTPUT FORMAT.
2. **IMPORTANT:** The first keyframe's 'position' MUST match the 'Current Camera State' Position ${rawPosString}.
3. **IMPORTANT:** The first keyframe's 'target' MUST match the 'Current Camera State' Target ${initialRawTargetString}.
4. **CRITICAL FOR CORRECT FRAMING:** To keep the object centered, the 'target' value for **ALL** keyframes AFTER THE FIRST ONE must be the fixed 'Object Center' coordinates: ${objectCenterString}. Do not change the target after the first frame.
5. Creates smooth, professional, and visually appealing camera movements appropriate for the scene and object.
6. Interprets the User Request to define the overall motion starting from the locked camera state.`;
  }

  async compilePrompt(
    userInput: string,
    sceneAnalysis: SceneAnalysis,
    envAnalysis: EnvironmentalAnalysis,
    modelMetadata: ModelMetadata,
    currentCameraState: { position: Vector3; target: Vector3; fov: number } // Keep receiving raw state here
  ): Promise<CompiledPrompt> {
    const startTime = performance.now();
    this.logger.debug('[compilePrompt] Received envAnalysis:', envAnalysis);
    this.logger.debug('[compilePrompt] envAnalysis.cameraConstraints:', envAnalysis?.cameraConstraints);
    
    // Pass the raw state directly to generateSystemMessage
    const systemMessage = this.generateSystemMessage(
      sceneAnalysis,
      envAnalysis,
      modelMetadata,
      currentCameraState 
    );

    const endTime = performance.now();
    this.metrics = {
      ...this.metrics,
      endTime,
      duration: endTime - this.metrics.startTime,
      operations: [
        ...this.metrics.operations,
        {
          name: 'compile_prompt',
          duration: endTime - startTime,
          success: true
        }
      ]
    };

    // Construct the object to be returned
    const promptToReturn: CompiledPrompt = {
      systemMessage,
      userMessage: userInput,
      // Log the value just before assignment
      constraints: envAnalysis?.cameraConstraints, 
      metadata: {
        timestamp: new Date(),
        version: '1.0',
        optimizationHistory: [],
        performanceMetrics: this.metrics,
        requestId: crypto.randomUUID(), // Ensure crypto is available
        userId: modelMetadata?.userId // Use optional chaining
      }
    };

    // Log the final object and its constraints just before returning
    this.logger.debug('[compilePrompt] Returning prompt object:', promptToReturn);
    this.logger.debug('[compilePrompt] Returning prompt.constraints:', promptToReturn.constraints);

    return promptToReturn;
  }

  validatePrompt(prompt: CompiledPrompt): ValidationResult {
    const errors: string[] = [];

    if (!prompt.systemMessage) {
      errors.push('Missing system message');
    }

    if (!prompt.userMessage) {
      errors.push('Missing user message');
    }

    if (!prompt.constraints) {
      errors.push('Missing constraints');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async optimizePrompt(prompt: CompiledPrompt): Promise<CompiledPrompt> {
    const startTime = performance.now();
    
    // Simple optimization: trim whitespace and remove duplicate newlines
    const optimizedSystemMessage = prompt.systemMessage
      .trim()
      .replace(/\n{3,}/g, '\n\n');
    
    const optimizedUserMessage = prompt.userMessage
      .trim()
      .replace(/\n{3,}/g, '\n\n');

    const endTime = performance.now();
    
    return {
      ...prompt,
      systemMessage: optimizedSystemMessage,
      userMessage: optimizedUserMessage,
      metadata: {
        ...prompt.metadata,
        optimizationHistory: [
          ...prompt.metadata.optimizationHistory,
          {
            timestamp: new Date(),
            action: 'basic_optimization',
            tokenCountBefore: prompt.systemMessage.length + prompt.userMessage.length,
            tokenCountAfter: optimizedSystemMessage.length + optimizedUserMessage.length,
            details: 'Removed excess whitespace and newlines'
          }
        ]
      }
    };
  }
} 