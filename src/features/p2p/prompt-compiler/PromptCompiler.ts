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
    currentCameraState: LLMFriendlyCameraState
  ): string {
    const { environment, object, distances, cameraConstraints } = envAnalysis;
    const { lighting, scene } = modelMetadata.environment || {};

    return `You are a professional cinematographer tasked with creating a camera path for a 3D scene.

Scene Information:
- Object dimensions: ${object.dimensions.width.toFixed(2)}x${object.dimensions.height.toFixed(2)}x${object.dimensions.depth.toFixed(2)} units
- Floor offset: ${object.floorOffset.toFixed(2)} units
- Scene complexity: ${sceneAnalysis.spatial.complexity}
- Available space: ${distances.fromObjectToBoundary.front.toFixed(2)} units front, ${distances.fromObjectToBoundary.back.toFixed(2)} units back

Camera Constraints:
- Height range: ${cameraConstraints.minHeight.toFixed(2)} to ${cameraConstraints.maxHeight.toFixed(2)} units
- Distance range: ${cameraConstraints.minDistance.toFixed(2)} to ${cameraConstraints.maxDistance.toFixed(2)} units
- Movement speed: Maintain smooth transitions between keyframes
- Framing: Keep the object centered and well-framed

Current Camera State:
- Distance from object: ${currentCameraState.distance.toFixed(2)} units
- Height above object: ${currentCameraState.height.toFixed(2)} units
- Horizontal angle: ${currentCameraState.angle.toFixed(2)} degrees
- Tilt angle: ${currentCameraState.tilt.toFixed(2)} degrees
- Field of view: ${currentCameraState.fov.toFixed(2)} degrees

Environmental Conditions:
${lighting ? `- Lighting: ${lighting.intensity} intensity, ${lighting.color} color` : ''}
${scene ? `- Background: ${scene.background}
- Ground: ${scene.ground}
- Atmosphere: ${scene.atmosphere}` : ''}

Please generate a camera path that:
1. Maintains smooth transitions between keyframes
2. Stays within the specified constraints
3. Considers the environmental conditions
4. Creates visually appealing shots that highlight the object's features`;
  }

  async compilePrompt(
    userInput: string,
    sceneAnalysis: SceneAnalysis,
    envAnalysis: EnvironmentalAnalysis,
    modelMetadata: ModelMetadata,
    currentCameraState: { position: Vector3; target: Vector3; fov: number }
  ): Promise<CompiledPrompt> {
    const startTime = performance.now();
    
    const llmFriendlyCameraState = this.transformCameraState(
      currentCameraState.position,
      currentCameraState.target,
      currentCameraState.fov
    );

    const systemMessage = this.generateSystemMessage(
      sceneAnalysis,
      envAnalysis,
      modelMetadata,
      llmFriendlyCameraState
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

    return {
      systemMessage,
      userMessage: userInput,
      constraints: envAnalysis.cameraConstraints,
      metadata: {
        timestamp: new Date(),
        version: '1.0',
        optimizationHistory: [],
        performanceMetrics: this.metrics,
        requestId: crypto.randomUUID(),
        userId: modelMetadata.userId
      }
    };
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