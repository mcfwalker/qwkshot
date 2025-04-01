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

  private serializeVector3(v: Vector3 | undefined | null): SerializedVector3 {
    if (!v) {
      return { x: 0, y: 0, z: 0 };
    }
    return { x: v.x || 0, y: v.y || 0, z: v.z || 0 };
  }

  private serializeGeometry(geometry: any) {
    if (!geometry) {
      return {
        vertexCount: 0,
        faceCount: 0,
        boundingBox: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 0, y: 0, z: 0 }
        },
        center: { x: 0, y: 0, z: 0 },
        dimensions: { x: 0, y: 0, z: 0 }
      };
    }

    const defaultVector = new Vector3(0, 0, 0);
    return {
      vertexCount: geometry.vertexCount || 0,
      faceCount: geometry.faceCount || 0,
      boundingBox: {
        min: this.serializeVector3(geometry.boundingBox?.min || defaultVector),
        max: this.serializeVector3(geometry.boundingBox?.max || defaultVector)
      },
      center: this.serializeVector3(geometry.center || defaultVector),
      dimensions: this.serializeVector3(geometry.dimensions || defaultVector)
    };
  }

  private serializeEnvironmentBounds(bounds: any) {
    if (!bounds) {
      return {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 },
        center: { x: 0, y: 0, z: 0 },
        dimensions: {
          width: 0,
          height: 0,
          depth: 0
        }
      };
    }

    const defaultVector = new Vector3(0, 0, 0);
    return {
      min: this.serializeVector3(bounds.min || defaultVector),
      max: this.serializeVector3(bounds.max || defaultVector),
      center: this.serializeVector3(bounds.center || defaultVector),
      dimensions: {
        width: bounds.dimensions?.width || 0,
        height: bounds.dimensions?.height || 0,
        depth: bounds.dimensions?.depth || 0
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
      let envAnalysis: EnvironmentalAnalysis;
      let metadata: ModelMetadata;

      if (input.file) {
        // Process new file upload
        this.logger.info('Starting scene analysis...');
        sceneAnalysis = await this.sceneAnalyzer.analyzeScene(input.file);
        this.logger.info('Scene analysis completed with data:', {
          hasGLB: !!sceneAnalysis.glb,
          hasSpatial: !!sceneAnalysis.spatial,
          spatialBounds: sceneAnalysis.spatial.bounds,
          safetyConstraints: sceneAnalysis.safetyConstraints
        });
        
        // Run environmental analysis based on scene analysis
        this.logger.info('Starting environmental analysis...');
        envAnalysis = await this.envAnalyzer.analyzeEnvironment(sceneAnalysis);
        this.logger.info('Raw environmental analysis result:', {
          hasEnvironment: !!envAnalysis?.environment,
          hasObject: !!envAnalysis?.object,
          hasDistances: !!envAnalysis?.distances,
          hasConstraints: !!envAnalysis?.cameraConstraints,
          environmentData: envAnalysis?.environment,
          objectData: envAnalysis?.object,
          distancesData: envAnalysis?.distances,
          constraintsData: envAnalysis?.cameraConstraints
        });

        // Generate new model ID
        modelId = crypto.randomUUID();
        
        this.logger.info('Creating metadata object...');
        // Create metadata object
        metadata = {
          id: modelId,
          modelId,
          userId: input.userId,
          file: input.file.name,
          orientation: this.serializeOrientation({
            position: new Vector3(0, 0, 0),
            rotation: new Vector3(0, 0, 0),
            scale: new Vector3(1, 1, 1)
          }),
          preferences: {
            defaultCameraDistance: 5,
            defaultCameraHeight: envAnalysis?.cameraConstraints?.minHeight || 0,
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
          analysis: {
            geometry: {
              vertexCount: sceneAnalysis.glb.geometry.vertexCount,
              faceCount: sceneAnalysis.glb.geometry.faceCount,
              boundingBox: {
                min: this.serializeVector3(sceneAnalysis.glb.geometry.boundingBox.min),
                max: this.serializeVector3(sceneAnalysis.glb.geometry.boundingBox.max)
              },
              center: this.serializeVector3(sceneAnalysis.glb.geometry.center),
              dimensions: this.serializeVector3(sceneAnalysis.glb.geometry.dimensions)
            },
            environment: {
              bounds: envAnalysis?.environment ? {
                min: this.serializeVector3(envAnalysis.environment.bounds.min),
                max: this.serializeVector3(envAnalysis.environment.bounds.max),
                center: this.serializeVector3(envAnalysis.environment.bounds.center),
                dimensions: {
                  width: envAnalysis.environment.dimensions.width,
                  height: envAnalysis.environment.dimensions.height,
                  depth: envAnalysis.environment.dimensions.depth
                }
              } : {
                min: { x: 0, y: 0, z: 0 },
                max: { x: 0, y: 0, z: 0 },
                center: { x: 0, y: 0, z: 0 },
                dimensions: { width: 0, height: 0, depth: 0 }
              },
              floorOffset: envAnalysis?.object?.floorOffset || 0,
              distances: envAnalysis?.distances?.fromObjectToBoundary || {},
              constraints: envAnalysis?.cameraConstraints ? {
                minDistance: envAnalysis.cameraConstraints.minDistance,
                maxDistance: envAnalysis.cameraConstraints.maxDistance,
                minHeight: envAnalysis.cameraConstraints.minHeight,
                maxHeight: envAnalysis.cameraConstraints.maxHeight
              } : {
                minDistance: 0,
                maxDistance: 0,
                minHeight: 0,
                maxHeight: 0
              }
            },
            performance: {
              sceneAnalysis: sceneAnalysis.performance,
              environmentalAnalysis: envAnalysis?.performance || {
                startTime: 0,
                endTime: 0,
                duration: 0,
                operations: [],
                cacheHits: 0,
                cacheMisses: 0,
                databaseQueries: 0,
                averageResponseTime: 0
              }
            }
          }
        };

        this.logger.info('Created metadata object with analysis:', {
          hasGeometry: !!metadata.analysis?.geometry,
          hasEnvironment: !!metadata.analysis?.environment,
          environmentBounds: metadata.analysis?.environment?.bounds,
          environmentConstraints: metadata.analysis?.environment?.constraints
        });

        // Add log before storing
        this.logger.info('Metadata before sending to MetadataManager:', { metadata });

        // Store metadata
        this.logger.info('Storing metadata in database...');
        await this.metadataManager.storeModelMetadata(modelId, metadata);
        this.logger.info('Stored metadata in database');
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
        success: true
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
      // Load the actual file content before passing to scene analyzer
      const modelFile = await this.loadModelFile(metadata.file); 
      const analysis = await this.sceneAnalyzer.analyzeScene(modelFile);

      // Compile prompt - Assuming currentCameraState is needed and available?
      // Placeholder for currentCameraState - this needs proper implementation
      const currentCameraState = { 
          position: new Vector3(), 
          target: new Vector3() 
      }; 
      const compiledPrompt = await this.promptCompiler.compilePrompt(
        instruction.text,
        analysis,
        metadata,
        currentCameraState,
        {}
      );

      // Generate path
      const path = await this.llmEngine.generatePath(compiledPrompt);

      // Validate path
      const validation = this.llmEngine.validatePath(path);
      if (!validation.isValid) {
        // Use validation.errors as per potential type definition
        throw new PathGenerationError(validation.errors?.join(', ') || 'Invalid path');
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

  async compileForLLM(
    userInput: string,
    modelId: string,
    currentCameraState: { position: Vector3; target: Vector3 } // Assuming Vector3 is available
  ): Promise<CompiledPrompt | null> {
    this.logger.info(`Compiling prompt for model: ${modelId}`);
    try {
      // 1. Analyze Scene (or get cached analysis)
      const modelMetadataForFile = await this.metadataManager.getModelMetadata(modelId);
      if (!modelMetadataForFile) {
           this.logger.error(`Metadata not found for model: ${modelId}`);
           return null;
      }
      const modelFileForAnalysis = await this.loadModelFile(modelMetadataForFile.file);
      const sceneAnalysis = await this.sceneAnalyzer.analyzeScene(modelFileForAnalysis);
      if (!sceneAnalysis) {
        this.logger.error('Scene analysis failed');
        return null;
      }

      // 2. Get Model Metadata (already fetched above)
      const modelMetadata = modelMetadataForFile; 

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
        currentCameraState,
        {}
      );

      this.logger.info(`Prompt compiled successfully for request: ${compiledPrompt.metadata.requestId}`);
      return compiledPrompt;

    } catch (error) {
      this.logger.error('Error during prompt compilation pipeline:', error);
      return null;
    }
  }
}