import { CameraKeyframe } from '@/types/camera';
import { CompiledPrompt } from '@/types/p2p';

/**
 * Parameters required for generating a camera path
 */
export interface PathGenerationParams {
  prompt: string;
  duration: number;
  sceneGeometry: SceneGeometry;
}

export interface SceneGeometry {
  boundingBox: {
    center: Vector3;
    size: Vector3;
  };
  boundingSphere: {
    radius: number;
  };
  floor: {
    height: number;
  };
  safeDistance: {
    min: number;
    max: number;
  };
  currentCamera?: {
    position: Vector3;
    target: Vector3;
    modelOrientation: {
      front: Vector3;
      up: Vector3;
    };
  };
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Capabilities of an LLM provider
 */
export interface ProviderCapabilities {
  name: string;
  version: string;
  maxTokens: number;
  supportsJson: boolean;
  temperature: number;
  maxDuration: number;
}

/**
 * Base configuration for all LLM providers
 */
export interface BaseProviderConfig {
  type: ProviderType;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * OpenAI-specific configuration
 */
export interface OpenAIProviderConfig extends BaseProviderConfig {
  type: 'openai';
  organization?: string;
}

/**
 * Gemini-specific configuration
 */
export interface GeminiProviderConfig extends BaseProviderConfig {
  type: 'gemini';
  // Add Gemini-specific config options here
}

/**
 * Union type of all provider configurations
 */
export type ProviderConfig = OpenAIProviderConfig | GeminiProviderConfig;

/**
 * Supported LLM provider types
 */
export type ProviderType = 'openai' | 'gemini';

/**
 * Core interface that all LLM providers must implement
 */
export interface LLMProvider {
  generateCameraPath(promptData: CompiledPrompt, duration: number): Promise<{ keyframes: CameraKeyframe[] }>;
  validateConfiguration(): Promise<boolean>;
  getCapabilities(): ProviderCapabilities;
  getProviderType(): ProviderType;
}

/**
 * Registry interface for managing LLM providers
 */
export interface ProviderRegistry {
  registerProvider(type: ProviderType, provider: LLMProvider): void;
  getProvider(type: ProviderType): LLMProvider;
  listProviders(): ProviderType[];
  validateProvider(type: ProviderType): Promise<boolean>;
}

/**
 * Error types for LLM operations
 */
export class LLMProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: ProviderType,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'LLMProviderError';
  }
}

export class ConfigurationError extends LLMProviderError {
  constructor(provider: ProviderType, details?: unknown) {
    super('Invalid provider configuration', provider, 'CONFIG_ERROR', details);
  }
}

export class GenerationError extends LLMProviderError {
  constructor(provider: ProviderType, details?: unknown) {
    super('Failed to generate camera path', provider, 'GENERATION_ERROR', details);
  }
} 