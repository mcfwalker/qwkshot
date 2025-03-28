import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { BaseLLMProvider } from '../base-provider';
import { PathGenerationParams, ProviderCapabilities, GeminiProviderConfig, GenerationError, ProviderType } from '../types';
import { CameraKeyframe } from '@/types/camera';
import { Vector3 } from 'three';

export default class GeminiProvider extends BaseLLMProvider {
  private client: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(config: GeminiProviderConfig) {
    super(config);
    this.client = new GoogleGenerativeAI(config.apiKey);
    this.model = this.client.getGenerativeModel({ 
      model: "gemini-2.0-flash",  // Hardcode the model name for now
      generationConfig: {
        temperature: config.temperature || 0.7,
        maxOutputTokens: config.maxTokens || 2000,
      }
    });
  }

  async generateCameraPath(params: PathGenerationParams): Promise<{ keyframes: CameraKeyframe[] }> {
    try {
      // Enhanced prompt structure for Gemini
      const prompt = [
        'IMPORTANT: You are a camera path generator. Your response must be ONLY valid JSON in this exact format:',
        '```json',
        '{"keyframes": [{"position": {"x": number, "y": number, "z": number}, "target": {"x": number, "y": number, "z": number}, "duration": number}]}',
        '```',
        '',
        'Rules:',
        '1. Sum of all keyframe durations MUST equal exactly ' + params.duration + ' seconds',
        '2. All numbers must be finite and reasonable (no Infinity, NaN, or extreme values)',
        '3. No additional text or explanation - ONLY the JSON response',
        '4. Every keyframe MUST have a duration greater than 0 (minimum 0.1)',
        '5. First keyframe should have a reasonable duration (at least 0.5 seconds)',
        '',
        this.generateSystemPrompt(params.sceneGeometry),
        '',
        this.generateUserPrompt(params)
      ].join('\n');

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      if (!text) {
        this.throwError('No response from Gemini', 'GENERATION_ERROR');
      }

      // Log the raw response for debugging
      console.log('Raw Gemini response:', text);

      // Extract JSON, handling markdown code blocks more robustly
      let jsonStr = text;
      
      // Check for JSON wrapped in code blocks
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        jsonStr = codeBlockMatch[1].trim();
        console.log('Extracted JSON from code block:', jsonStr);
      }
      
      try {
        const parsed = JSON.parse(jsonStr);
        
        // Validate keyframes array exists and has correct format
        if (!parsed.keyframes || !Array.isArray(parsed.keyframes) || parsed.keyframes.length === 0) {
          console.error('Missing or invalid keyframes array:', parsed);
          this.throwError('Missing or invalid keyframes array', 'GENERATION_ERROR', parsed);
        }

        // Validate keyframe format and convert to Vector3
        const keyframes: CameraKeyframe[] = parsed.keyframes.map((kf: any, index: number) => {
          // Fix any zero durations BEFORE validation
          if (kf.duration === 0) {
            console.log(`Fixing zero duration at keyframe ${index}`);
            kf.duration = 0.5; // Use a reasonable minimum duration
          }
          
          // Validate after fixing duration
          if (!this.validateKeyframe(kf)) {
            // Log more details about the invalid keyframe
            console.error(`Invalid keyframe at index ${index}:`, JSON.stringify(kf));
            this.throwError(`Invalid keyframe at index ${index}`, 'GENERATION_ERROR', kf);
          }
          
          return {
            position: new Vector3(kf.position.x, kf.position.y, kf.position.z),
            target: new Vector3(kf.target.x, kf.target.y, kf.target.z),
            duration: kf.duration
          };
        });

        // Validate total duration
        const totalDuration = keyframes.reduce((sum, kf) => sum + kf.duration, 0);
        if (Math.abs(totalDuration - params.duration) > 0.001) {
          // Adjust durations proportionally to match the requested duration
          const scaleFactor = params.duration / totalDuration;
          keyframes.forEach(kf => {
            kf.duration *= scaleFactor;
          });
          console.log(`Adjusted keyframe durations to match requested duration (${params.duration}s)`);
        }

        return { keyframes };
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Failed to parse JSON string:', jsonStr);
        
        // Try to clean up the JSON string further and attempt parsing again
        try {
          // Sometimes there might be issues with escaped characters or whitespace
          const cleanedJson = jsonStr.replace(/\\n/g, '').replace(/\\"/g, '"').trim();
          console.log('Attempting to parse cleaned JSON:', cleanedJson);
          const parsed = JSON.parse(cleanedJson);
          
          if (parsed.keyframes && Array.isArray(parsed.keyframes) && parsed.keyframes.length > 0) {
            console.log('Successfully parsed cleaned JSON');
            // Process keyframes as in the main code path
            const keyframes: CameraKeyframe[] = parsed.keyframes.map((kf: any, index: number) => {
              if (kf.duration === 0) {
                console.log(`Fixing zero duration at keyframe ${index}`);
                kf.duration = 0.5;
              }
              
              if (!this.validateKeyframe(kf)) {
                console.error(`Invalid keyframe in cleaned JSON at index ${index}:`, JSON.stringify(kf));
                this.throwError(`Invalid keyframe at index ${index}`, 'GENERATION_ERROR', kf);
              }
              
              return {
                position: new Vector3(kf.position.x, kf.position.y, kf.position.z),
                target: new Vector3(kf.target.x, kf.target.y, kf.target.z),
                duration: kf.duration
              };
            });
            
            // Validate total duration as in the main code path
            const totalDuration = keyframes.reduce((sum, kf) => sum + kf.duration, 0);
            if (Math.abs(totalDuration - params.duration) > 0.001) {
              const scaleFactor = params.duration / totalDuration;
              keyframes.forEach(kf => {
                kf.duration *= scaleFactor;
              });
              console.log(`Adjusted keyframe durations to match requested duration (${params.duration}s)`);
            }
            
            return { keyframes };
          }
        } catch (secondError) {
          console.error('Failed second attempt to parse JSON:', secondError);
        }
        
        this.throwError(
          'Failed to parse JSON response',
          'GENERATION_ERROR',
          { response: text, error: parseError }
        );
      }
    } catch (error) {
      if (error instanceof GenerationError) {
        throw error;
      }
      this.throwError(
        error instanceof Error ? error.message : 'Failed to generate camera path',
        'GENERATION_ERROR',
        error
      );
    }
  }

  private validateKeyframe(keyframe: any): boolean {
    const isValidVector = (v: any) => (
      v && typeof v === 'object' &&
      typeof v.x === 'number' && isFinite(v.x) &&
      typeof v.y === 'number' && isFinite(v.y) &&
      typeof v.z === 'number' && isFinite(v.z)
    );

    return (
      keyframe &&
      typeof keyframe === 'object' &&
      isValidVector(keyframe.position) &&
      isValidVector(keyframe.target) &&
      typeof keyframe.duration === 'number' &&
      isFinite(keyframe.duration) &&
      keyframe.duration > 0
    );
  }

  async validateConfiguration(): Promise<boolean> {
    try {
      // Try a simple generation to validate the configuration
      const result = await this.model.generateContent('Test connection');
      return !!result.response.text();
    } catch (error) {
      console.error('Gemini configuration validation failed:', error);
      return false;
    }
  }

  getCapabilities(): ProviderCapabilities {
    return {
      name: 'Google Gemini',
      version: '2.0',
      maxTokens: this.config.maxTokens || 2000,
      supportsJson: true,
      temperature: this.config.temperature || 0.7,
      maxDuration: 60 // Maximum duration in seconds
    };
  }

  public getProviderType(): ProviderType {
    return this.config.type;
  }
} 