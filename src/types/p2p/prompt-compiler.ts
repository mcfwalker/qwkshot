import { Vector3, Box3 } from 'three';

export type CameraStyle = 'cinematic' | 'documentary' | 'technical' | 'artistic';

export interface CameraConstraints {
  maxSpeed: number;
  minDistance: number;
  maxDistance: number;
  maxAngleChange: number;
  minFramingMargin: number;
}

export interface SceneContext {
  objectCenter: Vector3;
  boundingBox: Box3;
  cameraStart: {
    position: Vector3;
    target: Vector3;
  };
  sceneScale: number;
  objectType: string;
  objectDimensions: {
    width: number;
    height: number;
    depth: number;
  };
}

export interface OptimizationStep {
  timestamp: Date;
  action: string;
  tokenCountBefore: number;
  tokenCountAfter: number;
  details: string;
}

export interface PerformanceMetrics {
  compilationTime: number;
  optimizationTime: number;
  contextIntegrationTime: number;
  totalTokens: number;
  optimizationSteps: OptimizationStep[];
}

export interface CompilePromptParams {
  instruction: string;
  duration?: number;
  style?: CameraStyle;
  constraints?: Partial<CameraConstraints>;
  sceneContext?: Partial<SceneContext>;
  userId?: string;
}

export interface CompiledPrompt {
  systemMessage: string;
  userMessage: string;
  constraints: CameraConstraints;
  metadata: PromptMetadata;
}

export interface OptimizedPrompt extends CompiledPrompt {
  tokenCount: number;
  optimizationLevel: 'minimal' | 'balanced' | 'detailed';
}

export interface ContextualPrompt extends OptimizedPrompt {
  sceneContext: SceneContext;
  safetyChecks: SafetyCheck[];
}

export interface SafetyCheck {
  type: 'distance' | 'speed' | 'angle' | 'framing';
  status: 'safe' | 'warning' | 'error';
  message: string;
  value: number;
  threshold: number;
}

export interface PromptMetadata {
  timestamp: Date;
  version: string;
  optimizationHistory: OptimizationStep[];
  performanceMetrics: PerformanceMetrics;
  requestId: string;
  userId?: string;
}

export interface PromptCompiler {
  compilePrompt(params: CompilePromptParams): Promise<CompiledPrompt>;
  optimizePrompt(prompt: CompiledPrompt): Promise<OptimizedPrompt>;
  addSceneContext(prompt: OptimizedPrompt, scene: SceneContext): Promise<ContextualPrompt>;
  trackMetadata(prompt: ContextualPrompt): Promise<PromptMetadata>;
} 