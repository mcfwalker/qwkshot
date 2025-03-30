# Scene Analyzer

## Overview
The Scene Analyzer is a core component of the Prompt-to-Path (P2P) pipeline that analyzes 3D scenes to extract meaningful information for camera path generation. It processes GLB files to understand spatial relationships, identify features, and calculate safety boundaries.

## Features

### 1. GLB File Analysis
- File validation and parsing
- Geometry analysis (vertices, faces, bounding volumes)
- Material extraction
- Metadata processing

### 2. Spatial Analysis
- Bounding box and sphere calculations
- Reference point extraction (center, highest, lowest, etc.)
- Symmetry detection
- Complexity assessment

### 3. Safety Features
- Safe distance calculation
- Height restrictions
- Restricted zone identification
- Movement boundary validation

### 4. Feature Detection
- Key point identification
- Landmark detection
- Spatial relationship mapping
- Feature description generation

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

### 2. Spatial Analysis
- Calculates bounding volumes using Three.js Box3 and Sphere
- Identifies key reference points based on spatial bounds
- Detects symmetry planes (TODO)
- Assesses scene complexity based on geometry metrics

### 3. Safety Calculations
- Determines safe camera distances based on model size
- Sets height restrictions based on model bounds
- Identifies restricted zones for camera movement
- Validates movement constraints

### 4. Feature Detection
- Identifies key points in the scene
- Maps spatial relationships between features
- Generates descriptive information
- Tracks important landmarks

## Performance Considerations

### 1. Processing Efficiency
- Optimized GLB parsing
- Efficient spatial calculations
- Caching of analysis results
- Memory management

### 2. Accuracy
- Precise spatial measurements
- Reliable feature detection
- Accurate safety boundaries
- Consistent reference points

## Testing

### Unit Tests
- GLB file validation
- Spatial analysis accuracy
- Safety boundary calculation
- Feature detection reliability
- Performance metrics tracking

### Integration Tests
- Full scene analysis pipeline
- Reference point accuracy
- Safety constraint validation
- Performance benchmarks

## Future Improvements

### 1. Planned Features
- Advanced symmetry detection
- Enhanced feature recognition
- Improved safety calculations
- Better performance optimization

### 2. Research Areas
- GLB processing optimization
- Spatial analysis algorithms
- Feature detection methods
- Safety calculation improvements

## Related Components
- [Prompt Compiler](../prompt-compiler/README.md)
- [Metadata Manager](../metadata-manager/README.md)
- [Scene Interpreter](../scene-interpreter/README.md) 