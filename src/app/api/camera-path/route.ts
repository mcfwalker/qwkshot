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
import { SceneAnalysis, SerializedSceneAnalysis } from '@/types/p2p/scene-analyzer';
import { deserializeSceneAnalysis } from '@/features/p2p/pipeline/serializationUtils';

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
  try { // Outer try for the whole request
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
    const { instruction, duration, modelId } = body; 

    // --- Declare Context Variables --- 
    let modelMetadata: ModelMetadata;
    let fetchedEnvironmentalMetadata: EnvironmentalMetadata | null = null; // Initialize as null
    let environmentalAnalysis: EnvironmentalAnalysis;
    let sceneAnalysis: SceneAnalysis | null = null;
    // Declare currentCameraState outside the try block
    let currentCameraState: { position: Vector3; target: Vector3; fov: number };

    // --- Fetch & Analyze Context Data --- 
    logger.info(`Fetching context data for modelId: ${modelId}`);
    try { 
        modelMetadata = await metadataManager.getModelMetadata(modelId);
        if (!modelMetadata) throw new Error(`Model metadata not found for id: ${modelId}`);
        
        fetchedEnvironmentalMetadata = await metadataManager.getEnvironmentalMetadata(modelId);
        if (!fetchedEnvironmentalMetadata) {
             logger.error(`Environmental metadata not found for modelId: ${modelId}. Scene must be locked first.`);
             throw new Error(`Environmental metadata not found for modelId: ${modelId}. Scene must be locked first.`);
        }
        if (!fetchedEnvironmentalMetadata.camera?.position || !fetchedEnvironmentalMetadata.camera?.target) {
            logger.error('Fetched environmental metadata is missing essential camera position or target.');
            throw new Error('Stored environmental metadata is incomplete (missing camera position/target).');
        }
        logger.info('Environmental Metadata Fetched and Validated Successfully');

        // --- DESERIALIZATION STEP --- 
        logger.info('Attempting to deserialize stored SceneAnalysis...');
        const storedSerializedAnalysis = modelMetadata.sceneAnalysis;
        if (storedSerializedAnalysis) {
             sceneAnalysis = deserializeSceneAnalysis(storedSerializedAnalysis);
             if (sceneAnalysis) {
                 logger.info('Successfully deserialized stored SceneAnalysis.');
             } else {
                 logger.warn('Deserialization of stored SceneAnalysis failed. Falling back to placeholder.');
             }
        } else {
            logger.warn('No stored SceneAnalysis found in metadata. Using placeholder.');
        }

        // --- FALLBACK PLACEHOLDER LOGIC --- 
        if (!sceneAnalysis) { 
            logger.info('Constructing placeholder SceneAnalysis from geometry...');
            const modelGeom = modelMetadata.geometry;
            if (!modelGeom) {
                throw new Error('Model metadata geometry is missing, cannot create placeholder scene analysis.')
            }
            // Construct the placeholder sceneAnalysis object
            sceneAnalysis = {
                 glb: {
                     fileInfo: { name: modelMetadata.file, size: 0, format: 'glb', version: modelMetadata.version?.toString() ?? '1' }, 
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
                 spatial: { 
                     bounds: { 
                        min: new Vector3(modelGeom.boundingBox?.min?.x ?? 0, modelGeom.boundingBox?.min?.y ?? 0, modelGeom.boundingBox?.min?.z ?? 0),
                        max: new Vector3(modelGeom.boundingBox?.max?.x ?? 0, modelGeom.boundingBox?.max?.y ?? 0, modelGeom.boundingBox?.max?.z ?? 0),
                        center: new Vector3(modelGeom.center?.x ?? 0, modelGeom.center?.y ?? 0, modelGeom.center?.z ?? 0),
                        dimensions: new Vector3(modelGeom.dimensions?.x ?? 0, modelGeom.dimensions?.y ?? 0, modelGeom.dimensions?.z ?? 0)
                     },
                     symmetry: { hasSymmetry: false, symmetryPlanes: [] }, 
                     complexity: 'moderate', 
                     referencePoints: { center: new Vector3(), highest: new Vector3(), lowest: new Vector3(), leftmost: new Vector3(), rightmost: new Vector3(), frontmost: new Vector3(), backmost: new Vector3() }, 
                     performance: {} as any 
                 },
                 featureAnalysis: { features: [], landmarks: [], constraints: [], performance: {} as any },
                 safetyConstraints: { 
                     minHeight: fetchedEnvironmentalMetadata?.constraints?.minHeight ?? 0, 
                     maxHeight: fetchedEnvironmentalMetadata?.constraints?.maxHeight ?? 100, 
                     minDistance: fetchedEnvironmentalMetadata?.constraints?.minDistance ?? 0, 
                     maxDistance: fetchedEnvironmentalMetadata?.constraints?.maxDistance ?? 100, 
                     restrictedZones: [] 
                 },
                 orientation: { 
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
                 // Ensure feature points are also deserialized (Vector3)
                 features: modelMetadata.featurePoints?.map(fp => ({
                     ...fp,
                     position: new Vector3(fp.position.x, fp.position.y, fp.position.z) 
                 })) ?? [],
                 performance: {} as any
             };
            if (!sceneAnalysis?.glb?.geometry) { 
                 throw new Error('Failed to construct placeholder scene analysis data from model metadata.');
            }
            logger.info('Using constructed placeholder SceneAnalysis.');
        }
        
        // Final check: ensure sceneAnalysis is non-null before proceeding
        if (!sceneAnalysis) {
             throw new Error('SceneAnalysis could not be obtained or constructed.');
        }
        
        // --- Construct Camera State --- 
        // We already validated fetchedEnvironmentalMetadata and its camera properties above
        // Assign to the variable declared outside the try block
        currentCameraState = {
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
        logger.debug('Constructed currentCameraState from fetched metadata');

        // --- Analyze Environment --- 
        logger.info('Analyzing environment with scene and camera state...');
        environmentalAnalysis = await environmentalAnalyzer.analyzeEnvironment(
            sceneAnalysis, 
            currentCameraState // Now passing the state
        ); 
        if (!environmentalAnalysis) throw new Error(`Environmental analysis failed for id: ${modelId}`);
        
        logger.debug('Successfully fetched and analyzed context data');

    } catch (contextError) { // Catch for context fetching/analysis errors
        logger.error('Error fetching/analyzing context data:', contextError);
        const errorMessage = contextError instanceof Error ? contextError.message : 'Unknown error fetching context';
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

    // --- Get Retry Context from Request Body (if any) ---
    const retryReason = body.retryContext?.reason;
    let retryFeedbackString: string | undefined = undefined;
    if (retryReason === 'bounding_box_violation') {
        retryFeedbackString = "Previous Attempt Feedback: The generated path failed because the camera position entered the object's bounding box. Ensure the new path strictly respects the object boundaries and maintains a distance greater than the 'Distance to Object Bounding Box' provided.";
        logger.info('Generating prompt with retry feedback for bounding box violation.');
    }

    // --- Compile Prompt --- 
    let compiledPrompt: CompiledPrompt;
    try {
      // currentCameraState should now be accessible here
      compiledPrompt = await promptCompiler.compilePrompt(
        instruction, 
        sceneAnalysis, // Use non-null sceneAnalysis
        environmentalAnalysis, 
        modelMetadata, 
        currentCameraState, 
        duration,
        retryFeedbackString // Pass optional feedback string
      );
      logger.debug('Prompt compiled successfully'); 
    } catch (promptError) {
       // ... prompt compilation error handling ...
       logger.error('Error during prompt compilation:', promptError);
       const errorMessage = promptError instanceof Error ? promptError.message : 'Unknown prompt compilation error';
       return NextResponse.json(
            { error: `Prompt compilation failed: ${errorMessage}` },
            { status: 500 }
       );
    }

    // Generate the path using the LLM Engine (using the compiledPrompt)
    logger.info('Generating camera path via LLM Engine for provider:', engineConfig.model); 
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
        // 1. Get object bounds from environmentalAnalysis
        if (!environmentalAnalysis?.object?.bounds?.min || !environmentalAnalysis?.object?.bounds?.max) {
            logger.error('Object bounds not available in environmentalAnalysis for validation.');
            throw new Error('Object bounds missing for path validation.');
        }
        const objectBounds = new Box3(
            environmentalAnalysis.object.bounds.min,
            environmentalAnalysis.object.bounds.max
        );
        
        // 2. Interpret the path
        commands = interpreter.interpretPath(cameraPath);
        logger.info(`Interpretation resulted in ${commands.length} commands.`);

        // 3. Validate commands, passing the bounds
        const commandValidation = interpreter.validateCommands(commands, objectBounds);
        if (!commandValidation.isValid) {
          logger.error('Generated commands failed validation:', commandValidation.errors);
          // Check if the specific error is bounding box violation
          const isBoundingBoxError = commandValidation.errors.some(err => err.startsWith('PATH_VIOLATION_BOUNDING_BOX'));
          if (isBoundingBoxError) {
              // Return specific response for bounding box violation
              return NextResponse.json(
                  { error: "Validation Failed: Path enters object bounds", code: "PATH_VIOLATION_BOUNDING_BOX" },
                  { status: 422 } // 422 Unprocessable Entity might be suitable
              );
          } else {
              // Throw a generic error for other validation failures
              throw new Error(`Generated commands failed validation: ${commandValidation.errors.join(', ')}`);
          }
        }
        logger.info('Generated commands passed validation.');
      } catch (interpretationError) {
          logger.error('Error during path interpretation or command validation:', interpretationError);
          const errorMessage = interpretationError instanceof Error ? interpretationError.message : 'Unknown interpretation error';
          // Avoid returning the specific bounding box error code here if it was already handled
          if (errorMessage.includes('PATH_VIOLATION_BOUNDING_BOX')) {
             // This case should ideally not be reached if the specific check above works,
             // but as a fallback, return a generic server error.
             return NextResponse.json(
                { error: 'Path validation failed.' },
                { status: 500 } 
             );
          }
          return NextResponse.json(
              { error: `Path Interpretation Failed: ${errorMessage}` },
              { status: 500 } 
          );
      }
      
      return NextResponse.json(commands);

    } catch (engineError) {
      // ... engine/interpretation error handling ...
    }

  } catch (requestError) { // Catch for outer request processing
    logger.error('Unhandled error in camera path route:', requestError);
  }
} 