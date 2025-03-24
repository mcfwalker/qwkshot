import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { SceneGeometry } from '@/lib/scene-analysis';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY environment variable');
}

// Check if API key is a project-based key (sk-proj-*)
const isProjectKey = process.env.OPENAI_API_KEY?.startsWith('sk-proj-');
console.log('Using project-based API key:', isProjectKey);

// Initialize OpenAI client with proper configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // Add organization ID for project-based keys if available
  ...(process.env.OPENAI_ORGANIZATION && { organization: process.env.OPENAI_ORGANIZATION })
});

export async function POST(request: Request) {
  console.log('Camera path generation request received');
  
  try {
    const body = await request.json();
    console.log('Request body:', JSON.stringify(body, null, 2));

    const { instruction, sceneGeometry } = body;

    if (!instruction || !sceneGeometry) {
      console.error('Missing parameters:', { instruction: !!instruction, sceneGeometry: !!sceneGeometry });
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const prompt = generatePrompt(instruction, sceneGeometry);
    console.log('Generated prompt:', prompt);
    
    console.log('Calling OpenAI API...');
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a camera path generator for a 3D viewer. Your task is to generate camera keyframes based on natural language instructions. 
          The scene has the following constraints:
          - Camera must stay above the floor (y > ${sceneGeometry.floor.height})
          - Camera must maintain safe distance from model (between ${sceneGeometry.safeDistance.min} and ${sceneGeometry.safeDistance.max} units)
          - Camera should generally point towards the model's center
          
          IMPORTANT: You must respond ONLY with a valid JSON object containing an array of keyframes. No other text or explanation.
          Example response format:
          {
            "keyframes": [
              {
                "position": {"x": 5, "y": 2, "z": 3},
                "target": {"x": 0, "y": 0, "z": 0},
                "duration": 2
              }
            ]
          }`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
    });
    console.log('OpenAI API response received');

    const response = completion.choices[0].message.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    console.log('OpenAI response content:', response);

    const keyframes = JSON.parse(response);
    console.log('Parsed keyframes:', keyframes);
    
    // Validate keyframes format
    if (!keyframes.keyframes || !Array.isArray(keyframes.keyframes)) {
      throw new Error('Invalid keyframes format in response');
    }

    // Validate each keyframe
    keyframes.keyframes.forEach((kf: any, index: number) => {
      if (!kf.position || !kf.target || typeof kf.duration !== 'number') {
        throw new Error(`Invalid keyframe at index ${index}`);
      }
    });

    console.log('Sending response with keyframes');
    return NextResponse.json(keyframes);

  } catch (error) {
    console.error('Error generating camera path:', error);
    
    // Check for specific OpenAI errors
    if (error instanceof OpenAI.APIError) {
      console.error('OpenAI API error:', {
        status: error.status,
        message: error.message,
        code: error.code,
        type: error.type
      });
      
      // Handle authentication errors specifically
      if (error.status === 401) {
        let errorMessage = 'Authentication error with OpenAI API. ';
        
        // Additional context for project-based keys
        if (isProjectKey) {
          errorMessage += 'You are using a project-based API key (sk-proj-*). Make sure OPENAI_ORGANIZATION is set correctly in your environment variables.';
        } else {
          errorMessage += 'Please check your API key is valid and has not expired.';
        }
        
        return NextResponse.json(
          { error: errorMessage },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        { error: `OpenAI API error: ${error.message}` },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate camera path' },
      { status: 500 }
    );
  }
}

function generatePrompt(instruction: string, geometry: SceneGeometry): string {
  const currentCamera = geometry.currentCamera;
  const isFrontView = Math.abs(currentCamera?.target.z || 0) < 0.1 && 
                      Math.abs(currentCamera?.position.z || 0) > Math.abs(currentCamera?.position.x || 0);

  return `
Generate camera keyframes for the following instruction: "${instruction}"

Scene information:
- Model center: (${geometry.boundingBox.center.x}, ${geometry.boundingBox.center.y}, ${geometry.boundingBox.center.z})
- Model size: (${geometry.boundingBox.size.x}, ${geometry.boundingBox.size.y}, ${geometry.boundingBox.size.z})
- Bounding sphere radius: ${geometry.boundingSphere.radius}
- Floor height: ${geometry.floor.height}
- Safe distance range: ${geometry.safeDistance.min} to ${geometry.safeDistance.max} units

Current camera state:
- Position: (${currentCamera?.position.x || 0}, ${currentCamera?.position.y || 0}, ${currentCamera?.position.z || 0})
- Looking at: (${currentCamera?.target.x || 0}, ${currentCamera?.target.y || 0}, ${currentCamera?.target.z || 0})
- Current view: ${isFrontView ? 'Facing the front of the model' : 'Not directly facing the front'}

Model orientation:
- Front direction: (${currentCamera?.modelOrientation.front.x || 0}, ${currentCamera?.modelOrientation.front.y || 0}, ${currentCamera?.modelOrientation.front.z || 1})
- Up direction: (${currentCamera?.modelOrientation.up.x || 0}, ${currentCamera?.modelOrientation.up.y || 1}, ${currentCamera?.modelOrientation.up.z || 0})

Generate a sequence of camera keyframes that:
1. Start from the current camera position
2. Follow the user's instructions, considering the current view
3. Maintain safe distances
4. Create smooth, cinematic movement
5. Stay above the floor
6. Keep the model in frame

Response format:
{
  "keyframes": [
    {
      "position": {"x": number, "y": number, "z": number},
      "target": {"x": number, "y": number, "z": number},
      "duration": number
    }
  ]
}

Important:
- First keyframe should match or smoothly transition from current camera position
- All positions must be numbers
- All positions must respect the safe distance range
- All y-coordinates must be above ${geometry.floor.height}
- Target points should generally be near the model center
- Duration should be between 1-5 seconds per keyframe
- Generate at least 4 keyframes for smooth movement
- When instructions mention "front", use the established front direction of the model`;
} 