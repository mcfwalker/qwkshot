import { Vector3 } from 'three';
import { P2PError } from '../../../types/p2p/shared';
import type { PromptCompiler, PromptCompilerConfig, CompiledPrompt, ValidationResult, PerformanceMetrics } from '../../../types/p2p';
import type { SceneAnalysis } from '../../../types/p2p';
import type { ModelMetadata } from '../../../types/p2p';
import { EnvironmentalAnalysis } from '../../../types/p2p/environmental-analyzer';

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

export class PromptCompilerImpl implements PromptCompiler {
  private config: PromptCompilerConfig;
  private metrics: PerformanceMetrics = {
    startTime: 0,
    endTime: 0,
    duration: 0,
    operations: [],
    // Initialize missing fields
    cacheHits: 0,
    cacheMisses: 0,
    databaseQueries: 0,
    averageResponseTime: 0,
  };

  constructor(config: PromptCompilerConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    this.metrics.startTime = Date.now();
    // Reset metrics on initialization if needed
    this.metrics = {
        startTime: Date.now(),
        endTime: 0,
        duration: 0,
        operations: [],
        cacheHits: 0,
        cacheMisses: 0,
        databaseQueries: 0,
        averageResponseTime: 0,
    };
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return this.metrics;
  }

  async compilePrompt(
    userInput: string,
    sceneAnalysis: SceneAnalysis,
    envAnalysis: EnvironmentalAnalysis,
    modelMetadata: ModelMetadata,
    currentCameraState: { position: Vector3; target: Vector3 }
  ): Promise<CompiledPrompt> {
    try {
      const sceneContext = this.extractSceneContext(sceneAnalysis);
      const userPreferences = this.extractUserPreferences(modelMetadata);
      const baseSafetyConstraints = this.extractBaseSafetyConstraints(sceneAnalysis, modelMetadata);
      const finalConstraints = {
        ...baseSafetyConstraints,
        minDistance: envAnalysis.cameraConstraints?.minDistance ?? baseSafetyConstraints.minDistance,
        maxDistance: envAnalysis.cameraConstraints?.maxDistance ?? baseSafetyConstraints.maxDistance,
        minHeight: envAnalysis.cameraConstraints?.minHeight ?? baseSafetyConstraints.minHeight,
        maxHeight: envAnalysis.cameraConstraints?.maxHeight ?? baseSafetyConstraints.maxHeight,
      };

      const { message: userInstructions } = this.processUserInput(userInput);
      const systemMessage = this.generateSystemMessage(sceneContext, envAnalysis, finalConstraints, currentCameraState);
      const tokenCount = this.calculateTokenCount(systemMessage, userInstructions);

      const compiledPrompt: CompiledPrompt = {
        systemMessage,
        userMessage: userInstructions,
        constraints: {
          ...finalConstraints,
          maxSpeed: 1.0,
          maxAngleChange: Math.PI / 4,
          minFramingMargin: 0.1,
        },
        metadata: {
          timestamp: new Date(),
          version: '1.1',
          optimizationHistory: [],
          performanceMetrics: this.metrics,
          requestId: 'test-request-id', // TODO: Generate proper UUID
          userId: modelMetadata.userId,
        },
        tokenCount,
      };

      return compiledPrompt;
    } catch (error) {
      console.error("Error compiling prompt:", error);
      if (error instanceof P2PError) {
        throw error;
      } else {
        throw new P2PError(
          error instanceof Error ? error.message : 'Failed to compile prompt',
          'COMPILATION_ERROR',
          'PROMPT_COMPILER'
        );
      }
    }
  }

  validatePrompt(prompt: CompiledPrompt): ValidationResult {
    const errors: string[] = [];
    try {
      // Check if required fields are present
      if (!prompt.systemMessage) errors.push('Missing systemMessage');
      if (!prompt.userMessage) errors.push('Missing userMessage');

      // Validate constraints
      if (!this.validateConstraints(prompt.constraints)) {
        errors.push('Invalid constraint values');
      }

      // Check if constraints are within safety bounds (example)
      const { minDistance, maxDistance } = prompt.constraints;
      // Use default values if undefined for validation purposes
      const safeMinDistance = minDistance ?? 0.5;
      const safeMaxDistance = maxDistance ?? 10.0;
      if (safeMinDistance < 0.5 || safeMaxDistance > 10.0) {
        errors.push('Distance constraints exceed safety bounds (0.5 - 10.0)');
      }
      // Add more specific constraint validations here

      return { isValid: errors.length === 0, errors };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown validation error';
        return {
            isValid: false,
            errors: [...errors, message], // Include caught error along with others
        };
    }
  }

