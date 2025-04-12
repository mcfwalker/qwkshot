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
        // Disable caching for this instance to test
        caching: { enabled: false, ttl: 0 },
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
    logger.info('>>> Request Body Parsed'); 
    const { instruction, duration, modelId } = body; 

    // --- Declare Context Variables --- 
    let modelMetadata: ModelMetadata;
    let fetchedEnvironmentalMetadata: EnvironmentalMetadata | null; 
    let environmentalAnalysis: EnvironmentalAnalysis;
    let sceneAnalysis: SceneAnalysis;

    // --- Fetch & Analyze Context Data --- 
    logger.info(`Fetching context data for modelId: ${modelId}`);
    try {
        modelMetadata = await metadataManager.getModelMetadata(modelId);
        if (!modelMetadata) throw new Error(`Model metadata not found for id: ${modelId}`);
        logger.info('>>> Model Metadata Fetched Successfully'); 
        
        // Fetch Environmental Metadata from DB
        fetchedEnvironmentalMetadata = await metadataManager.getEnvironmentalMetadata(modelId);
        if (!fetchedEnvironmentalMetadata) {
             logger.error(`Environmental metadata not found for modelId: ${modelId}. Scene must be locked first.`);
             throw new Error(`Environmental metadata not found for modelId: ${modelId}. Scene must be locked first.`);
        }
        logger.info('>>> Environmental Metadata Fetched Successfully');

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

        // Analyze Environment (using the fetched model/scene data)
        logger.info('Analyzing environment...');
        environmentalAnalysis = await environmentalAnalyzer.analyzeEnvironment(sceneAnalysis); 
        if (!environmentalAnalysis) throw new Error(`Environmental analysis failed for id: ${modelId}`);
        
        logger.info('>>> Context Data Fetched & Analyzed Successfully'); 
        logger.debug('Successfully fetched and analyzed context data');
    } catch (error) {
        logger.error('Error fetching/analyzing context data:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error fetching context';
        return NextResponse.json({ error: `Failed to fetch context data: ${errorMessage}` }, { status: 500 });
    }

    // --- Input Validation --- 
    if (!instruction || !duration || !modelId || !fetchedEnvironmentalMetadata) { 
      const missing = {
        instruction: !instruction,
        duration: !duration,
        modelId: !modelId,
        fetchedEnvironmentalMetadata: !fetchedEnvironmentalMetadata
      };
      logger.error('Missing parameters:', missing);
      return NextResponse.json(
        { error: 'Missing required parameters', details: missing },
        { status: 400 }
      );
    }
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
    const interpreterConfig: SceneInterpreterConfig = {
      smoothingFactor: 0.5, // Default smoothing
      maxKeyframes: 100,   // Default max keyframes from LLM
      interpolationMethod: 'smooth', // Default to smooth
      // Inherit debug/performance flags from engine/request if needed
      debug: engineConfig.debug, 
    };
    await interpreter.initialize(interpreterConfig);
    logger.info('Scene Interpreter initialized with config:', interpreterConfig);

    // Construct currentCameraState from FETCHED environmental metadata
    if (!fetchedEnvironmentalMetadata.camera?.position || !fetchedEnvironmentalMetadata.camera?.target) {
        logger.error('Fetched environmental metadata is missing camera position or target.');
        return NextResponse.json({ error: 'Stored environmental metadata is incomplete (missing camera state).' }, { status: 500 });
    }
    const currentCameraState = {
      position: new Vector3(
        fetchedEnvironmentalMetadata.camera.position.x,
        fetchedEnvironmentalMetadata.camera.position.y,
        fetchedEnvironmentalMetadata.camera.position.z
      ),
      target: new Vector3(
        fetchedEnvironmentalMetadata.camera.target.x,
        fetchedEnvironmentalMetadata.camera.target.y,
        fetchedEnvironmentalMetadata.camera.target.z
      ),
      fov: fetchedEnvironmentalMetadata.camera.fov ?? 50 // Use fetched FOV, default to 50
    };

    logger.info('>>> Using Camera State From Fetched Metadata:', JSON.stringify(currentCameraState));

    // --- Compile Prompt --- 
    let compiledPrompt: CompiledPrompt;
    try {
      compiledPrompt = await promptCompiler.compilePrompt(
        instruction, 
        sceneAnalysis, 
        environmentalAnalysis, // Use result from analyzer
        modelMetadata, 
        currentCameraState, // Use state derived from DB metadata
        duration
      );
      logger.debug('Prompt compiled successfully'); 
    } catch (error) {
        logger.error('Error during prompt compilation:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown prompt compilation error';
        return NextResponse.json(
            { error: `Prompt compilation failed: ${errorMessage}` },
            { status: 500 }
        );
    }

    // Generate the path using the LLM Engine (using the compiledPrompt)
    logger.info('Generating camera path via LLM Engine for provider:', engineConfig.model); 
    // Log the prompt being sent
    logger.info('>>> Compiled Prompt Sent to Engine:', JSON.stringify(compiledPrompt, null, 2)); 
    try {
      const response = await engine.generatePath(compiledPrompt);

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
        commands = interpreter.interpretPath(cameraPath);
        logger.info(`Interpretation resulted in ${commands.length} commands.`);
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
              { status: 500 } 
          );
      }
      
      logger.info('>>> API ROUTE END - Success');
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