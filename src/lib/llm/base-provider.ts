import { LLMProvider, PathGenerationParams, ProviderCapabilities, BaseProviderConfig, LLMProviderError, ProviderType } from './types';

/**
 * Abstract base class for all LLM providers
 * Provides common functionality and enforces consistent interface
 */
export abstract class BaseLLMProvider implements LLMProvider {
  protected config: BaseProviderConfig;

  constructor(config: BaseProviderConfig) {
    this.config = config;
  }

  /**
   * Get the type of this provider
   */
  public getProviderType(): ProviderType {
    return this.config.type;
  }

  abstract generateCameraPath(params: PathGenerationParams): Promise<{ keyframes: any[] }>;
  abstract validateConfiguration(): Promise<boolean>;
  abstract getCapabilities(): ProviderCapabilities;

  /**
   * Validates the structure of generated keyframes
   */
  protected validateKeyframes(keyframes: any[]): boolean {
    if (!Array.isArray(keyframes)) {
      return false;
    }

    return keyframes.every((kf) => {
      return (
        kf &&
        typeof kf === 'object' &&
        typeof kf.position === 'object' &&
        typeof kf.target === 'object' &&
        typeof kf.duration === 'number' &&
        typeof kf.position.x === 'number' &&
        typeof kf.position.y === 'number' &&
        typeof kf.position.z === 'number' &&
        typeof kf.target.x === 'number' &&
        typeof kf.target.y === 'number' &&
        typeof kf.target.z === 'number'
      );
    });
  }

  /**
   * Generates the system prompt for camera path generation
   */
  protected generateSystemPrompt(sceneGeometry: PathGenerationParams['sceneGeometry']): string {
    return `You are a camera path generator for a 3D viewer. Your task is to generate camera keyframes based on natural language instructions and a specified duration. 

Core constraints:
1. Duration Constraint:
   - The total animation duration MUST EXACTLY match the user's requested duration
   - Break down the total duration into appropriate keyframes for smooth, cinematic movement
   - You have full control over individual keyframe timing to achieve the best result

2. Spatial Constraints:
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
}`;
  }

  /**
   * Generates the user prompt for camera path generation
   */
  protected generateUserPrompt(params: PathGenerationParams): string {
    const { prompt, duration, sceneGeometry } = params;
    const currentCamera = sceneGeometry.currentCamera;
    const isFrontView = Math.abs(currentCamera.target.z) < 0.1 && 
                       Math.abs(currentCamera.position.z) > Math.abs(currentCamera.position.x);

    return `
Generate camera keyframes for the following instruction: "${prompt}"

Required animation duration: ${duration} seconds

Scene information:
- Model center: (${sceneGeometry.boundingBox.center.x}, ${sceneGeometry.boundingBox.center.y}, ${sceneGeometry.boundingBox.center.z})
- Model size: (${sceneGeometry.boundingBox.size.x}, ${sceneGeometry.boundingBox.size.y}, ${sceneGeometry.boundingBox.size.z})
- Bounding sphere radius: ${sceneGeometry.boundingSphere.radius}
- Floor height: ${sceneGeometry.floor.height}
- Safe distance range: ${sceneGeometry.safeDistance.min} to ${sceneGeometry.safeDistance.max} units

Current camera state:
- Position: (${currentCamera.position.x}, ${currentCamera.position.y}, ${currentCamera.position.z})
- Looking at: (${currentCamera.target.x}, ${currentCamera.target.y}, ${currentCamera.target.z})
- Current view: ${isFrontView ? 'Facing the front of the model' : 'Not directly facing the front'}

Model orientation:
- Front direction: (${currentCamera.modelOrientation.front.x}, ${currentCamera.modelOrientation.front.y}, ${currentCamera.modelOrientation.front.z})
- Up direction: (${currentCamera.modelOrientation.up.x}, ${currentCamera.modelOrientation.up.y}, ${currentCamera.modelOrientation.up.z})

Generate a sequence of camera keyframes that:
1. Start from the current camera position
2. Follow the user's instructions, considering the current view
3. Maintain safe distances
4. Create smooth, cinematic movement`;
  }

  /**
   * Helper method to throw provider-specific errors
   */
  protected throwError(message: string, code: string, details?: unknown): never {
    throw new LLMProviderError(message, this.getProviderType(), code, details);
  }
} 