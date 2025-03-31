import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Vector3, Box3 } from 'three';
import { EnvironmentalAnalyzerImpl } from '../EnvironmentalAnalyzer';
import { EnvironmentalAnalyzerConfig, Logger } from '../../../../types/p2p/environmental-analyzer';
import { SceneAnalysis } from '../../../../types/p2p/scene-analyzer';

// Mock logger
const mockLogger: Logger & {
  info: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
  performance: ReturnType<typeof vi.fn>;
} = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  performance: vi.fn(),
};

describe('EnvironmentalAnalyzer', () => {
  let analyzer: EnvironmentalAnalyzerImpl;
  let config: EnvironmentalAnalyzerConfig;

  beforeEach(() => {
    config = {
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
      debug: false,
      performanceMonitoring: true,
      errorReporting: true,
      maxRetries: 3,
      timeout: 5000,
    };

    analyzer = new EnvironmentalAnalyzerImpl(config, mockLogger);
  });

  describe('initialization', () => {
    it('should initialize with config', async () => {
      await analyzer.initialize(config);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Environmental Analyzer initialized with config:',
        config
      );
    });
  });

  describe('environment analysis', () => {
    const mockSceneAnalysis: SceneAnalysis = {
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

    it('should analyze environment correctly', async () => {
      await analyzer.initialize(config);
      const analysis = await analyzer.analyzeEnvironment(mockSceneAnalysis);

      // Check environment bounds
      expect(analysis.environment.bounds.min).toEqual(new Vector3(-50, 0, -50));
      expect(analysis.environment.bounds.max).toEqual(new Vector3(50, 100, 50));
      expect(analysis.environment.bounds.center).toEqual(new Vector3(0, 50, 0));

      // Check object measurements
      expect(analysis.object.bounds.min).toEqual(new Vector3(-5, 0, -5));
      expect(analysis.object.bounds.max).toEqual(new Vector3(5, 10, 5));
      expect(analysis.object.bounds.center).toEqual(new Vector3(0, 5, 0));

      // Check distances
      expect(analysis.distances.fromObjectToBoundary.left).toBe(45);
      expect(analysis.distances.fromObjectToBoundary.right).toBe(45);
      expect(analysis.distances.fromObjectToBoundary.front).toBe(45);
      expect(analysis.distances.fromObjectToBoundary.back).toBe(45);
      expect(analysis.distances.fromObjectToBoundary.top).toBe(90);
      expect(analysis.distances.fromObjectToBoundary.bottom).toBe(0);

      // Check camera constraints
      expect(analysis.cameraConstraints.minHeight).toBe(5); // 0.5 * object height
      expect(analysis.cameraConstraints.maxHeight).toBe(30); // 3 * object height
      expect(analysis.cameraConstraints.minDistance).toBe(8); // 0.8 * object height
      expect(analysis.cameraConstraints.maxDistance).toBe(50); // 5 * object height
    });

    it('should throw error if not initialized', async () => {
      await expect(analyzer.analyzeEnvironment(mockSceneAnalysis)).rejects.toThrow(
        'Environmental Analyzer not initialized'
      );
    });
  });

  describe('camera position validation', () => {
    const mockAnalysis = {
      environment: {
        bounds: {
          min: new Vector3(-50, 0, -50),
          max: new Vector3(50, 100, 50),
          center: new Vector3(0, 50, 0),
        },
        dimensions: {
          width: 100,
          height: 100,
          depth: 100,
        },
      },
      object: {
        bounds: {
          min: new Vector3(-5, 0, -5),
          max: new Vector3(5, 10, 5),
          center: new Vector3(0, 5, 0),
        },
        dimensions: {
          width: 10,
          height: 10,
          depth: 10,
        },
      },
      distances: {
        fromObjectToBoundary: {
          left: 45,
          right: 45,
          front: 45,
          back: 45,
          top: 90,
          bottom: 0,
        },
      },
      cameraConstraints: {
        minHeight: 5,
        maxHeight: 30,
        minDistance: 8,
        maxDistance: 50,
      },
      performance: {
        startTime: 0,
        endTime: 0,
        duration: 0,
        operations: [],
      },
    };

    it('should validate valid camera position', async () => {
      const result = await analyzer.validateCameraPosition(mockAnalysis, {
        position: new Vector3(10, 15, 10),
        target: new Vector3(0, 5, 0),
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject camera position below minimum height', async () => {
      const result = await analyzer.validateCameraPosition(mockAnalysis, {
        position: new Vector3(10, 3, 10),
        target: new Vector3(0, 5, 0),
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Camera height outside allowed range');
    });

    it('should reject camera position above maximum height', async () => {
      const result = await analyzer.validateCameraPosition(mockAnalysis, {
        position: new Vector3(10, 35, 10),
        target: new Vector3(0, 5, 0),
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Camera height outside allowed range');
    });

    it('should reject camera position too close to target', async () => {
      const result = await analyzer.validateCameraPosition(mockAnalysis, {
        position: new Vector3(2, 8, 2),
        target: new Vector3(0, 5, 0),
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Camera distance outside allowed range');
    });

    it('should reject camera position too far from target', async () => {
      const result = await analyzer.validateCameraPosition(mockAnalysis, {
        position: new Vector3(60, 15, 60),
        target: new Vector3(0, 5, 0),
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Camera distance outside allowed range');
    });
  });

  describe('camera ranges', () => {
    const mockAnalysis = {
      cameraConstraints: {
        minHeight: 5,
        maxHeight: 30,
        minDistance: 8,
        maxDistance: 50,
      },
    } as any;

    it('should return correct camera ranges', async () => {
      const ranges = await analyzer.getCameraRanges(mockAnalysis);

      expect(ranges.height).toEqual({
        min: 5,
        max: 30,
      });
      expect(ranges.distance).toEqual({
        min: 8,
        max: 50,
      });
    });
  });
}); 