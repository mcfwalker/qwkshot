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
import { SceneInterpreterImpl } from '@/features/p2p/scene-interpreter/interpreter';
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

// --- NEW IMPORTS ---
import { OpenAIAssistantAdapter } from '@/lib/motion-planning/providers/openai-assistant';
import { OpenAIAssistantProviderConfig, MotionPlan } from '@/lib/motion-planning/types';
// --- END NEW IMPORTS ---

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
    logger.info('Starting camera path generation request (Assistants API Refactor)'); // Updated log message

    // --- Initialize Components (Keep existing, some might be simplified/removed later) --- 
    // await ensureLLMSystemInitialized(); // Old LLM init might not be needed
    // const engine = getLLMEngine(); // <<< COMMENT OUT OLD ENGINE INSTANTIATION
    const interpreter = new SceneInterpreterImpl({} as SceneInterpreterConfig, logger); // Keep interpreter instance for now, methods commented out later
    // const promptCompiler = promptCompilerFactory.create({ maxTokens: 2048, temperature: 0.7 }); // <<< COMMENT OUT OLD COMPILER INSTANTIATION
    // await promptCompiler.initialize({ maxTokens: 2048, temperature: 0.7 }); // <<< COMMENT OUT OLD COMPILER INIT
    
    // --- Metadata Manager and Analyzers remain crucial --- 
    const metadataManager = metadataManagerFactory.create(
      { // Config object
        database: { 
            type: 'supabase', 
            url: process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
            key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' 
        },
        caching: { enabled: false, ttl: 0 },
        validation: { strict: false, maxFeaturePoints: 100 }
      }, 
      'serviceRole'
    );
    await metadataManager.initialize();
    logger.debug('Got and initialized Metadata Manager instance (Service Role)');
    
    const environmentalAnalyzer = environmentalAnalyzerFactory.create(defaultEnvAnalyzerConfig);
    await environmentalAnalyzer.initialize(defaultEnvAnalyzerConfig);
    logger.debug('Initialized core components (Metadata, EnvAnalyzer, Interpreter stub)');

    // --- Process Request Body --- 
    const body = await request.json();
    const { instruction, duration, modelId } = body; 

    // --- Input Validation (Keep as is) --- 
    if (!instruction || !duration || !modelId) { 
      const missing = {
        instruction: !instruction,
        duration: !duration,
        modelId: !modelId,
      };
      logger.error('Missing parameters:', missing);
      return NextResponse.json(
        { error: 'Missing required parameters', details: missing },
        { status: 400 }
      );
    }
    logger.info(`Received instruction: "${instruction}", duration: ${duration}s, modelId: ${modelId}`);

    // --- Declare Context Variables (Keep as is) --- 
    let modelMetadata: ModelMetadata;
    let fetchedEnvironmentalMetadata: EnvironmentalMetadata | null = null; 
    let environmentalAnalysis: EnvironmentalAnalysis;
    let sceneAnalysis: SceneAnalysis | null = null;
    let currentCameraState: { position: Vector3; target: Vector3; fov: number };

    // --- Fetch & Analyze Context Data (Keep as is) --- 
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

        // --- DESERIALIZATION STEP (Keep as is) --- 
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

        // --- FALLBACK PLACEHOLDER LOGIC (Keep as is) --- 
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
        
        // <<< FIX: Manually add the CORRECT modelOffset to the analysis object >>>
        if (fetchedEnvironmentalMetadata?.modelOffset !== undefined) {
          (environmentalAnalysis as any).modelOffset = fetchedEnvironmentalMetadata.modelOffset;
          logger.debug(`Added correct modelOffset (${fetchedEnvironmentalMetadata.modelOffset}) to environmentalAnalysis object.`);
        } else {
          logger.warn('Could not find modelOffset in fetchedEnvironmentalMetadata to add to analysis.');
          (environmentalAnalysis as any).modelOffset = 0; // Default if missing
        }
        // <<< END FIX >>>
        
        logger.debug('Successfully fetched and analyzed context data');

    } catch (contextError: any) { // Catch for context fetching/analysis errors
        logger.error('Error fetching/analyzing context data:', contextError);
        // Sanitize the error message
        let errorMessage = contextError instanceof Error ? contextError.message : 'Unknown error fetching context';
        errorMessage = errorMessage.replace(/\r?\n|\r/g, ' '); // Replace newlines/carriage returns
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

    // --- >>> NEW: Instantiate and Use Motion Planner Adapter <<< ---
    logger.info('Initializing OpenAI Assistant Adapter...');
    const apiKey = process.env.OPENAI_API_KEY;
    const assistantId = process.env.OPENAI_ASSISTANT_ID;

    if (!apiKey) {
        logger.error('OPENAI_API_KEY environment variable is not set.');
        return NextResponse.json({ error: 'Server configuration error: Missing OpenAI API Key.' }, { status: 500 });
    }
    if (!assistantId) {
        logger.error('OPENAI_ASSISTANT_ID environment variable is not set.');
        return NextResponse.json({ error: 'Server configuration error: Missing OpenAI Assistant ID.' }, { status: 500 });
    }

    const adapterConfig: OpenAIAssistantProviderConfig = {
        type: 'openai-assistant',
        apiKey: apiKey,
        assistantId: assistantId,
        // Optional: Add polling/timeout overrides if needed
        // pollingIntervalMs: 1500,
        // timeoutMs: 90000, 
    };

    const motionPlanner = new OpenAIAssistantAdapter(adapterConfig);

    // --- Generate the Motion Plan using the Adapter --- 
    logger.info(`Generating motion plan via ${adapterConfig.type} adapter (ID: ${adapterConfig.assistantId})...`); 
    let motionPlan: MotionPlan;
    try {
      motionPlan = await motionPlanner.generatePlan(instruction, duration);

      logger.info(`Motion Plan received from Assistant Adapter with ${motionPlan.steps.length} steps.`);

      // --- >>> NEW: Interpret the Motion Plan <<< ---
      logger.info('Interpreting the generated Motion Plan...');
      try {
        // Ensure necessary context is available
        if (!sceneAnalysis || !environmentalAnalysis || !currentCameraState) {
          throw new Error('Interpreter context (SceneAnalysis, EnvironmentalAnalysis, or CameraState) is missing.');
        }

        const cameraCommands: CameraCommand[] = interpreter.interpretPath(
          motionPlan,
          sceneAnalysis,
          environmentalAnalysis,
          { position: currentCameraState.position, target: currentCameraState.target }
        );

        logger.info(`Motion Plan interpreted successfully. Returning ${cameraCommands.length} CameraCommands.`);
        
        // --- ADDED: Serialize Vector3 before sending --- 
        const serializableCommands = cameraCommands.map(cmd => ({
            position: { x: cmd.position.x, y: cmd.position.y, z: cmd.position.z },
            target: { x: cmd.target.x, y: cmd.target.y, z: cmd.target.z },
            duration: cmd.duration,
            easing: cmd.easing
        }));
        // --- END ADDED ---
        
        return NextResponse.json(serializableCommands); // Return the serialized commands

      } catch (interpreterError: any) {
        logger.error('Error during Scene Interpreter execution:', interpreterError);
        const errorMessage = interpreterError instanceof Error ? interpreterError.message : 'Unknown interpretation error';
        return NextResponse.json(
            { error: `Scene Interpretation Failed: ${errorMessage}` },
            { status: 500 }
        );
      }
      // --- End Scene Interpreter Call ---

    } catch (plannerError: any) { // Catch errors from the adapter
      // --- NEW: Log specific error type --- 
      const errorName = plannerError instanceof Error ? plannerError.name : 'UnknownError';
      // Sanitize the error message: replace newlines with spaces
      let errorMessage = plannerError instanceof Error ? plannerError.message : 'Unknown motion planning error';
      errorMessage = errorMessage.replace(/\r?\n|\r/g, ' '); // Replace newlines/carriage returns with spaces
      
      // Log the FULL error object for detailed debugging
      logger.error(`Error during Motion Planner execution (${errorName}):`, plannerError); 
      // Also log the sanitized message just to be sure
      logger.error(`Sanitized error message for response: ${errorMessage}`);
      
      // Keep generic 500 response for now, but could customize based on errorName later
      return NextResponse.json(
          { error: `Motion Planning Failed: ${errorMessage}`, code: errorName }, // Include error name/code
          { status: 500 }
      );
    }

  } catch (requestError: any) { // Add type annotation
    logger.error('Unhandled error in camera path route:', requestError);
    const errorMessage = requestError instanceof Error ? requestError.message : 'Unknown server error';
    return NextResponse.json(
        { error: `Internal Server Error: ${errorMessage}` },
        { status: 500 }
    );
  }
} 