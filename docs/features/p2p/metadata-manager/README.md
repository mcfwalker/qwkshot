# Metadata Manager

## Overview
The Metadata Manager is responsible for handling user-specified metadata and model information. It manages the storage and retrieval of model orientation, feature points, and other user-defined information that helps improve camera path generation.

## Interface

### Core Functions
```typescript
interface MetadataManager {
  // Store user metadata for a model
  storeModelMetadata(modelId: string, metadata: ModelMetadata): Promise<void>;
  
  // Retrieve metadata for a model
  getModelMetadata(modelId: string): Promise<ModelMetadata>;
  
  // Update model orientation
  updateModelOrientation(modelId: string, orientation: ModelOrientation): Promise<void>;
  
  // Manage feature points
  addFeaturePoint(modelId: string, point: FeaturePoint): Promise<void>;
  removeFeaturePoint(modelId: string, pointId: string): Promise<void>;
  getFeaturePoints(modelId: string): Promise<FeaturePoint[]>;
}
```

### Types
```typescript
interface ModelMetadata {
  modelId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  orientation: ModelOrientation;
  featurePoints: FeaturePoint[];
  preferences: UserPreferences;
}

interface ModelOrientation {
  front: Vector3;
  up: Vector3;
  right: Vector3;
  center: Vector3;
  scale: number;
}

interface FeaturePoint {
  id: string;
  name: string;
  position: Vector3;
  description: string;
  type: 'landmark' | 'reference' | 'constraint';
  createdAt: Date;
  updatedAt: Date;
}

interface UserPreferences {
  defaultCameraDistance: number;
  preferredViewingAngles: ViewingAngle[];
  safetyConstraints: SafetyConstraints;
}

interface ViewingAngle {
  position: Vector3;
  target: Vector3;
  description: string;
}

interface SafetyConstraints {
  minDistance: number;
  maxDistance: number;
  minHeight: number;
  maxHeight: number;
}
```

## Implementation Details

### 1. Database Integration
- Supabase table structure
- CRUD operations
- Data validation
- Error handling

### 2. Metadata Management
- Store and retrieve metadata
- Handle updates
- Version control
- Data consistency

### 3. Feature Point Handling
- Add/remove points
- Update positions
- Validate constraints
- Track changes

### 4. User Preferences
- Store defaults
- Handle updates
- Apply constraints
- Validate settings

## Usage Examples

### Basic Usage
```typescript
const manager = new MetadataManager();
await manager.storeModelMetadata(modelId, {
  orientation: {
    front: new Vector3(0, 0, 1),
    up: new Vector3(0, 1, 0),
    right: new Vector3(1, 0, 0),
    center: new Vector3(0, 0, 0),
    scale: 1.0
  }
});
```

### Advanced Usage
```typescript
const metadata = await manager.getModelMetadata(modelId);
await manager.addFeaturePoint(modelId, {
  name: 'Front Face',
  position: new Vector3(0, 0, 1),
  description: 'Main viewing angle',
  type: 'reference'
});
```

## Performance Considerations

### 1. Database Operations
- Efficient queries
- Caching strategy
- Batch updates
- Connection management

### 2. Data Management
- Memory usage
- Update frequency
- Validation overhead
- Cache invalidation

## Testing

### 1. Unit Tests
- Database operations
- Data validation
- Feature point handling
- Error cases

### 2. Integration Tests
- Full metadata flow
- Database consistency
- Performance benchmarks
- Error recovery

## Future Improvements

### 1. Planned Features
- Advanced metadata types
- Better validation
- Enhanced caching
- Performance optimization

### 2. Research Areas
- Database optimization
- Caching strategies
- Validation methods
- Performance improvements

## Related Components
- [Scene Analyzer](../scene-analyzer/README.md)
- [Prompt Compiler](../prompt-compiler/README.md)
- [Scene Interpreter](../scene-interpreter/README.md) 