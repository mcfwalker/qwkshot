import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import GeminiProvider from '../gemini';
import { GeminiProviderConfig } from '../../types';
import { CompiledPrompt } from '@/types/p2p';
import { Vector3 } from 'three';

// --- Define Mocks ---
const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn(() => ({
  generateContent: mockGenerateContent,
}));

// --- Mock the Module ---
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

// --- Mock Data & Config ---
const mockPromptData: CompiledPrompt = {
  systemMessage: 'Sys Prompt with rules and context',
  userMessage: 'User: Orbit now',
  constraints: { minDistance: 0.5, maxDistance: 5.0 },
  metadata: { timestamp: new Date(), version: '1.1', optimizationHistory: [], performanceMetrics: {} as any, requestId: 'req-456', userId: 'user-456' },
  tokenCount: 180,
};
const mockDuration = 12;
const mockConfig: GeminiProviderConfig = {
  type: 'gemini', apiKey: 'test-gemini-key',
  model: 'gemini-test', temperature: 0.8, maxTokens: 1800,
};

// --- Test Suite ---
describe('GeminiProvider', () => {
  let provider: GeminiProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new GeminiProvider(mockConfig);
  });

  it('should call Gemini API with correct parameters in generateCameraPath', async () => {
    const mockApiResponse = {
      response: {
        text: () => JSON.stringify({ keyframes: [{ position:{x:1,y:1,z:1}, target:{x:0,y:0,z:0}, duration: mockDuration }] })
      }
    };
    mockGenerateContent.mockResolvedValue(mockApiResponse);

    await provider.generateCameraPath(mockPromptData, mockDuration);

    expect(mockGetGenerativeModel).toHaveBeenCalledWith({
        model: mockConfig.model,
        generationConfig: {
            temperature: mockConfig.temperature,
            maxOutputTokens: mockConfig.maxTokens
        }
    });
    expect(mockGenerateContent).toHaveBeenCalledOnce();

    const expectedPromptStart = 'IMPORTANT: You are a camera path generator.';
    const expectedRule1 = `1. Sum of all keyframe durations MUST equal exactly ${mockDuration} seconds`;
    const actualPrompt = mockGenerateContent.mock.calls[0][0];

    expect(actualPrompt).toEqual(expect.stringContaining(expectedPromptStart));
    expect(actualPrompt).toEqual(expect.stringContaining(expectedRule1));
    expect(actualPrompt).toEqual(expect.stringContaining(mockPromptData.systemMessage));
    expect(actualPrompt).toEqual(expect.stringContaining(mockPromptData.userMessage));
  });

  it('should parse valid response (including markdown blocks) and return keyframes with duration adjustment', async () => {
    const responseContent = JSON.stringify({
        keyframes: [
            { position: { x: 1, y: 1, z: 1 }, target: { x: 0, y: 0, z: 0 }, duration: 5 },
            { position: { x: -1, y: 1, z: -1 }, target: { x: 0, y: 0, z: 0 }, duration: 5 }, // Total 10 != 12
        ]
    });
    const mockApiResponse = {
      response: {
        text: () => `\`\`\`json\n${responseContent}\n\`\`\``
      }
    };
    mockGenerateContent.mockResolvedValue(mockApiResponse);

    const result = await provider.generateCameraPath(mockPromptData, mockDuration); // Request duration 12

    expect(result.keyframes).toBeDefined();
    expect(result.keyframes.length).toBe(2);
    expect(result.keyframes[0].position).toBeInstanceOf(Vector3);
    const totalDuration = result.keyframes.reduce((sum, kf) => sum + kf.duration, 0);
    expect(totalDuration).toBeCloseTo(mockDuration); // Should be adjusted to 12
    expect(result.keyframes[0].duration).toBeCloseTo(6); // 5 * (12/10)
    expect(result.keyframes[1].duration).toBeCloseTo(6); // 5 * (12/10)
  });

  // TODO: Add tests for error handling, validateConfiguration, getCapabilities
}); 