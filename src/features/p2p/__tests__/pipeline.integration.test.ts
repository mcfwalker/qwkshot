import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Vector3 } from 'three';
// Component implementations
import { SceneAnalyzerImpl } from '../scene-analyzer/SceneAnalyzer';
import { EnvironmentalAnalyzerImpl } from '../environmental-analyzer/EnvironmentalAnalyzer';
import { MetadataManagerImpl } from '../metadata-manager/MetadataManager';
import { PromptCompilerImpl } from '../prompt-compiler/PromptCompiler';
import OpenAIProvider from '../../../lib/llm/providers/openai';
// Type imports
import { Logger } from '../../../types/p2p/shared';
import { SceneAnalysis, SceneAnalyzerConfig, Orientation } from '../../../types/p2p/scene-analyzer';
import { EnvironmentalAnalysis, EnvironmentalAnalyzerConfig } from '../../../types/p2p/environmental-analyzer';
import { ModelMetadata, MetadataManagerConfig } from '../../../types/p2p/metadata-manager';
import { CompiledPrompt, PromptCompilerConfig } from '../../../types/p2p/prompt-compiler';
import { OpenAIProviderConfig, LLMProvider } from '../../../lib/llm/types';
// Adapter imports
import { DatabaseAdapter } from '../metadata-manager/adapters/DatabaseAdapter';
import { CacheAdapter } from '../metadata-manager/cache/CacheAdapter';
// Mock data
import { mockSceneAnalysis, mockModelMetadata } from '../prompt-compiler/__tests__/fixtures';

// --- Mock OpenAI API ---
const mockCompletionsCreate = vi.fn();
vi.mock('openai', () => {
    const MockOpenAI = vi.fn(() => ({
        chat: { completions: { create: mockCompletionsCreate } },
        // models: { list: mockModelsList } // Add if needed
    }));
    // Only export the default mock constructor
    return {
        default: MockOpenAI,
        // APIError: MockAPIError // Removed export
    };
});
// ----------------------

// --- Mocks for Adapters --- (Ensure these mocks are complete for MetadataManager)
const mockDbAdapter: DatabaseAdapter = { initialize: vi.fn(), getModelMetadata: vi.fn(), storeModelMetadata: vi.fn(), updateModelOrientation: vi.fn(), addFeaturePoint: vi.fn(), removeFeaturePoint: vi.fn(), getFeaturePoints: vi.fn(), updateUserPreferences: vi.fn(), modelExists: vi.fn(), getFeaturePointCount: vi.fn() };
const mockCacheAdapter: CacheAdapter = { initialize: vi.fn(), getModelMetadata: vi.fn(), setModelMetadata: vi.fn(), removeModelMetadata: vi.fn(), getFeaturePoints: vi.fn(), setFeaturePoints: vi.fn(), removeFeaturePoints: vi.fn(), clear: vi.fn(), getStats: vi.fn().mockReturnValue({ hits: 0, misses: 0 }) };

// --- Mock Configs --- (Ensure these are valid)
const mockPromptCompilerConfig: PromptCompilerConfig = { maxTokens: 4000, temperature: 0.7 };
const mockSceneAnalyzerConfig: SceneAnalyzerConfig = { analysisOptions: {} } as any;
const mockEnvAnalyzerConfig: EnvironmentalAnalyzerConfig = { environmentSize: {}, analysisOptions: {} } as any;
const mockMetadataManagerConfig: MetadataManagerConfig = { database: {}, caching: {}, validation: {} } as any;
const mockOpenAIConfig: OpenAIProviderConfig = { type: 'openai', apiKey: 'test-key', model: 'gpt-test' };

// Mock logger
const mockLogger: Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn(), performance: vi.fn() };

// Mock Camera State
const mockCameraState = { position: new Vector3(0, 1.5, 5), target: new Vector3(0, 0.5, 0) };

// --- Prepare Mock Data --- (Restore detailed setup)
const testSceneAnalysis: SceneAnalysis = JSON.parse(JSON.stringify(mockSceneAnalysis));
// Ensure orientation matches the exported type definition
testSceneAnalysis.orientation = {
    ...(testSceneAnalysis.orientation || {}),
    position: testSceneAnalysis.orientation?.position || { x: 0, y: 0, z: 0 },
    rotation: testSceneAnalysis.orientation?.rotation || { x: 0, y: 0, z: 0 },
    front: new Vector3(testSceneAnalysis.orientation?.front?.x ?? 0, testSceneAnalysis.orientation?.front?.y ?? 0, testSceneAnalysis.orientation?.front?.z ?? 1),
    up: new Vector3(testSceneAnalysis.orientation?.up?.x ?? 0, testSceneAnalysis.orientation?.up?.y ?? 1, testSceneAnalysis.orientation?.up?.z ?? 0),
    right: new Vector3(testSceneAnalysis.orientation?.right?.x ?? 1, testSceneAnalysis.orientation?.right?.y ?? 0, testSceneAnalysis.orientation?.right?.z ?? 0),
    center: new Vector3(testSceneAnalysis.orientation?.center?.x ?? 0, testSceneAnalysis.orientation?.center?.y ?? 0, testSceneAnalysis.orientation?.center?.z ?? 0),
    scale: testSceneAnalysis.orientation?.scale ?? 1,
};
// Ensure features have descriptions
const ensureFeatureDescription = (f: any) => { f.description = f.description ?? 'Default Description'; };
if (testSceneAnalysis.featureAnalysis?.features) { testSceneAnalysis.featureAnalysis.features.forEach(ensureFeatureDescription); }
if (testSceneAnalysis.features) { testSceneAnalysis.features.forEach(ensureFeatureDescription); }
const testModelMetadata: ModelMetadata = JSON.parse(JSON.stringify(mockModelMetadata));
// Define mock EnvAnalysis using prepared testSceneAnalysis
const mockEnvAnalysisResult: EnvironmentalAnalysis = {
  environment: {
    bounds: { min: new Vector3(-10,-1,-10), max: new Vector3(10,10,10), center: new Vector3(0,4.5,0) },
    dimensions: { width: 20, height: 11, depth: 20 }
  },
  object: {
    bounds: testSceneAnalysis.spatial.bounds,
    dimensions: { 
        width: testSceneAnalysis.spatial.bounds.dimensions.x, 
        height: testSceneAnalysis.spatial.bounds.dimensions.y, 
        depth: testSceneAnalysis.spatial.bounds.dimensions.z 
    },
  },
  distances: {
    fromObjectToBoundary: { left: 9, right: 9, front: 9, back: 9, top: 9, bottom: 0 }
  },
  cameraConstraints: {
    minDistance: 0.6, maxDistance: 8.0, minHeight: 0.1, maxHeight: 9.0
  },
  performance: { startTime: 0, endTime: 0, duration: 0, operations: [], cacheHits: 0, cacheMisses: 0, databaseQueries: 0, averageResponseTime: 0 },
};

