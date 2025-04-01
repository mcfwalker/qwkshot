import { Logger } from '@/types/p2p/shared';
import { PromptCompiler, PromptCompilerConfig } from '@/types/p2p/prompt-compiler';
import { PromptCompilerImpl } from './PromptCompiler';

/**
 * Factory class for creating PromptCompiler instances
 */
export class PromptCompilerFactory {
  constructor(private logger: Logger) {}

  /**
   * Create a new PromptCompiler instance with the specified configuration
   */
  create(config: PromptCompilerConfig): PromptCompiler {
    return new PromptCompilerImpl(config, this.logger);
  }
} 