import { NextResponse } from 'next/server';
import { SceneGeometry } from '@/lib/scene-analysis';
import { getActiveProvider } from '@/lib/llm/registry';
import { ensureLLMSystemInitialized } from '@/lib/llm/init';
import { Vector3, Box3 } from 'three';
import { LLMProvider } from '@/lib/llm/types';
import { CameraKeyframe } from '@/types/camera';
import { CompiledPrompt, CameraConstraints, PromptMetadata } from '@/types/p2p/prompt-compiler';
import { getLLMEngine } from '@/features/p2p/llm-engine/engine';
import { LLMEngineConfig } from '@/types/p2p/llm-engine';
import { MetadataManagerFactory } from '@/features/p2p/metadata-manager/MetadataManagerFactory';
import { EnvironmentalMetadata } from '@/types/p2p/environmental-metadata';
import { Logger } from '@/types/p2p/shared';
import { getSceneInterpreter } from '@/features/p2p/scene-interpreter/interpreter';
import { SceneInterpreterConfig } from '@/types/p2p/scene-interpreter';
import { PromptCompilerFactory } from '@/features/p2p/prompt-compiler/PromptCompilerFactory';
import { PromptCompilerConfig } from '@/types/p2p/prompt-compiler';
import { SceneAnalyzerFactory } from '@/features/p2p/scene-analyzer/SceneAnalyzerFactory';
import { EnvironmentalAnalyzerFactory } from '@/features/p2p/environmental-analyzer/EnvironmentalAnalyzerFactory';
import { CameraCommand } from '@/types/p2p/scene-interpreter';
import { ModelMetadata } from '@/types/p2p/metadata-manager';
import { EnvironmentalAnalysis, EnvironmentalAnalyzerConfig } from '@/types/p2p/environmental-analyzer';
import { SceneAnalysis } from '@/types/p2p/scene-analyzer';

// Mark as dynamic route with increased timeout
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Increase to 60 seconds from default of 10

// Create a logger instance
const logger: Logger = {
  info: (...args) => console.log('[Camera Path]', ...args),
  warn: (...args) => console.warn('[Camera Path]', ...args),
  error: (...args) => console.error('[Camera Path]', ...args),
  debug: (...args) => console.debug('[Camera Path]', ...args),
  trace: (...args) => console.trace('[Camera Path]', ...args),
  performance: (...args) => console.debug('[Camera Path Performance]', ...args)
};

// Define default Env Analyzer Config
const defaultEnvAnalyzerConfig: EnvironmentalAnalyzerConfig = {
  environmentSize: { width: 50, height: 50, depth: 50 }, // Example size
  analysisOptions: {
    calculateDistances: true,
    validateConstraints: true,
    optimizeCameraSpace: false
  },
  debug: false,
  performanceMonitoring: true,
  errorReporting: true,
  maxRetries: 3,
  timeout: 10000, // 10 seconds
  performance: { enabled: true, logInterval: 5000 }
};

// Instantiate Factories
const metadataManagerFactory = new MetadataManagerFactory(logger);
const promptCompilerFactory = new PromptCompilerFactory(logger);
const sceneAnalyzerFactory = new SceneAnalyzerFactory(logger);
const environmentalAnalyzerFactory = new EnvironmentalAnalyzerFactory(logger);

