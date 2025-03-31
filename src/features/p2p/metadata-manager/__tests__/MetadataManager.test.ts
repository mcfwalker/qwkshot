/// <reference types="jest" />

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Vector3 } from 'three';
import { MetadataManager } from '../MetadataManager';
import { DatabaseAdapter } from '../adapters/DatabaseAdapter';
import { CacheAdapter } from '../cache/CacheAdapter';
import { Logger } from '../../../../types/p2p/shared';
import {
  ModelMetadata,
  ModelFeaturePoint,
  UserPreferences,
  Orientation,
  ValidationError,
  NotFoundError,
  DatabaseError
} from '../../../../types/p2p/metadata-manager';

const testModelId = 'test-model-123';
const testUserId = 'test-user-123';

const mockMetadata: ModelMetadata = {
  id: testModelId,
  modelId: testModelId,
  userId: testUserId,
  file: 'test.glb',
  orientation: {
    position: new Vector3(0, 0, 0),
    rotation: new Vector3(0, 0, 0),
    scale: new Vector3(1, 1, 1)
  },
  featurePoints: [],
  preferences: {
    defaultCameraDistance: 5,
    defaultCameraHeight: 2,
    preferredViewAngles: [0, 45, 90],
    uiPreferences: {
      showGrid: true,
      showAxes: true,
      showMeasurements: true
    }
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1
};

// Mock dependencies
const mockLogger: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  performance: vi.fn()
};

const mockDatabase = {
  initialize: vi.fn().mockImplementation(() => Promise.resolve()),
  storeModelMetadata: vi.fn().mockImplementation(() => Promise.resolve()),
  getModelMetadata: vi.fn().mockImplementation(() => Promise.resolve(mockMetadata)),
  updateModelOrientation: vi.fn().mockImplementation(() => Promise.resolve()),
  addFeaturePoint: vi.fn().mockImplementation(() => Promise.resolve()),
  removeFeaturePoint: vi.fn().mockImplementation(() => Promise.resolve()),
  getFeaturePoints: vi.fn().mockImplementation(() => Promise.resolve([])),
  updateUserPreferences: vi.fn().mockImplementation(() => Promise.resolve()),
  modelExists: vi.fn().mockImplementation(() => Promise.resolve(true)),
  getFeaturePointCount: vi.fn().mockImplementation(() => Promise.resolve(0))
} as unknown as DatabaseAdapter;

const mockCache = {
  initialize: vi.fn().mockImplementation(() => Promise.resolve()),
  setModelMetadata: vi.fn().mockImplementation(() => Promise.resolve()),
  getModelMetadata: vi.fn().mockImplementation(() => Promise.resolve(null)),
  setFeaturePoints: vi.fn().mockImplementation(() => Promise.resolve()),
  getFeaturePoints: vi.fn().mockImplementation(() => Promise.resolve(null)),
  removeModelMetadata: vi.fn().mockImplementation(() => Promise.resolve()),
  removeFeaturePoints: vi.fn().mockImplementation(() => Promise.resolve()),
  clear: vi.fn().mockImplementation(() => Promise.resolve()),
  getStats: vi.fn().mockImplementation(() => ({ hits: 0, misses: 0, size: 0 }))
} as unknown as CacheAdapter;

