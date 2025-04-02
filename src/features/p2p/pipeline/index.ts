import { P2PPipelineFactoryImpl } from './P2PPipelineFactory';
import { P2PPipelineConfig } from '../../../types/p2p/pipeline';
import { Logger } from '../../../types/p2p/shared';
import { SceneAnalyzerFactory } from '../scene-analyzer/SceneAnalyzerFactory';
import { MetadataManagerFactory } from '../metadata-manager/MetadataManagerFactory';
import { PromptCompilerFactory } from '../prompt-compiler/PromptCompilerFactory';
import { LLMEngineFactory } from '../llm-engine/LLMEngineFactory';
import { SceneInterpreterFactory } from '../scene-interpreter/SceneInterpreterFactory';
import { EnvironmentalAnalyzerFactory } from '../environmental-analyzer/EnvironmentalAnalyzerFactory';

// Create a default logger
const defaultLogger: Logger = {
  info: console.info,
  error: console.error,
  warn: console.warn,
  debug: console.debug,
  trace: console.trace,
  performance: console.debug // Use debug for performance logs
};

// Create factory instances
const sceneAnalyzerFactory = new SceneAnalyzerFactory(defaultLogger);
const metadataManagerFactory = new MetadataManagerFactory(defaultLogger);
const promptCompilerFactory = new PromptCompilerFactory(defaultLogger);
const llmEngineFactory = new LLMEngineFactory(defaultLogger);
const sceneInterpreterFactory = new SceneInterpreterFactory(defaultLogger);
const environmentalAnalyzerFactory = new EnvironmentalAnalyzerFactory(defaultLogger);

// Create pipeline factory
const pipelineFactory = new P2PPipelineFactoryImpl(
  sceneAnalyzerFactory,
  metadataManagerFactory,
  promptCompilerFactory,
  llmEngineFactory,
  sceneInterpreterFactory,
  environmentalAnalyzerFactory
);

// Helper function to get a pipeline instance
export async function getP2PPipeline(config: P2PPipelineConfig, logger: Logger = defaultLogger) {
  return pipelineFactory.create(config, logger);
}

export { P2PPipelineFactoryImpl }; 