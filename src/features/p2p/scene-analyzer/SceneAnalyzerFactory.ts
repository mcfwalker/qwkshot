import { SceneAnalyzer, SceneAnalyzerConfig, SceneAnalyzerFactory, Logger } from '../../../types/p2p';
import { SceneAnalyzerImpl } from './SceneAnalyzer';

/**
 * Implementation of the Scene Analyzer Factory
 */
export class SceneAnalyzerFactoryImpl implements SceneAnalyzerFactory {
  create(config: SceneAnalyzerConfig, logger: Logger): SceneAnalyzer {
    return new SceneAnalyzerImpl(config, logger);
  }
} 