import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Vector3, Box3, BufferGeometry, Material, Mesh, BufferAttribute, TextureLoader } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SceneAnalyzerImpl } from '../SceneAnalyzer';
import { SceneAnalyzerConfig, Logger } from '../../../../types/p2p';
import { mockSceneAnalysis } from '../../prompt-compiler/__tests__/fixtures';
import fs from 'fs';
import path from 'path';

// Mock Three.js TextureLoader
vi.mock('three/src/loaders/TextureLoader', () => ({
  TextureLoader: vi.fn().mockImplementation(() => ({
    load: vi.fn(),
  })),
}));

// Mock Three.js ImageLoader
vi.mock('three/src/loaders/ImageLoader', () => ({
  ImageLoader: vi.fn().mockImplementation(() => ({
    load: vi.fn(),
  })),
}));

// Mock URL.createObjectURL globally
global.URL.createObjectURL = vi.fn();
global.URL.revokeObjectURL = vi.fn();

// Mock logger
const mockLogger: Logger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  performance: vi.fn(),
};

// Load test GLB file
const testGlbPath = path.join(__dirname, 'fixtures', 'test.glb');
const testGlbBuffer = fs.readFileSync(testGlbPath);

// Create a proper File mock with arrayBuffer method
class MockFile {
  name: string;
  type: string;
  size: number;
  private buffer: Buffer;

  constructor(buffer: Buffer, name: string, type: string) {
    this.buffer = buffer;
    this.name = name;
    this.type = type;
    this.size = buffer.length;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    // Create a new ArrayBuffer and copy the data
    const arrayBuffer = new ArrayBuffer(this.buffer.length);
    const view = new Uint8Array(arrayBuffer);
    for (let i = 0; i < this.buffer.length; i++) {
      view[i] = this.buffer[i];
    }
    return arrayBuffer;
  }
}

const mockGLBFile = new MockFile(testGlbBuffer, 'test.glb', 'model/gltf-binary') as unknown as File;

// Create a mock geometry for other tests
const mockGeometry = new BufferGeometry();
const positions = new Float32Array([
  0, 0, 0,  // vertex 0
  1, 0, 0,  // vertex 1
  0, 1, 0,  // vertex 2
  1, 1, 0,  // vertex 3
]);
mockGeometry.setAttribute('position', new BufferAttribute(positions, 3));
mockGeometry.setIndex([0, 1, 2, 1, 3, 2]); // two triangles

// Create a mock material
const mockMaterial = new Material();

// Create a mock mesh
const mockMesh = new Mesh(mockGeometry, mockMaterial);

// Mock GLTF scene with more realistic structure (for other tests)
const mockGLTF = {
  scene: {
    traverse: vi.fn().mockImplementation((callback) => {
      callback(mockMesh);
    }),
    children: [mockMesh],
    type: 'Scene',
  },
  parser: {
    json: {
      version: '2.0',
      asset: {
        generator: 'Mock Generator',
        version: '2.0',
      },
    },
  },
};

// Remove GLTFLoader mock to use the real one
vi.unmock('three/examples/jsm/loaders/GLTFLoader.js');

