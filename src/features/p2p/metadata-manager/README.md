# Metadata Manager

The Metadata Manager is a core component of the P2P pipeline that handles the storage, retrieval, and management of model metadata. It provides a robust interface for managing model data, feature points, and user preferences while ensuring data consistency and performance through caching.

## Features

- **Model Metadata Management**: Store and retrieve metadata for 3D models
- **Feature Point Management**: Add, remove, and query feature points on models
- **User Preferences**: Manage user-specific viewing preferences
- **Caching Layer**: In-memory caching for improved performance
- **Database Integration**: Supabase integration for persistent storage
- **Performance Metrics**: Track and monitor operation performance
- **Validation**: Built-in validation for data integrity
- **Error Handling**: Comprehensive error handling and logging

## Architecture

The Metadata Manager follows a modular architecture with the following components:

### Core Components

- **MetadataManager**: Main class that orchestrates all operations
- **DatabaseAdapter**: Interface for database operations
- **CacheAdapter**: Interface for caching operations
- **MetadataManagerFactory**: Factory for creating MetadataManager instances

### Adapters

- **SupabaseAdapter**: Implementation of DatabaseAdapter for Supabase
- **InMemoryCache**: Implementation of CacheAdapter for in-memory caching

## Usage

### Basic Usage

```typescript
import { MetadataManagerFactory } from './MetadataManagerFactory';
import { Logger } from '../../types/p2p/shared';

// Create a logger instance
const logger: Logger = {
  info: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
  trace: console.trace
};

// Create configuration
const config = {
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

// Create MetadataManager instance
const factory = new MetadataManagerFactory();
const manager = factory.create(config, logger);

// Initialize the manager
await manager.initialize();

// Store model metadata
await manager.storeModelMetadata('model-1', {
  modelId: 'model-1',
  userId: 'user-1',
  file: 'model.glb',
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
  }
});

// Retrieve model metadata
const metadata = await manager.getModelMetadata('model-1');

// Add feature point
await manager.addFeaturePoint('model-1', {
  modelId: 'model-1',
  userId: 'user-1',
  type: 'landmark',
  position: new Vector3(1, 2, 3),
  description: 'Important point'
});

// Update user preferences
await manager.updateUserPreferences('model-1', {
  defaultCameraDistance: 10,
  defaultCameraHeight: 3,
  preferredViewAngles: [0, 30, 60, 90],
  uiPreferences: {
    showGrid: false,
    showAxes: true,
    showMeasurements: true
  }
});
```

### Error Handling

The Metadata Manager provides comprehensive error handling:

```typescript
try {
  await manager.storeModelMetadata('model-1', metadata);
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation errors
  } else if (error instanceof DatabaseError) {
    // Handle database errors
  } else if (error instanceof NotFoundError) {
    // Handle not found errors
  } else {
    // Handle other errors
  }
}
```

### Performance Monitoring

You can monitor the performance of operations:

```typescript
// Get performance metrics
const metrics = manager.getPerformanceMetrics();
console.log('Cache hits:', metrics.cacheHits);
console.log('Cache misses:', metrics.cacheMisses);
console.log('Database queries:', metrics.databaseQueries);
console.log('Average response time:', metrics.averageResponseTime);
```

## Configuration

### Database Configuration

```typescript
{
  database: {
    table: string;    // Database table name
    schema: string;   // Database schema name
  }
}
```

### Caching Configuration

```typescript
{
  caching: {
    enabled: boolean; // Whether caching is enabled
    ttl: number;      // Cache time-to-live in milliseconds
  }
}
```

### Validation Configuration

```typescript
{
  validation: {
    strict: boolean;      // Whether to enforce strict validation
    maxFeaturePoints: number; // Maximum number of feature points per model
  }
}
```

## Testing

The Metadata Manager includes comprehensive tests:

```bash
# Run tests
npm test

# Run tests with coverage
npm test -- --coverage
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 