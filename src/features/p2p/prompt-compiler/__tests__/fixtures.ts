import type { SceneAnalysis, ModelMetadata } from '../../../../types/p2p';
import { Vector3, Box3 } from 'three';

/**
 * Mock scene analysis data
 */
export const mockSceneAnalysis: SceneAnalysis = {
  glb: {
    fileInfo: {
      name: 'test.glb',
      size: 1024,
      format: 'model/gltf-binary',
      version: '2.0'
    },
    geometry: {
      vertexCount: 1000,
      faceCount: 500,
      boundingBox: new Box3(
        new Vector3(-1, -1, -1),
        new Vector3(1, 1, 1)
      ),
      center: new Vector3(0, 0, 0),
      dimensions: new Vector3(2, 2, 2)
    },
    materials: [],
    metadata: {},
    performance: {
      startTime: Date.now(),
      endTime: Date.now() + 100,
      duration: 100,
      operations: []
    }
  },
  spatial: {
    bounds: {
      min: new Vector3(-1, -1, -1),
      max: new Vector3(1, 1, 1),
      center: new Vector3(0, 0, 0),
      dimensions: new Vector3(2, 2, 2)
    },
    referencePoints: {
      center: new Vector3(0, 0, 0),
      highest: new Vector3(0, 1, 0),
      lowest: new Vector3(0, -1, 0),
      leftmost: new Vector3(-1, 0, 0),
      rightmost: new Vector3(1, 0, 0),
      frontmost: new Vector3(0, 0, 1),
      backmost: new Vector3(0, 0, -1)
    },
    symmetry: {
      hasSymmetry: true,
      symmetryPlanes: []
    },
    complexity: 'moderate',
    performance: {
      startTime: Date.now(),
      endTime: Date.now() + 50,
      duration: 50,
      operations: []
    }
  },
  featureAnalysis: {
    features: [{
      id: 'feature1',
      type: 'landmark',
      position: new Vector3(0, 1, 0),
      description: 'Top point'
    }],
    landmarks: [{
      id: 'landmark1',
      type: 'reference',
      position: new Vector3(1, 0, 0),
      description: 'Right side'
    }],
    constraints: [{
      id: 'constraint1',
      type: 'distance',
      position: new Vector3(0, 0, 1),
      description: 'Front view distance'
    }],
    performance: {
      startTime: Date.now(),
      endTime: Date.now() + 30,
      duration: 30,
      operations: []
    }
  },
  safetyConstraints: {
    minDistance: 0.5,
    maxDistance: 5.0,
    minHeight: -1.0,
    maxHeight: 2.0,
    restrictedZones: [
      new Box3(
        new Vector3(-2, -2, -2),
        new Vector3(-1.5, -1.5, -1.5)
      )
    ]
  },
  orientation: {
    front: new Vector3(0, 0, 1),
    up: new Vector3(0, 1, 0),
    right: new Vector3(1, 0, 0),
    center: new Vector3(0, 0, 0),
    scale: 1.0
  },
  features: [{
    id: 'main-feature',
    type: 'primary',
    position: new Vector3(0, 0, 1),
    description: 'Main viewing point'
  }],
  performance: {
    startTime: Date.now(),
    endTime: Date.now() + 180,
    duration: 180,
    operations: []
  }
};

/**
 * Mock model metadata
 */
export const mockModelMetadata: ModelMetadata = {
  id: 'test-model-1',
  modelId: 'test-model-1',
  userId: 'test-user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  version: '1.0.0',
  file: new File([], 'test.glb'),
  orientation: {
    front: new Vector3(0, 0, 1),
    up: new Vector3(0, 1, 0),
    right: new Vector3(1, 0, 0),
    center: new Vector3(0, 0, 0),
    scale: 1.0
  },
  featurePoints: [{
    id: 'feature1',
    type: 'landmark',
    position: new Vector3(0, 1, 0),
    description: 'Top point'
  }],
  preferences: {
    defaultCameraDistance: 5,
    preferredViewingAngles: [{
      position: new Vector3(0, 0, 5),
      target: new Vector3(0, 0, 0),
      description: 'Front view'
    }],
    safetyConstraints: {
      minDistance: 0.5,
      maxDistance: 5.0,
      minHeight: -1.0,
      maxHeight: 2.0,
      restrictedZones: [
        new Box3(
          new Vector3(-2, -2, -2),
          new Vector3(-1.5, -1.5, -1.5)
        )
      ]
    }
  }
}; 