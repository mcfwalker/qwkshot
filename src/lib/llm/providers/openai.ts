import OpenAI from 'openai';
import { BaseLLMProvider } from '../base-provider';
import { PathGenerationParams, ProviderCapabilities, OpenAIProviderConfig, GenerationError } from '../types';
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

  async generateCameraPath(params: PathGenerationParams): Promise<{ keyframes: CameraKeyframe[] }> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.config.model || "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: this.generateSystemPrompt(params.sceneGeometry)
          },
          {
            role: "user",
            content: this.generateUserPrompt(params)
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

      // Convert plain objects to Vector3 instances
      const keyframes: CameraKeyframe[] = parsed.keyframes.map((kf: any) => ({
        position: new Vector3(kf.position.x, kf.position.y, kf.position.z),
        target: new Vector3(kf.target.x, kf.target.y, kf.target.z),
        duration: kf.duration
      }));

      return { keyframes };
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        this.throwError(
          `OpenAI API error: ${error.message}`,
          'GENERATION_ERROR',
          {
            status: error.status,
            code: error.code,
            type: error.type
          }
        );
      }
      this.throwError(
        error instanceof Error ? error.message : 'Failed to generate camera path',
        'GENERATION_ERROR'
      );
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