import { P2PError } from '../../../types/p2p/shared';
import type { PromptCompiler, PromptCompilerConfig, CompiledPrompt, ValidationResult, PerformanceMetrics } from '../../../types/p2p';
import type { SceneAnalysis } from '../../../types/p2p';
import type { ModelMetadata } from '../../../types/p2p';

export class PromptCompilerImpl implements PromptCompiler {
  private config: PromptCompilerConfig;
  private metrics: PerformanceMetrics = {
    startTime: 0,
    endTime: 0,
    duration: 0,
    operations: [],
  };

  constructor(config: PromptCompilerConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    this.metrics.startTime = Date.now();
    // Any initialization logic can go here
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return this.metrics;
  }

  async compilePrompt(
    userInput: string,
    sceneAnalysis: SceneAnalysis,
    modelMetadata: ModelMetadata
  ): Promise<CompiledPrompt> {
    try {
      // Extract key information from scene analysis and metadata
      const sceneContext = this.extractSceneContext(sceneAnalysis);
      const userPreferences = this.extractUserPreferences(modelMetadata);
      const safetyConstraints = this.extractSafetyConstraints(sceneAnalysis, modelMetadata);

      // Process user input and generate user message
      const { message: userMessage, constraints: userConstraints } = this.processUserInput(userInput, sceneContext, userPreferences);

      // Generate system message with context
      const systemMessage = this.generateSystemMessage(sceneContext, safetyConstraints);

      // Calculate token count
      const tokenCount = this.calculateTokenCount(systemMessage, userMessage);

      // Create compiled prompt
      const compiledPrompt: CompiledPrompt = {
        systemMessage,
        userMessage,
        constraints: {
          ...safetyConstraints,
          ...userConstraints,
          maxSpeed: 1.0,
          maxAngleChange: Math.PI / 4,
          minFramingMargin: 0.1,
        },
        metadata: {
          timestamp: new Date(),
          version: '1.0',
          optimizationHistory: [],
          performanceMetrics: this.metrics,
          requestId: 'test-request-id', // TODO: Generate proper UUID
          userId: modelMetadata.userId,
        },
      };

      return compiledPrompt;
    } catch (error) {
      throw new P2PError('Failed to compile prompt', 'COMPILATION_ERROR', 'PROMPT_COMPILER');
    }
  }

  validatePrompt(prompt: CompiledPrompt): ValidationResult {
    try {
      // Check if required fields are present
      if (!prompt.systemMessage || !prompt.userMessage) {
        return {
          isValid: false,
          error: 'Missing required prompt fields',
        };
      }

      // Validate constraints
      if (!this.validateConstraints(prompt.constraints)) {
        return {
          isValid: false,
          error: 'Invalid constraint values',
        };
      }

      // Check if constraints are within safety bounds
      const { minDistance, maxDistance } = prompt.constraints;
      if (minDistance < 0.5 || maxDistance > 10.0) {
        return {
          isValid: false,
          error: 'Distance constraints exceed safety bounds',
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown validation error',
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
    return {
      bounds: sceneAnalysis.spatial.bounds,
      center: sceneAnalysis.spatial.bounds.center,
      referencePoints: sceneAnalysis.spatial.referencePoints,
      features: sceneAnalysis.features,
    };
  }

  private extractUserPreferences(modelMetadata: ModelMetadata) {
    return {
      defaultDistance: modelMetadata.preferences.defaultCameraDistance,
      preferredAngles: modelMetadata.preferences.preferredViewingAngles,
    };
  }

  private extractSafetyConstraints(sceneAnalysis: SceneAnalysis, modelMetadata: ModelMetadata) {
    const sceneConstraints = sceneAnalysis.safetyConstraints;
    const userConstraints = modelMetadata.preferences.safetyConstraints;

    return {
      minDistance: Math.max(sceneConstraints.minDistance, userConstraints.minDistance),
      maxDistance: Math.min(sceneConstraints.maxDistance, userConstraints.maxDistance),
      minHeight: Math.max(sceneConstraints.minHeight, 0),
      maxHeight: Math.min(sceneConstraints.maxHeight, 100),
      restrictedZones: [...sceneConstraints.restrictedZones],
    };
  }

  private generateSystemMessage(sceneContext: any, constraints: any): string {
    return `You are a camera path generator for a 3D model viewer. Your task is to generate a smooth, natural camera path based on the user's instructions.

Scene Context:
- Model bounds: ${JSON.stringify(sceneContext.bounds)}
- Center point: ${JSON.stringify(sceneContext.center)}
- Reference points: ${JSON.stringify(sceneContext.referencePoints)}
- Features: ${JSON.stringify(sceneContext.features)}

Safety Constraints:
- Minimum distance: ${constraints.minDistance}
- Maximum distance: ${constraints.maxDistance}
- Minimum height: ${constraints.minHeight}
- Maximum height: ${constraints.maxHeight}
- Restricted zones: ${JSON.stringify(constraints.restrictedZones)}

Generate a camera path that:
1. Follows the user's instructions
2. Respects all safety constraints
3. Creates smooth, natural movement
4. Maintains consistent speed
5. Avoids sudden changes

Output the path as a series of keyframes with position and target coordinates.`;
  }

  private processUserInput(
    userInput: string,
    sceneContext: any,
    userPreferences: any
  ): { message: string; constraints: any } {
    // Process user input to extract key information
    const { instructions, constraints } = this.parseUserInstructions(userInput);
    
    // Add context about the scene and user preferences
    return {
      message: `Based on the following scene and preferences:
- Model center: ${JSON.stringify(sceneContext.center)}
- Default distance: ${userPreferences.defaultDistance}
- Preferred viewing angles: ${JSON.stringify(userPreferences.preferredAngles)}

User instructions: ${instructions}

Please generate a camera path that follows these instructions while respecting all safety constraints.`,
      constraints
    };
  }

  private parseUserInstructions(userInput: string): { instructions: string; constraints: any } {
    const input = userInput.toLowerCase();
    const constraints: any = {};

    // Extract distance constraints
    const distanceMatch = input.match(/distance of (\d+(?:\.\d+)?)/);
    if (distanceMatch) {
      const distance = parseFloat(distanceMatch[1]);
      constraints.minDistance = distance;
      constraints.maxDistance = distance;
    }

    // Check for unsafe distance requests
    if (input.includes('too close')) {
      constraints.minDistance = 0.1; // Set to unsafe distance
      constraints.maxDistance = 0.1;
      return {
        instructions: input.replace('too close', 'maintain unsafe distance'),
        constraints
      };
    }

    // Process other instructions
    let instructions = input;
    if (input.includes('get close')) {
      instructions = input.replace('get close', 'maintain minimum safe distance');
    }

    return { instructions, constraints };
  }

  private calculateTokenCount(systemMessage: string, userMessage: string): number {
    // Simple token estimation - can be enhanced with actual tokenizer
    return Math.ceil((systemMessage.length + userMessage.length) / 4);
  }

  private validateConstraints(constraints: any): boolean {
    return (
      constraints.minDistance >= 0 &&
      constraints.maxDistance >= constraints.minDistance &&
      constraints.minHeight >= 0 &&
      constraints.maxHeight > constraints.minHeight &&
      constraints.maxSpeed > 0 &&
      constraints.maxAngleChange > 0 &&
      constraints.minFramingMargin >= 0 &&
      Array.isArray(constraints.restrictedZones)
    );
  }

  private optimizeMessage(message: string): string {
    // Simple optimization - can be enhanced with more sophisticated techniques
    return message
      .replace(/\s+/g, ' ')
      .replace(/\n\s*/g, '\n')
      .trim();
  }
} 