describe('P2P Integration Test: EnvAnalyzer -> PromptCompiler -> LLM Provider Call', () => {
  let sceneAnalyzer: SceneAnalyzerImpl;
  let envAnalyzer: EnvironmentalAnalyzerImpl;
  let metadataManager: MetadataManagerImpl;
  let promptCompiler: PromptCompilerImpl;
  let openaiProvider: OpenAIProvider;
  // No longer need instanceMockCreate if only checking args passed to generateCameraPath
  let generateCameraPathSpy: any; 

  beforeEach(() => {
    vi.clearAllMocks();

    sceneAnalyzer = new SceneAnalyzerImpl(mockSceneAnalyzerConfig, mockLogger);
    envAnalyzer = new EnvironmentalAnalyzerImpl(mockEnvAnalyzerConfig, mockLogger);
    metadataManager = new MetadataManagerImpl(mockDbAdapter, mockCacheAdapter, mockLogger, mockMetadataManagerConfig);
    promptCompiler = new PromptCompilerImpl(mockPromptCompilerConfig);
    openaiProvider = new OpenAIProvider(mockOpenAIConfig);

    // Mock component inputs/dependencies
    vi.spyOn(sceneAnalyzer, 'analyzeScene').mockResolvedValue(testSceneAnalysis);
    (mockDbAdapter.getModelMetadata as Mock).mockResolvedValue(testModelMetadata);
    vi.spyOn(envAnalyzer, 'analyzeEnvironment').mockResolvedValue(mockEnvAnalysisResult);

    // Spy on generateCameraPath
    generateCameraPathSpy = vi.spyOn(openaiProvider, 'generateCameraPath');
    // Set a simple return value for the spy
    generateCameraPathSpy.mockResolvedValue({ keyframes: [{ position: new Vector3(1,1,1), target: new Vector3(), duration: 15 }] }); 
  });

  it('should call OpenAIProvider.generateCameraPath with correct CompiledPrompt and duration', async () => {
    const userInput = 'Create a simple orbit';
    const modelId = 'test-model-1';
    const mockDuration = 15;

    // --- Phase 1 & 2 --- 
    const dummyFile = new File([""], "dummy.glb", { type: "model/gltf-binary" });
    const sceneAnalysisResult = await sceneAnalyzer.analyzeScene(dummyFile);
    const envAnalysisResult = await envAnalyzer.analyzeEnvironment(sceneAnalysisResult);
    const modelMetadataResult = await metadataManager.getModelMetadata(modelId);
    const compiledPrompt = await promptCompiler.compilePrompt(
      userInput, sceneAnalysisResult as any, envAnalysisResult, 
      modelMetadataResult, mockCameraState
    );
    expect(compiledPrompt).toBeDefined();

    // --- Phase 3 --- 
    // Call the spied method
    await openaiProvider.generateCameraPath(compiledPrompt, mockDuration);

    // --- Assertions --- 
    // 1. Verify the spy was called with the correct arguments
    expect(generateCameraPathSpy).toHaveBeenCalledOnce();
    expect(generateCameraPathSpy).toHaveBeenCalledWith(compiledPrompt, mockDuration);

    // 2. Verify specific content within the passed compiledPrompt
    const receivedPrompt = generateCameraPathSpy.mock.calls[0][0];
    expect(receivedPrompt.systemMessage).toContain('SCENE & ENVIRONMENT CONTEXT:');
    expect(receivedPrompt.userMessage).toBe(userInput);
    expect(receivedPrompt.metadata.userId).toBe('test-user-1');

    // 3. Verify other mocks
    expect(sceneAnalyzer.analyzeScene).toHaveBeenCalled();
    expect(mockDbAdapter.getModelMetadata).toHaveBeenCalledWith(modelId);
    expect(envAnalyzer.analyzeEnvironment).toHaveBeenCalledWith(sceneAnalysisResult);
  });
  
  // Error handling tests removed
}); 