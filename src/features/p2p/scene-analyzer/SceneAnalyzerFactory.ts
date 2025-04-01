import { SceneAnalyzer, SceneAnalyzerConfig, SceneAnalyzerFactory as ISceneAnalyzerFactory } from '@/types/p2p/scene-analyzer';
import { Logger } from '@/types/p2p/shared';
import { SceneAnalyzerImpl } from './SceneAnalyzer';

/**
 * Factory class for creating SceneAnalyzer instances
 */
export class SceneAnalyzerFactory implements ISceneAnalyzerFactory {
  constructor(private logger: Logger) {}

  /**
   * Create a new SceneAnalyzer instance with the specified configuration
   */
  create(config: SceneAnalyzerConfig): SceneAnalyzer {
    return new SceneAnalyzerImpl(config, this.logger);
  }
} 