  async optimizePrompt(prompt: CompiledPrompt): Promise<CompiledPrompt> {
    try {
      // Create a copy of the prompt to optimize
      const optimized = { ...prompt };

      // Calculate initial token count
      const initialTokenCount = this.calculateTokenCount(
        prompt.systemMessage,
        prompt.userMessage
      );

      // Optimize system message
      optimized.systemMessage = this.optimizeMessage(prompt.systemMessage);

      // Optimize user message
      optimized.userMessage = this.optimizeMessage(prompt.userMessage);

      // Calculate final token count
      const finalTokenCount = this.calculateTokenCount(
        optimized.systemMessage,
        optimized.userMessage
      );

      // Update metadata with optimization info
      optimized.metadata = {
        ...optimized.metadata,
        optimizationHistory: [
          ...optimized.metadata.optimizationHistory,
          {
            timestamp: new Date(),
            action: 'message_optimization',
            tokenCountBefore: initialTokenCount,
            tokenCountAfter: finalTokenCount,
            details: 'Optimized message length while preserving meaning',
          },
        ],
      };

      // Add token count to the optimized prompt
      optimized.tokenCount = finalTokenCount;

      return optimized;
    } catch (error) {
      throw new P2PError('Failed to optimize prompt', 'OPTIMIZATION_ERROR', 'PROMPT_COMPILER');
    }
  }

  private extractSceneContext(sceneAnalysis: SceneAnalysis) {
    const bounds = sceneAnalysis.spatial?.bounds || { min: {x:0,y:0,z:0}, max: {x:0,y:0,z:0}, center: {x:0,y:0,z:0} };
    const referencePoints = sceneAnalysis.spatial?.referencePoints || {};
    const features = sceneAnalysis.features || [];
    return {
      bounds,
      center: bounds.center,
      referencePoints,
      features,
    };
  }

  private extractUserPreferences(modelMetadata: ModelMetadata) {
    const prefs = modelMetadata.preferences || {};
    return {
      defaultDistance: prefs.defaultCameraDistance ?? 5.0,
      preferredViewAngles: prefs.preferredViewAngles ?? [],
    };
  }

  private extractBaseSafetyConstraints(sceneAnalysis: SceneAnalysis, modelMetadata: ModelMetadata) {
    const sceneConstraints = sceneAnalysis.safetyConstraints || {};
    const userPrefs = modelMetadata.preferences;
    const userPrefsConstraints = userPrefs && (userPrefs as any).safetyConstraints ? (userPrefs as any).safetyConstraints : {};
    const defaultMinDistance = 0.5;
    const defaultMaxDistance = 10.0;
    const defaultMinHeight = 0.1;
    const defaultMaxHeight = 50.0;
    return {
      minDistance: Math.max(sceneConstraints.minDistance ?? defaultMinDistance, userPrefsConstraints.minDistance ?? defaultMinDistance),
      maxDistance: Math.min(sceneConstraints.maxDistance ?? defaultMaxDistance, userPrefsConstraints.maxDistance ?? defaultMaxDistance),
      minHeight: Math.max(sceneConstraints.minHeight ?? defaultMinHeight, userPrefsConstraints.minHeight ?? defaultMinHeight, 0),
      maxHeight: Math.min(sceneConstraints.maxHeight ?? defaultMaxHeight, userPrefsConstraints.maxHeight ?? defaultMaxHeight),
      restrictedZones: [...(sceneConstraints.restrictedZones || [])],
    };
  }