export async function POST(request: Request) {
  // *** ADD LOGGING: Start ***
  console.log('>>> API ROUTE START'); 
  logger.info('>>> API ROUTE START - Logger');

  try {
    logger.info('Starting camera path generation request');

    // --- Initialize Components --- 
    await ensureLLMSystemInitialized();
    const engine = getLLMEngine();
    const interpreter = getSceneInterpreter();
    const promptCompiler = promptCompilerFactory.create({ maxTokens: 2048, temperature: 0.7 });
    await promptCompiler.initialize({ maxTokens: 2048, temperature: 0.7 });
    const metadataManager = metadataManagerFactory.create(
      { // Config object
        database: { 
            type: 'supabase', 
            url: process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
            key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' 
        },
        caching: { enabled: true, ttl: 300000 }, 
        validation: { strict: false, maxFeaturePoints: 100 }
      }, 
      'serviceRole' // Explicitly request the service role client
    );
    await metadataManager.initialize();
    logger.debug('Got and initialized Metadata Manager instance (Service Role)');
    
    // Use default config for Env Analyzer
    const environmentalAnalyzer = environmentalAnalyzerFactory.create(defaultEnvAnalyzerConfig);
    await environmentalAnalyzer.initialize(defaultEnvAnalyzerConfig);
    logger.debug('Initialized all components');

    // --- Process Request Body --- 
    const body = await request.json();
    // *** ADD LOGGING: Body Parsed ***
    logger.info('>>> Request Body Parsed'); 
    const { instruction, sceneGeometry, duration, modelId } = body;

    // --- Declare Context Variables --- 
    let modelMetadata: ModelMetadata;
    let environmentalMetadata: EnvironmentalAnalysis;
    let sceneAnalysis: SceneAnalysis;

    // --- Fetch & Analyze Context Data --- 
    logger.info(`Fetching context data for modelId: ${modelId}`);
    try {
        modelMetadata = await metadataManager.getModelMetadata(modelId);
        if (!modelMetadata) throw new Error(`Model metadata not found for id: ${modelId}`);
        
        // *** ADD LOGGING: Model Metadata Fetched ***
        logger.info('>>> Model Metadata Fetched Successfully'); 
        
        // Create placeholder SceneAnalysis based on ModelMetadata
        const modelGeom = modelMetadata.geometry;
        sceneAnalysis = {
             glb: {
                 fileInfo: { name: modelMetadata.file, size: 0, format: 'glb', version: modelMetadata.version?.toString() ?? '1' }, 
                 // Create THREE instances from serialized data
                 geometry: {
                    vertexCount: modelGeom.vertexCount ?? 0,
                    faceCount: modelGeom.faceCount ?? 0,
                    boundingBox: new Box3(
                        new Vector3(modelGeom.boundingBox?.min?.x ?? 0, modelGeom.boundingBox?.min?.y ?? 0, modelGeom.boundingBox?.min?.z ?? 0),
                        new Vector3(modelGeom.boundingBox?.max?.x ?? 0, modelGeom.boundingBox?.max?.y ?? 0, modelGeom.boundingBox?.max?.z ?? 0)
                    ),
                    center: new Vector3(modelGeom.center?.x ?? 0, modelGeom.center?.y ?? 0, modelGeom.center?.z ?? 0),
                    dimensions: new Vector3(modelGeom.dimensions?.x ?? 0, modelGeom.dimensions?.y ?? 0, modelGeom.dimensions?.z ?? 0)
                 },
                 materials: [], metadata: {}, performance: {} as any 
             },
             // Populate other fields as before, potentially creating Vector3/Box3 if needed
             spatial: { 
                 bounds: { // Create SpatialBounds structure explicitly
                    min: new Vector3(modelGeom.boundingBox?.min?.x ?? 0, modelGeom.boundingBox?.min?.y ?? 0, modelGeom.boundingBox?.min?.z ?? 0),
                    max: new Vector3(modelGeom.boundingBox?.max?.x ?? 0, modelGeom.boundingBox?.max?.y ?? 0, modelGeom.boundingBox?.max?.z ?? 0),
                    center: new Vector3(modelGeom.center?.x ?? 0, modelGeom.center?.y ?? 0, modelGeom.center?.z ?? 0),
                    dimensions: new Vector3(modelGeom.dimensions?.x ?? 0, modelGeom.dimensions?.y ?? 0, modelGeom.dimensions?.z ?? 0)
                 },
                 symmetry: {} as any, 
                 complexity: 'moderate', 
                 referencePoints: { center: new Vector3(), highest: new Vector3(), lowest: new Vector3(), leftmost: new Vector3(), rightmost: new Vector3(), frontmost: new Vector3(), backmost: new Vector3() }, 
                 performance: {} as any 
             },
             featureAnalysis: { features: [], landmarks: [], constraints: [], performance: {} as any },
             safetyConstraints: { minHeight: 0, maxHeight: 100, minDistance: 0, maxDistance: 100, restrictedZones: [] },
             orientation: { // Create ModelOrientation structure explicitly
                 front: new Vector3(modelMetadata.orientation?.front?.x ?? 0, modelMetadata.orientation?.front?.y ?? 0, modelMetadata.orientation?.front?.z ?? 1),
                 back: new Vector3(modelMetadata.orientation?.back?.x ?? 0, modelMetadata.orientation?.back?.y ?? 0, modelMetadata.orientation?.back?.z ?? -1),
                 left: new Vector3(modelMetadata.orientation?.left?.x ?? -1, modelMetadata.orientation?.left?.y ?? 0, modelMetadata.orientation?.left?.z ?? 0),
                 right: new Vector3(modelMetadata.orientation?.right?.x ?? 1, modelMetadata.orientation?.right?.y ?? 0, modelMetadata.orientation?.right?.z ?? 0),
                 top: new Vector3(modelMetadata.orientation?.top?.x ?? 0, modelMetadata.orientation?.top?.y ?? 1, modelMetadata.orientation?.top?.z ?? 0),
                 bottom: new Vector3(modelMetadata.orientation?.bottom?.x ?? 0, modelMetadata.orientation?.bottom?.y ?? -1, modelMetadata.orientation?.bottom?.z ?? 0),
                 center: new Vector3(modelMetadata.orientation?.center?.x ?? 0, modelMetadata.orientation?.center?.y ?? 0, modelMetadata.orientation?.center?.z ?? 0),
                 scale: modelMetadata.orientation?.scale ?? 1,
                 confidence: modelMetadata.orientation?.confidence ?? 0
             },
             features: modelMetadata.featurePoints ?? [],
             performance: {} as any
         } as SceneAnalysis;
         
        if (!sceneAnalysis?.glb?.geometry) { 
            throw new Error('Failed to construct placeholder scene analysis data from model metadata.');
        }

        // Analyze Environment
        logger.info('Analyzing environment...');
        environmentalMetadata = await environmentalAnalyzer.analyzeEnvironment(sceneAnalysis);
        if (!environmentalMetadata) throw new Error(`Environmental analysis failed for id: ${modelId}`);
        
        // *** ADD LOGGING: Context Data Done ***
        logger.info('>>> Context Data Fetched & Analyzed Successfully'); 
        logger.debug('Successfully fetched and analyzed context data');
    } catch (error) {
        logger.error('Error fetching/analyzing context data:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error fetching context';
        return NextResponse.json({ error: `Failed to fetch context data: ${errorMessage}` }, { status: 500 });
    }

    // --- Input Validation --- 
    if (!instruction || !sceneGeometry || !duration || !modelId) {
      const missing = {
        instruction: !instruction,
        sceneGeometry: !sceneGeometry,
        duration: !duration,
        modelId: !modelId
      };
      logger.error('Missing parameters:', missing);
      return NextResponse.json(
        { error: 'Missing required parameters', details: missing },
        { status: 400 }
      );
    }
    if (!sceneGeometry.currentCamera || !sceneGeometry.currentCamera.position || !sceneGeometry.currentCamera.target) {
        logger.error('Missing current camera state in sceneGeometry');
        return NextResponse.json({ error: 'Missing current camera state in sceneGeometry' }, { status: 400 });
    }
    // *** ADD LOGGING: Input Validated ***
    logger.info('>>> Input Parameters Validated'); 

    // --- Get Provider & Configure --- 
    const provider = await getActiveProvider() as LLMProvider;
    if (!provider) {
      logger.error('No LLM provider available');
      return NextResponse.json(
        { error: 'No LLM provider available' },
        { status: 500 }
      );
    }
    logger.info('Using provider:', provider.getProviderType());

    // Get provider capabilities for configuration
    const capabilities = provider.getCapabilities();
    logger.debug('Provider capabilities:', capabilities);

    // Configure and initialize the LLM Engine
    const engineConfig: LLMEngineConfig = {
      model: provider.getProviderType(), // Or potentially capabilities.name/model identifier?
      maxTokens: capabilities.maxTokens,
      temperature: capabilities.temperature,
      // Optionally add apiKey if available/needed, maybe from environment variables or a config service
    };
    await engine.initialize(engineConfig);
    logger.info('LLM Engine initialized with config:', engineConfig);

    // Configure and initialize the Scene Interpreter
    // TODO: Source these config values properly (env vars, request body?)
    const interpreterConfig: SceneInterpreterConfig = {
      smoothingFactor: 0.5, // Default smoothing
      maxKeyframes: 100,   // Default max keyframes from LLM
      interpolationMethod: 'smooth', // Default to smooth
      // Inherit debug/performance flags from engine/request if needed
      debug: engineConfig.debug, 
    };
    await interpreter.initialize(interpreterConfig);
    logger.info('Scene Interpreter initialized with config:', interpreterConfig);

    // Convert camera state to Vector3 and include fov
    const currentCameraState = {
      position: new Vector3(
        sceneGeometry.currentCamera.position.x,
        sceneGeometry.currentCamera.position.y,
        sceneGeometry.currentCamera.position.z
      ),
      target: new Vector3(
        sceneGeometry.currentCamera.target.x,
        sceneGeometry.currentCamera.target.y,
        sceneGeometry.currentCamera.target.z
      ),
      fov: sceneGeometry.currentCamera.fov ?? 50 // Add fov, default to 50 if missing
    };

    // *** ADD LOGGING: Received Camera State ***
    // logger.info('>>> Received Camera State:', JSON.stringify(currentCameraState));

    // logger.debug('Camera state:', { // Keep debug log?
    //   position: currentCameraState.position.toArray(),
    //   target: currentCameraState.target.toArray()
    // });

    // console.log('Generating path with:', { // Keep basic log?
    //   modelId,
    //   instruction,
    //   currentCameraState,
    //   duration
    // });

    // --- Compile Prompt --- 
    // logger.info('Compiling prompt...'); // Keep info log?
    let compiledPrompt: CompiledPrompt;
    try {
      compiledPrompt = await promptCompiler.compilePrompt(
        instruction, 
        sceneAnalysis, 
        environmentalMetadata, 
        modelMetadata, 
        currentCameraState,
        duration
      );
      // *** REMOVE LOG ***
      // logger.info('>>> Compiled System Message:', compiledPrompt.systemMessage);
      // logger.debug('Prompt compiled successfully'); // Keep debug log?
    } catch (error) {
        logger.error('Error during prompt compilation:', error);
        // Handle unknown error type
        const errorMessage = error instanceof Error ? error.message : 'Unknown prompt compilation error';
        return NextResponse.json(
            { error: `Prompt compilation failed: ${errorMessage}` },
            { status: 500 }
        );
    }

    // Generate the path using the LLM Engine (using the compiledPrompt)
    // logger.info('Generating camera path via LLM Engine for provider:', engineConfig.model); // Keep info log?
    try {
      const response = await engine.generatePath(compiledPrompt);

      // *** REMOVE LOG ***
      // logger.info('>>> Raw LLM Response Data:', JSON.stringify(response.data, null, 2)); // Stringify for full detail

      // logger.debug('LLM Engine response:', response); // Keep debug log?

      // Handle potential errors from the engine
      if (response.error) {
        logger.error('LLM Engine returned an error:', response.error);
        return NextResponse.json(
          { error: response.error.message, code: response.error.code },
          { status: 500 } // Or map specific error codes to HTTP statuses
        );
      }

      // Check if data is null (shouldn't happen if error is null, but good practice)
      if (!response.data) {
        logger.error('LLM Engine returned null data without an error.');
        return NextResponse.json(
          { error: 'LLM Engine failed without specific error details' },
          { status: 500 }
        );
      }

      // Use the data from the engine response
      const cameraPath = response.data; 
      logger.info(`Path received from LLM Engine with ${cameraPath.keyframes.length} keyframes.`);

      // --- Interpret and Validate Path --- 
      let commands: CameraCommand[];
      try {
        // Interpret the path (Input validation happens inside interpretPath)
        commands = interpreter.interpretPath(cameraPath);
        logger.info(`Interpretation resulted in ${commands.length} commands.`);

        // Validate Generated Commands (Output validation)
        const commandValidation = interpreter.validateCommands(commands);
        if (!commandValidation.isValid) {
          logger.error('Generated commands failed validation:', commandValidation.errors);
          throw new Error(`Generated commands failed validation: ${commandValidation.errors.join(', ')}`);
        }
        logger.info('Generated commands passed validation.');

      } catch (interpretationError) {
          logger.error('Error during path interpretation or command validation:', interpretationError);
          const errorMessage = interpretationError instanceof Error ? interpretationError.message : 'Unknown interpretation error';
          return NextResponse.json(
              { error: `Path Interpretation Failed: ${errorMessage}` },
              { status: 500 } // Or specific code like 422 Unprocessable Entity?
          );
      }
      
      // --- If interpretation and validation succeeded, proceed --- 

      // --- Metadata Storage --- 
      // TODO: Review if EnvironmentalMetadata needs adjustment
      // Make sure metadata creation uses the *actual* compiledPrompt data if needed
      const environmentalMetadataToStore: EnvironmentalMetadata = {
        lighting: {
          intensity: 1.0,
          color: '#ffffff',
          position: {
            x: 0,
            y: 10,
            z: 0
          }
        },
        camera: {
          position: {
            x: currentCameraState.position.x,
            y: currentCameraState.position.y,
            z: currentCameraState.position.z
          },
          target: {
            x: currentCameraState.target.x,
            y: currentCameraState.target.y,
            z: currentCameraState.target.z
          },
          fov: currentCameraState.fov
        },
        scene: {
          background: '#000000',
          ground: '#808080',
          atmosphere: '#87CEEB'
        },
        shot: {
          type: 'cinematic', // TODO: Derive from somewhere?
          duration: cameraPath.duration, // Use original total duration
          keyframes: cameraPath.keyframes.map(kf => ({ // Still map original keyframes for storage?
            position: { x: kf.position.x, y: kf.position.y, z: kf.position.z },
            target: { x: kf.target.x, y: kf.target.y, z: kf.target.z },
            duration: kf.duration
          }))
        },
        constraints: { // Use constraints from compiled prompt?
          minDistance: compiledPrompt.constraints.minDistance,
          maxDistance: compiledPrompt.constraints.maxDistance,
          minHeight: compiledPrompt.constraints.minHeight ?? 0,
          maxHeight: compiledPrompt.constraints.maxHeight ?? 100,
          maxSpeed: compiledPrompt.constraints.maxSpeed ?? 2.0, // Default to 2.0 if undefined
          // Add defaults for other required fields if missing from prompt constraints
          maxAngleChange: compiledPrompt.constraints.maxAngleChange ?? 45, // Default to 45 if undefined
          minFramingMargin: compiledPrompt.constraints.minFramingMargin ?? 0.1 // Default to 0.1 if undefined
        },
        performance: { // Use performance from compiled prompt?
          startTime: compiledPrompt.metadata.performanceMetrics.startTime,
          endTime: Date.now(), // Or get from interpreter/engine?
          duration: Date.now() - compiledPrompt.metadata.performanceMetrics.startTime,
          operations: compiledPrompt.metadata.performanceMetrics.operations
        }
      };

      // Store the environmental metadata
      await metadataManager.storeEnvironmentalMetadata(modelId, environmentalMetadataToStore);

      // Return the FINAL validated CameraCommand array
      logger.info('Sending generated commands to client.');
      return NextResponse.json(commands); 
    } catch (error) {
      // This top-level catch block in the route might still be useful for
      // catching errors *outside* the engine call (e.g., engine initialization,
      // metadata storage errors), but errors *from* the engine are handled above.
      logger.error('Error during engine path generation or metadata storage:', error);
      return NextResponse.json(
        { 
          error: error instanceof Error ? error.message : 'Internal server error',
          details: process.env.NODE_ENV === 'development' ? error : undefined
        },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Unhandled error in camera path route:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
} 