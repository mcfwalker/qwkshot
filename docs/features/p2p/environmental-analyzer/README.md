# Environmental Analyzer

## Overview
The Environmental Analyzer is a core component of the Prompt-to-Path (P2P) pipeline that analyzes the spatial environment around a 3D object. It works in conjunction with the Scene Analyzer to provide precise measurements and constraints for camera path generation. The environment is modeled as a cubed volume with the object centered on its floor plane.

## Features

### 1. Environment Analysis
- Environment bounds calculation
- Object positioning and dimensions
- Distance measurements from object to boundaries
- Camera positioning constraints

### 2. Spatial Measurements
- Object bounding box analysis
- Reference point calculations
- Distance to boundary measurements
- Height-based constraints

### 3. Camera Constraints
- Minimum and maximum camera heights
- Safe distance calculations
- Movement boundary validation
- Position constraints

## Usage

### Basic Usage
```typescript
import { EnvironmentalAnalyzerImpl } from '@/features/p2p/environmental-analyzer/EnvironmentalAnalyzer';
import { EnvironmentalAnalyzerConfig } from '@/types/p2p';

// Create analyzer instance
const config: EnvironmentalAnalyzerConfig = {
  environmentSize: {
    width: 100,  // Environment width in units
    height: 100, // Environment height in units
    depth: 100   // Environment depth in units
  },
  analysisOptions: {
    calculateDistances: true,
    validateConstraints: true,
    optimizeCameraSpace: true
  },
  debug: false,
  performanceMonitoring: true,
  errorReporting: true
};

const analyzer = new EnvironmentalAnalyzerImpl(config, logger);

// Analyze environment with scene analysis
const analysis = await analyzer.analyzeEnvironment(sceneAnalysis);

// Get environment measurements
const measurements = await analyzer.getEnvironmentMeasurements(analysis);

// Get camera constraints
const constraints = await analyzer.getCameraConstraints(analysis);
```

### Advanced Usage
```typescript
// Get detailed distance measurements
const distances = await analyzer.getDistanceMeasurements(analysis);

// Validate camera position
const isValid = await analyzer.validateCameraPosition(analysis, {
  position: new Vector3(10, 5, 10),
  target: new Vector3(0, 0, 0)
});

// Get recommended camera ranges
const ranges = await analyzer.getCameraRanges(analysis);
```

## Integration

### Scene Analyzer Integration
```typescript
// Combine Scene and Environmental analysis
const sceneAnalysis = await sceneAnalyzer.analyzeScene(file);
const environmentalAnalysis = await environmentalAnalyzer.analyzeEnvironment(sceneAnalysis);

// Get comprehensive spatial understanding
const understanding = {
  ...sceneAnalysis,
  environment: environmentalAnalysis,
};
```

### Viewer Integration
```typescript
// Apply environmental constraints to viewer
viewer.applyEnvironmentalConstraints(environmentalAnalysis);

// Update viewer settings based on analysis
viewer.updateSettings({
  cameraConstraints: environmentalAnalysis.cameraConstraints,
  movementBounds: environmentalAnalysis.movementBounds,
  heightLimits: environmentalAnalysis.heightLimits,
});
```

## Implementation Details

### 1. Environment Structure
- Cubed volume environment
- Object centered on floor plane (z=0)
- Clear boundary definitions
- Reference point system

### 2. Distance Calculations
- Object to boundary distances
- Safe camera distances
- Height constraints
- Movement boundaries

### 3. Camera Constraints
- Height-based limits
- Distance-based limits
- Movement restrictions
- Position validation

## Performance Considerations

### 1. Calculation Efficiency
- Optimized distance calculations
- Efficient boundary checks
- Cached measurements
- Lazy evaluation

### 2. Memory Usage
- Minimal data structures
- Efficient vector operations
- Clean resource management
- Optimized caching

## Error Handling

### 1. Validation Errors
- Invalid camera positions
- Out of bounds movements
- Constraint violations
- Measurement errors

### 2. Resource Errors
- Memory management
- Calculation failures
- Validation failures
- State preservation

## Future Enhancements

### 1. Planned Features
- Dynamic environment scaling
- Adaptive constraints
- Performance optimization
- Enhanced validation

### 2. Research Areas
- Optimal camera positioning
- Path optimization
- Constraint relaxation
- Performance profiling

## Related Documentation
- [Scene Analyzer Documentation](../scene-analyzer/README.md)
- [Viewer Integration Documentation](../viewer-integration/README.md)
- [Technical Design Document](../../../TECHNICAL_DESIGN.md)
- [Architecture Document](../ARCHITECTURE.md) 