describe('SceneAnalyzer', () => {
  let analyzer: SceneAnalyzerImpl;
  let config: SceneAnalyzerConfig;

  beforeEach(() => {
    config = {
      maxFileSize: 100 * 1024 * 1024, // 100MB
      supportedFormats: ['model/gltf-binary'],
      analysisOptions: {
        extractFeatures: true,
        calculateSymmetry: true,
        analyzeMaterials: true,
      },
      debug: false,
      performanceMonitoring: true,
      errorReporting: true,
      maxRetries: 3,
      timeout: 30000,
    };
    analyzer = new SceneAnalyzerImpl(config, mockLogger);
  });

  describe('initialize', () => {
    it('should initialize with config', async () => {
      await analyzer.initialize(config);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Scene Analyzer initialized with config:',
        config
      );
    });
  });

  describe('analyzeScene', () => {
    it('should analyze a valid GLB file', async () => {
      const result = await analyzer.analyzeScene(mockGLBFile);

      // Check basic structure
      expect(result).toHaveProperty('glb');
      expect(result).toHaveProperty('spatial');
      expect(result).toHaveProperty('featureAnalysis');
      expect(result).toHaveProperty('safetyConstraints');
      expect(result).toHaveProperty('orientation');
      expect(result).toHaveProperty('features');
      expect(result).toHaveProperty('performance');

      // Check GLB analysis
      expect(result.glb.fileInfo).toHaveProperty('name', 'model.glb');
      expect(result.glb.fileInfo).toHaveProperty('format', 'model/gltf-binary');
      expect(result.glb.fileInfo).toHaveProperty('version', '2.0');
      expect(result.glb.geometry).toHaveProperty('vertexCount');
      expect(result.glb.geometry).toHaveProperty('faceCount');
      expect(result.glb.geometry).toHaveProperty('boundingBox');
      expect(result.glb.geometry).toHaveProperty('center');
      expect(result.glb.geometry).toHaveProperty('dimensions');

      // Check spatial analysis
      expect(result.spatial).toHaveProperty('bounds');
      expect(result.spatial).toHaveProperty('referencePoints');
      expect(result.spatial).toHaveProperty('symmetry');
      expect(result.spatial).toHaveProperty('complexity');
      expect(result.spatial).toHaveProperty('performance');
    });

    it('should reject files exceeding size limit', async () => {
      const largeFile = new File([new ArrayBuffer(200 * 1024 * 1024)], 'large.glb', {
        type: 'model/gltf-binary',
      });

      await expect(analyzer.analyzeScene(largeFile)).rejects.toThrow(
        'File size exceeds maximum allowed size'
      );
    });

    it('should reject unsupported file formats', async () => {
      const unsupportedFile = new File([], 'test.obj', { type: 'model/obj' });

      await expect(analyzer.analyzeScene(unsupportedFile)).rejects.toThrow(
        'Unsupported file format'
      );
    });
  });

  describe('extractReferencePoints', () => {
    it('should extract reference points from scene analysis', async () => {
      const points = await analyzer.extractReferencePoints(mockSceneAnalysis);

      expect(points).toHaveProperty('center');
      expect(points).toHaveProperty('highest');
      expect(points).toHaveProperty('lowest');
      expect(points).toHaveProperty('leftmost');
      expect(points).toHaveProperty('rightmost');
      expect(points).toHaveProperty('frontmost');
      expect(points).toHaveProperty('backmost');

      // Check point values
      expect(points.center).toEqual(new Vector3(0, 0, 0));
      expect(points.highest).toEqual(new Vector3(0, 1, 0));
      expect(points.lowest).toEqual(new Vector3(0, -1, 0));
      expect(points.leftmost).toEqual(new Vector3(-1, 0, 0));
      expect(points.rightmost).toEqual(new Vector3(1, 0, 0));
      expect(points.frontmost).toEqual(new Vector3(0, 0, 1));
      expect(points.backmost).toEqual(new Vector3(0, 0, -1));
    });
  });

  describe('calculateSafetyBoundaries', () => {
    it('should calculate safety boundaries from scene analysis', async () => {
      const boundaries = await analyzer.calculateSafetyBoundaries(mockSceneAnalysis);

      expect(boundaries).toHaveProperty('minDistance');
      expect(boundaries).toHaveProperty('maxDistance');
      expect(boundaries).toHaveProperty('minHeight');
      expect(boundaries).toHaveProperty('maxHeight');
      expect(boundaries).toHaveProperty('restrictedZones');

      // Check boundary values
      expect(boundaries.minDistance).toBeGreaterThan(0);
      expect(boundaries.maxDistance).toBeGreaterThan(boundaries.minDistance);
      expect(boundaries.minHeight).toBeLessThanOrEqual(boundaries.maxHeight);
      expect(Array.isArray(boundaries.restrictedZones)).toBe(true);
    });
  });

  describe('getSceneUnderstanding', () => {
    it('should get scene understanding from analysis', async () => {
      const understanding = await analyzer.getSceneUnderstanding(mockSceneAnalysis);

      expect(understanding).toHaveProperty('complexity');
      expect(understanding).toHaveProperty('symmetry');
      expect(understanding).toHaveProperty('features');

      expect(['simple', 'moderate', 'complex']).toContain(understanding.complexity);
      expect(understanding.symmetry).toHaveProperty('hasSymmetry');
      expect(understanding.symmetry).toHaveProperty('symmetryPlanes');
      expect(Array.isArray(understanding.features)).toBe(true);
    });
  });

  describe('validateAnalysis', () => {
    it('should validate complete scene analysis', () => {
      const result = analyzer.validateAnalysis(mockSceneAnalysis);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing GLB analysis', () => {
      const invalidAnalysis = { ...mockSceneAnalysis, glb: undefined };
      const result = analyzer.validateAnalysis(invalidAnalysis as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing GLB analysis data');
    });

    it('should detect missing spatial analysis', () => {
      const invalidAnalysis = { ...mockSceneAnalysis, spatial: undefined };
      const result = analyzer.validateAnalysis(invalidAnalysis as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing spatial analysis data');
    });

    it('should detect missing safety constraints', () => {
      const invalidAnalysis = { ...mockSceneAnalysis, safetyConstraints: undefined };
      const result = analyzer.validateAnalysis(invalidAnalysis as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing safety constraints');
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return performance metrics', () => {
      const metrics = analyzer.getPerformanceMetrics();
      expect(metrics).toHaveProperty('startTime');
      expect(metrics).toHaveProperty('endTime');
      expect(metrics).toHaveProperty('duration');
      expect(metrics).toHaveProperty('operations');
      expect(Array.isArray(metrics.operations)).toBe(true);
    });
  });
}); 