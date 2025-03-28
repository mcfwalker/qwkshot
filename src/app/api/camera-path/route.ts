import { NextResponse } from 'next/server';
import { SceneGeometry } from '@/lib/scene-analysis';
import { getActiveProvider } from '@/lib/llm/registry';
import { ensureLLMSystemInitialized } from '@/lib/llm/init';

// Mark as dynamic route with increased timeout
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Increase to 60 seconds from default of 10

// Simple debug logs at the very start
console.log('DEBUG - API Route Loading');

export async function POST(request: Request) {
  try {
    // Ensure LLM system is initialized
    await ensureLLMSystemInitialized();

    const body = await request.json();
    console.log('Camera path request:', {
      hasInstruction: !!body.instruction,
      hasSceneGeometry: !!body.sceneGeometry,
      duration: body.duration
    });

    const { instruction, sceneGeometry, duration } = body;

    if (!instruction || !sceneGeometry || !duration) {
      console.error('Missing parameters:', { 
        instruction: !!instruction, 
        sceneGeometry: !!sceneGeometry,
        duration: !!duration 
      });
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Get the active provider - properly await the Promise
    const provider = await getActiveProvider();
    if (!provider) {
      return NextResponse.json(
        { error: 'No LLM provider configured' },
        { status: 500 }
      );
    }

    console.log(`Generating camera path using ${await provider.getProviderType()} provider`);

    // Generate camera path using the active provider
    const result = await provider.generateCameraPath({
      instruction,
      sceneGeometry,
      duration
    });

    // Ensure the response format is consistent
    const response = {
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
    };

    console.log('Generated keyframes:', response);
    return NextResponse.json(response);

  } catch (error) {
    console.error('Error generating camera path:', error);
    
    // Ensure we return a proper JSON error response even for timeout errors
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to generate camera path',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
} 