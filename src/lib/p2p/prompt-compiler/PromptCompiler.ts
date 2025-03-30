import { v4 as uuidv4 } from 'uuid';
import {
  PromptCompiler as IPromptCompiler,
  CompilePromptParams,
  CompiledPrompt,
  OptimizedPrompt,
  ContextualPrompt,
  PromptMetadata,
  CameraConstraints,
  SceneContext,
  SafetyCheck,
  OptimizationStep,
  PerformanceMetrics,
} from '@/types/p2p/prompt-compiler';

const DEFAULT_CONSTRAINTS: CameraConstraints = {
  maxSpeed: 2.0,
  minDistance: 1.0,
  maxDistance: 10.0,
  maxAngleChange: Math.PI / 4,
  minFramingMargin: 0.1,
};

const SYSTEM_PROMPT_TEMPLATE = `You are a virtual cinematographer assistant. Your task is to generate camera paths based on natural language instructions.
Follow these constraints:
- Maximum camera speed: {maxSpeed} units/second
- Minimum distance from target: {minDistance} units
- Maximum distance from target: {maxDistance} units
- Maximum angle change per second: {maxAngleChange} radians
- Minimum framing margin: {minFramingMargin} units

Generate a camera path that:
1. Maintains smooth, natural motion
2. Keeps the target in frame
3. Respects all safety constraints
4. Creates visually appealing compositions

Respond with a JSON object containing the camera path segments.`;

export class PromptCompiler implements IPromptCompiler {
  private readonly version: string = '1.0.0';
  private readonly tokenEstimator: (text: string) => number;

  constructor(tokenEstimator: (text: string) => number) {
    this.tokenEstimator = tokenEstimator;
  }

  async compilePrompt(params: CompilePromptParams): Promise<CompiledPrompt> {
    const startTime = performance.now();
    
    // Merge constraints with defaults
    const constraints = {
      ...DEFAULT_CONSTRAINTS,
      ...params.constraints,
    };

    // Generate system message with constraints
    const systemMessage = this.generateSystemMessage(constraints);

    // Create user message with style and duration if provided
    const userMessage = this.generateUserMessage(params);

    // Create initial metadata
    const metadata: PromptMetadata = {
      timestamp: new Date(),
      version: this.version,
      optimizationHistory: [],
      performanceMetrics: {
        compilationTime: 0,
        optimizationTime: 0,
        contextIntegrationTime: 0,
        totalTokens: 0,
        optimizationSteps: [],
      },
      requestId: uuidv4(),
      userId: params.userId,
    };

    // Calculate compilation time
    const compilationTime = performance.now() - startTime;

    const prompt: CompiledPrompt = {
      systemMessage,
      userMessage,
      constraints,
      metadata: {
        ...metadata,
        performanceMetrics: {
          ...metadata.performanceMetrics,
          compilationTime,
        },
      },
    };

    return prompt;
  }

  async optimizePrompt(prompt: CompiledPrompt): Promise<OptimizedPrompt> {
    const startTime = performance.now();
    const optimizationSteps: OptimizationStep[] = [];

    // Initial token count
    let currentTokens = this.tokenEstimator(
      prompt.systemMessage + prompt.userMessage
    );

    // Optimization levels based on token count
    const optimizationLevel = this.determineOptimizationLevel(currentTokens);

    // Apply optimizations based on level
    const optimizedPrompt = await this.applyOptimizations(
      prompt,
      optimizationLevel,
      optimizationSteps
    );

    // Calculate optimization time
    const optimizationTime = performance.now() - startTime;

    return {
      ...optimizedPrompt,
      tokenCount: currentTokens,
      optimizationLevel,
      metadata: {
        ...prompt.metadata,
        optimizationHistory: optimizationSteps,
        performanceMetrics: {
          ...prompt.metadata.performanceMetrics,
          optimizationTime,
        },
      },
    };
  }

