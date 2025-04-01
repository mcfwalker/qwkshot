import { Vector3, Camera } from 'three';
import type {
  P2PError,
  ValidationResult,
  PerformanceMetrics,
  Logger,
  P2PConfig,
  P2PPipeline as IP2PPipeline,
  P2PPipelineConfig,
  ModelInput,
  UserInstruction,
  AnimationOutput,
  SceneAnalyzer,
  SceneAnalysis,
  MetadataManager,
  ModelMetadata,
  PromptCompiler,
  CompiledPrompt,
  LLMEngine,
  CameraPath,
  CameraKeyframe,
  SceneInterpreter,
  CameraCommand
} from '../../../types/p2p';

import type { 
  EnvironmentalAnalyzer, 
  EnvironmentalAnalysis 
} from '../../../types/p2p/environmental-analyzer';

import { P2PPipelineError, ModelProcessingError, PathGenerationError, AnimationError } from '../../../types/p2p/pipeline';

interface SerializedVector3 {
  x: number;
  y: number;
  z: number;
}

interface SerializedOrientation {
  position: SerializedVector3;
  rotation: SerializedVector3;
  scale: SerializedVector3;
}

/**
 * Implementation of the P2P Pipeline
 */
export class P2PPipelineImpl implements IP2PPipeline {
  private readonly _config: P2PPipelineConfig;
  public readonly logger: Logger;
  public readonly sceneAnalyzer: SceneAnalyzer;
  public readonly envAnalyzer: EnvironmentalAnalyzer;
  public readonly metadataManager: MetadataManager;
  public readonly promptCompiler: PromptCompiler;
  public readonly llmEngine: LLMEngine;
  public readonly sceneInterpreter: SceneInterpreter;
  private metrics: PerformanceMetrics = {
    startTime: 0,
    endTime: 0,
    duration: 0,
    operations: [],
    cacheHits: 0,
    cacheMisses: 0,
    databaseQueries: 0,
    averageResponseTime: 0
  };

  constructor(
    config: P2PPipelineConfig,
    logger: Logger,
    sceneAnalyzer: SceneAnalyzer,
    envAnalyzer: EnvironmentalAnalyzer,
    metadataManager: MetadataManager,
    promptCompiler: PromptCompiler,
    llmEngine: LLMEngine,
    sceneInterpreter: SceneInterpreter
  ) {
    this._config = config;
    this.logger = logger;
    this.sceneAnalyzer = sceneAnalyzer;
    this.envAnalyzer = envAnalyzer;
    this.metadataManager = metadataManager;
    this.promptCompiler = promptCompiler;
    this.llmEngine = llmEngine;
    this.sceneInterpreter = sceneInterpreter;

    this.logger.info('P2P Pipeline initialized');
  }

  private serializeVector3(v: Vector3): SerializedVector3 {
    return { x: v.x, y: v.y, z: v.z };
  }

  private serializeGeometry(geometry: any) {
    return {
      vertexCount: geometry.vertexCount,
      faceCount: geometry.faceCount,
      boundingBox: {
        min: this.serializeVector3(geometry.boundingBox.min),
        max: this.serializeVector3(geometry.boundingBox.max)
      },
      center: this.serializeVector3(geometry.center),
      dimensions: this.serializeVector3(geometry.dimensions)
    };
  }

  private serializeEnvironmentBounds(bounds: any) {
    return {
      min: this.serializeVector3(bounds.min),
      max: this.serializeVector3(bounds.max),
      center: this.serializeVector3(bounds.center),
      dimensions: {
        width: bounds.dimensions.width,
        height: bounds.dimensions.height,
        depth: bounds.dimensions.depth
      }
    };
  }

  private serializeOrientation(orientation: any): SerializedOrientation {
    return {
      position: this.serializeVector3(orientation.position || new Vector3(0, 0, 0)),
      rotation: this.serializeVector3(orientation.rotation || new Vector3(0, 0, 0)),
      scale: this.serializeVector3(orientation.scale || new Vector3(1, 1, 1))
    };
  }

  get config(): P2PPipelineConfig {
    return this._config;
  }

