import { Vector3, Camera, Box3 } from 'three';
import type {
  // Core P2P Types from index
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
  SceneAnalyzer, // The interface
  // SceneAnalysis, // This will be imported from scene-analyzer.ts
  MetadataManager,
  ModelMetadata, // This will be imported from metadata-manager.ts
  PromptCompiler,
  CompiledPrompt,
  LLMEngine,
  CameraPath,
  CameraKeyframe,
  SceneInterpreter,
  CameraCommand
} from '../../../types/p2p';

// Types from shared
import type {
  Feature,
  SpatialBounds,
  SafetyConstraints, // The non-serialized version from shared
  Orientation, // The non-serialized version from shared
  SerializedVector3,
  SerializedOrientation
} from '../../../types/p2p/shared';

// Types from scene-analyzer
import type {
  SceneAnalysis, // The actual full analysis object type
  SceneSafetyConstraints, // The specific constraints type from scene-analyzer
  ModelOrientation, // The specific orientation type from scene-analyzer
  GLBAnalysis,
  SpatialAnalysis,
  FeatureAnalysis,
  // Import the serialized types defined in scene-analyzer.ts
  SerializedSceneAnalysis,
  SerializedGLBAnalysis,
  SerializedSpatialAnalysis,
  SerializedFeatureAnalysis,
  SerializedSceneSafetyConstraints,
  SerializedFeature,
  SerializedSpatialBounds,
  SerializedGLBGeometry,
  SerializedSpatialReferencePoints,
  SerializedSymmetry,
  SerializedBox3
} from '../../../types/p2p/scene-analyzer';

// Types from metadata-manager
// No - ModelMetadata is in the main index

// Types from environmental-analyzer
import type { 
  EnvironmentalAnalyzer, 
  EnvironmentalAnalysis 
} from '../../../types/p2p/environmental-analyzer';

