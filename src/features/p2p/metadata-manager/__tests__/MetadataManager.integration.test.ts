/// <reference types="vitest" />

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Vector3 } from 'three';
import { MetadataManagerImpl as MetadataManager } from '../MetadataManager';
import { SupabaseAdapter } from '../adapters/SupabaseAdapter';
import { InMemoryCache } from '../cache/InMemoryCache';
import { Logger } from '../../../../types/p2p/shared';
import { ModelFeaturePoint, UserPreferences } from '../../../../types/p2p/metadata-manager';
import { Orientation } from '../../../../types/p2p/shared';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

// Mock browser APIs
class MockBroadcastChannel {
  constructor() {}
  postMessage() {}
  close() {}
  addEventListener() {}
  removeEventListener() {}
}

class MockEventTarget {
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true; }
}

global.BroadcastChannel = MockBroadcastChannel as any;
global.EventTarget = MockEventTarget as any;
global.location = { href: 'http://localhost:3000' } as any;

// Test configuration
const TEST_MODEL_ID = 'c0a80121-7ac0-4e1c-9d6f-e286d8c8e6d1';
const TEST_FILE_PATH = path.join(__dirname, 'test.glb');
const TEST_FILE_2_PATH = path.join(__dirname, 'test-2.glb');

// Create test files if they don't exist
if (!fs.existsSync(TEST_FILE_PATH)) {
  fs.writeFileSync(TEST_FILE_PATH, 'test file content');
}
if (!fs.existsSync(TEST_FILE_2_PATH)) {
  fs.writeFileSync(TEST_FILE_2_PATH, 'test file 2 content');
}

// Mock logger
const mockLogger: Logger = {
  info: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
  trace: console.trace,
  performance: console.log
};

// Test data
const testOrientation: Orientation = {
  position: new Vector3(1, 2, 3),
  rotation: new Vector3(45, 90, 180),
  scale: new Vector3(1, 1, 1),
};

const testPreferences: UserPreferences = {
  defaultCameraDistance: 10,
  defaultCameraHeight: 5,
  preferredViewAngles: [0, 90, 180],
  uiPreferences: {
    showGrid: true,
    showAxes: true,
    showMeasurements: false,
  },
};

const testFeaturePoint: Omit<ModelFeaturePoint, 'id' | 'modelId' | 'createdAt' | 'updatedAt' | 'version'> = {
  type: 'landmark',
  position: new Vector3(1, 2, 3),
  description: 'Test point',
  measurements: {
    distance: 10,
  },
  userId: '',
};

