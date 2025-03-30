import { Logger } from '../../../types/p2p/shared';
import {
  P2PPipeline,
  P2PPipelineConfig,
  P2PPipelineFactory,
} from '../../../types/p2p/pipeline';
import { SceneAnalyzer, SceneAnalyzerFactory } from '../../../types/p2p/scene-analyzer';
import { MetadataManager, MetadataManagerFactory } from '../../../types/p2p/metadata-manager';
import { PromptCompiler, PromptCompilerFactory } from '../../../types/p2p/prompt-compiler';
import { LLMEngine, LLMEngineFactory } from '../../../types/p2p/llm-engine';
import { SceneInterpreter, SceneInterpreterFactory } from '../../../types/p2p/scene-interpreter';
import { P2PPipelineImpl } from './P2PPipeline';

/**
 * Implementation of the P2P Pipeline Factory
 */
export class P2PPipelineFactoryImpl implements P2PPipelineFactory {
  constructor(
    private sceneAnalyzerFactory: SceneAnalyzerFactory,
    private metadataManagerFactory: MetadataManagerFactory,
    private promptCompilerFactory: PromptCompilerFactory,
    private llmEngineFactory: LLMEngineFactory,
    private sceneInterpreterFactory: SceneInterpreterFactory
  ) {}

  create(config: P2PPipelineConfig, logger: Logger): P2PPipeline {
    // Create all component instances
    const sceneAnalyzer = this.sceneAnalyzerFactory.create(
      config.sceneAnalyzer,
      logger
    );
    const metadataManager = this.metadataManagerFactory.create(
      config.metadataManager,
      logger
    );
    const promptCompiler = this.promptCompilerFactory.create(
      config.promptCompiler,
      logger
    );
    const llmEngine = this.llmEngineFactory.create(
      config.llmEngine,
      logger
    );
    const sceneInterpreter = this.sceneInterpreterFactory.create(
      config.sceneInterpreter,
      logger
    );

    // Create and return pipeline instance
    return new P2PPipelineImpl(
      config,
      logger,
      sceneAnalyzer,
      metadataManager,
      promptCompiler,
      llmEngine,
      sceneInterpreter
    );
  }
} 