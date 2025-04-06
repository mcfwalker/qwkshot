import { NextResponse } from 'next/server';
import { SceneGeometry } from '@/lib/scene-analysis';
import { getActiveProvider } from '@/lib/llm/registry';
import { ensureLLMSystemInitialized } from '@/lib/llm/init';
import { Vector3 } from 'three';
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

// Create MetadataManagerFactory
const metadataManagerFactory = new MetadataManagerFactory(logger);

// Create PromptCompilerFactory
const promptCompilerFactory = new PromptCompilerFactory(logger);

export async function POST(request: Request) {
  try {
    logger.info('Starting camera path generation request');
    
    // Ensure LLM system is initialized
    await ensureLLMSystemInitialized();
    logger.debug('LLM system initialized');

    // Get LLM Engine instance
    const engine = getLLMEngine();
    logger.debug('Got LLM Engine instance');

    // Get Scene Interpreter instance
    const interpreter = getSceneInterpreter();
    logger.debug('Got Scene Interpreter instance');

    // Get Prompt Compiler instance
    // TODO: Configure PromptCompiler properly
    const promptCompiler = promptCompilerFactory.create({ 
        maxTokens: 2048, // Placeholder config
        temperature: 0.7   // Placeholder config
    });
    await promptCompiler.initialize({ /* Use same config? */ maxTokens: 2048, temperature: 0.7 }); // Placeholder init
    logger.debug('Got and initialized Prompt Compiler instance');

    const body = await request.json();
    logger.debug('Request body:', body);

    // TODO: The request body structure needs review. 
    // It provides sceneGeometry (analysis result) but compilePrompt expects SceneAnalysis component/result type.
    // It lacks envAnalysis and modelMetadata.
    const { instruction, sceneGeometry, duration, modelId } = body;

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

    // Get the LLM provider
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

    // Convert camera state to Vector3
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
      )
    };

    logger.debug('Camera state:', {
      position: currentCameraState.position.toArray(),
      target: currentCameraState.target.toArray()
    });

    console.log('Generating path with:', {
      modelId,
      instruction,
      currentCameraState,
      duration
    });

    // --- Compile Prompt using the PromptCompiler --- 
    logger.info('Compiling prompt via PromptCompiler...');
    let compiledPrompt: CompiledPrompt;
    try {
      // TODO: Fetch actual SceneAnalysis, EnvAnalysis, ModelMetadata using modelId
      // Using placeholders/incorrect types for now to establish flow
      const placeholderSceneAnalysis: any = sceneGeometry; // Incorrect type, using existing data
      const placeholderEnvAnalysis: any = null; // Placeholder
      const placeholderModelMetadata: any = null; // Placeholder

      compiledPrompt = await promptCompiler.compilePrompt(
        instruction, // userInput
        placeholderSceneAnalysis, 
        placeholderEnvAnalysis, 
        placeholderModelMetadata, 
        currentCameraState
      );
      logger.debug('Prompt compiled successfully:', compiledPrompt);

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
    logger.info('Generating camera path via LLM Engine for provider:', engineConfig.model);
    try {
      const response = await engine.generatePath(compiledPrompt);

      logger.debug('LLM Engine response:', response);

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
      const cameraPath = response.data; // cameraPath is type CameraPath
      logger.info(`Path received from LLM Engine with ${cameraPath.keyframes.length} keyframes.`);

      // --- Interpret the Path --- 
      logger.info('Interpreting camera path...');
      const commands = interpreter.interpretPath(cameraPath);
      logger.info(`Interpretation resulted in ${commands.length} commands.`);

      // --- Validate Commands --- 
      const commandValidation = interpreter.validateCommands(commands);
      if (!commandValidation.isValid) {
          // Handle invalid commands - log, potentially throw or return error
          logger.error('Generated commands failed validation:', commandValidation.errors);
          // Decide on error response - returning 500 for now
          return NextResponse.json(
              { error: 'Generated commands failed validation', details: commandValidation.errors },
              { status: 500 }
          );
      }
      logger.info('Generated commands passed validation.');

      // --- Metadata Storage --- 
      // TODO: Review if EnvironmentalMetadata needs adjustment
      // Make sure metadata creation uses the *actual* compiledPrompt data if needed
      const environmentalMetadata: EnvironmentalMetadata = {
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
          fov: 45
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

      // Create and initialize MetadataManager
      const metadataManager = metadataManagerFactory.create({
        database: {
          type: 'supabase',
          url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
          key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        },
        caching: {
          enabled: true,
          ttl: 5 * 60 * 1000 // 5 minutes
        },
        validation: {
          strict: false,
          maxFeaturePoints: 100
        }
      });

      await metadataManager.initialize();

      // Store the environmental metadata
      await metadataManager.storeEnvironmentalMetadata(modelId, environmentalMetadata);

      // Return the FINAL validated CameraCommand array
      logger.info('Sending generated commands to client.');
      return NextResponse.json(commands); // Return commands, not cameraPath
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