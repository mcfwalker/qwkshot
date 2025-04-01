/// <reference types="jest" />

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Vector3 } from 'three';
import { MetadataManagerImpl } from '../MetadataManager';
import { DatabaseAdapter } from '../adapters/DatabaseAdapter';
import { CacheAdapter } from '../cache/CacheAdapter';
import { MetadataManagerConfig, ModelMetadata, UserPreferences, ModelFeaturePoint, NotFoundError, DatabaseError, ValidationError } from '../../../../types/p2p/metadata-manager';
import { Orientation, Logger } from '../../../../types/p2p/shared';

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

// Mocks using `as unknown as` and plain vi.fn()
const mockDatabase = {
    initialize: vi.fn(),
    getModelMetadata: vi.fn(),
    storeModelMetadata: vi.fn(),
    updateModelOrientation: vi.fn(),
    addFeaturePoint: vi.fn(),
    removeFeaturePoint: vi.fn(),
    getFeaturePoints: vi.fn(),
    updateUserPreferences: vi.fn(),
    modelExists: vi.fn(),
    getFeaturePointCount: vi.fn(),
} as unknown as DatabaseAdapter;

const mockCache = {
    initialize: vi.fn(),
    getModelMetadata: vi.fn(),
    setModelMetadata: vi.fn(),
    removeModelMetadata: vi.fn(),
    getFeaturePoints: vi.fn(),
    setFeaturePoints: vi.fn(),
    removeFeaturePoints: vi.fn(),
    clear: vi.fn(),
    getStats: vi.fn().mockReturnValue({ hits: 0, misses: 0, size: 0 }),
} as unknown as CacheAdapter;

const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    performance: vi.fn(),
} as unknown as Logger;

// Config (using proper types)
const testConfig: MetadataManagerConfig = {
  database: {
    type: 'supabase',
    url: 'test-url',
    key: 'test-key'
  },
  caching: {
    enabled: true,
    ttl: 5000
  },
  validation: {
    strict: true,
    maxFeaturePoints: 50
  },
  debug: false,
  performance: {
    enabled: false,
    logInterval: 0
  }
};

// Skip this entire suite due to unresolved import path errors
describe('MetadataManager', () => {
  let manager: MetadataManagerImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    // Instantiate with explicitly typed mocks
    manager = new MetadataManagerImpl(
      mockDatabase,
      mockCache,
      mockLogger,
      testConfig
    );
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      // Mock resolved values for initialize
      (mockDatabase.initialize as Mock).mockResolvedValue(undefined);
      (mockCache.initialize as Mock).mockResolvedValue(undefined);

      await manager.initialize();
      expect(mockDatabase.initialize).toHaveBeenCalled();
      expect(mockCache.initialize).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('initialized successfully'));
    });

    it('should handle initialization errors', async () => {
        const dbError = new Error('DB Init Failed');
        // Mock rejected value for db initialize
        (mockDatabase.initialize as Mock).mockRejectedValue(dbError);
        (mockCache.initialize as Mock).mockResolvedValue(undefined); // Cache init succeeds

        await expect(manager.initialize()).rejects.toThrow(dbError);
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