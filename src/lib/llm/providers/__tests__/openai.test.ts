import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import OpenAI from 'openai';
import OpenAIProvider from '../openai'; // Adjust path as needed
import { OpenAIProviderConfig } from '../../types';
import { CompiledPrompt } from '@/types/p2p'; // Assuming central type location
import { Vector3 } from 'three';

// Define mocks accessible in the test scope
const mockCompletionsCreate = vi.fn();
const mockModelsList = vi.fn();

// Mock the module
vi.mock('openai', () => {
    // Return a mock constructor that returns an object with our mock functions
    const MockOpenAI = vi.fn(() => ({
        chat: {
            completions: {
                create: mockCompletionsCreate,
            },
        },
        models: {
            list: mockModelsList,
        }
    }));
    return { default: MockOpenAI };
});

// Mock Data & Config (ensure these are fully defined)
const mockPromptData: CompiledPrompt = {
  systemMessage: 'Sys Prompt', userMessage: 'User Prompt',
  constraints: { minDistance: 0.5, maxDistance: 5.0 },
  metadata: { timestamp: new Date(), version: '1.1', optimizationHistory: [], performanceMetrics: {} as any, requestId: 'req-123', userId: 'user-123' },
  tokenCount: 150,
};
const mockDuration = 10;
const mockConfig: OpenAIProviderConfig = {
  type: 'openai', apiKey: 'test-key', organization: 'test-org',
  model: 'gpt-test', temperature: 0.6, maxTokens: 1500,
};

describe('OpenAIProvider', () => {
    let provider: OpenAIProvider;

    beforeEach(() => {
        vi.clearAllMocks(); // Reset call counts, etc.
        // Instantiate the provider normally; it will use the mocked OpenAI internally
        provider = new OpenAIProvider(mockConfig);
    });

    it('should call OpenAI API with correct parameters in generateCameraPath', async () => {
        const mockApiResponse = {
          choices: [
            { message: { role: 'assistant', content: JSON.stringify({ keyframes: [{ position: {x:1,y:1,z:1}, target:{x:0,y:0,z:0}, duration: 10 }] }) } }
          ],
        };
        // Set the mock return value directly on the globally accessible mock
        mockCompletionsCreate.mockResolvedValue(mockApiResponse);

        await provider.generateCameraPath(mockPromptData, mockDuration);

        // Assert calls directly on the globally accessible mock
        expect(mockCompletionsCreate).toHaveBeenCalledOnce();
        expect(mockCompletionsCreate).toHaveBeenCalledWith({
            model: mockConfig.model,
            messages: [
                { role: 'system', content: mockPromptData.systemMessage },
                { role: 'user', content: mockPromptData.userMessage },
            ],
            temperature: mockConfig.temperature,
            max_tokens: mockConfig.maxTokens,
            response_format: { type: 'json_object' },
        });
    });

    it('should parse valid response and return keyframes with duration adjustment', async () => {
        const mockApiResponse = {
            choices: [
                { message: { role: 'assistant', content: JSON.stringify({
                    keyframes: [
                        { position: { x: 1, y: 1, z: 1 }, target: { x: 0, y: 0, z: 0 }, duration: 4 },
                        { position: { x: -1, y: 1, z: -1 }, target: { x: 0, y: 0, z: 0 }, duration: 4 }, // Total 8 != 10
                    ]
                })}}
            ],
        };
        // Set the mock return value directly
        mockCompletionsCreate.mockResolvedValue(mockApiResponse);

        const result = await provider.generateCameraPath(mockPromptData, mockDuration); // Request duration 10

        expect(result.keyframes).toBeDefined();
        expect(result.keyframes.length).toBe(2);
        expect(result.keyframes[0].position).toBeInstanceOf(Vector3);
        const totalDuration = result.keyframes.reduce((sum, kf) => sum + kf.duration, 0);
        expect(totalDuration).toBeCloseTo(mockDuration); // Should be adjusted to 10
        expect(result.keyframes[0].duration).toBeCloseTo(5); // 4 * (10/8)
        expect(result.keyframes[1].duration).toBeCloseTo(5); // 4 * (10/8)
    });

    // TODO: Add tests for error handling, validateConfiguration, getCapabilities
}); 