// Skip this entire suite for now as it requires environment variables/real DB connection
describe.skip('MetadataManager Integration Tests', () => {
  let manager: MetadataManager;
  let supabaseClient: any;
  let userId: string;

  beforeAll(async () => {
    // Initialize Supabase client
    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Sign in with test user
    const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
      email: process.env.TEST_USER_EMAIL!,
      password: process.env.TEST_USER_PASSWORD!,
    });

    if (signInError) {
      throw new Error(`Failed to sign in test user: ${signInError.message}`);
    }

    if (!signInData?.user?.id) {
      throw new Error('Failed to get user ID after sign in');
    }

    userId = signInData.user.id;

    // Initialize test feature point with the authenticated user's ID
    testFeaturePoint.userId = userId;

    // Initialize adapters
    const dbAdapter = new SupabaseAdapter(
      {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
      mockLogger
    );

    const cacheAdapter = new InMemoryCache(
      {
        defaultTTL: 5000,
        maxSize: 100,
        cleanupInterval: 60000,
      },
      mockLogger
    );

    // Initialize MetadataManager
    manager = new MetadataManager(dbAdapter, cacheAdapter, mockLogger);
    await manager.initialize();

    // Create test model
    const { error: modelError } = await supabaseClient
      .from('models')
      .upsert({
        id: TEST_MODEL_ID,
        user_id: userId,
        name: 'Test Model',
        file_url: TEST_FILE_PATH,
        metadata: {
          p2p: {
            orientation: testOrientation,
            preferences: testPreferences,
          },
        },
      });

    if (modelError) {
      throw new Error(`Failed to create test model: ${modelError.message}`);
    }
  });

  afterAll(async () => {
    // Clean up test data
    await supabaseClient.from('feature_points').delete().eq('model_id', TEST_MODEL_ID);
    await supabaseClient.from('models').delete().eq('id', TEST_MODEL_ID);
    await supabaseClient.auth.signOut();

    // Clean up test files
    if (fs.existsSync(TEST_FILE_PATH)) {
      fs.unlinkSync(TEST_FILE_PATH);
    }
    if (fs.existsSync(TEST_FILE_2_PATH)) {
      fs.unlinkSync(TEST_FILE_2_PATH);
    }
  });

  beforeEach(async () => {
    console.log('Cleared all cached data');
    await manager.clearCache();
    console.log('Cache cleared');
    
    // Clean up feature points before each test
    await supabaseClient.from('feature_points').delete().eq('model_id', TEST_MODEL_ID);
  });

  describe('Model Metadata Operations', () => {
    it('should store and retrieve model metadata', async () => {
      await manager.storeModelMetadata(TEST_MODEL_ID, {
        orientation: testOrientation,
        preferences: testPreferences,
      });

      const metadata = await manager.getModelMetadata(TEST_MODEL_ID);

      expect(metadata).toBeDefined();
      expect(metadata.modelId).toBe(TEST_MODEL_ID);
      expect(metadata.userId).toBe(userId);
      expect(metadata.orientation).toEqual(testOrientation);
      expect(metadata.preferences).toEqual(testPreferences);
    });

    it('should update model orientation', async () => {
      const newOrientation: Orientation = {
        position: new Vector3(4, 5, 6),
        rotation: new Vector3(30, 60, 90),
        scale: new Vector3(2, 2, 2),
      };

      await manager.updateModelOrientation(TEST_MODEL_ID, newOrientation);
      const metadata = await manager.getModelMetadata(TEST_MODEL_ID);

      expect(metadata.orientation).toEqual(newOrientation);
    });
  });

  describe('Feature Point Operations', () => {
    it('should add and retrieve feature points', async () => {
      try {
        await manager.addFeaturePoint(TEST_MODEL_ID, testFeaturePoint);
        const points = await manager.getFeaturePoints(TEST_MODEL_ID);

        expect(points).toHaveLength(1);
        expect(points[0].modelId).toBe(TEST_MODEL_ID);
        expect(points[0].userId).toBe(userId);
        expect(points[0].position).toEqual(testFeaturePoint.position);
      } catch (error) {
        console.error('Feature point test failed:', error);
        throw error;
      }
    });

    it('should remove feature points', async () => {
      try {
        await manager.addFeaturePoint(TEST_MODEL_ID, testFeaturePoint);
        const points = await manager.getFeaturePoints(TEST_MODEL_ID);
        expect(points).toHaveLength(1);

        await manager.removeFeaturePoint(TEST_MODEL_ID, points[0].id);
        const updatedPoints = await manager.getFeaturePoints(TEST_MODEL_ID);
        expect(updatedPoints).toHaveLength(0);
      } catch (error) {
        console.error('Feature point removal test failed:', error);
        throw error;
      }
    });
  });

  describe('User Preferences Operations', () => {
    it('should update and retrieve user preferences', async () => {
      const newPreferences: UserPreferences = {
        defaultCameraDistance: 15,
        defaultCameraHeight: 8,
        preferredViewAngles: [30, 60, 120],
        uiPreferences: {
          showGrid: false,
          showAxes: true,
          showMeasurements: true,
        },
      };

      await manager.updateUserPreferences(TEST_MODEL_ID, newPreferences);
      const metadata = await manager.getModelMetadata(TEST_MODEL_ID);

      expect(metadata.preferences).toEqual(newPreferences);
    });
  });

  describe('Cache Operations', () => {
    it('should use cache for repeated operations', async () => {
      const metadata1 = await manager.getModelMetadata(TEST_MODEL_ID);
      const metadata2 = await manager.getModelMetadata(TEST_MODEL_ID);

      expect(metadata1).toEqual(metadata2);
    });

    it('should invalidate cache on updates', async () => {
      const originalMetadata = await manager.getModelMetadata(TEST_MODEL_ID);

      const newPreferences: UserPreferences = {
        ...originalMetadata.preferences,
        defaultCameraDistance: 20,
      };

      await manager.updateUserPreferences(TEST_MODEL_ID, newPreferences);
      const updatedMetadata = await manager.getModelMetadata(TEST_MODEL_ID);

      expect(updatedMetadata.preferences.defaultCameraDistance).toBe(20);
    });
  });
}); 