  private generateSystemMessage(
    sceneContext: any,
    envAnalysis: EnvironmentalAnalysis,
    constraints: any,
    currentCameraState: { position: Vector3; target: Vector3 }
  ): string {
    const jsonFormat = `{\n  \"keyframes\": [\n    {\n      \"position\": {\"x\": number, \"y\": number, \"z\": number},\n      \"target\": {\"x\": number, \"y\": number, \"z\": number},\n      \"duration\": number // Duration > 0\n    }\n    // ... more keyframes\n  ]\n}`;

    const distances = envAnalysis.distances?.fromObjectToBoundary;
    const distString = distances ? 
      `- Dist to Boundary: L:${distances.left?.toFixed(2) ?? 'N/A'} R:${distances.right?.toFixed(2) ?? 'N/A'} F:${distances.front?.toFixed(2) ?? 'N/A'} B:${distances.back?.toFixed(2) ?? 'N/A'} T:${distances.top?.toFixed(2) ?? 'N/A'} Bot:${distances.bottom?.toFixed(2) ?? 'N/A'}` 
      : '- Distances to boundary: Not available';

    return `You are an expert virtual cinematographer generating camera paths for a 3D model viewer. Your response MUST be ONLY a valid JSON object matching the specified format.\n\nIMPORTANT JSON OUTPUT FORMAT:\n\`\`\`json\n${jsonFormat}\n\`\`\`\n\nRULES:\n1. Respond ONLY with the JSON object described above. No explanations, apologies, or extra text.\n2. The sum of all keyframe durations MUST match the requested total duration. (Handle total duration logic outside this prompt if needed)\n3. Each keyframe MUST have a duration greater than 0.\n4. Start the camera path from the current camera state provided.\n5. Respect all safety constraints.\n6. Generate smooth, natural, and visually appealing camera movements.\n\nCURRENT CAMERA STATE:\n- Position: ${formatVector3(currentCameraState.position)}\n- Target: ${formatVector3(currentCameraState.target)}\n\nSCENE & ENVIRONMENT CONTEXT:\n- Model Center: ${formatVector3(sceneContext.center)}\n- Model Bounds: ${formatBounds(sceneContext.bounds)}\n- Environment Dimensions: W:${envAnalysis.environment?.dimensions?.width?.toFixed(2) ?? 'N/A'} H:${envAnalysis.environment?.dimensions?.height?.toFixed(2) ?? 'N/A'} D:${envAnalysis.environment?.dimensions?.depth?.toFixed(2) ?? 'N/A'}\n${distString}\n- Key Reference Points: ${JSON.stringify(sceneContext.referencePoints)}\n- Notable Features: ${JSON.stringify(sceneContext.features)}\n\nSAFETY CONSTRAINTS:\n- Min Distance from Center: ${constraints.minDistance?.toFixed(2) ?? 'N/A'}\n- Max Distance from Center: ${constraints.maxDistance?.toFixed(2) ?? 'N/A'}\n- Min Height (Y): ${constraints.minHeight?.toFixed(2) ?? 'N/A'}\n- Max Height (Y): ${constraints.maxHeight?.toFixed(2) ?? 'N/A'}\n- Restricted Zones: ${JSON.stringify(constraints.restrictedZones)}\n`;
  }

  private processUserInput(userInput: string): { message: string; constraints?: any } {
    const { instructions, constraints } = this.parseUserInstructions(userInput);
    return {
      message: instructions,
      constraints,
    };
  }

  private parseUserInstructions(userInput: string): { instructions: string; constraints: any } {
    const constraints = {};
    const durationMatch = userInput.match(/duration.*?(\\d+)\\s*seconds?/i);
    let requestedDuration: number | undefined;
    if (durationMatch && durationMatch[1]) {
      requestedDuration = parseInt(durationMatch[1], 10);
    }
    return { instructions: userInput, constraints };
  }

  private validateConstraints(constraints: any): boolean {
    if (!constraints) return false;
    return (
      typeof constraints.minDistance === 'number' &&
      typeof constraints.maxDistance === 'number' &&
      constraints.minDistance <= constraints.maxDistance &&
      typeof constraints.minHeight === 'number' &&
      typeof constraints.maxHeight === 'number' &&
      constraints.minHeight <= constraints.maxHeight
    );
  }

  private optimizeMessage(message: string): string {
    return message.trim();
  }

  private calculateTokenCount(systemMessage: string, userMessage: string): number {
    return Math.ceil((systemMessage.length + userMessage.length) / 4);
  }
} 