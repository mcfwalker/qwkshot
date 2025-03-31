import { LLMProvider, PathGenerationParams, ProviderCapabilities, BaseProviderConfig, LLMProviderError, ProviderType } from './types';
import { CompiledPrompt } from '@/types/p2p';

/**
 * Abstract base class for all LLM providers
 * Provides common functionality and enforces consistent interface
 */
export abstract class BaseLLMProvider implements LLMProvider {
  protected config: BaseProviderConfig;

  constructor(config: BaseProviderConfig) {
    this.config = config;
  }

  /**
   * Get the type of this provider
   */
  public getProviderType(): ProviderType {
    return this.config.type;
  }

  abstract generateCameraPath(promptData: CompiledPrompt, duration: number): Promise<{ keyframes: any[] }>;
  abstract validateConfiguration(): Promise<boolean>;
  abstract getCapabilities(): ProviderCapabilities;

  /**
   * Validates the structure of generated keyframes
   */
  protected validateKeyframes(keyframes: any[]): boolean {
    if (!Array.isArray(keyframes)) {
      return false;
    }

    return keyframes.every((kf) => {
      return (
        kf &&
        typeof kf === 'object' &&
        typeof kf.position === 'object' &&
        typeof kf.target === 'object' &&
        typeof kf.duration === 'number' &&
        typeof kf.position.x === 'number' &&
        typeof kf.position.y === 'number' &&
        typeof kf.position.z === 'number' &&
        typeof kf.target.x === 'number' &&
        typeof kf.target.y === 'number' &&
        typeof kf.target.z === 'number'
      );
    });
  }

  /**
   * Helper method to throw provider-specific errors
   */
  protected throwError(message: string, code: string, details?: unknown): never {
    throw new LLMProviderError(message, this.getProviderType(), code, details);
  }
} 