describe('MetadataManager', () => {
  let manager: MetadataManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new MetadataManager(
      mockDatabase,
      mockCache,
      mockLogger,
      {
        cacheEnabled: true,
        cacheTTL: 5000,
        retryAttempts: 3
      }
    );
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await manager.initialize();
      expect(mockDatabase.initialize).toHaveBeenCalled();
      expect(mockCache.initialize).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('MetadataManager initialized successfully');
    });

    it('should handle initialization errors', async () => {
      const errorManager = new MetadataManager(
        mockDatabase,
        mockCache,
        mockLogger,
        {
          cacheEnabled: true,
          cacheTTL: 5000,
          retryAttempts: 3
        }
      );
      (mockDatabase.initialize as any).mockImplementation(() => Promise.reject(new Error('Database error')));
      await expect(errorManager.initialize()).rejects.toThrow('Database error');
      // Reset the mock implementation
      (mockDatabase.initialize as any).mockImplementation(() => Promise.resolve());
    });
  });

  describe('model metadata operations', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should store model metadata', async () => {
      await manager.storeModelMetadata(testModelId, {
        orientation: mockMetadata.orientation,
        preferences: mockMetadata.preferences
      });
      expect(mockDatabase.storeModelMetadata).toHaveBeenCalled();
      expect(mockCache.removeModelMetadata).toHaveBeenCalledWith(testModelId);
    });

    it('should get model metadata from cache when available', async () => {
      (mockCache.getModelMetadata as any).mockImplementation(() => Promise.resolve(mockMetadata));
      const result = await manager.getModelMetadata(testModelId);
      expect(result).toEqual(mockMetadata);
      expect(mockDatabase.getModelMetadata).not.toHaveBeenCalled();
    });

    it('should get model metadata from database when not in cache', async () => {
      (mockCache.getModelMetadata as any).mockImplementation(() => Promise.resolve(null));
      (mockDatabase.getModelMetadata as any).mockImplementation(() => Promise.resolve(mockMetadata));
      const result = await manager.getModelMetadata(testModelId);
      expect(result).toEqual(mockMetadata);
      expect(mockDatabase.getModelMetadata).toHaveBeenCalled();
      expect(mockCache.setModelMetadata).toHaveBeenCalled();
    });

    it('should handle database errors when getting metadata', async () => {
      (mockCache.getModelMetadata as any).mockImplementation(() => Promise.resolve(null));
      (mockDatabase.getModelMetadata as any).mockImplementation(() => Promise.reject(new DatabaseError('Database error')));
      await expect(manager.getModelMetadata(testModelId)).rejects.toThrow('Database error');
    });
  });

  describe('feature point operations', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    const mockFeaturePoint: ModelFeaturePoint = {
      id: 'feature-1',
      modelId: testModelId,
      userId: testUserId,
      type: 'landmark',
      position: new Vector3(1, 2, 3),
      description: 'Test feature point',
      measurements: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    };

    it('should add a feature point', async () => {
      await manager.addFeaturePoint(testModelId, {
        userId: testUserId,
        type: 'landmark',
        position: mockFeaturePoint.position,
        description: mockFeaturePoint.description,
        measurements: {}
      });
      expect(mockDatabase.addFeaturePoint).toHaveBeenCalled();
      expect(mockCache.removeFeaturePoints).toHaveBeenCalledWith(testModelId);
    });

    it('should get feature points from cache when available', async () => {
      (mockCache.getFeaturePoints as any).mockImplementation(() => Promise.resolve([mockFeaturePoint]));
      const result = await manager.getFeaturePoints(testModelId);
      expect(result).toEqual([mockFeaturePoint]);
      expect(mockDatabase.getFeaturePoints).not.toHaveBeenCalled();
    });

    it('should get feature points from database when not in cache', async () => {
      (mockCache.getFeaturePoints as any).mockImplementation(() => Promise.resolve(null));
      (mockDatabase.getFeaturePoints as any).mockImplementation(() => Promise.resolve([mockFeaturePoint]));
      const result = await manager.getFeaturePoints(testModelId);
      expect(result).toEqual([mockFeaturePoint]);
      expect(mockDatabase.getFeaturePoints).toHaveBeenCalled();
      expect(mockCache.setFeaturePoints).toHaveBeenCalled();
    });

    it('should remove a feature point', async () => {
      await manager.removeFeaturePoint(testModelId, 'feature-1');
      expect(mockDatabase.removeFeaturePoint).toHaveBeenCalled();
      expect(mockCache.removeFeaturePoints).toHaveBeenCalledWith(testModelId);
    });
  });

  describe('user preferences operations', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    const mockPreferences: UserPreferences = {
      defaultCameraDistance: 10,
      defaultCameraHeight: 3,
      preferredViewAngles: [0, 30, 60, 90],
      uiPreferences: {
        showGrid: false,
        showAxes: true,
        showMeasurements: true
      }
    };

    it('should update user preferences', async () => {
      await manager.updateUserPreferences(testModelId, mockPreferences);
      expect(mockDatabase.updateUserPreferences).toHaveBeenCalled();
      expect(mockCache.removeModelMetadata).toHaveBeenCalledWith(testModelId);
    });
  });

  describe('cache operations', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should get cache statistics', () => {
      (mockCache.getStats as any).mockImplementation(() => ({
        hits: 10,
        misses: 5,
        size: 15
      }));
      const stats = manager.getCacheStats();
      expect(stats).toEqual({
        hits: 10,
        misses: 5,
        size: 15
      });
    });

    it('should clear cache', async () => {
      await manager.clearCache();
      expect(mockCache.clear).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should handle not found errors', async () => {
      (mockCache.getModelMetadata as any).mockImplementation(() => Promise.resolve(null));
      (mockDatabase.getModelMetadata as any).mockImplementation(() => Promise.reject(new NotFoundError('Model not found')));
      await expect(manager.getModelMetadata(testModelId))
        .rejects.toThrow('Model not found');
    });

    it('should handle validation errors', async () => {
      (mockDatabase.addFeaturePoint as any).mockImplementation(() => Promise.reject(new ValidationError('Invalid feature point')));
      await expect(manager.addFeaturePoint(testModelId, {
        userId: testUserId,
        type: 'invalid-type' as any,
        position: new Vector3(),
        description: '',
        measurements: {}
      })).rejects.toThrow('Invalid feature point');
    });
  });
}); 