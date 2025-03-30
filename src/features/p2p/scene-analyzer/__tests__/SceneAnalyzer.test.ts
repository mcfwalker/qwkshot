import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Vector3, Box3, BufferGeometry, Material, Mesh, BufferAttribute, TextureLoader } from 'three';
import * as THREE from 'three';
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

// Mock btoa function
global.btoa = vi.fn().mockImplementation((str: string) => {
  return Buffer.from(str, 'binary').toString('base64');
});

// Mock GLTFLoader
vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: vi.fn().mockImplementation(() => ({
    parseAsync: vi.fn().mockImplementation(async (buffer: ArrayBuffer) => {
      console.log('Mock GLTFLoader: parseAsync called with buffer size:', buffer.byteLength);
      return {
        scene: {
          traverse: vi.fn().mockImplementation((callback) => {
            // Create a mock mesh with some geometry
            const mockGeometry = new THREE.BufferGeometry();
            const positions = new Float32Array([
              0, 0, 0,  // vertex 0
              1, 0, 0,  // vertex 1
              0, 1, 0,  // vertex 2
              1, 1, 0,  // vertex 3
            ]);
            mockGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            mockGeometry.setIndex([0, 1, 2, 1, 3, 2]); // two triangles
            const mockMesh = new THREE.Mesh(mockGeometry);
            callback(mockMesh);
          }),
          children: [],
          type: 'Scene',
          updateWorldMatrix: vi.fn(),
          matrix: new THREE.Matrix4(),
          matrixWorld: new THREE.Matrix4(),
          matrixAutoUpdate: true,
          visible: true,
          castShadow: false,
          receiveShadow: false,
          frustumCulled: true,
          renderOrder: 0,
          layers: new THREE.Layers(),
          modelViewMatrix: new THREE.Matrix4(),
          normalMatrix: new THREE.Matrix3(),
          parent: null,
          position: new THREE.Vector3(),
          quaternion: new THREE.Quaternion(),
          rotation: new THREE.Euler(),
          scale: new THREE.Vector3(1, 1, 1),
          up: new THREE.Vector3(0, 1, 0),
          userData: {},
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
    }),
  })),
}));

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

// Load test GLB files
const testGlbPath = path.join(__dirname, 'fixtures', 'test.glb');
const test2GlbPath = path.join(__dirname, 'fixtures', 'test-2.glb');
console.log('Loading test GLB files from:', testGlbPath, 'and', test2GlbPath);
let testGlbBuffer: Buffer;
let test2GlbBuffer: Buffer;
try {
  testGlbBuffer = fs.readFileSync(testGlbPath);
  test2GlbBuffer = fs.readFileSync(test2GlbPath);
  console.log('Successfully loaded test GLB files, sizes:', testGlbBuffer.length, 'and', test2GlbBuffer.length);
} catch (error) {
  console.error('Failed to load test GLB files:', error);
  throw error;
}

// Create a proper File mock with arrayBuffer method
class MockFile {
  name: string;
  type: string;
  size: number;

  constructor(private buffer: Buffer, name: string = 'test.glb', type: string = 'model/gltf-binary') {
    this.name = name;
    this.type = type;
    this.size = buffer.length;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    console.log('Converting Buffer to ArrayBuffer...');
    try {
      const arrayBuffer = new ArrayBuffer(this.buffer.length);
      const view = new Uint8Array(arrayBuffer);
      view.set(this.buffer);
      console.log('Successfully converted Buffer to ArrayBuffer');
      return arrayBuffer;
    } catch (error) {
      console.error('Failed to convert Buffer to ArrayBuffer:', error);
      throw error;
    }
  }
}

const mockGLBFile = new MockFile(testGlbBuffer) as unknown as File;
const mockLargeGLBFile = new MockFile(test2GlbBuffer, 'test-2.glb') as unknown as File;

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

describe('SceneAnalyzer', () => {
  let analyzer: SceneAnalyzerImpl;
  let mockLogger: Logger;
  let config: SceneAnalyzerConfig;
  let testGlbPath: string;
  let testGlbBuffer: Buffer;

  beforeEach(() => {
    console.log('Setting up test environment...');
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      performance: vi.fn(),
      warn: vi.fn(),
    };

    config = {
      debug: true,
      performanceMonitoring: true,
      errorReporting: true,
      maxRetries: 3,
      timeout: 60000,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      supportedFormats: ['model/gltf-binary'],
      analysisOptions: {
        extractFeatures: true,
        calculateSymmetry: true,
        analyzeMaterials: true,
      },
    };

    analyzer = new SceneAnalyzerImpl(config, mockLogger);
    testGlbPath = path.join(__dirname, 'fixtures', 'test.glb');
    testGlbBuffer = fs.readFileSync(testGlbPath);
    console.log('Test environment setup complete');
  });

  describe('initialize', () => {
    it('should initialize with config', async () => {
      try {
        console.log('Running initialize test...');
        await analyzer.initialize(config);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Scene Analyzer initialized with config:',
          config
        );
        console.log('Initialize test completed successfully');
      } catch (error) {
        console.error('Error in initialize test:', error);
        throw error;
      }
    });
  });

  describe('analyzeScene', () => {
    it('should analyze a valid GLB file', async () => {
      console.log('Loading test GLB file from:', testGlbPath);
      const file = new MockFile(testGlbBuffer, 'test.glb', 'model/gltf-binary') as unknown as File;
      console.log('Successfully loaded test GLB file, size:', testGlbBuffer.length);

      const result = await analyzer.analyzeScene(file);

      expect(result).toBeDefined();
      expect(result.glb).toBeDefined();
      expect(result.spatial).toBeDefined();
      expect(result.featureAnalysis).toBeDefined();
      expect(result.safetyConstraints).toBeDefined();
      expect(result.orientation).toBeDefined();
      expect(result.features).toBeDefined();
      expect(result.performance).toBeDefined();
    }, 60000); // Increase timeout to 60 seconds

    it('should handle large GLB files', async () => {
      console.log('Starting large file test...');
      const result = await analyzer.analyzeScene(mockLargeGLBFile);
      console.log('Large file analysis complete');
      expect(result).toBeDefined();
      expect(result.glb).toBeDefined();
      expect(result.glb.fileInfo).toBeDefined();
      expect(result.glb.fileInfo.size).toBe(test2GlbBuffer.length);
      expect(result.glb.fileInfo.name).toBe('test-2.glb');
      expect(result.glb.fileInfo.format).toBe('model/gltf-binary');
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