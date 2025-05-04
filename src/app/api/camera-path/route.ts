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
import { OpenAIAssistantProviderConfig, MotionPlan, MotionStep } from '@/lib/motion-planning/types';
import { AdapterPlanResponse } from '@/lib/motion-planning/types';
import { composePattern, PatternArgs, SceneMeta } from '@/composers/composer';
import { Primitive } from '@/composers/composer';
import * as THREE from 'three';
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
  try {
    logger.info('Starting camera path generation request (Assistants API Refactor)');
    const interpreter = new SceneInterpreterImpl({} as SceneInterpreterConfig, logger);
    
    // --- Restore MetadataManager Config ---
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
    // --- End Restore ---
    await metadataManager.initialize();
    const environmentalAnalyzer = environmentalAnalyzerFactory.create(defaultEnvAnalyzerConfig);
    await environmentalAnalyzer.initialize(defaultEnvAnalyzerConfig);

    const body = await request.json();
    const { instruction, duration, modelId } = body;

    if (!instruction || !duration || !modelId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }
    logger.info(`Received instruction: "${instruction}", duration: ${duration}s, modelId: ${modelId}`);

    let modelMetadata: ModelMetadata;
    let fetchedEnvironmentalMetadata: EnvironmentalMetadata | null = null;
    let environmentalAnalysis: EnvironmentalAnalysis;
    let sceneAnalysis: SceneAnalysis | null = null;
    let currentCameraState: { position: Vector3; target: Vector3; fov: number };

    logger.info(`Fetching context data for modelId: ${modelId}`);
    try {
        modelMetadata = await metadataManager.getModelMetadata(modelId);
        // ... validation ...
        fetchedEnvironmentalMetadata = await metadataManager.getEnvironmentalMetadata(modelId);
        // ... validation ...
        const storedSerializedAnalysis = modelMetadata.sceneAnalysis;
        if (storedSerializedAnalysis) {
             sceneAnalysis = deserializeSceneAnalysis(storedSerializedAnalysis);
        }
        if (!sceneAnalysis) {
            logger.info('Constructing placeholder SceneAnalysis from geometry...');
            const modelGeom = modelMetadata.geometry;
            if (!modelGeom) {
                throw new Error('Model metadata geometry is missing, cannot create placeholder scene analysis.')
            }
            // --- Restore Placeholder SceneAnalysis Construction ---
            sceneAnalysis = {
                 glb: {
                     fileInfo: { name: modelMetadata.file ?? 'unknown.glb', size: 0, format: 'glb', version: modelMetadata.version?.toString() ?? '1' },
                     geometry: {
                        vertexCount: modelGeom.vertexCount ?? 0,
                        faceCount: modelGeom.faceCount ?? 0,
                        boundingBox: new THREE.Box3(
                            new THREE.Vector3(modelGeom.boundingBox?.min?.x ?? 0, modelGeom.boundingBox?.min?.y ?? 0, modelGeom.boundingBox?.min?.z ?? 0),
                            new THREE.Vector3(modelGeom.boundingBox?.max?.x ?? 0, modelGeom.boundingBox?.max?.y ?? 0, modelGeom.boundingBox?.max?.z ?? 0)
                        ),
                        center: new THREE.Vector3(modelGeom.center?.x ?? 0, modelGeom.center?.y ?? 0, modelGeom.center?.z ?? 0),
                        dimensions: new THREE.Vector3(modelGeom.dimensions?.x ?? 0, modelGeom.dimensions?.y ?? 0, modelGeom.dimensions?.z ?? 0)
                     },
                     materials: [], metadata: {}, performance: {} as any
                 },
                 spatial: {
                     bounds: { // Use SpatialBounds type structure
                        min: new THREE.Vector3(modelGeom.boundingBox?.min?.x ?? 0, modelGeom.boundingBox?.min?.y ?? 0, modelGeom.boundingBox?.min?.z ?? 0),
                        max: new THREE.Vector3(modelGeom.boundingBox?.max?.x ?? 0, modelGeom.boundingBox?.max?.y ?? 0, modelGeom.boundingBox?.max?.z ?? 0),
                        center: new THREE.Vector3(modelGeom.center?.x ?? 0, modelGeom.center?.y ?? 0, modelGeom.center?.z ?? 0),
                        dimensions: new THREE.Vector3(modelGeom.dimensions?.x ?? 0, modelGeom.dimensions?.y ?? 0, modelGeom.dimensions?.z ?? 0)
                     },
                     symmetry: { hasSymmetry: false, symmetryPlanes: [] },
                     complexity: 'moderate',
                     referencePoints: { center: new THREE.Vector3(), highest: new THREE.Vector3(), lowest: new THREE.Vector3(), leftmost: new THREE.Vector3(), rightmost: new THREE.Vector3(), frontmost: new THREE.Vector3(), backmost: new THREE.Vector3() },
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
                 orientation: { /* ... restored orientation ... */
                    front: new THREE.Vector3(modelMetadata.orientation?.front?.x ?? 0, modelMetadata.orientation?.front?.y ?? 0, modelMetadata.orientation?.front?.z ?? 1),
                     back: new THREE.Vector3(modelMetadata.orientation?.back?.x ?? 0, modelMetadata.orientation?.back?.y ?? 0, modelMetadata.orientation?.back?.z ?? -1),
                     left: new THREE.Vector3(modelMetadata.orientation?.left?.x ?? -1, modelMetadata.orientation?.left?.y ?? 0, modelMetadata.orientation?.left?.z ?? 0),
                     right: new THREE.Vector3(modelMetadata.orientation?.right?.x ?? 1, modelMetadata.orientation?.right?.y ?? 0, modelMetadata.orientation?.right?.z ?? 0),
                     top: new THREE.Vector3(modelMetadata.orientation?.top?.x ?? 0, modelMetadata.orientation?.top?.y ?? 1, modelMetadata.orientation?.top?.z ?? 0),
                     bottom: new THREE.Vector3(modelMetadata.orientation?.bottom?.x ?? 0, modelMetadata.orientation?.bottom?.y ?? -1, modelMetadata.orientation?.bottom?.z ?? 0),
                     center: new THREE.Vector3(modelMetadata.orientation?.center?.x ?? 0, modelMetadata.orientation?.center?.y ?? 0, modelMetadata.orientation?.center?.z ?? 0),
                     scale: modelMetadata.orientation?.scale ?? 1,
                     confidence: modelMetadata.orientation?.confidence ?? 0
                  },
                 features: modelMetadata.featurePoints?.map(fp => ({
                     ...fp,
                     position: new THREE.Vector3(fp.position.x, fp.position.y, fp.position.z)
                 })) ?? [],
                 performance: {} as any
             };
            // --- End Restore Placeholder --- 
            if (!sceneAnalysis?.glb?.geometry) { 
                 throw new Error('Failed to construct placeholder scene analysis data from model metadata.');
            }
            logger.info('Using constructed placeholder SceneAnalysis.');
        }
        if (!sceneAnalysis) { throw new Error('SceneAnalysis could not be obtained.'); }

        currentCameraState = {
            position: new Vector3(/* ... */),
            target: new Vector3(/* ... */),
            fov: fetchedEnvironmentalMetadata?.camera?.fov ?? 50
        };
        environmentalAnalysis = await environmentalAnalyzer.analyzeEnvironment(sceneAnalysis, currentCameraState);
        if (!environmentalAnalysis) throw new Error(`Environmental analysis failed.`);
        environmentalAnalysis.userVerticalAdjustment = fetchedEnvironmentalMetadata?.userVerticalAdjustment ?? 0;
        logger.debug('Successfully fetched and analyzed context data');
    } catch (contextError: any) { 
        logger.error('Error fetching/analyzing context data:', contextError);
        return NextResponse.json({ error: `Failed to fetch context data: ${contextError.message}` }, { status: 500 });
    }
    // Ensure sceneAnalysis is non-null after context fetching/analysis for type safety
    if (!sceneAnalysis) {
        logger.error('SceneAnalysis is null after context block, cannot proceed.');
        return NextResponse.json({ error: 'Internal server error: Scene context unavailable.' }, { status: 500 });
    }

    // --- Instantiate Motion Planner Adapter --- 
    logger.info('Initializing OpenAI Assistant Adapter...');
    const apiKey = process.env.OPENAI_API_KEY;
    const assistantId = process.env.OPENAI_ASSISTANT_ID;
    
    // --- Validate API Key and Assistant ID earlier ---
    if (!apiKey) {
        logger.error('OPENAI_API_KEY environment variable is not set.');
        return NextResponse.json({ error: 'Server configuration error: Missing OpenAI API Key.' }, { status: 500 });
    }
    if (!assistantId) {
        logger.error('OPENAI_ASSISTANT_ID environment variable is not set.');
        return NextResponse.json({ error: 'Server configuration error: Missing OpenAI Assistant ID.' }, { status: 500 });
    }
    // --- End Validation ---

    // Now apiKey and assistantId are guaranteed to be strings
    const adapterConfig: OpenAIAssistantProviderConfig = {
        type: 'openai-assistant', apiKey, assistantId
    };
    const motionPlanner = new OpenAIAssistantAdapter(adapterConfig);

    // --- Generate Plan OR Get Function Call --- 
    logger.info(`Generating plan or function call via ${adapterConfig.type} adapter...`);
    let finalMotionPlan: MotionPlan;

    try {
      const adapterResponse: AdapterPlanResponse = await motionPlanner.generatePlan(instruction, duration);

      // --- >>> NEW: Handle Adapter Response <<< ---
      if (adapterResponse.type === 'function_call') {
          logger.info(`Adapter returned function call: ${adapterResponse.name}`);
          if (adapterResponse.name === 'compose_pattern') {
              logger.info('Parsing arguments for compose_pattern...');
              let patternArgs: PatternArgs;
              try {
                  // Arguments from OpenAI are a JSON string, parse it
                  patternArgs = JSON.parse(adapterResponse.arguments) as PatternArgs;
              } catch (parseError) {
                  logger.error('Failed to parse compose_pattern arguments:', parseError);
                  throw new Error(`Invalid arguments received for compose_pattern: ${parseError}`);
              }

              logger.info('Constructing SceneMeta for composer...');
              // Construct SceneMeta using available data
              let objectRadius = 1; // Default radius
              const bounds = sceneAnalysis.spatial?.bounds;
              if (bounds && bounds.dimensions) {
                  // Use half of the largest dimension as an approximate radius
                  objectRadius = Math.max(bounds.dimensions.x, bounds.dimensions.y, bounds.dimensions.z) / 2;
              } else {
                  logger.warn('Could not calculate radius from bounding box dimensions, using default.')
              }

              const sceneMeta: SceneMeta = {
                  boundingBox: bounds, // Pass the bounds object (might be Box3 or our custom SpatialBounds)
                  objectRadius: objectRadius
                  // Add other necessary context later
              };
              if (!sceneMeta.boundingBox) {
                   logger.warn('SceneMeta boundingBox is missing. Composer might not work correctly.');
              }

              logger.info(`Calling composePattern for pattern: ${patternArgs.pattern}`);
              const composedPrimitives: Primitive[] = composePattern(patternArgs, sceneMeta);

              logger.info(`Pattern composed into ${composedPrimitives.length} primitives.`);

              // Map composed Primitives back to MotionSteps for the interpreter
              const composedSteps: MotionStep[] = composedPrimitives.map((prim, index) => ({
                    type: prim.type,
                    parameters: prim.parameters,
                    // TODO: Need a strategy for duration_ratio allocation for composed steps
                    // For now, distribute equally as a placeholder
                    duration_ratio: composedPrimitives.length > 0 ? 1 / composedPrimitives.length : 1
              }));

              // Create a MotionPlan object from the composed steps
              finalMotionPlan = {
                  steps: composedSteps,
                  metadata: {
                      requested_duration: duration,
                      original_prompt: instruction,
                      source: 'composer', // Add source metadata
                      pattern: patternArgs.pattern // Add pattern name metadata
                  }
              };
          } else {
              // Handle other potential function calls if added later
              throw new Error(`Unsupported function call received: ${adapterResponse.name}`);
          }
      } else if (adapterResponse.type === 'motion_plan') {
          logger.info(`Adapter returned motion plan with ${adapterResponse.plan.steps.length} steps.`);
          finalMotionPlan = adapterResponse.plan;
      } else {
          // Should be exhaustive, but handle unexpected cases
          throw new Error('Unexpected response type from motion planner adapter.');
      }
      // --- >>> End Handle Adapter Response <<< ---

      // --- Interpret the Final Motion Plan --- 
      logger.info('Interpreting the final Motion Plan...');
      try {
        if (!environmentalAnalysis || !currentCameraState) {
          throw new Error('Interpreter context (EnvironmentalAnalysis or CameraState) is missing.');
        }

        const cameraCommands: CameraCommand[] = interpreter.interpretPath(
          finalMotionPlan, // <<< Use the final plan (either direct or composed)
          sceneAnalysis, // sceneAnalysis is guaranteed non-null here
          environmentalAnalysis,
          { position: currentCameraState.position, target: currentCameraState.target }
        );

        logger.info(`Motion Plan interpreted successfully. Returning ${cameraCommands.length} CameraCommands.`);
        const serializableCommands = cameraCommands.map(cmd => ({
            position: { x: cmd.position.x, y: cmd.position.y, z: cmd.position.z },
            target: { x: cmd.target.x, y: cmd.target.y, z: cmd.target.z },
            duration: cmd.duration,
            easing: cmd.easing
        }));
        return NextResponse.json(serializableCommands);

      } catch (interpreterError: any) {
        logger.error('Error during Scene Interpreter execution:', interpreterError);
        return NextResponse.json({ error: `Scene Interpretation Failed: ${interpreterError.message}` }, { status: 500 });
      }

    } catch (motionPlannerError: any) {
      logger.error(`Error during Motion Planner/Composer execution: ${motionPlannerError.message}`, motionPlannerError);
      return NextResponse.json({ error: `Motion Planning/Composition Failed: ${motionPlannerError.message}` }, { status: 500 });
    }

  } catch (requestError: any) {
    logger.error('Error during request processing:', requestError);
    return NextResponse.json({ error: `Request processing failed: ${requestError.message}` }, { status: 500 });
  }
}