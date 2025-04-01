import { LLMEngine, LLMEngineConfig, LLMEngineFactory as ILLMEngineFactory } from '@/types/p2p/llm-engine';
import { Logger } from '@/types/p2p/shared';
import { LLMEngineImpl } from './LLMEngine';

/**
 * Factory class for creating LLMEngine instances
 */
export class LLMEngineFactory implements ILLMEngineFactory {
  constructor(private logger: Logger) {}

  /**
   * Create a new LLMEngine instance with the specified configuration
   */
  create(config: LLMEngineConfig): LLMEngine {
    return new LLMEngineImpl(config, this.logger);
  }
} 