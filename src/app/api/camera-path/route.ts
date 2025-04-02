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

// Simple debug logs at the very start
console.log('DEBUG - API Route Loading');

// Create a logger instance
const logger: Logger = {
  info: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
  trace: console.trace,
  performance: console.debug // Use debug for performance logs
};

// Create MetadataManagerFactory
const metadataManagerFactory = new MetadataManagerFactory(logger);

export async function POST(request: Request) {
  try {
    // Ensure LLM system is initialized
    await ensureLLMSystemInitialized();

    const body = await request.json();
    
    // Log the full request body
    console.log('Full camera path request:', JSON.stringify(body, null, 2));

    const { instruction, sceneGeometry, duration, modelId } = body;

    if (!instruction || !sceneGeometry || !duration || !modelId) {
      console.error('Missing parameters:', { 
        instruction: !!instruction, 
        sceneGeometry: !!sceneGeometry,
        duration: !!duration,
        modelId: !!modelId
      });
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Get the LLM provider
    const provider = await getActiveProvider() as LLMProvider;
    if (!provider) {
      return NextResponse.json(
        { error: 'No LLM provider available' },
        { status: 500 }
      );
    }

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
    const result = await provider.generateCameraPath(prompt, duration);
    
    // Log the full response
    console.log('Generated animation:', JSON.stringify(result, null, 2));

    // Log performance metrics
    console.log('Performance metrics:', JSON.stringify(prompt.metadata.performanceMetrics, null, 2));

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
    console.error('Error generating camera path:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    return NextResponse.json(
      { error: 'Failed to generate camera path' },
      { status: 500 }
    );
  }
} 