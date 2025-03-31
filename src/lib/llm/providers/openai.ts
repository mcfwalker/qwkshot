import OpenAI from 'openai';
import { BaseLLMProvider } from '../base-provider';
import { PathGenerationParams, ProviderCapabilities, OpenAIProviderConfig, GenerationError } from '../types';
import { CompiledPrompt } from '@/types/p2p';
import { CameraKeyframe } from '@/types/camera';
import { Vector3 } from 'three';

export default class OpenAIProvider extends BaseLLMProvider {
  private client: OpenAI;

  constructor(config: OpenAIProviderConfig) {
    super(config);
    this.client = new OpenAI({
      apiKey: config.apiKey,
      organization: config.organization,
    });
  }

  async generateCameraPath(promptData: CompiledPrompt, duration: number): Promise<{ keyframes: CameraKeyframe[] }> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.config.model || "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: promptData.systemMessage
          },
          {
            role: "user",
            content: promptData.userMessage
          }
        ],
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 2000,
        response_format: { type: "json_object" }
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        this.throwError('No response from OpenAI', 'GENERATION_ERROR');
      }

      const parsed = JSON.parse(response);
      if (!parsed.keyframes || !this.validateKeyframes(parsed.keyframes)) {
        this.throwError('Invalid keyframes format in response', 'GENERATION_ERROR', parsed);
      }

      const keyframes: CameraKeyframe[] = parsed.keyframes.map((kf: any) => {
        if (kf.duration === 0) {
            console.warn('OpenAI returned keyframe with zero duration, setting to 0.5s');
            kf.duration = 0.5;
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
        console.warn(`OpenAI total duration (${totalDuration.toFixed(2)}s) differs from requested (${duration}s). Adjusting...`);
        const scaleFactor = totalDuration > tolerance ? duration / totalDuration : 1;
        if (scaleFactor !== 1) {
          keyframes.forEach(kf => { kf.duration *= scaleFactor; });
          console.log(`Adjusted keyframe durations by factor ${scaleFactor.toFixed(3)}.`);
        }
      }

      return { keyframes };
    } catch (error) {
      // Simplify error handling further: just re-throw the original error
      console.error('Error during OpenAI path generation:', error); // Add logging
      throw error; 
    }
  }

  async validateConfiguration(): Promise<boolean> {
    try {
      // Try a simple API call to validate the configuration
      await this.client.models.list();
      return true;
    } catch (error) {
      console.error('OpenAI configuration validation failed:', error);
      return false;
    }
  }

  getCapabilities(): ProviderCapabilities {
    return {
      name: 'OpenAI',
      version: '1.0',
      maxTokens: this.config.maxTokens || 2000,
      supportsJson: true,
      temperature: this.config.temperature || 0.7,
      maxDuration: 60 // Maximum duration in seconds
    };
  }

  public getProviderType(): 'openai' | 'gemini' {
    return 'openai';
  }
} 