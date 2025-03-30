// Re-export shared types
export type {
  P2PError,
  ValidationResult,
  PerformanceMetrics,
  P2PConfig,
  SpatialPoint,
  SpatialBounds,
  BaseMetadata,
  SafetyConstraints,
  Feature,
  Orientation,
  ValidationUtils,
  Logger,
} from './shared';

// Re-export pipeline types
export type {
  P2PPipeline,
  P2PPipelineConfig,
  ModelInput,
  UserInstruction,
  AnimationOutput,
  P2PPipelineError,
  ModelProcessingError,
  PathGenerationError,
  AnimationError,
  P2PPipelineFactory,
} from './pipeline';

// Re-export scene analyzer types
export type {
  SceneAnalyzer,
  SceneAnalyzerConfig,
  GLBAnalysis,
  SpatialAnalysis,
  FeatureAnalysis,
  SceneAnalysis,
  SceneAnalyzerFactory,
  SceneAnalyzerError,
  GLBParseError,
  AnalysisError,
} from './scene-analyzer';

// Re-export metadata manager types
export type {
  MetadataManager,
  MetadataManagerConfig,
  ModelMetadata,
  UserPreferences,
  ViewingAngle,
  ModelFeaturePoint,
  MetadataManagerFactory,
  MetadataManagerError,
  DatabaseError,
  NotFoundError,
  DuplicateError,
} from './metadata-manager';

// Re-export prompt compiler types
export type {
  PromptCompiler,
  PromptCompilerConfig,
  CompiledPrompt,
  PromptCompilerFactory,
  PromptCompilerError,
  CompilationError,
  ValidationError as PromptValidationError,
} from './prompt-compiler';

// Re-export LLM engine types
export type {
  LLMEngine,
  LLMEngineConfig,
  CameraKeyframe,
  CameraPath,
  LLMEngineFactory,
  LLMEngineError,
  GenerationError,
  ConfigurationError,
} from './llm-engine';

// Re-export scene interpreter types
export type {
  SceneInterpreter,
  SceneInterpreterConfig,
  CameraCommand,
  SceneInterpreterFactory,
  SceneInterpreterError,
  InterpretationError,
  ExecutionError,
  ValidationError as InterpreterValidationError,
} from './scene-interpreter'; 