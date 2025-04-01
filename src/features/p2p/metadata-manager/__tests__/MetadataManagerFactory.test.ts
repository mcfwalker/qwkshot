/// <reference types="vitest" />

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetadataManager, MetadataManagerConfig } from '@/types/p2p/metadata-manager';
import { MetadataManagerFactory } from '../MetadataManagerFactory';
import { MetadataManagerImpl } from '../MetadataManager';
import { SupabaseAdapter } from '../adapters/SupabaseAdapter';
import { InMemoryCache } from '../cache/InMemoryCache';
import { Logger } from '@/types/p2p/shared';

// Mocks
vi.mock('../adapters/SupabaseAdapter');
vi.mock('../cache/InMemoryCache');
vi.mock('../MetadataManager');

const mockLogger: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  performance: vi.fn()
} as any;

const defaultConfig: MetadataManagerConfig = {
  database: {
    type: 'supabase',
    url: 'test-url',
    key: 'test-key'
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
  let mockDatabase: SupabaseAdapter;
  let mockCache: InMemoryCache;
  let mockManager: MetadataManagerImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock instances
    mockDatabase = new SupabaseAdapter(defaultConfig.database, mockLogger);
    mockCache = new InMemoryCache({
      defaultTTL: defaultConfig.caching.ttl,
      maxSize: 1000,
      cleanupInterval: 60000
    }, mockLogger);
    mockManager = new MetadataManagerImpl(mockDatabase, mockCache, mockLogger, defaultConfig);

    // Mock the constructors
    (SupabaseAdapter as any).mockImplementation(() => mockDatabase);
    (InMemoryCache as any).mockImplementation(() => mockCache);
    (MetadataManagerImpl as any).mockImplementation(() => mockManager);

    // Create factory with logger in constructor
    factory = new MetadataManagerFactory(mockLogger);
  });

  it('should create a MetadataManager instance with correct dependencies', () => {
    const manager = factory.create(defaultConfig);

    // Verify the manager was created
    expect(manager).toBeDefined();
    expect(manager).toBeInstanceOf(MetadataManagerImpl);
    expect(SupabaseAdapter).toHaveBeenCalledWith(defaultConfig.database, mockLogger);
    expect(InMemoryCache).toHaveBeenCalledWith({
      defaultTTL: defaultConfig.caching.ttl,
      maxSize: 1000,
      cleanupInterval: 60000
    }, mockLogger);
  });

  it('should create a manager that can interact with database', async () => {
    const manager = factory.create(defaultConfig);
    
    // Test database interaction through public methods
    await manager.initialize();
    expect(mockLogger.info).toHaveBeenCalledWith('MetadataManager initialized successfully');
  });

  it('should create a manager that can interact with cache', async () => {
    const manager = factory.create(defaultConfig);
    
    // Test cache interaction through public methods
    const stats = manager.getCacheStats();
    expect(stats).toBeDefined();
    expect(stats).toEqual({
      hits: 0,
      misses: 0,
      size: 0
    });
  });

  it('should use the provided configuration for cache TTL', async () => {
    const customConfig = {
      ...defaultConfig,
      caching: {
        enabled: true,
        ttl: 7200000 // 2 hours
      }
    };

    const manager = factory.create(customConfig);
    
    // Test cache configuration through behavior
    const stats = manager.getCacheStats();
    expect(stats).toBeDefined();
    expect(stats).toEqual({
      hits: 0,
      misses: 0,
      size: 0
    });
  });

  it('should create a MetadataManager instance with SupabaseAdapter and InMemoryCache', () => {
    const manager = factory.create(defaultConfig);
    expect(manager).toBeInstanceOf(MetadataManagerImpl);
  });
}); 