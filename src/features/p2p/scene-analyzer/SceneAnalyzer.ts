import { Vector3, Box3, Plane, Material, Object3D } from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  SceneAnalyzer,
  SceneAnalyzerConfig,
  GLBAnalysis,
  SpatialAnalysis,
  FeatureAnalysis,
  SceneAnalysis,
  ValidationResult,
  PerformanceMetrics,
  SafetyConstraints,
  Feature,
  Logger,
  Orientation,
} from '../../../types/p2p';
import { SceneAnalyzerError, GLBParseError, AnalysisError } from '../../../types/p2p/scene-analyzer';

/**
 * Implementation of the Scene Analyzer interface
 */
export class SceneAnalyzerImpl implements SceneAnalyzer {
  private config: SceneAnalyzerConfig;
  private logger: Logger;
  private metrics: PerformanceMetrics = {
    startTime: 0,
    endTime: 0,
    duration: 0,
    operations: [],
  };
  private gltfLoader: GLTFLoader;

  constructor(config: SceneAnalyzerConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.gltfLoader = new GLTFLoader();
  }

  async initialize(config: SceneAnalyzerConfig): Promise<void> {
    this.config = config;
    this.logger.info('Scene Analyzer initialized with config:', config);
  }

  async analyzeScene(file: File): Promise<SceneAnalysis> {
    const startTime = Date.now();
    this.metrics.startTime = startTime;

    try {
      // Validate file
      if (!this.isValidFile(file)) {
        throw new Error('Invalid file format or size');
      }

      // Load GLB file
      const gltf = await this.loadGLB(file);
      const scene = gltf.scene;

      // Perform GLB analysis
      const glbAnalysis = await this.analyzeGLB(gltf);

      // Perform spatial analysis
      const spatialAnalysis = await this.analyzeSpatial(scene);

      // Perform feature analysis
      const featureAnalysis = await this.analyzeFeatures(scene);

      // Calculate safety constraints
      const safetyConstraints = await this.calculateSafetyBoundaries({
        glb: glbAnalysis,
        spatial: spatialAnalysis,
        featureAnalysis,
        safetyConstraints: {} as SafetyConstraints,
        orientation: {} as Orientation,
        features: [],
        performance: {} as PerformanceMetrics,
      });

      // Calculate orientation
      const orientation = await this.calculateOrientation(scene);

      const endTime = Date.now();
      this.metrics.endTime = endTime;
      this.metrics.duration = endTime - startTime;

      return {
        glb: glbAnalysis,
        spatial: spatialAnalysis,
        featureAnalysis,
        safetyConstraints,
        orientation,
        features: featureAnalysis.features,
        performance: this.metrics,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Scene analysis failed:', new Error(errorMessage));
      throw new Error(errorMessage);
    }
  }

  async extractReferencePoints(scene: SceneAnalysis): Promise<SpatialAnalysis['referencePoints']> {
    const { spatial } = scene;
    const { bounds } = spatial;

    return {
      center: bounds.center.clone(),
      highest: new Vector3(bounds.center.x, bounds.max.y, bounds.center.z),
      lowest: new Vector3(bounds.center.x, bounds.min.y, bounds.center.z),
      leftmost: new Vector3(bounds.min.x, bounds.center.y, bounds.center.z),
      rightmost: new Vector3(bounds.max.x, bounds.center.y, bounds.center.z),
      frontmost: new Vector3(bounds.center.x, bounds.center.y, bounds.max.z),
      backmost: new Vector3(bounds.center.x, bounds.center.y, bounds.min.z),
    };
  }

  async calculateSafetyBoundaries(scene: SceneAnalysis): Promise<SafetyConstraints> {
    const { spatial } = scene;
    const { bounds } = spatial;
    const maxDimension = Math.max(
      bounds.dimensions.x,
      bounds.dimensions.y,
      bounds.dimensions.z
    );

    return {
      minDistance: maxDimension * 0.5,
      maxDistance: maxDimension * 5.0,
      minHeight: bounds.min.y,
      maxHeight: bounds.max.y * 1.5,
      restrictedZones: [],
    };
  }

  async getSceneUnderstanding(scene: SceneAnalysis): Promise<{
    complexity: SpatialAnalysis['complexity'];
    symmetry: SpatialAnalysis['symmetry'];
    features: FeatureAnalysis['features'];
  }> {
    const { spatial, featureAnalysis } = scene;

    // Calculate complexity based on vertex and face count
    const complexity = this.calculateComplexity(scene.glb.geometry);

    // Calculate symmetry
    const symmetry = await this.calculateSymmetry(scene);

    return {
      complexity,
      symmetry,
      features: featureAnalysis.features,
    };
  }

  validateAnalysis(analysis: SceneAnalysis): ValidationResult {
    const errors: string[] = [];

    // Validate GLB analysis
    if (!analysis.glb || !analysis.glb.geometry) {
      errors.push('Missing GLB analysis data');
    }

    // Validate spatial analysis
    if (!analysis.spatial || !analysis.spatial.bounds) {
      errors.push('Missing spatial analysis data');
    }

    // Validate safety constraints
    if (!analysis.safetyConstraints) {
      errors.push('Missing safety constraints');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // Private helper methods

  private isValidFile(file: File): boolean {
    if (file.size > this.config.maxFileSize) {
      throw new Error('File size exceeds maximum allowed size');
    }

    const format = file.type.toLowerCase();
    if (!this.config.supportedFormats.includes(format)) {
      throw new Error('Unsupported file format');
    }

    return true;
  }

  private async loadGLB(file: File): Promise<GLTF> {
    try {
      this.logger.debug('Starting GLB file load:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });

      // Get file content as ArrayBuffer
      const buffer = await file.arrayBuffer();
      this.logger.debug('Successfully read ArrayBuffer, size:', buffer.byteLength);

      try {
        // Create a data URL from the buffer
        const base64 = Buffer.from(buffer).toString('base64');
        const dataUrl = `data:model/gltf-binary;base64,${base64}`;
        
        // Load using the data URL
        const gltf = await this.gltfLoader.loadAsync(dataUrl);
        this.logger.debug('Successfully loaded GLB using data URL');
        return gltf;
      } catch (parseError) {
        const parseErrorMessage = parseError instanceof Error ? parseError.message : String(parseError);
        this.logger.error('Failed to parse GLB:', new Error(parseErrorMessage));
        throw new Error(parseErrorMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to load GLB file:', new Error(errorMessage));
      throw new Error(`Failed to load GLB file: ${errorMessage}`);
    }
  }

  private async analyzeGLB(gltf: GLTF): Promise<GLBAnalysis> {
    const scene = gltf.scene;
    const bbox = new Box3().setFromObject(scene);
    const size = new Vector3();
    bbox.getSize(size);
    const center = new Vector3();
    bbox.getCenter(center);

    return {
      fileInfo: {
        name: 'model.glb', // Default name since we can't access parser.path
        size: 0, // TODO: Get actual file size
        format: 'model/gltf-binary',
        version: gltf.parser.json.version,
      },
      geometry: {
        vertexCount: this.countVertices(scene),
        faceCount: this.countFaces(scene),
        boundingBox: bbox,
        center,
        dimensions: size,
      },
      materials: this.extractMaterials(scene),
      metadata: gltf.parser.json.asset || {},
      performance: {
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 0,
        operations: [],
      },
    };
  }

  private async analyzeSpatial(scene: Object3D): Promise<SpatialAnalysis> {
    const bbox = new Box3().setFromObject(scene);
    const size = new Vector3();
    bbox.getSize(size);
    const center = new Vector3();
    bbox.getCenter(center);

    return {
      bounds: {
        min: bbox.min.clone(),
        max: bbox.max.clone(),
        center: center.clone(),
        dimensions: size.clone(),
      },
      referencePoints: await this.extractReferencePoints({
        glb: {} as GLBAnalysis,
        spatial: {
          bounds: {
            min: bbox.min.clone(),
            max: bbox.max.clone(),
            center: center.clone(),
            dimensions: size.clone(),
          },
          referencePoints: {} as any,
          symmetry: { hasSymmetry: false, symmetryPlanes: [] },
          complexity: 'moderate',
          performance: {} as PerformanceMetrics,
        },
        featureAnalysis: {} as FeatureAnalysis,
        safetyConstraints: {} as SafetyConstraints,
        orientation: {} as Orientation,
        features: [],
        performance: {} as PerformanceMetrics,
      }),
      symmetry: {
        hasSymmetry: false,
        symmetryPlanes: [],
      },
      complexity: 'moderate',
      performance: {
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 0,
        operations: [],
      },
    };
  }

  private async analyzeFeatures(scene: Object3D): Promise<FeatureAnalysis> {
    // TODO: Implement feature detection
    return {
      features: [],
      landmarks: [],
      constraints: [],
      performance: {
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 0,
        operations: [],
      },
    };
  }

  private async calculateOrientation(scene: Object3D): Promise<Orientation> {
    const bbox = new Box3().setFromObject(scene);
    const center = new Vector3();
    bbox.getCenter(center);

    return {
      front: new Vector3(0, 0, 1),
      up: new Vector3(0, 1, 0),
      right: new Vector3(1, 0, 0),
      center: center.clone(),
      scale: 1.0,
    };
  }

  private calculateComplexity(geometry: GLBAnalysis['geometry']): SpatialAnalysis['complexity'] {
    const { vertexCount, faceCount } = geometry;
    const totalElements = vertexCount + faceCount;

    if (totalElements < 1000) return 'simple';
    if (totalElements < 10000) return 'moderate';
    return 'complex';
  }

  private async calculateSymmetry(scene: SceneAnalysis): Promise<SpatialAnalysis['symmetry']> {
    // TODO: Implement symmetry detection
    return {
      hasSymmetry: false,
      symmetryPlanes: [],
    };
  }

  private countVertices(scene: Object3D): number {
    let count = 0;
    scene.traverse((object) => {
      if ('geometry' in object) {
        const geometry = (object as any).geometry;
        if (geometry.attributes?.position) {
          count += geometry.attributes.position.count;
        }
      }
    });
    return count;
  }

  private countFaces(scene: Object3D): number {
    let count = 0;
    scene.traverse((object) => {
      if ('geometry' in object) {
        const geometry = (object as any).geometry;
        if (geometry.index) {
          count += geometry.index.count / 3;
        } else if (geometry.attributes?.position) {
          count += geometry.attributes.position.count / 3;
        }
      }
    });
    return count;
  }

  private extractMaterials(scene: Object3D): Material[] {
    const materials: Material[] = [];
    scene.traverse((object) => {
      if ('material' in object) {
        const material = (object as any).material;
        if (material && !materials.includes(material)) {
          materials.push(material);
        }
      }
    });
    return materials;
  }
} 