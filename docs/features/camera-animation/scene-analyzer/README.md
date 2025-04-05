# Scene Analyzer

## Overview
The Scene Analyzer is a core component of the Prompt-to-Path (P2P) pipeline that analyzes 3D scenes to extract meaningful information for camera path generation and animation. It processes GLB files to understand spatial relationships, identify features, calculate safety boundaries, and determine optimal camera start positions.

## Status
✅ **Current Status**: Fully functional
- Core analysis features working as expected
- Integration with Environmental Analyzer complete
- Performance metrics established
- Start position analysis implemented
- Animation path analysis implemented

## Features

### 1. GLB File Analysis
- File validation and parsing
- Geometry analysis (vertices, faces, bounding volumes)
- Material extraction
- Metadata processing
- Start position optimization
- Animation path validation

### 2. Spatial Analysis
- Bounding box and sphere calculations
- Reference point extraction (center, highest, lowest, etc.)
- Symmetry detection
- Complexity assessment
- Start position optimization
- Animation path boundaries

### 3. Safety Features
- Safe distance calculation
- Height restrictions
- Restricted zone identification
- Movement boundary validation
- Start position validation
- Animation path safety

### 4. Feature Detection
- Key point identification
- Landmark detection
- Spatial relationship mapping
- Feature description generation
- Start position landmarks
- Animation path features

## Integration

### Environmental Analyzer Integration
```typescript
// Analyze scene and prepare for environmental analysis
const sceneAnalysis = await sceneAnalyzer.analyzeScene(glbFile);

// Pass to environmental analyzer
const environmentalAnalysis = await environmentalAnalyzer.analyzeEnvironment(sceneAnalysis);

// Combine results
const comprehensiveAnalysis = {
  ...sceneAnalysis,
  environment: environmentalAnalysis,
  startPosition: sceneAnalysis.optimalStartPosition,
  animation: sceneAnalysis.animationConstraints
};
```

## Usage

### Basic Usage
```typescript
import { SceneAnalyzerImpl } from '@/features/p2p/scene-analyzer/SceneAnalyzer';
import { SceneAnalyzerConfig } from '@/types/p2p';

// Create analyzer instance
const config: SceneAnalyzerConfig = {
  maxFileSize: 100 * 1024 * 1024, // 100MB
  supportedFormats: ['model/gltf-binary'],
  analysisOptions: {
    extractFeatures: true,
    calculateSymmetry: true,
    analyzeMaterials: true,
    optimizeStartPosition: true,
    validateAnimationPath: true
  },
  debug: false,
  performanceMonitoring: true,
  errorReporting: true,
  maxRetries: 3,
  timeout: 30000,
};

const analyzer = new SceneAnalyzerImpl(config, logger);

// Analyze a GLB file
const analysis = await analyzer.analyzeScene(glbFile);

// Extract reference points
const points = await analyzer.extractReferencePoints(analysis);

// Calculate safety boundaries
const safety = await analyzer.calculateSafetyBoundaries(analysis);

// Get scene understanding
const understanding = await analyzer.getSceneUnderstanding(analysis);

// Get optimal start position
const startPosition = await analyzer.getOptimalStartPosition(analysis);

// Get animation constraints
const animationConstraints = await analyzer.getAnimationConstraints(analysis);
```

### Advanced Usage
```typescript
// Validate analysis results
const validation = analyzer.validateAnalysis(analysis);
if (!validation.isValid) {
  console.error('Analysis validation failed:', validation.errors);
}

// Get performance metrics
const metrics = analyzer.getPerformanceMetrics();
console.log('Analysis duration:', metrics.duration);

// Validate start position
const startPositionValidation = analyzer.validateStartPosition(analysis, startPosition);

// Validate animation path
const animationValidation = analyzer.validateAnimationPath(analysis, animationPath);
```

## Implementation Details

### 1. GLB Processing
- Uses Three.js GLTFLoader for file parsing
- Extracts geometry and material information
- Calculates basic spatial properties
- Processes metadata and version information
- Supports files up to 100MB
- Handles large files efficiently (tested with 21MB+ files)
- Reports accurate file sizes and formats
- Optimizes start position calculation
- Validates animation paths

### 2. Spatial Analysis
- Calculates bounding volumes using Three.js Box3 and Sphere
- Identifies key reference points based on spatial bounds
- Detects symmetry planes
- Assesses scene complexity based on geometry metrics
- Determines optimal start positions
- Calculates animation path boundaries

### 3. Safety Calculations
- Validates safe distances
- Enforces height restrictions
- Identifies restricted zones
- Calculates movement boundaries
- Validates start positions
- Ensures animation path safety

## Performance Considerations

### 1. File Size Handling
- Efficient memory usage
- Streaming for large files
- Progress reporting
- Error recovery
- Start position optimization
- Animation path optimization

### 2. Analysis Optimization
- Parallel processing where possible
- Caching of intermediate results
- Resource cleanup
- Memory management
- Start position caching
- Animation path caching

## Testing
The analyzer includes comprehensive tests covering:
- Basic GLB processing
- Spatial analysis accuracy
- Safety calculations
- Performance metrics
- Error handling
- Integration testing
- Start position validation
- Animation path validation

## Future Improvements
1. **Analysis Enhancement**
   - Advanced feature detection
   - Better symmetry analysis
   - Improved material understanding
   - Enhanced safety calculations
   - Improved start position optimization
   - Enhanced animation path analysis

2. **Performance Optimization**
   - Faster processing
   - Better memory usage
   - Improved caching
   - Enhanced error recovery
   - Optimized start position calculation
   - Optimized animation path validation

## Related Components
- Environmental Analyzer
- Metadata Manager
- Viewer Integration
- Camera Controller
- CameraAnimationSystem
- StartPositionHint 