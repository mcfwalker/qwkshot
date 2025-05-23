import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { BaseLLMProvider } from '../base-provider';
import { ProviderCapabilities, GeminiProviderConfig, GenerationError, ProviderType } from '../types';
import { CompiledPrompt } from '@/types/p2p';
import { CameraKeyframe } from '@/types/camera';
import { Vector3 } from 'three';

export default class GeminiProvider extends BaseLLMProvider {
  private client: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(config: GeminiProviderConfig) {
    super(config);
    this.client = new GoogleGenerativeAI(config.apiKey);
    this.model = this.client.getGenerativeModel({ 
      model: config.model || "gemini-2.0-flash",
      generationConfig: {
        temperature: config.temperature || 0.7,
        maxOutputTokens: config.maxTokens || 2000,
      }
    });
  }

  async generateCameraPath(promptData: CompiledPrompt, duration: number): Promise<{ keyframes: CameraKeyframe[] }> {
    try {
      // Construct prompt using CompiledPrompt data
      const prompt = [
        'IMPORTANT: You are a camera path generator. Your response must be ONLY valid JSON in this exact format:',
        '```json',
        '{"keyframes": [{"position": {"x": number, "y": number, "z": number}, "target": {"x": number, "y": number, "z": number}, "duration": number}]}',
        '```',
        '',
        'Rules:',
        `1. Sum of all keyframe durations MUST equal exactly ${duration} seconds`,
        '2. All numbers must be finite and reasonable (no Infinity, NaN, or extreme values)',
        '3. No additional text or explanation - ONLY the JSON response',
        '4. Every keyframe MUST have a duration greater than 0 (minimum 0.1)',
        '5. First keyframe should have a reasonable duration (at least 0.5 seconds)',
        '',
        promptData.systemMessage,
        '',
        promptData.userMessage
      ].join('\n');

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      if (!text) {
        this.throwError('No response from Gemini', 'GENERATION_ERROR');
      }

      console.log('Raw Gemini response:', text);

      let jsonStr = text;
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        jsonStr = codeBlockMatch[1].trim();
        console.log('Extracted JSON from code block:', jsonStr);
      }
      
      try {
        const parsed = JSON.parse(jsonStr);
        
        if (!parsed.keyframes || !Array.isArray(parsed.keyframes) || parsed.keyframes.length === 0) {
          console.error('Missing or invalid keyframes array:', parsed);
          this.throwError('Missing or invalid keyframes array', 'GENERATION_ERROR', parsed);
        }

        const keyframes: CameraKeyframe[] = parsed.keyframes.map((kf: any, index: number) => {
          if (kf.duration === 0) {
            console.log(`Fixing zero duration at keyframe ${index}`);
            kf.duration = 0.5;
          }
          if (!this.validateKeyframe(kf)) {
            console.error(`Invalid keyframe at index ${index}:`, JSON.stringify(kf));
            this.throwError(`Invalid keyframe at index ${index}`, 'GENERATION_ERROR', kf);
          }
          return {
            position: new Vector3(kf.position.x, kf.position.y, kf.position.z),
            target: new Vector3(kf.target.x, kf.target.y, kf.target.z),
            duration: kf.duration
          };
        });

        const totalDuration = keyframes.reduce((sum, kf) => sum + kf.duration, 0);
        const tolerance = 0.01;
        if (Math.abs(totalDuration - duration) > tolerance) {
          console.warn(`Total duration (${totalDuration.toFixed(2)}s) differs from requested (${duration}s). Adjusting...`);
          const scaleFactor = totalDuration > tolerance ? duration / totalDuration : 1;
          if (scaleFactor !== 1) { 
            keyframes.forEach(kf => { kf.duration *= scaleFactor; });
            console.log(`Adjusted keyframe durations by factor ${scaleFactor.toFixed(3)}.`);
          }
        }

        return { keyframes };
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Failed to parse JSON string:', jsonStr);
        try {
          const cleanedJson = jsonStr.replace(/\\n/g, '').replace(/\\"/g, '"').trim();
          console.log('Attempting to parse cleaned JSON:', cleanedJson);
          const parsed = JSON.parse(cleanedJson);
          if (parsed.keyframes && Array.isArray(parsed.keyframes) && parsed.keyframes.length > 0) {
            console.log('Successfully parsed cleaned JSON');
            const keyframes: CameraKeyframe[] = parsed.keyframes.map((kf: any, index: number) => {
              if (kf.duration === 0) kf.duration = 0.5;
              if (!this.validateKeyframe(kf)) {
                this.throwError(`Invalid keyframe in cleaned JSON at index ${index}`, 'GENERATION_ERROR', kf);
              }
              return { position: new Vector3(kf.position.x, kf.position.y, kf.position.z), target: new Vector3(kf.target.x, kf.target.y, kf.target.z), duration: kf.duration };
            });
            const totalDuration = keyframes.reduce((sum, kf) => sum + kf.duration, 0);
            const tolerance = 0.01;
            if (Math.abs(totalDuration - duration) > tolerance) {
              const scaleFactor = totalDuration > tolerance ? duration / totalDuration : 1;
              if (scaleFactor !== 1) {
                keyframes.forEach(kf => { kf.duration *= scaleFactor; });
                console.log(`Adjusted keyframe durations by factor ${scaleFactor.toFixed(3)}.`);
              }
            }
            return { keyframes };
          }
        } catch (secondError) {
          console.error('Failed second attempt to parse JSON:', secondError);
        }
        this.throwError('Failed to parse JSON response', 'GENERATION_ERROR', { response: text, error: parseError });
      }
    } catch (error) {
      if (error instanceof GenerationError) {
        throw error;
      }
      this.throwError(error instanceof Error ? error.message : 'Failed to generate camera path', 'GENERATION_ERROR', error);
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