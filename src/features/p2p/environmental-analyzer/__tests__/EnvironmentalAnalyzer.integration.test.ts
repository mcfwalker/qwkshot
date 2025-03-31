import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SceneAnalyzerImpl } from '../../scene-analyzer/SceneAnalyzer';
import { EnvironmentalAnalyzerImpl } from '../EnvironmentalAnalyzer';
import { Logger } from '../../../../types/p2p/shared';
import { EnvironmentalAnalyzerConfig } from '../../../../types/p2p/environmental-analyzer';
import { SceneAnalyzerConfig } from '../../../../types/p2p/scene-analyzer';
import { Vector3, Box3 } from 'three';
import path from 'path';
import fs from 'fs/promises';

// Mock logger for both analyzers
const mockLogger: Logger = {
  info: (...args: any[]) => console.log(...args),
  error: (...args: any[]) => console.error(...args),
  warn: (...args: any[]) => console.warn(...args),
  debug: (...args: any[]) => console.debug(...args),
  performance: (...args: any[]) => console.log('Performance:', ...args),
};

// Mock scene analysis result
const mockSceneAnalysis = {
  glb: {
    fileInfo: {
      name: 'test.glb',
      size: 1000,
      format: 'model/gltf-binary',
      version: '2.0',
    },
    geometry: {
      boundingBox: new Box3(
        new Vector3(-5, 0, -5),
        new Vector3(5, 10, 5)
      ),
      center: new Vector3(0, 5, 0),
      dimensions: new Vector3(10, 10, 10),
      vertexCount: 100,
      faceCount: 100,
    },
    materials: [],
    metadata: {},
    performance: {
      startTime: 0,
      endTime: 0,
      duration: 0,
      operations: [],
    },
  },
  spatial: {
    bounds: {
      min: new Vector3(-5, 0, -5),
      max: new Vector3(5, 10, 5),
      center: new Vector3(0, 5, 0),
      dimensions: new Vector3(10, 10, 10),
    },
    referencePoints: {
      center: new Vector3(0, 5, 0),
      highest: new Vector3(0, 10, 0),
      lowest: new Vector3(0, 0, 0),
      leftmost: new Vector3(-5, 5, 0),
      rightmost: new Vector3(5, 5, 0),
      frontmost: new Vector3(0, 5, -5),
      backmost: new Vector3(0, 5, 5),
    },
    symmetry: {
      hasSymmetry: false,
      symmetryPlanes: [],
    },
    complexity: 'simple',
    performance: {
      startTime: 0,
      endTime: 0,
      duration: 0,
      operations: [],
    },
  },
  featureAnalysis: {
    features: [],
    landmarks: [],
    constraints: [],
    performance: {
      startTime: 0,
      endTime: 0,
      duration: 0,
      operations: [],
    },
  },
  safetyConstraints: {
    minHeight: 0,
    maxHeight: 100,
    minDistance: 5,
    maxDistance: 50,
    restrictedZones: [],
  },
  orientation: {
    front: new Vector3(0, 0, 1),
    up: new Vector3(0, 1, 0),
    right: new Vector3(1, 0, 0),
    center: new Vector3(0, 0, 0),
    scale: 1,
  },
  features: [],
  performance: {
    startTime: 0,
    endTime: 0,
    duration: 0,
    operations: [],
  },
};

// Mock Scene Analyzer
vi.mock('../../scene-analyzer/SceneAnalyzer', () => ({
  SceneAnalyzerImpl: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    analyzeScene: vi.fn().mockResolvedValue(mockSceneAnalysis),
  })),
}));

describe('Environmental Analyzer Integration', () => {
  let sceneAnalyzer: SceneAnalyzerImpl;
  let environmentalAnalyzer: EnvironmentalAnalyzerImpl;
  let envConfig: EnvironmentalAnalyzerConfig;
  let sceneConfig: SceneAnalyzerConfig;

  beforeEach(() => {
    // Initialize Scene Analyzer
    sceneConfig = {
      maxFileSize: 100 * 1024 * 1024, // 100MB
      supportedFormats: ['model/gltf-binary'],
      analysisOptions: {
        extractFeatures: true,
        calculateSymmetry: true,
        analyzeMaterials: true,
      },
      debug: true,
      performanceMonitoring: true,
      errorReporting: true,
      maxRetries: 3,
      timeout: 5000,
    };
    sceneAnalyzer = new SceneAnalyzerImpl(sceneConfig, mockLogger);

    // Initialize Environmental Analyzer
    envConfig = {
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
    };

    environmentalAnalyzer = new EnvironmentalAnalyzerImpl(envConfig, mockLogger);
  });

  describe('Pipeline Integration', () => {
    it('should process test.glb through both analyzers', async () => {
      // Initialize analyzers
      await sceneAnalyzer.initialize(sceneConfig);
      await environmentalAnalyzer.initialize(envConfig);

      // Analyze scene first
      const sceneAnalysis = await sceneAnalyzer.analyzeScene({} as any); // Mock input doesn't matter
      expect(sceneAnalysis).toBeDefined();
      expect(sceneAnalysis.spatial.bounds).toBeDefined();

      // Pass scene analysis to environmental analyzer
      const envAnalysis = await environmentalAnalyzer.analyzeEnvironment(sceneAnalysis);
      
      // Verify environment analysis results
      expect(envAnalysis).toBeDefined();
      expect(envAnalysis.environment).toBeDefined();
      expect(envAnalysis.object).toBeDefined();
      expect(envAnalysis.distances).toBeDefined();
      expect(envAnalysis.cameraConstraints).toBeDefined();

      // Verify environment bounds
      const { environment } = envAnalysis;
      expect(environment.bounds.min.x).toBe(-50); // Half of environment width
      expect(environment.bounds.min.y).toBe(0);
      expect(environment.bounds.min.z).toBe(-50);
      expect(environment.bounds.max.x).toBe(50);
      expect(environment.bounds.max.y).toBe(100);
      expect(environment.bounds.max.z).toBe(50);

      // Verify object measurements are derived from scene analysis
      const { object } = envAnalysis;
      expect(object.bounds.min).toEqual(sceneAnalysis.spatial.bounds.min);
      expect(object.bounds.max).toEqual(sceneAnalysis.spatial.bounds.max);
      expect(object.bounds.center).toEqual(sceneAnalysis.spatial.bounds.center);

      // Verify camera constraints are calculated based on object dimensions
      const { cameraConstraints } = envAnalysis;
      const objectHeight = sceneAnalysis.spatial.bounds.dimensions.y;
      expect(cameraConstraints.minHeight).toBe(objectHeight * 0.5);
      expect(cameraConstraints.maxHeight).toBe(objectHeight * 3);
      expect(cameraConstraints.minDistance).toBe(objectHeight * 0.8);
      expect(cameraConstraints.maxDistance).toBe(objectHeight * 5);

      // Test camera position validation with valid position
      const validationResult = await environmentalAnalyzer.validateCameraPosition(
        envAnalysis,
        {
          position: sceneAnalysis.spatial.bounds.center.clone().add({ x: 20, y: 15, z: 20 } as any),
          target: sceneAnalysis.spatial.bounds.center,
        }
      );
      expect(validationResult.isValid).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      await environmentalAnalyzer.initialize(envConfig);

      // Try to analyze with invalid scene analysis
      const invalidSceneAnalysis = {} as any;
      await expect(environmentalAnalyzer.analyzeEnvironment(invalidSceneAnalysis))
        .rejects
        .toThrow();
    });
  });
}); 