# Scene Analyzer

## Overview
The Scene Analyzer is responsible for analyzing and understanding the 3D scene structure and spatial relationships. It processes GLB files to extract meaningful information that helps the Prompt Compiler and LLM Engine generate better camera paths.

## Interface

### Core Functions
```typescript
interface SceneAnalyzer {
  // Analyze a GLB file and extract scene information
  analyzeScene(glbFile: File): Promise<SceneAnalysis>;
  
  // Extract spatial reference points
  extractReferencePoints(scene: SceneAnalysis): Promise<ReferencePoints>;
  
  // Calculate safety boundaries
  calculateSafetyBoundaries(scene: SceneAnalysis): Promise<SafetyBoundaries>;
  
  // Get basic scene understanding
  getSceneUnderstanding(scene: SceneAnalysis): Promise<SceneUnderstanding>;
}
```

### Types
```typescript
interface SceneAnalysis {
  geometry: {
    vertices: Vector3[];
    faces: Face[];
    boundingBox: Box3;
  };
  materials: Material[];
  metadata: {
    name: string;
    version: string;
    generator: string;
  };
  spatialInfo: {
    center: Vector3;
    dimensions: Vector3;
    scale: number;
  };
}

interface ReferencePoints {
  center: Vector3;
  highest: Vector3;
  lowest: Vector3;
  leftmost: Vector3;
  rightmost: Vector3;
  frontmost: Vector3;
  backmost: Vector3;
}

interface SafetyBoundaries {
  minDistance: number;
  maxDistance: number;
  minHeight: number;
  maxHeight: number;
  restrictedZones: Box3[];
}

interface SceneUnderstanding {
  complexity: 'simple' | 'moderate' | 'complex';
  symmetry: {
    hasSymmetry: boolean;
    symmetryPlanes: Plane[];
  };
  features: {
    type: string;
    position: Vector3;
    description: string;
  }[];
}
```

## Implementation Details

### 1. GLB Processing
- Parse GLB file structure
- Extract geometry and materials
- Calculate basic spatial information
- Identify key features

### 2. Spatial Analysis
- Calculate bounding volumes
- Identify reference points
- Determine symmetry
- Analyze complexity

### 3. Safety Calculations
- Define safe camera distances
- Identify restricted zones
- Calculate height limits
- Set movement boundaries

### 4. Feature Extraction
- Identify key points
- Calculate spatial relationships
- Generate feature descriptions
- Track important landmarks

## Usage Examples

### Basic Usage
```typescript
const analyzer = new SceneAnalyzer();
const analysis = await analyzer.analyzeScene(glbFile);
const safety = await analyzer.calculateSafetyBoundaries(analysis);
```

### Advanced Usage
```typescript
const analysis = await analyzer.analyzeScene(glbFile);
const refPoints = await analyzer.extractReferencePoints(analysis);
const understanding = await analyzer.getSceneUnderstanding(analysis);
```

## Performance Considerations

### 1. Processing Efficiency
- Optimize GLB parsing
- Cache analysis results
- Lazy loading of features
- Memory management

### 2. Accuracy
- Precise spatial calculations
- Reliable feature detection
- Accurate safety boundaries
- Consistent reference points

## Testing

### 1. Unit Tests
- GLB parsing
- Spatial calculations
- Feature extraction
- Safety validation

### 2. Integration Tests
- Full scene analysis
- Reference point accuracy
- Safety boundary validation
- Performance benchmarks

## Future Improvements

### 1. Planned Features
- Advanced feature detection
- Better symmetry analysis
- Enhanced safety calculations
- Performance optimization

### 2. Research Areas
- GLB processing optimization
- Spatial analysis algorithms
- Feature detection methods
- Safety calculation improvements

## Related Components
- [Metadata Manager](../metadata-manager/README.md)
- [Prompt Compiler](../prompt-compiler/README.md)
- [Scene Interpreter](../scene-interpreter/README.md) 