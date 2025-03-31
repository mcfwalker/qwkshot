import { SceneAnalyzerImpl as SceneAnalyzer } from '../scene-analyzer/SceneAnalyzer';
import { EnvironmentalAnalyzerImpl as EnvironmentalAnalyzer } from '../environmental-analyzer/EnvironmentalAnalyzer';
import { MetadataManager } from '../metadata-manager/MetadataManager';
import { PromptCompilerImpl as PromptCompiler } from '../prompt-compiler/PromptCompiler';
import { SupabaseAdapter } from '../metadata-manager/adapters/SupabaseAdapter';
import { InMemoryCache } from '../metadata-manager/cache/InMemoryCache';
import { Logger } from '../../../types/p2p/shared';
import { Vector3 } from 'three';
import path from 'path';
import { SceneAnalyzerConfig } from '../../../types/p2p/scene-analyzer';
import { EnvironmentalAnalyzerConfig } from '../../../types/p2p/environmental-analyzer';
import { PromptCompilerConfig } from '../../../types/p2p/prompt-compiler';
import { Feature } from '../../../types/p2p/shared';
import fs from 'fs/promises';

// Mock logger for testing
const mockLogger: Logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  trace: jest.fn()
};

describe('P2P Pipeline Integration', () => {
  let sceneAnalyzer: SceneAnalyzer;
  let environmentalAnalyzer: EnvironmentalAnalyzer;
  let metadataManager: MetadataManager;
  let promptCompiler: PromptCompiler;

  const testModelId = 'test-model-123';
  const testUserId = 'test-user-123';
  const testModelPath = path.resolve(__dirname, '../scene-analyzer/__tests__/fixtures/test.glb');
  const testModel2Path = path.resolve(__dirname, '../scene-analyzer/__tests__/fixtures/test-2.glb');

  beforeAll(async () => {
    // Initialize components
    const dbAdapter = new SupabaseAdapter({
      url: process.env.SUPABASE_URL || '',
      key: process.env.SUPABASE_KEY || ''
    }, mockLogger);

    const cacheAdapter = new InMemoryCache({
      defaultTTL: 5000,
      maxSize: 100,
      cleanupInterval: 1000
    }, mockLogger);

    metadataManager = new MetadataManager(dbAdapter, cacheAdapter, mockLogger, {
      cacheEnabled: true,
      cacheTTL: 5000,
      retryAttempts: 3
    });

    // Initialize Scene Analyzer with config
    const sceneConfig: SceneAnalyzerConfig = {
      maxFileSize: 100 * 1024 * 1024, // 100MB
      supportedFormats: ['model/gltf-binary'],
      analysisOptions: {
        extractFeatures: true,
        calculateSymmetry: true,
        analyzeMaterials: true,
      },
      debug: true,
      performance: {
        enabled: true,
        logInterval: 1000
      }
    };
    sceneAnalyzer = new SceneAnalyzer(sceneConfig, mockLogger);

    // Initialize Environmental Analyzer with config
    const envConfig: EnvironmentalAnalyzerConfig = {
      environmentSize: {
        width: 100,
        height: 100,
        depth: 100,
      },
      analysisOptions: {
        calculateDistances: true,
        validateConstraints: true,
        optimizeCameraSpace: true,
      },
      debug: true,
      performanceMonitoring: true,
      errorReporting: true,
      maxRetries: 3,
      timeout: 5000,
      performance: {
        enabled: true,
        logInterval: 1000
      }
    };
    environmentalAnalyzer = new EnvironmentalAnalyzer(envConfig, mockLogger);

    // Initialize Prompt Compiler with config
    const promptConfig: PromptCompilerConfig = {
      maxTokens: 1000,
      temperature: 0.7,
      debug: true,
      performance: {
        enabled: true,
        logInterval: 1000
      }
    };
    promptCompiler = new PromptCompiler(promptConfig);

    // Initialize metadata manager
    await metadataManager.initialize();
  });

  describe('Pipeline Flow', () => {
    it('should process a small model through the entire pipeline', async () => {
      // 1. Scene Analysis
      const fileContent = await fs.readFile(testModelPath);
      const file = new File([fileContent], 'test.glb', { type: 'model/gltf-binary' });
      const sceneAnalysis = await sceneAnalyzer.analyzeScene(file);
      expect(sceneAnalysis).toBeDefined();
      expect(sceneAnalysis.glb).toBeDefined();
      expect(sceneAnalysis.spatial).toBeDefined();

      // 2. Environmental Analysis
      const environmentalData = await environmentalAnalyzer.analyzeEnvironment(sceneAnalysis);
      expect(environmentalData).toBeDefined();
      expect(environmentalData.environment).toBeDefined();
      expect(environmentalData.object).toBeDefined();

      // 3. Store Metadata
      await metadataManager.storeModelMetadata(testModelId, {
        orientation: {
          position: new Vector3(0, 0, 0),
          rotation: new Vector3(0, 0, 0),
          scale: new Vector3(1, 1, 1)
        },
        preferences: {
          defaultCameraDistance: environmentalData.cameraConstraints.minDistance,
          defaultCameraHeight: environmentalData.cameraConstraints.minHeight,
          preferredViewAngles: [0, 45, 90],
          uiPreferences: {
            showGrid: true,
            showAxes: true,
            showMeasurements: true
          }
        }
      });

      // Add feature points from scene analysis
      for (const feature of sceneAnalysis.features) {
        await metadataManager.addFeaturePoint(testModelId, {
          userId: testUserId,
          type: feature.type as 'landmark' | 'region' | 'measurement',
          position: feature.position,
          description: feature.description
        });
      }

      // Verify metadata storage
      const storedMetadata = await metadataManager.getModelMetadata(testModelId);
      expect(storedMetadata).toBeDefined();
      expect(storedMetadata.orientation).toBeDefined();
      expect(storedMetadata.preferences).toBeDefined();

      const storedFeaturePoints = await metadataManager.getFeaturePoints(testModelId);
      expect(storedFeaturePoints.length).toBeGreaterThan(0);

      // 4. Compile Prompt
      const prompt = await promptCompiler.compilePrompt(
        'Orbit around the model showing all sides',
        sceneAnalysis,
        storedMetadata
      );

      expect(prompt).toBeDefined();
      expect(prompt.systemMessage).toBeDefined();
      expect(prompt.userMessage).toBeDefined();
      expect(prompt.constraints).toBeDefined();
      expect(prompt.metadata).toBeDefined();
    });

    it('should process a larger model through the entire pipeline', async () => {
      const model2Id = 'test-model-456';

      // 1. Scene Analysis
      const fileContent = await fs.readFile(testModel2Path);
      const file = new File([fileContent], 'test-2.glb', { type: 'model/gltf-binary' });
      const sceneAnalysis = await sceneAnalyzer.analyzeScene(file);
      expect(sceneAnalysis).toBeDefined();
      expect(sceneAnalysis.glb).toBeDefined();
      expect(sceneAnalysis.spatial).toBeDefined();

      // 2. Environmental Analysis
      const environmentalData = await environmentalAnalyzer.analyzeEnvironment(sceneAnalysis);
      expect(environmentalData).toBeDefined();
      expect(environmentalData.environment).toBeDefined();
      expect(environmentalData.object).toBeDefined();

      // 3. Store Metadata
      await metadataManager.storeModelMetadata(model2Id, {
        orientation: {
          position: new Vector3(0, 0, 0),
          rotation: new Vector3(0, 0, 0),
          scale: new Vector3(1, 1, 1)
        },
        preferences: {
          defaultCameraDistance: environmentalData.cameraConstraints.minDistance,
          defaultCameraHeight: environmentalData.cameraConstraints.minHeight,
          preferredViewAngles: [0, 45, 90],
          uiPreferences: {
            showGrid: true,
            showAxes: true,
            showMeasurements: true
          }
        }
      });

      // Add feature points from scene analysis
      for (const feature of sceneAnalysis.features) {
        await metadataManager.addFeaturePoint(model2Id, {
          userId: testUserId,
          type: feature.type as 'landmark' | 'region' | 'measurement',
          position: feature.position,
          description: feature.description
        });
      }

      // Verify metadata storage
      const storedMetadata = await metadataManager.getModelMetadata(model2Id);
      expect(storedMetadata).toBeDefined();
      expect(storedMetadata.orientation).toBeDefined();
      expect(storedMetadata.preferences).toBeDefined();

      const storedFeaturePoints = await metadataManager.getFeaturePoints(model2Id);
      expect(storedFeaturePoints.length).toBeGreaterThan(0);

      // 4. Compile Prompt
      const prompt = await promptCompiler.compilePrompt(
        'Show me the details of the model from different angles',
        sceneAnalysis,
        storedMetadata
      );

      expect(prompt).toBeDefined();
      expect(prompt.systemMessage).toBeDefined();
      expect(prompt.userMessage).toBeDefined();
      expect(prompt.constraints).toBeDefined();
      expect(prompt.metadata).toBeDefined();
    });

    it('should handle missing model gracefully', async () => {
      const nonExistentModelId = 'non-existent-model';
      const nonExistentPath = path.resolve(__dirname, '../scene-analyzer/__tests__/fixtures/non-existent.glb');
      
      await expect(
        fs.readFile(nonExistentPath)
      ).rejects.toThrow();

      await expect(
        metadataManager.getModelMetadata(nonExistentModelId)
      ).rejects.toThrow();

      await expect(
        promptCompiler.compilePrompt(
          'Orbit around the model',
          null as any,
          null as any
        )
      ).rejects.toThrow();
    });
  });
}); 