  async initialize(config?: P2PPipelineConfig): Promise<void> {
    try {
      this.logger.info('Initializing P2P Pipeline');
      
      // Use provided config or default to this._config
      const finalConfig = config || this._config;

      // Initialize all components with their respective configurations
      await Promise.all([
        this.sceneAnalyzer.initialize({
          ...finalConfig.sceneAnalyzer,
          analysisOptions: {
            extractFeatures: true,
            calculateSymmetry: true,
            analyzeMaterials: true
          }
        }),
        this.metadataManager.initialize(),
        this.promptCompiler.initialize({
          ...finalConfig.promptCompiler,
          maxTokens: 1000,
          temperature: 0.7
        }),
        this.envAnalyzer.initialize({
          environmentSize: {
            width: 100,
            height: 100,
            depth: 100
          },
          analysisOptions: {
            calculateDistances: true,
            validateConstraints: true,
            optimizeCameraSpace: true
          },
          debug: finalConfig.debug,
          performanceMonitoring: true,
          errorReporting: true,
          maxRetries: 3,
          timeout: 30000
        }),
        this.llmEngine.initialize({
          ...finalConfig.llmEngine,
          model: 'gpt-4',
          maxTokens: 1000,
          temperature: 0.7
        }),
        this.sceneInterpreter.initialize({
          ...finalConfig.sceneInterpreter,
          smoothingFactor: 0.5,
          maxKeyframes: 100,
          interpolationMethod: 'smooth'
        })
      ]);

      this.logger.info('P2P Pipeline initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize P2P Pipeline', error as Error);
      throw new P2PPipelineError(
        'Failed to initialize pipeline',
        'INITIALIZATION_ERROR'
      );
    }
  }

