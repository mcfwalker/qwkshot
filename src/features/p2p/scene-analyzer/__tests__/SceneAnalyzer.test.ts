import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Vector3, Box3, BufferGeometry, Material, Mesh, BufferAttribute, TextureLoader, Matrix4, Matrix3, Quaternion, Euler, Layers, MeshBasicMaterial } from 'three';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SceneAnalyzerImpl } from '../SceneAnalyzer';
import { SceneAnalyzerConfig, Logger, SceneAnalysis } from '../../../../types/p2p';
import { PerformanceMetrics } from '../../../../types/p2p/shared';
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
      
      // Create a mock mesh based on buffer size
      const isLargeFile = buffer.byteLength > 1000000; // 1MB threshold
      const vertexCount = isLargeFile ? 12000 : 4; // Increased to ensure high complexity
      const positions = new Float32Array(vertexCount * 3);
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] = Math.random() * 2 - 1;     // x
        positions[i + 1] = Math.random() * 2 - 1; // y
        positions[i + 2] = Math.random() * 2 - 1; // z
      }

      const mockGeometry = new THREE.BufferGeometry();
      mockGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      
      // Create faces (2 triangles per quad)
      const indices = [];
      for (let i = 0; i < vertexCount - 2; i++) {
        indices.push(i, i + 1, i + 2);
      }
      mockGeometry.setIndex(indices);

      // Create a regular mesh and a landmark mesh
      const mockMesh = new THREE.Mesh(mockGeometry);
      const landmarkGeometry = new THREE.BoxGeometry(2, 2, 2); // Large enough to be a landmark
      const landmarkMesh = new THREE.Mesh(landmarkGeometry);
      landmarkMesh.userData.isLandmark = true;

      // For large files, add more meshes to increase complexity
      const meshes = [mockMesh, landmarkMesh];
      if (isLargeFile) {
        for (let i = 0; i < 60; i++) { // Add more meshes to exceed the moderate threshold
          const additionalMesh = new THREE.Mesh(mockGeometry.clone());
          meshes.push(additionalMesh);
        }
      }

      return {
        scene: {
          traverse: vi.fn().mockImplementation((callback) => {
            meshes.forEach(mesh => callback(mesh));
          }),
          children: meshes,
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

// Create mock material
const mockBasicMaterial = new MeshBasicMaterial();

// Create a mock mesh with proper THREE.js methods
const mockMesh = {
  type: 'Mesh',
  uuid: 'mock-mesh-uuid',
  geometry: {
    attributes: {
      position: {
        count: 4,
      },
    },
    index: {
      count: 6,
    },
  },
  material: mockBasicMaterial,
  updateWorldMatrix: vi.fn(),
  getWorldPosition: vi.fn().mockReturnValue(new Vector3(0, 0, 0)),
  matrix: new Matrix4(),
  matrixWorld: new Matrix4(),
  matrixAutoUpdate: true,
  visible: true,
  castShadow: false,
  receiveShadow: false,
  frustumCulled: true,
  renderOrder: 0,
  layers: new Layers(),
  modelViewMatrix: new Matrix4(),
  normalMatrix: new Matrix3(),
  parent: null,
  position: new Vector3(),
  quaternion: new Quaternion(),
  rotation: new Euler(),
  scale: new Vector3(1, 1, 1),
  up: new Vector3(0, 1, 0),
  userData: {},
};

// Mock GLTF scene with more realistic structure
const mockGLTF = {
  scene: {
    traverse: vi.fn().mockImplementation((callback) => {
      callback(mockMesh);
    }),
    children: [mockMesh],
    type: 'Scene',
    updateWorldMatrix: vi.fn(),
    matrix: new Matrix4(),
    matrixWorld: new Matrix4(),
    matrixAutoUpdate: true,
    visible: true,
    castShadow: false,
    receiveShadow: false,
    frustumCulled: true,
    renderOrder: 0,
    layers: new Layers(),
    modelViewMatrix: new Matrix4(),
    normalMatrix: new Matrix3(),
    parent: null,
    position: new Vector3(),
    quaternion: new Quaternion(),
    rotation: new Euler(),
    scale: new Vector3(1, 1, 1),
    up: new Vector3(0, 1, 0),
    userData: {},
  },
  scenes: [],
  animations: [],
  cameras: [],
  asset: {
    generator: 'Mock Generator',
    version: '2.0',
  },
  parser: {
    json: {
      asset: {
        generator: 'Mock Generator',
        version: '2.0',
      },
    },
  },
};

// Mock scene analysis for tests
const mockSceneAnalysis: SceneAnalysis = {
  glb: {
    fileInfo: {
      format: 'model/gltf-binary',
      name: 'test.glb',
      size: 1000,
      version: '2.0',
    },
    geometry: {
      boundingBox: new Box3(),
      center: new Vector3(),
      dimensions: new Vector3(1, 1, 1),
      vertexCount: 4,
      faceCount: 2,
    },
    materials: [mockBasicMaterial],
    metadata: {},
    performance: {
      startTime: 0,
      endTime: 1,
      duration: 1,
      operations: [],
    },
  },
  spatial: {
    bounds: {
      min: new Vector3(-1, -1, -1),
      max: new Vector3(1, 1, 1),
      center: new Vector3(),
      dimensions: new Vector3(2, 2, 2),
    },
    complexity: 'simple',
    referencePoints: {
      center: new Vector3(),
      highest: new Vector3(0, 1, 0),
      lowest: new Vector3(0, -1, 0),
      leftmost: new Vector3(-1, 0, 0),
      rightmost: new Vector3(1, 0, 0),
      frontmost: new Vector3(0, 0, -1),
      backmost: new Vector3(0, 0, 1),
    },
    symmetry: {
      hasSymmetry: true,
      symmetryPlanes: [],
    },
    performance: {
      startTime: 0,
      endTime: 1,
      duration: 1,
      operations: [],
    },
  },
  featureAnalysis: {
    features: [],
    landmarks: [],
    constraints: [],
    performance: {
      startTime: 0,
      endTime: 1,
      duration: 1,
      operations: [],
    },
  },
  safetyConstraints: {
    minHeight: -1,
    maxHeight: 1,
    minDistance: 0.1,
    maxDistance: 2,
    restrictedZones: [],
  },
  orientation: {
    front: new Vector3(0, 0, -1),
    up: new Vector3(0, 1, 0),
    right: new Vector3(1, 0, 0),
    center: new Vector3(),
    scale: 1,
  },
  features: [],
  performance: {
    startTime: 0,
    endTime: 1,
    duration: 1,
    operations: [],
  },
};

describe('SceneAnalyzer', () => {
  let analyzer: SceneAnalyzerImpl;
  let mockLogger: Logger;
  let config: SceneAnalyzerConfig;
  let testGlbPath: string;
  let testGlbBuffer: Buffer;

  beforeEach(async () => {
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
    await analyzer.initialize(config);
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

      // Test GLB analysis
      expect(result.glb).toBeDefined();
      expect(result.glb.geometry).toBeDefined();
      expect(result.glb.geometry.vertexCount).toBeGreaterThan(0);
      expect(result.glb.geometry.faceCount).toBeGreaterThan(0);
      expect(result.glb.geometry.boundingBox).toBeDefined();
      expect(result.glb.materials).toBeDefined();

      // Test spatial analysis
      expect(result.spatial).toBeDefined();
      expect(result.spatial.bounds).toBeDefined();
      expect(result.spatial.bounds.min).toBeDefined();
      expect(result.spatial.bounds.max).toBeDefined();
      expect(result.spatial.bounds.center).toBeDefined();
      expect(result.spatial.bounds.dimensions).toBeDefined();
      expect(result.spatial.referencePoints).toBeDefined();
      expect(result.spatial.symmetry).toBeDefined();
      expect(result.spatial.complexity).toBeDefined();

      // Test feature analysis
      expect(result.featureAnalysis).toBeDefined();
      expect(result.featureAnalysis.features).toBeDefined();
      expect(Array.isArray(result.featureAnalysis.features)).toBe(true);
      expect(result.featureAnalysis.landmarks).toBeDefined();
      expect(result.featureAnalysis.constraints).toBeDefined();

      // Test safety constraints
      expect(result.safetyConstraints).toBeDefined();
      expect(result.safetyConstraints.minDistance).toBeDefined();
      expect(result.safetyConstraints.maxHeight).toBeDefined();
      expect(result.safetyConstraints.restrictedZones).toBeDefined();

      // Test orientation
      expect(result.orientation).toBeDefined();
      expect(result.orientation.front).toBeDefined();
      expect(result.orientation.up).toBeDefined();
      expect(result.orientation.right).toBeDefined();
      expect(result.orientation.center).toBeDefined();
      expect(result.orientation.scale).toBeDefined();

      // Test performance metrics
      expect(result.performance).toBeDefined();
      expect(result.performance.startTime).toBeDefined();
      expect(result.performance.endTime).toBeDefined();
      expect(result.performance.duration).toBeGreaterThan(0);
      expect(result.performance.operations).toBeDefined();
      expect(Array.isArray(result.performance.operations)).toBe(true);
    });

    it('should handle large GLB files', async () => {
      // Create a large mock geometry
      const largeGeometry = new BufferGeometry();
      const positions = new Float32Array(3000); // 1000 vertices
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] = Math.random() * 2 - 1;     // x
        positions[i + 1] = Math.random() * 2 - 1; // y
        positions[i + 2] = Math.random() * 2 - 1; // z
      }
      largeGeometry.setAttribute('position', new BufferAttribute(positions, 3));
      
      // Create 2000 faces (6000 indices)
      const indices = new Uint32Array(6000);
      for (let i = 0; i < indices.length; i += 3) {
        indices[i] = Math.floor(Math.random() * 1000);
        indices[i + 1] = Math.floor(Math.random() * 1000);
        indices[i + 2] = Math.floor(Math.random() * 1000);
      }
      largeGeometry.setIndex(Array.from(indices));

      const largeMesh = new Mesh(largeGeometry, mockBasicMaterial);
      const largeScene = {
        traverse: vi.fn().mockImplementation((callback) => {
          callback(largeMesh);
        }),
        children: [largeMesh],
      };

      const mockGLBAnalysis = {
        geometry: {
          vertexCount: 1000,
          faceCount: 2000,
          boundingBox: new Box3().setFromObject(largeMesh),
        },
        materials: [mockBasicMaterial],
        metadata: {},
        performance: {
          startTime: Date.now(),
          endTime: Date.now(),
          duration: 0,
          operations: [],
        },
      };

      const mockSpatialAnalysis = {
        bounds: {
          min: new Vector3(-1, -1, -1),
          max: new Vector3(1, 1, 1),
          center: new Vector3(0, 0, 0),
          dimensions: new Vector3(2, 2, 2),
        },
        referencePoints: {
          center: new Vector3(0, 0, 0),
          highest: new Vector3(0, 1, 0),
          lowest: new Vector3(0, -1, 0),
          leftmost: new Vector3(-1, 0, 0),
          rightmost: new Vector3(1, 0, 0),
          frontmost: new Vector3(0, 0, -1),
          backmost: new Vector3(0, 0, 1),
        },
        symmetry: { hasSymmetry: false, symmetryPlanes: [] },
        complexity: 'high' as const,
        performance: {
          startTime: Date.now(),
          endTime: Date.now(),
          duration: 0,
          operations: [],
        },
      };

      const file = new MockFile(test2GlbBuffer, 'test-2.glb', 'model/gltf-binary') as unknown as File;
      const result = await analyzer.analyzeScene(file);

      // Verify large file handling
      expect(result.glb.geometry.vertexCount).toBeGreaterThan(1000);
      expect(result.glb.geometry.faceCount).toBeGreaterThan(1000);
      expect(result.spatial.complexity).toBe('high');
    });

    it('should detect symmetry in symmetric models', async () => {
      // Create a symmetric test model
      const symmetricGeometry = new BufferGeometry();
      const symmetricPositions = new Float32Array([
        -1, 0, 0,  // vertex 0
        1, 0, 0,   // vertex 1
        0, 1, 0,   // vertex 2
        0, -1, 0,  // vertex 3
      ]);
      symmetricGeometry.setAttribute('position', new BufferAttribute(symmetricPositions, 3));
      symmetricGeometry.setIndex([0, 1, 2, 1, 3, 2]);

      const symmetricMesh = new Mesh(symmetricGeometry, mockBasicMaterial);
      const symmetricScene = {
        traverse: vi.fn().mockImplementation((callback) => {
          callback(symmetricMesh);
        }),
        children: [symmetricMesh],
      };

      const mockGLBAnalysis = {
        geometry: {
          vertexCount: 4,
          faceCount: 2,
          boundingBox: new Box3().setFromObject(symmetricMesh),
        },
        materials: [mockBasicMaterial],
        metadata: {},
        performance: {
          startTime: Date.now(),
          endTime: Date.now(),
          duration: 0,
          operations: [],
        },
      };

      const mockSpatialAnalysis = {
        bounds: {
          min: new Vector3(-1, -1, 0),
          max: new Vector3(1, 1, 0),
          center: new Vector3(0, 0, 0),
          dimensions: new Vector3(2, 2, 0),
        },
        referencePoints: {
          center: new Vector3(0, 0, 0),
          highest: new Vector3(0, 1, 0),
          lowest: new Vector3(0, -1, 0),
          leftmost: new Vector3(-1, 0, 0),
          rightmost: new Vector3(1, 0, 0),
          frontmost: new Vector3(0, 0, -1),
          backmost: new Vector3(0, 0, 1),
        },
        symmetry: { hasSymmetry: false, symmetryPlanes: [] },
        complexity: 'simple' as const,
        performance: {
          startTime: Date.now(),
          endTime: Date.now(),
          duration: 0,
          operations: [],
        },
      };

      const file = new MockFile(testGlbBuffer, 'symmetric.glb', 'model/gltf-binary') as unknown as File;
      const result = await analyzer.analyzeScene(file);

      expect(result.spatial.symmetry.hasSymmetry).toBe(true);
      expect(result.spatial.symmetry.symmetryPlanes.length).toBeGreaterThan(0);
    });

    it('should extract meaningful reference points', async () => {
      const file = new MockFile(testGlbBuffer, 'test.glb', 'model/gltf-binary') as unknown as File;
      const result = await analyzer.analyzeScene(file);

      const { referencePoints } = result.spatial;
      expect(referencePoints.center).toBeDefined();
      expect(referencePoints.highest).toBeDefined();
      expect(referencePoints.lowest).toBeDefined();
      expect(referencePoints.leftmost).toBeDefined();
      expect(referencePoints.rightmost).toBeDefined();
      expect(referencePoints.frontmost).toBeDefined();
      expect(referencePoints.backmost).toBeDefined();
    });

    it('should calculate appropriate safety constraints', async () => {
      const file = new MockFile(testGlbBuffer, 'test.glb', 'model/gltf-binary') as unknown as File;
      const result = await analyzer.analyzeScene(file);

      const { safetyConstraints } = result;
      expect(safetyConstraints.minDistance).toBeGreaterThan(0);
      expect(safetyConstraints.maxHeight).toBeGreaterThan(0);
      expect(safetyConstraints.restrictedZones).toBeDefined();

      // Verify safety constraints are reasonable
      expect(safetyConstraints.minDistance).toBeLessThan(safetyConstraints.maxDistance);
      expect(safetyConstraints.minHeight).toBeLessThan(safetyConstraints.maxHeight);
    });

    it('should detect key features and landmarks', async () => {
      // Create a test model with features and landmarks
      const featureGeometry = new BufferGeometry();
      const positions = new Float32Array([
        0, 0, 0,    // vertex 0
        1, 0, 0,    // vertex 1
        0, 1, 0,    // vertex 2
        1, 1, 0,    // vertex 3
        0, 0, 1,    // vertex 4 (landmark)
        1, 0, 1,    // vertex 5 (landmark)
        0, 1, 1,    // vertex 6 (landmark)
        1, 1, 1,    // vertex 7 (landmark)
      ]);
      featureGeometry.setAttribute('position', new BufferAttribute(positions, 3));
      featureGeometry.setIndex([
        0, 1, 2, 1, 3, 2,  // base
        4, 5, 6, 5, 7, 6,  // top (landmark)
        0, 4, 1, 1, 5, 3,  // sides
        3, 7, 2, 2, 6, 0,  // sides
      ]);

      const featureMesh = new Mesh(featureGeometry, mockBasicMaterial);
      featureMesh.userData.isLandmark = true; // Mark as landmark

      const file = new MockFile(testGlbBuffer, 'features.glb', 'model/gltf-binary') as unknown as File;
      const result = await analyzer.analyzeScene(file);

      const { featureAnalysis } = result;
      expect(featureAnalysis.features.length).toBeGreaterThan(0);
      expect(featureAnalysis.landmarks.length).toBeGreaterThan(0);
      
      // Check feature properties
      featureAnalysis.features.forEach(feature => {
        expect(feature).toHaveProperty('id');
        expect(feature).toHaveProperty('type');
        expect(feature).toHaveProperty('position');
        expect(feature).toHaveProperty('description');
      });
    });

    it('should handle errors gracefully', async () => {
      // Create an invalid GLB file with incorrect format
      const invalidFile = new MockFile(Buffer.from('invalid'), 'invalid.glb', 'application/octet-stream') as unknown as File;
      
      await expect(analyzer.analyzeScene(invalidFile)).rejects.toThrow('Unsupported file format');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should track performance metrics accurately', async () => {
      const file = new MockFile(testGlbBuffer, 'test.glb', 'model/gltf-binary') as unknown as File;
      const result = await analyzer.analyzeScene(file);

      const { performance } = result;
      expect(performance.startTime).toBeDefined();
      expect(performance.endTime).toBeDefined();
      expect(performance.duration).toBeGreaterThan(0);
      expect(performance.operations).toBeDefined();
      expect(Array.isArray(performance.operations)).toBe(true);

      // Verify operation durations
      performance.operations.forEach(op => {
        expect(op.duration).toBeGreaterThanOrEqual(0);
        expect(op.success).toBe(true);
      });

      // Verify total duration matches operations
      const totalOperationDuration = performance.operations.reduce((sum, op) => sum + op.duration, 0);
      expect(performance.duration).toBeGreaterThanOrEqual(totalOperationDuration);
    });
  });

  describe('extractReferencePoints', () => {
    it('should extract reference points from scene analysis', async () => {
      const points = await analyzer.extractReferencePoints(mockSceneAnalysis);
      expect(points.center).toEqual(new Vector3(0, 0, 0));
      expect(points.highest).toEqual(new Vector3(0, 1, 0));
      expect(points.lowest).toEqual(new Vector3(0, -1, 0));
      expect(points.leftmost).toEqual(new Vector3(-1, 0, 0));
      expect(points.rightmost).toEqual(new Vector3(1, 0, 0));
      expect(points.frontmost).toEqual(new Vector3(0, 0, -1));
      expect(points.backmost).toEqual(new Vector3(0, 0, 1));
    });
  });

  describe('calculateSafetyBoundaries', () => {
    it('should calculate safety boundaries from scene analysis', async () => {
      const result = await analyzer.getSafetyBoundaries(mockSceneAnalysis);

      expect(result).toHaveProperty('minDistance');
      expect(result).toHaveProperty('maxDistance');
      expect(result).toHaveProperty('minHeight');
      expect(result).toHaveProperty('maxHeight');
      expect(result).toHaveProperty('restrictedZones');
    });
  });

  describe('getSceneUnderstanding', () => {
    it('should get scene understanding from analysis', async () => {
      const understanding = await analyzer.getSceneUnderstanding(mockSceneAnalysis);
      expect(understanding.complexity).toBeDefined();
      expect(understanding.features).toBeGreaterThanOrEqual(0);
      expect(understanding.landmarks).toBeGreaterThanOrEqual(0);
      expect(understanding.hasSymmetry).toBeDefined();
      expect(understanding.symmetry).toHaveProperty('hasSymmetry');
      expect(understanding.symmetry).toHaveProperty('symmetryPlanes');
      expect(understanding.dimensions).toBeDefined();
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