# Environmental Analyzer

## Overview
The Environmental Analyzer is a core component of the Prompt-to-Path (P2P) pipeline that analyzes environmental factors and constraints within a 3D scene. It works in conjunction with the Scene Analyzer to provide comprehensive scene understanding for camera path generation.

## Features

### 1. Lighting Analysis
- Light source detection and classification
- Shadow mapping analysis
- Ambient light assessment
- Light intensity measurement

### 2. Material Analysis
- Material property extraction
- Texture mapping analysis
- Surface roughness assessment
- Reflectivity analysis

### 3. Environmental Constraints
- Occlusion detection
- Visibility analysis
- Viewport optimization
- Environmental hazards identification

### 4. Performance Optimization
- LOD (Level of Detail) analysis
- Memory usage optimization
- Render performance assessment
- Resource management

## Usage

### Basic Usage
```typescript
import { EnvironmentalAnalyzerImpl } from '@/features/p2p/environmental-analyzer/EnvironmentalAnalyzer';
import { EnvironmentalAnalyzerConfig } from '@/types/p2p';

// Create analyzer instance
const config: EnvironmentalAnalyzerConfig = {
  maxLightSources: 100,
  maxTextureSize: 2048,
  analysisOptions: {
    analyzeLighting: true,
    analyzeMaterials: true,
    detectOcclusions: true,
    optimizePerformance: true,
  },
  debug: false,
  performanceMonitoring: true,
  errorReporting: true,
};

const analyzer = new EnvironmentalAnalyzerImpl(config, logger);

// Analyze scene environment
const analysis = await analyzer.analyzeEnvironment(sceneAnalysis);

// Get lighting information
const lighting = await analyzer.getLightingAnalysis(analysis);

// Get material information
const materials = await analyzer.getMaterialAnalysis(analysis);

// Get environmental constraints
const constraints = await analyzer.getEnvironmentalConstraints(analysis);
```

### Advanced Usage
```typescript
// Analyze specific environmental aspects
const lightingAnalysis = await analyzer.analyzeLighting(scene);
const materialAnalysis = await analyzer.analyzeMaterials(scene);
const constraintAnalysis = await analyzer.analyzeConstraints(scene);

// Optimize scene for specific conditions
const optimizedScene = await analyzer.optimizeForConditions(scene, {
  preferredLighting: 'natural',
  materialQuality: 'high',
  performanceTarget: 'smooth',
});
```

## Integration

### Scene Analyzer Integration
```typescript
// Combine Scene and Environmental analysis
const sceneAnalysis = await sceneAnalyzer.analyzeScene(file);
const environmentalAnalysis = await environmentalAnalyzer.analyzeEnvironment(sceneAnalysis);

// Get comprehensive scene understanding
const understanding = {
  ...sceneAnalysis,
  environment: environmentalAnalysis,
};
```

### Viewer Integration
```typescript
// Apply environmental analysis to viewer
viewer.applyEnvironmentalAnalysis(environmentalAnalysis);

// Update viewer settings based on analysis
viewer.updateSettings({
  lighting: environmentalAnalysis.lighting,
  materials: environmentalAnalysis.materials,
  constraints: environmentalAnalysis.constraints,
});
```

## Performance Considerations

### 1. Memory Usage
- Efficient texture management
- Optimized light source tracking
- Smart material caching
- Resource cleanup

### 2. Processing Time
- Parallel analysis where possible
- Incremental updates
- Lazy loading of resources
- Background processing

### 3. Quality vs Performance
- Adaptive quality settings
- Dynamic LOD management
- Resource prioritization
- Performance monitoring

## Error Handling

### 1. Analysis Errors
- Graceful degradation
- Partial results handling
- Error recovery
- State preservation

### 2. Resource Errors
- Memory management
- Texture loading
- Light source limits
- Material constraints

## Future Enhancements

### 1. Planned Features
- Advanced lighting simulation
- Material PBR analysis
- Dynamic environment adaptation
- Real-time optimization

### 2. Research Areas
- AI-powered analysis
- Predictive optimization
- Adaptive quality control
- Performance profiling

## Related Documentation
- [Scene Analyzer Documentation](../scene-analyzer/README.md)
- [Viewer Integration Documentation](../viewer-integration/README.md)
- [Technical Design Document](../../../TECHNICAL_DESIGN.md)
- [Architecture Document](../ARCHITECTURE.md) 