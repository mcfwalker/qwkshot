# Metadata Manager

## Overview
The Metadata Manager is responsible for handling user-specified metadata and model information. It manages the storage and retrieval of model orientation, feature points, camera start positions, and other user-defined information that helps improve camera path generation.

## Status
⚠️ **Current Status**: Functional but needs refinement
- Complex data structure handling needs optimization
- Database integration requires enhancement
- Error handling needs improvement
- Camera start position handling implemented

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

  // Camera position management
  storeStartPosition(modelId: string, position: CameraPosition): Promise<void>;
  getStartPosition(modelId: string): Promise<CameraPosition | null>;
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
  camera?: {
    startPosition?: CameraPosition;
  };
  analysis?: {
    scene?: SceneAnalysis;
    environment?: EnvironmentalAnalysis;
  };
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

interface CameraPosition {
  position: Vector3;
  target: Vector3;
  fov: number;
  timestamp: Date;
}
```

## Known Issues
1. **Data Structure**
   - Complex nested structure causing storage issues
   - Analysis data persistence challenges
   - Type validation needs enhancement

2. **Database Integration**
   - Storage operation efficiency needs improvement
   - Error handling requires enhancement
   - Transaction management needs optimization

3. **Error Handling**
   - Enhanced error reporting needed
   - Recovery mechanisms require improvement
   - Validation needs strengthening

## Implementation Details

### 1. Database Integration
- Supabase table structure
- CRUD operations
- Data validation
- Error handling
- Transaction management
- Camera position storage and retrieval

### 2. Metadata Management
- Store and retrieve metadata
- Handle updates
- Version control
- Data consistency
- Analysis data integration
- Camera start position tracking

### 3. Feature Point Handling
- Add/remove points
- Update positions
- Validate constraints
- Track changes
- Error recovery

### 4. Camera Position Management
- Store start position
- Validate camera data
- Handle position updates
- Track position history
- Ensure data consistency

## Current Focus Areas
1. **Data Persistence**
   - Resolve storage issues
   - Optimize data structure
   - Enhance error handling
   - Improve logging

2. **Integration**
   - Refine database operations
   - Optimize data flow
   - Enhance error handling
   - Improve performance

## Usage Examples

### Basic Usage
```typescript
const manager = new MetadataManager();

// Store camera start position
await manager.storeStartPosition(modelId, {
  position: new Vector3(0, 2, 5),
  target: new Vector3(0, 0, 0),
  fov: 50,
  timestamp: new Date()
});

// Retrieve start position
const startPosition = await manager.getStartPosition(modelId);

// Store metadata with camera position
await manager.storeModelMetadata(modelId, {
  modelId,
  userId: 'user123',
  createdAt: new Date(),
  updatedAt: new Date(),
  orientation: {
    front: new Vector3(0, 0, 1),
    up: new Vector3(0, 1, 0),
    right: new Vector3(1, 0, 0),
    center: new Vector3(0, 0, 0),
    scale: 1
  },
  featurePoints: [],
  preferences: {
    defaultCameraDistance: 5,
    preferredViewingAngles: [],
    safetyConstraints: {
      minDistance: 1,
      maxDistance: 10,
      minHeight: 1,
      maxHeight: 5
    }
  },
  camera: {
    startPosition: startPosition
  }
});
```

## Testing
The manager includes comprehensive tests covering:
- Basic CRUD operations
- Complex data structure handling
- Error scenarios
- Performance metrics
- Integration testing
- Camera position management
- Start position validation

## Future Improvements
1. **Storage Optimization**
   - Simplify data structure
   - Enhance error handling
   - Improve logging
   - Optimize performance
   - Streamline camera data storage

2. **Integration Enhancement**
   - Better database coordination
   - Improved error handling
   - Enhanced logging
   - Performance optimization
   - Camera position synchronization

## Related Components
- Environmental Analyzer
- Scene Analyzer
- Viewer Integration
- Camera Controller
- Animation System 