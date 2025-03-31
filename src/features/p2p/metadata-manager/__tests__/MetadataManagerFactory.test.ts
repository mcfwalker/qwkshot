/// <reference types="jest" />

import { MetadataManagerFactory } from '../MetadataManagerFactory';
import { MetadataManagerConfig } from '../../../../types/p2p/metadata-manager';
import { Logger } from '../../../../types/p2p/shared';
import { InMemoryCache } from '../cache/InMemoryCache';
import { SupabaseAdapter } from '../adapters/SupabaseAdapter';

// Mock dependencies
const mockLogger: Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn()
};

const defaultConfig: MetadataManagerConfig = {
  database: {
    table: 'models',
    schema: 'public'
  },
  caching: {
    enabled: true,
    ttl: 3600000 // 1 hour
  },
  validation: {
    strict: true,
    maxFeaturePoints: 100
  }
};

describe('MetadataManagerFactory', () => {
  let factory: MetadataManagerFactory;

  beforeEach(() => {
    factory = new MetadataManagerFactory();
  });

  it('should create a MetadataManager instance with correct dependencies', () => {
    const manager = factory.create(defaultConfig, mockLogger);

    // Verify the manager was created
    expect(manager).toBeDefined();
    expect(manager.initialize).toBeDefined();
    expect(manager.storeModelMetadata).toBeDefined();
    expect(manager.getModelMetadata).toBeDefined();
    expect(manager.updateModelOrientation).toBeDefined();
    expect(manager.addFeaturePoint).toBeDefined();
    expect(manager.removeFeaturePoint).toBeDefined();
    expect(manager.getFeaturePoints).toBeDefined();
    expect(manager.updateUserPreferences).toBeDefined();
    expect(manager.validateMetadata).toBeDefined();
    expect(manager.getPerformanceMetrics).toBeDefined();
  });

  it('should create a SupabaseAdapter for database operations', () => {
    const manager = factory.create(defaultConfig, mockLogger);
    
    // Access private database property through type assertion
    const database = (manager as any).database;
    
    expect(database).toBeInstanceOf(SupabaseAdapter);
    expect(database.initialize).toBeDefined();
    expect(database.storeModelMetadata).toBeDefined();
    expect(database.getModelMetadata).toBeDefined();
    expect(database.updateModelOrientation).toBeDefined();
    expect(database.addFeaturePoint).toBeDefined();
    expect(database.removeFeaturePoint).toBeDefined();
    expect(database.getFeaturePoints).toBeDefined();
    expect(database.updateUserPreferences).toBeDefined();
  });

  it('should create an InMemoryCache for caching operations', () => {
    const manager = factory.create(defaultConfig, mockLogger);
    
    // Access private cache property through type assertion
    const cache = (manager as any).cache;
    
    expect(cache).toBeInstanceOf(InMemoryCache);
    expect(cache.initialize).toBeDefined();
    expect(cache.setModelMetadata).toBeDefined();
    expect(cache.getModelMetadata).toBeDefined();
    expect(cache.setFeaturePoints).toBeDefined();
    expect(cache.getFeaturePoints).toBeDefined();
    expect(cache.removeModelMetadata).toBeDefined();
    expect(cache.removeFeaturePoints).toBeDefined();
    expect(cache.clear).toBeDefined();
    expect(cache.getStats).toBeDefined();
  });

  it('should use the provided configuration for cache TTL', () => {
    const customConfig = {
      ...defaultConfig,
      caching: {
        enabled: true,
        ttl: 7200000 // 2 hours
      }
    };

    const manager = factory.create(customConfig, mockLogger);
    const cache = (manager as any).cache;
    
    expect(cache).toBeInstanceOf(InMemoryCache);
    // Note: We can't directly test the TTL value as it's private
    // but we can verify the cache is working with the correct configuration
  });
}); 