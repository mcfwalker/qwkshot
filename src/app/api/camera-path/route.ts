import { NextResponse } from 'next/server';
import { SceneGeometry } from '@/lib/scene-analysis';
import { getActiveProvider } from '@/lib/llm/registry';
import { ensureLLMSystemInitialized } from '@/lib/llm/init';
import { Vector3 } from 'three';
import { LLMProvider } from '@/lib/llm/types';
import { CameraKeyframe } from '@/types/camera';
import { CompiledPrompt, CameraConstraints, PromptMetadata } from '@/types/p2p/prompt-compiler';
import { MetadataManagerFactory } from '@/features/p2p/metadata-manager/MetadataManagerFactory';
import { EnvironmentalMetadata } from '@/types/p2p/environmental-metadata';
import { Logger } from '@/types/p2p/shared';

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

export async function POST(request: Request) {
  try {
    logger.info('Starting camera path generation request');
    
    // Ensure LLM system is initialized
    await ensureLLMSystemInitialized();
    logger.debug('LLM system initialized');

    const body = await request.json();
    logger.debug('Request body:', body);

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

    // Generate the prompt
    const prompt: CompiledPrompt = {
      systemMessage: `You are an expert virtual cinematographer generating camera paths for a 3D model viewer. Your response MUST be ONLY a valid JSON object matching the specified format.

IMPORTANT: You MUST respond with a JSON object. No other text or explanations.

JSON OUTPUT FORMAT:
\`\`\`json
{
  "keyframes": [
    {
      "position": {"x": number, "y": number, "z": number},
      "target": {"x": number, "y": number, "z": number},
      "duration": number // Duration > 0
    }
    // ... more keyframes
  ]
}
\`\`\`

RULES:
1. Respond ONLY with the JSON object described above. No explanations, apologies, or extra text.
2. The sum of all keyframe durations MUST match the requested total duration of ${duration} seconds.
3. Each keyframe MUST have a duration greater than 0.
4. Start the camera path from the current camera state provided.
5. Generate smooth, natural, and visually appealing camera movements.`,
      userMessage: `CURRENT CAMERA STATE:
- Position: (${currentCameraState.position.x.toFixed(2)}, ${currentCameraState.position.y.toFixed(2)}, ${currentCameraState.position.z.toFixed(2)})
- Target: (${currentCameraState.target.x.toFixed(2)}, ${currentCameraState.target.y.toFixed(2)}, ${currentCameraState.target.z.toFixed(2)})

SCENE & ENVIRONMENT CONTEXT:
- Model Center: (${sceneGeometry.boundingBox.center.x.toFixed(2)}, ${sceneGeometry.boundingBox.center.y.toFixed(2)}, ${sceneGeometry.boundingBox.center.z.toFixed(2)})
- Model Bounds: min: (${sceneGeometry.boundingBox.min.x.toFixed(2)}, ${sceneGeometry.boundingBox.min.y.toFixed(2)}, ${sceneGeometry.boundingBox.min.z.toFixed(2)}), max: (${sceneGeometry.boundingBox.max.x.toFixed(2)}, ${sceneGeometry.boundingBox.max.y.toFixed(2)}, ${sceneGeometry.boundingBox.max.z.toFixed(2)})
- Model Size: (${sceneGeometry.boundingBox.size.x.toFixed(2)}, ${sceneGeometry.boundingBox.size.y.toFixed(2)}, ${sceneGeometry.boundingBox.size.z.toFixed(2)})
- Bounding Sphere Radius: ${sceneGeometry.boundingSphere.radius.toFixed(2)}
- Floor Height: ${sceneGeometry.floor.height.toFixed(2)}
- Safe Distance Range: ${sceneGeometry.safeDistance.min.toFixed(2)} to ${sceneGeometry.safeDistance.max.toFixed(2)}

USER INSTRUCTION:
${instruction}`,
      constraints: {
        minDistance: sceneGeometry.safeDistance.min,
        maxDistance: sceneGeometry.safeDistance.max,
        minHeight: sceneGeometry.floor.height,
        maxHeight: sceneGeometry.boundingBox.max.y,
        maxSpeed: 2.0, // Maximum camera movement speed
        maxAngleChange: 45, // Maximum angle change between keyframes
        minFramingMargin: 0.1 // Minimum margin from model bounds
      },
      metadata: {
        timestamp: new Date(),
        version: '1.0',
        optimizationHistory: [],
        performanceMetrics: {
          startTime: Date.now(),
          endTime: 0,
          duration: 0,
          operations: [],
          cacheHits: 0,
          cacheMisses: 0,
          databaseQueries: 0,
          averageResponseTime: 0
        },
        requestId: modelId
      }
    };

    // Log the full prompt
    console.log('Generated prompt:', JSON.stringify(prompt, null, 2));

    // Generate the path
    logger.info('Generating camera path with provider:', provider.getProviderType());
    try {
      const result = await provider.generateCameraPath(prompt, duration);
      logger.debug('Generated animation result:', result);
      
      if (!result.keyframes || !Array.isArray(result.keyframes)) {
        logger.error('Invalid keyframes in result:', result);
        return NextResponse.json(
          { error: 'Invalid keyframes returned from provider' },
          { status: 500 }
        );
      }

      // Validate keyframes
      const validationErrors = result.keyframes.map((kf, index) => {
        const issues = [];
        if (!kf.position || typeof kf.position.x !== 'number') issues.push('invalid position');
        if (!kf.target || typeof kf.target.x !== 'number') issues.push('invalid target');
        if (typeof kf.duration !== 'number' || kf.duration <= 0) issues.push('invalid duration');
        return issues.length ? { index, issues } : null;
      }).filter(Boolean);

      if (validationErrors.length > 0) {
        logger.error('Keyframe validation errors:', validationErrors);
        return NextResponse.json(
          { error: 'Invalid keyframes in response', details: validationErrors },
          { status: 500 }
        );
      }

      const totalDuration = result.keyframes.reduce((sum, kf) => sum + kf.duration, 0);
      logger.info('Path generated successfully', {
        keyframeCount: result.keyframes.length,
        totalDuration,
        requestedDuration: duration
      });

      // Store environmental metadata
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
          type: 'cinematic',
          duration: duration,
          keyframes: result.keyframes.map(kf => ({
            position: {
              x: kf.position.x,
              y: kf.position.y,
              z: kf.position.z
            },
            target: {
              x: kf.target.x,
              y: kf.target.y,
              z: kf.target.z
            },
            duration: kf.duration
          }))
        },
        constraints: {
          minDistance: sceneGeometry.safeDistance.min,
          maxDistance: sceneGeometry.safeDistance.max,
          minHeight: sceneGeometry.floor.height,
          maxHeight: sceneGeometry.boundingBox.max.y,
          maxSpeed: 2.0,
          maxAngleChange: 45,
          minFramingMargin: 0.1
        },
        performance: {
          startTime: Date.now(),
          endTime: Date.now(),
          duration: Date.now() - prompt.metadata.performanceMetrics.startTime,
          operations: prompt.metadata.performanceMetrics.operations
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

      return NextResponse.json(result);
    } catch (error) {
      logger.error('Error generating camera path:', error);
      return NextResponse.json(
        { 
          error: error instanceof Error ? error.message : 'Failed to generate camera path',
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