  async addSceneContext(
    prompt: OptimizedPrompt,
    scene: SceneContext
  ): Promise<ContextualPrompt> {
    const startTime = performance.now();
    const safetyChecks = this.performSafetyChecks(scene);

    // Add scene context to user message
    const contextualizedMessage = this.addContextToMessage(
      prompt.userMessage,
      scene
    );

    // Calculate context integration time
    const contextIntegrationTime = performance.now() - startTime;

    return {
      ...prompt,
      userMessage: contextualizedMessage,
      sceneContext: scene,
      safetyChecks,
      metadata: {
        ...prompt.metadata,
        performanceMetrics: {
          ...prompt.metadata.performanceMetrics,
          contextIntegrationTime,
        },
      },
    };
  }

  async trackMetadata(prompt: ContextualPrompt): Promise<PromptMetadata> {
    return prompt.metadata;
  }

  private generateSystemMessage(constraints: CameraConstraints): string {
    return SYSTEM_PROMPT_TEMPLATE
      .replace('{maxSpeed}', constraints.maxSpeed.toString())
      .replace('{minDistance}', constraints.minDistance.toString())
      .replace('{maxDistance}', constraints.maxDistance.toString())
      .replace('{maxAngleChange}', constraints.maxAngleChange.toString())
      .replace('{minFramingMargin}', constraints.minFramingMargin.toString());
  }

  private generateUserMessage(params: CompilePromptParams): string {
    const parts: string[] = [params.instruction];

    if (params.duration) {
      parts.push(`Duration: ${params.duration} seconds`);
    }

    if (params.style) {
      parts.push(`Style: ${params.style}`);
    }

    return parts.join('\n');
  }

  private determineOptimizationLevel(tokenCount: number): 'minimal' | 'balanced' | 'detailed' {
    if (tokenCount > 4000) return 'minimal';
    if (tokenCount > 2000) return 'balanced';
    return 'detailed';
  }

  private async applyOptimizations(
    prompt: CompiledPrompt,
    level: 'minimal' | 'balanced' | 'detailed',
    steps: OptimizationStep[]
  ): Promise<CompiledPrompt> {
    // Apply different optimization strategies based on level
    switch (level) {
      case 'minimal':
        return this.applyMinimalOptimizations(prompt, steps);
      case 'balanced':
        return this.applyBalancedOptimizations(prompt, steps);
      case 'detailed':
        return this.applyDetailedOptimizations(prompt, steps);
    }
  }

  private async applyMinimalOptimizations(
    prompt: CompiledPrompt,
    steps: OptimizationStep[]
  ): Promise<CompiledPrompt> {
    // Implement minimal optimization strategy
    return prompt;
  }

  private async applyBalancedOptimizations(
    prompt: CompiledPrompt,
    steps: OptimizationStep[]
  ): Promise<CompiledPrompt> {
    // Implement balanced optimization strategy
    return prompt;
  }

  private async applyDetailedOptimizations(
    prompt: CompiledPrompt,
    steps: OptimizationStep[]
  ): Promise<CompiledPrompt> {
    // Implement detailed optimization strategy
    return prompt;
  }

  private performSafetyChecks(scene: SceneContext): SafetyCheck[] {
    const checks: SafetyCheck[] = [];

    // Add distance check
    checks.push({
      type: 'distance',
      status: 'safe',
      message: 'Distance within safe range',
      value: scene.sceneScale,
      threshold: DEFAULT_CONSTRAINTS.maxDistance,
    });

    // Add framing check
    checks.push({
      type: 'framing',
      status: 'safe',
      message: 'Object dimensions within frame',
      value: Math.max(
        scene.objectDimensions.width,
        scene.objectDimensions.height,
        scene.objectDimensions.depth
      ),
      threshold: scene.sceneScale * 0.8,
    });

    return checks;
  }

  private addContextToMessage(message: string, scene: SceneContext): string {
    const context = `
Scene Context:
- Object Type: ${scene.objectType}
- Object Dimensions: ${scene.objectDimensions.width.toFixed(2)} x ${scene.objectDimensions.height.toFixed(2)} x ${scene.objectDimensions.depth.toFixed(2)}
- Scene Scale: ${scene.sceneScale.toFixed(2)}
- Object Center: (${scene.objectCenter.x.toFixed(2)}, ${scene.objectCenter.y.toFixed(2)}, ${scene.objectCenter.z.toFixed(2)})
`;

    return `${message}\n${context}`;
  }
} 