// Error types from pipeline
import { P2PPipelineError, ModelProcessingError, PathGenerationError, AnimationError } from '../../../types/p2p/pipeline';

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
            width: 20,
            height: 20,
            depth: 20
          },
          analysisOptions: {
            calculateDistances: true,
            validateConstraints: true,
            optimizeCameraSpace: true
          },
          debug: finalConfig.debug || false,
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
      let metadata: ModelMetadata;

      if (input.file) {
        // Process new file upload
        this.logger.info('Starting scene analysis...');
        sceneAnalysis = await this.sceneAnalyzer.analyzeScene(input.file);
        this.logger.info('Scene analysis completed');

        // Generate new model ID
        modelId = crypto.randomUUID();
        
        this.logger.info('Creating and serializing metadata object...');
        
        // Import and use the exported serialization function
        const { serializeSceneAnalysis } = await import('./serializationUtils');
        const serializedAnalysis = serializeSceneAnalysis(sceneAnalysis);
        
        metadata = {
          id: modelId,
          modelId,
          userId: input.userId,
          file: input.file.name,
          orientation: serializedAnalysis.orientation, 
          preferences: {
            defaultCameraDistance: 5,
            defaultCameraHeight: 1.6,
            preferredViewAngles: [],
            uiPreferences: {
              showGrid: true,
              showAxes: true,
              showMeasurements: true
            }
          },
          featurePoints: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
          geometry: serializedAnalysis.glb.geometry,
          environment: {
            constraints: {
              minHeight: 0,
              maxHeight: 1,
              minDistance: 0.1,
              maxDistance: 2,
              maxSpeed: 2.0,
              maxAngleChange: Math.PI / 4,
              minFramingMargin: 0.1
            },
            performance: {
              startTime: 0,
              endTime: 0,
              duration: 0,
              operations: []
            }
          },
          performance_metrics: {
            sceneAnalysis: serializedAnalysis.performance,
            environmentalAnalysis: { /* placeholder */ } as PerformanceMetrics
          },
          sceneAnalysis: serializedAnalysis 
        };

        this.logger.info('Metadata structure created with serialized analysis.');

        // Add log before storing
        this.logger.info('>>> Preparing to call storeModelMetadata. Metadata object:', { metadata });

        // Store metadata
        this.logger.info('Storing metadata in database...');
        await this.metadataManager.storeModelMetadata(modelId, metadata);
        this.logger.info('Stored metadata in database');

      } else if (input.modelId) {
        // Use existing model
        modelId = input.modelId;
        this.logger.info(`Using existing modelId: ${modelId}`);
        metadata = await this.metadataManager.getModelMetadata(modelId);
        
        // Re-analyze the model file if necessary (or assume metadata.sceneAnalysis exists)
        // If we assume it exists, we might need deserialization logic here or later
        // For now, let's re-analyze to get the live SceneAnalysis object for the return value
        this.logger.info(`Loading model file for existing model: ${metadata.file}`);
        const modelFile = await this.loadModelFile(metadata.file); // Ensure loadModelFile handles paths correctly
        sceneAnalysis = await this.sceneAnalyzer.analyzeScene(modelFile);
        this.logger.info(`Re-analysis complete for existing model ${modelId}`);

      } else {
        throw new ModelProcessingError('Either file or modelId must be provided');
      }

      const duration = Date.now() - startTime;
      this.metrics.operations.push({
        name: 'processModel',
        duration,
        success: true
      });

      // Return the live analysis object and the metadata containing the serialized version
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
    userInput: string,
    requestedDuration: number
  ): Promise<AnimationOutput> {
    try {
      this.logger.info('Generating path', { modelId, userInput });
      const startTime = Date.now();

      // Get model metadata
      const metadata = await this.metadataManager.getModelMetadata(modelId);
      if (!metadata) {
        throw new PathGenerationError('Model metadata not found');
      }

      // Reconstruct camera state from metadata (as per plan)
      const cameraStateForPrompt = {
          position: metadata.environment?.camera?.position ? new Vector3(metadata.environment.camera.position.x, metadata.environment.camera.position.y, metadata.environment.camera.position.z) : new Vector3(0,1.6,5),
          target: metadata.environment?.camera?.target ? new Vector3(metadata.environment.camera.target.x, metadata.environment.camera.target.y, metadata.environment.camera.target.z) : new Vector3(0,0,0),
          fov: metadata.environment?.camera?.fov || 50 // Use stored FOV or default
      };

      // Compile prompt using reconstructed state and requested duration
      const compiledPrompt = await this.compileForLLM(
        userInput,
        modelId,
        cameraStateForPrompt, // Use reconstructed state
        requestedDuration    // Pass requested duration
      );

      if (!compiledPrompt) {
        throw new PathGenerationError('Failed to compile prompt');
      }

      // Generate path - returns LLMResponse<CameraPath>
      const llmResponse = await this.llmEngine.generatePath(compiledPrompt);

      // Extract CameraPath from the response data
      const cameraPathData = llmResponse.data;
      if (!cameraPathData) {
          throw new PathGenerationError('LLM response did not contain path data');
      }

      // Validate the extracted CameraPath data
      const validation = this.llmEngine.validatePath(cameraPathData);
      if (!validation.isValid) {
        throw new PathGenerationError(validation.errors?.join(', ') || 'Invalid path generated by LLM');
      }

      // Convert to animation output using cameraPathData
      const animation: AnimationOutput = {
        keyframes: cameraPathData.keyframes.map((kf: CameraKeyframe) => ({
          position: kf.position,
          target: kf.target,
          duration: kf.duration,
        })),
        duration: cameraPathData.duration,
        metadata: cameraPathData.metadata,
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
      const motionPlan = {
        steps: animation.keyframes.map(kf => ({
          type: 'custom',
          parameters: {
            positionX: kf.position.x,
            positionY: kf.position.y,
            positionZ: kf.position.z,
            targetX: kf.target.x,
            targetY: kf.target.y,
            targetZ: kf.target.z,
          },
          duration_ratio: kf.duration / animation.duration,
        })),
        metadata: {
          requested_duration: animation.duration,
          original_prompt: animation.metadata?.focus || ''
        }
      };
      
      const commands = this.sceneInterpreter.interpretPath(
        motionPlan,
        // Add missing required parameters
        {} as SceneAnalysis,
        {} as EnvironmentalAnalysis,
        {
          position: new Vector3(0, 0, 0),
          target: new Vector3(0, 0, 0)
        }
      );

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
      const motionPlan = {
        steps: animation.keyframes.map(kf => ({
          type: 'custom',
          parameters: {
            positionX: kf.position.x,
            positionY: kf.position.y,
            positionZ: kf.position.z,
            targetX: kf.target.x,
            targetY: kf.target.y,
            targetZ: kf.target.z,
          },
          duration_ratio: kf.duration / animation.duration,
        })),
        metadata: {
          requested_duration: animation.duration,
          original_prompt: animation.metadata?.focus || ''
        }
      };
      
      const commands = this.sceneInterpreter.interpretPath(
        motionPlan,
        // Add missing required parameters
        {} as SceneAnalysis,
        {} as EnvironmentalAnalysis,
        {
          position: new Vector3(0, 0, 0),
          target: new Vector3(0, 0, 0)
        }
      );

      // Validate commands
      const validation = this.sceneInterpreter.validateCommands(
        commands,
        new Box3() // Add missing required Box3 parameter
      );
      if (!validation.isValid) {
        // Use validation.errors as per potential type definition
        throw new AnimationError(validation.errors?.join(', ') || 'Invalid commands');
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

  private async compileForLLM(
    userInput: string,
    modelId: string,
    currentCameraState: { position: Vector3; target: Vector3; fov: number },
    requestedDuration: number
  ): Promise<CompiledPrompt | null> {
    try {
      this.logger.info('Compiling prompt', {
        modelId,
        userInput,
        currentCameraState,
        requestedDuration
      });
      const startTime = Date.now();

      // Fetch necessary metadata
      const modelMetadata = await this.metadataManager.getModelMetadata(modelId);
      if (!modelMetadata) {
        this.logger.warn('Model metadata not found during prompt compilation');
        return null;
      }
      const envMetadata = await this.metadataManager.getEnvironmentalMetadata(modelId);
      if (!envMetadata) {
        this.logger.warn('Environmental metadata not found during prompt compilation');
        // Might proceed with defaults or return null depending on requirements
        return null;
      }

      // Placeholder for actual SceneAnalysis data retrieval/deserialization
      const sceneAnalysis: SceneAnalysis = { /* ... placeholder ... */ } as any;

      // Perform environmental analysis using ONLY sceneAnalysis
      const envAnalysis = await this.envAnalyzer.analyzeEnvironment(
        sceneAnalysis, // Pass ONLY scene analysis
        {
          position: new Vector3(0, 0, 0),
          target: new Vector3(0, 0, 0),
          fov: 50
        } // Add missing required second parameter
      );

      // Update model metadata with environmental analysis results
      modelMetadata.environment.constraints = envAnalysis.cameraConstraints; // Update constraints

      // Compile the prompt
      const compiledPrompt = this.promptCompiler.compilePrompt(
        userInput,
        sceneAnalysis, // Pass potentially simplified scene analysis
        envAnalysis,
        modelMetadata,
        currentCameraState, // The state passed into compileForLLM
        requestedDuration
      );

      const duration = Date.now() - startTime;
      // Add performance logging if needed
      this.logger.info('Prompt compiled successfully', { duration });

      return compiledPrompt;
    } catch (error) {
      this.logger.error(
        'Failed to compile prompt',
        error instanceof Error ? error : undefined
      );
      return null;
    }
  }
}