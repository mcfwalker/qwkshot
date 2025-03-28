import { GoogleGenerativeAI } from '@google/generative-ai';
import { BaseLLMProvider } from './base-provider';
import { PathGenerationParams, ProviderCapabilities } from './types';
import { CameraKeyframe } from '@/types/camera';
import { Vector3 } from 'three';

export class GeminiProvider extends BaseLLMProvider {
  private client: GoogleGenerativeAI;
  private model: any; // Using any for now as types might be incomplete

  constructor(config: {
    apiKey: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }) {
    super(config);
    this.client = new GoogleGenerativeAI(config.apiKey);
    this.model = this.client.getGenerativeModel({ 
      model: config.model || "gemini-2.0-flash-experimental",
      generationConfig: {
        temperature: config.temperature || 0.7,
        maxOutputTokens: config.maxTokens || 2000,
      }
    });
  }

  async generateCameraPath(params: PathGenerationParams): Promise<{ keyframes: CameraKeyframe[] }> {
    try {
      const prompt = [
        this.generateSystemPrompt(params.sceneGeometry),
        this.generateUserPrompt(params)
      ].join('\n\n');

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      if (!text) {
        throw new Error('No response from Gemini');
      }

      // Gemini might wrap the JSON in markdown code blocks
      const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      
      if (!parsed.keyframes || !this.validateKeyframes(parsed.keyframes)) {
        throw new Error('Invalid keyframes format in response');
      }

      // Convert plain objects to Vector3 instances
      const keyframes: CameraKeyframe[] = parsed.keyframes.map((kf: any) => ({
        position: new Vector3(kf.position.x, kf.position.y, kf.position.z),
        target: new Vector3(kf.target.x, kf.target.y, kf.target.z),
        duration: kf.duration
      }));

      return { keyframes };
    } catch (error) {
      console.error('Gemini API error:', error);
      throw error;
    }
  }

  async validateConfiguration(): Promise<boolean> {
    try {
      // Try a simple API call to validate the configuration
      await this.model.generateContent('Test');
      return true;
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
} 