  private async loadModelFile(filePath: string): Promise<File> {
    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`Failed to fetch model file: ${response.statusText}`);
      }
      const blob = await response.blob();
      const fileName = filePath.split('/').pop() || 'model.glb';
      const file = new File([blob], fileName, { type: 'model/gltf-binary' });
      return file;
    } catch (error) {
      this.logger.error('Failed to load model file:', error);
      throw new ModelProcessingError('Failed to load model file');
    }
  }

  async processModel(input: ModelInput): Promise<{
    modelId: string;
    analysis: SceneAnalysis;
    metadata: ModelMetadata;
  }> {
    try {
      this.logger.info('Processing model', { input });
      const startTime = Date.now();

      let modelId: string;
      let sceneAnalysis: SceneAnalysis;
      let envAnalysis: EnvironmentalAnalysis;
      let metadata: ModelMetadata;

      if (input.file) {
        // Process new file upload
        sceneAnalysis = await this.sceneAnalyzer.analyzeScene(input.file);
        
        // Run environmental analysis based on scene analysis
        envAnalysis = await this.envAnalyzer.analyzeEnvironment(sceneAnalysis);
        
        // Generate new model ID
        modelId = crypto.randomUUID();
        
        // Store combined metadata with serialized vectors
        const metadataToStore = {
          modelId,
          userId: input.userId,
          file: input.file.name,
          geometry: this.serializeGeometry(sceneAnalysis.glb.geometry),
          environment: {
            bounds: this.serializeEnvironmentBounds(envAnalysis.environment),
            dimensions: envAnalysis.environment.dimensions,
            distances: envAnalysis.distances.fromObjectToBoundary,
            constraints: envAnalysis.cameraConstraints
          },
          orientation: {
            position: new Vector3(0, 0, 0),
            rotation: new Vector3(0, 0, 0),
            scale: new Vector3(1, 1, 1)
          },
          preferences: {
            defaultCameraDistance: 5,
            defaultCameraHeight: envAnalysis.cameraConstraints.minHeight,
            preferredViewAngles: [],
            uiPreferences: {
              showGrid: true,
              showAxes: true,
              showMeasurements: true
            }
          },
          featurePoints: [], // Required by ModelMetadata
          performance_metrics: {
            sceneAnalysis: sceneAnalysis.performance,
            environmentalAnalysis: envAnalysis.performance
          }
        };
        
        await this.metadataManager.storeModelMetadata(modelId, metadataToStore);
        metadata = await this.metadataManager.getModelMetadata(modelId);
      } else if (input.modelId) {
        // Use existing model
        modelId = input.modelId;
        metadata = await this.metadataManager.getModelMetadata(modelId);
        
        // Load and analyze the model file
        const modelFile = await this.loadModelFile(metadata.file);
        sceneAnalysis = await this.sceneAnalyzer.analyzeScene(modelFile);
        envAnalysis = await this.envAnalyzer.analyzeEnvironment(sceneAnalysis);
      } else {
        throw new ModelProcessingError('Either file or modelId must be provided');
      }

      const duration = Date.now() - startTime;
      this.metrics.operations.push({
        name: 'processModel',
        duration,
        success: true,
        error: undefined // Optional error field for OperationMetrics
      });

      return { modelId, analysis: sceneAnalysis, metadata };
    } catch (error) {
      this.logger.error('Failed to process model', error instanceof Error ? error : undefined);
      throw new ModelProcessingError(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  async generatePath(
    modelId: string,
    instruction: UserInstruction
  ): Promise<AnimationOutput> {
    try {
      this.logger.info('Generating camera path', { modelId, instruction });
      const startTime = Date.now();

      // Get model metadata and analysis
      const metadata = await this.metadataManager.getModelMetadata(modelId);
      const analysis = await this.sceneAnalyzer.analyzeScene(metadata.file);

      // Compile prompt
      const compiledPrompt = await this.promptCompiler.compilePrompt(
        instruction.text,
        analysis,
        metadata
      );

      // Generate path
      const path = await this.llmEngine.generatePath(compiledPrompt);

      // Validate path
      const validation = this.llmEngine.validatePath(path);
      if (!validation.isValid) {
        throw new PathGenerationError(validation.error || 'Invalid path');
      }

      // Convert to animation output
      const animation: AnimationOutput = {
        keyframes: path.keyframes.map((kf: CameraKeyframe) => ({
          position: kf.position,
          target: kf.target,
          timestamp: kf.timestamp,
        })),
        duration: path.duration,
        metadata: {
          style: path.metadata.style,
          focus: path.metadata.focus,
          safetyConstraints: path.metadata.safetyConstraints,
        },
      };

      const duration = Date.now() - startTime;
      this.metrics.operations.push({
        name: 'generatePath',
        duration,
        success: true,
      });

      return animation;
    } catch (error) {
      this.logger.error('Failed to generate path', error instanceof Error ? error : undefined);
      throw new PathGenerationError(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  async previewKeyframe(
    modelId: string,
    keyframeIndex: number,
    animation: AnimationOutput
  ): Promise<void> {
    try {
      this.logger.info('Previewing keyframe', { modelId, keyframeIndex });
      const startTime = Date.now();

      // Convert animation to camera commands
      const commands = this.sceneInterpreter.interpretPath({
        keyframes: animation.keyframes,
        duration: animation.duration,
        metadata: {
          style: animation.metadata.style,
          focus: animation.metadata.focus,
          safetyConstraints: animation.metadata.safetyConstraints,
        },
      });

      // Execute the specific keyframe
      if (keyframeIndex >= 0 && keyframeIndex < commands.length) {
        await this.sceneInterpreter.executeCommand(
          this.getCamera(),
          commands[keyframeIndex]
        );
      }

      const duration = Date.now() - startTime;
      this.metrics.operations.push({
        name: 'previewKeyframe',
        duration,
        success: true,
      });
    } catch (error) {
      this.logger.error('Failed to preview keyframe', error instanceof Error ? error : undefined);
      throw new AnimationError(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  async executeAnimation(
    modelId: string,
    animation: AnimationOutput
  ): Promise<void> {
    try {
      this.logger.info('Executing animation', { modelId });
      const startTime = Date.now();

      // Convert animation to camera commands
      const commands = this.sceneInterpreter.interpretPath({
        keyframes: animation.keyframes,
        duration: animation.duration,
        metadata: {
          style: animation.metadata.style,
          focus: animation.metadata.focus,
          safetyConstraints: animation.metadata.safetyConstraints,
        },
      });

      // Validate commands
      const validation = this.sceneInterpreter.validateCommands(commands);
      if (!validation.isValid) {
        throw new AnimationError(validation.error || 'Invalid commands');
      }

      // Execute all commands
      await this.sceneInterpreter.executeCommands(
        this.getCamera(),
        commands
      );

      const duration = Date.now() - startTime;
      this.metrics.operations.push({
        name: 'executeAnimation',
        duration,
        success: true,
      });
    } catch (error) {
      this.logger.error('Failed to execute animation', error instanceof Error ? error : undefined);
      throw new AnimationError(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return this.metrics;
  }

  private getCamera(): Camera {
    // TODO: Implement camera retrieval from Three.js scene
    throw new Error('Camera retrieval not implemented');
  }

  async compileForLLM(
    userInput: string,
    modelId: string,
    currentCameraState: { position: Vector3; target: Vector3 } // Assuming Vector3 is available
  ): Promise<CompiledPrompt | null> {
    this.logger.info(`Compiling prompt for model: ${modelId}`);
    try {
      // 1. Analyze Scene (or get cached analysis)
      // TODO: Handle file loading/retrieval based on modelId
      const sceneAnalysis = await this.sceneAnalyzer.analyzeScene('path/to/model.glb');
      if (!sceneAnalysis) {
        this.logger.error('Scene analysis failed');
        return null;
      }

      // 2. Get Model Metadata
      const modelMetadata = await this.metadataManager.getModelMetadata(modelId);
      if (!modelMetadata) {
        this.logger.error(`Metadata not found for model: ${modelId}`);
        return null;
      }

      // 3. Analyze Environment (using scene analysis result)
      const envAnalysis = await this.envAnalyzer.analyzeEnvironment(sceneAnalysis);
      if (!envAnalysis) {
        this.logger.error('Environmental analysis failed');
        return null;
      }
      // We might need envAnalysis data in the prompt compiler too?

      // 4. Compile Prompt
      const compiledPrompt = await this.promptCompiler.compilePrompt(
        userInput,
        sceneAnalysis,
        modelMetadata,
        currentCameraState
      );

      this.logger.info(`Prompt compiled successfully for request: ${compiledPrompt.metadata.requestId}`);
      return compiledPrompt;

    } catch (error) {
      this.logger.error('Error during prompt compilation pipeline:', error);
      return null;
    }
  }
}