import { Vector3, Box3, Plane, Material, Object3D, Euler } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
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
import * as THREE from 'three';

interface GeometricData {
  position: Vector3;
  rotation: Euler;
  scale: Vector3;
  boundingBox: Box3;
  vertices: number;
  faces: number;
}

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
  private geometricData: GeometricData[] = [];
  private sceneDimensions: { width: number; height: number; depth: number; center: Vector3 } | null = null;

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
    this.metrics.operations = [];

    try {
      // Validate file
      const validateStart = Date.now();
      if (!this.isValidFile(file)) {
        throw new Error('Invalid file format or size');
      }
      this.metrics.operations.push({
        name: 'validateFile',
        duration: Date.now() - validateStart,
        success: true
      });

      // Load GLB file
      const loadStart = Date.now();
      const gltf = await this.loadGLB(file);
      this.metrics.operations.push({
        name: 'loadGLB',
        duration: Date.now() - loadStart,
        success: true
      });

      const scene = gltf.scene;

      // Add file size to GLTF metadata
      gltf.parser.json.asset = {
        ...gltf.parser.json.asset,
        name: file.name,
        size: file.size,
      };

      // Perform GLB analysis
      const glbStart = Date.now();
      const glbAnalysis = await this.analyzeGLB(gltf);
      this.metrics.operations.push({
        name: 'analyzeGLB',
        duration: Date.now() - glbStart,
        success: true
      });

      // Perform spatial analysis
      const spatialStart = Date.now();
      const spatialAnalysis = await this.analyzeSpatial(scene);
      this.metrics.operations.push({
        name: 'analyzeSpatial',
        duration: Date.now() - spatialStart,
        success: true
      });

      // Perform feature analysis
      const featureStart = Date.now();
      const featureAnalysis = await this.analyzeFeatures(scene);
      this.metrics.operations.push({
        name: 'analyzeFeatures',
        duration: Date.now() - featureStart,
        success: true
      });

      // Calculate safety constraints
      const safetyStart = Date.now();
      const safetyConstraints = await this.calculateSafetyBoundaries({
        glb: glbAnalysis,
        spatial: spatialAnalysis,
        featureAnalysis,
        safetyConstraints: {} as SafetyConstraints,
        orientation: {} as Orientation,
        features: [],
        performance: {} as PerformanceMetrics,
      });
      this.metrics.operations.push({
        name: 'calculateSafetyBoundaries',
        duration: Date.now() - safetyStart,
        success: true
      });

      // Calculate orientation
      const orientationStart = Date.now();
      const orientation = await this.calculateOrientation(scene);
      this.metrics.operations.push({
        name: 'calculateOrientation',
        duration: Date.now() - orientationStart,
        success: true
      });

      const endTime = Date.now();
      this.metrics.endTime = endTime;
      this.metrics.duration = endTime - startTime;

      // Log performance metrics
      this.logger.performance(this.metrics);

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
    if (!file) {
      this.logger.error('No file provided');
      return false;
    }

    // Check file size
    if (file.size > this.config.maxFileSize) {
      this.logger.error(`File size ${file.size} exceeds maximum allowed size ${this.config.maxFileSize}`);
      throw new Error('File size exceeds maximum allowed size');
    }

    // Check file type
    const fileType = file.type.toLowerCase();
    if (!fileType.includes('gltf-binary')) {
      this.logger.error(`Unsupported file type: ${fileType}`);
      throw new Error('Unsupported file format');
    }

    return true;
  }

  private async loadGLB(file: File): Promise<GLTF> {
    const startTime = performance.now();
    try {
      console.log('Starting GLB loading process...');
      // Read file as ArrayBuffer
      const bufferStartTime = performance.now();
      const buffer = await file.arrayBuffer();
      console.log('ArrayBuffer created in:', performance.now() - bufferStartTime, 'ms');
      console.log('Buffer size:', buffer.byteLength, 'bytes');
      this.logger.debug('Successfully read GLB file as ArrayBuffer');

      // Use parseAsync with ArrayBuffer for direct binary loading
      console.log('Starting GLB parsing...');
      const parseStartTime = performance.now();
      const gltf = await this.gltfLoader.parseAsync(buffer, '');
      console.log('GLB parsing completed in:', performance.now() - parseStartTime, 'ms');
      this.logger.debug('Successfully parsed GLB file');

      // Extract only geometric data
      console.log('Starting geometric data extraction...');
      const extractStartTime = performance.now();
      const scene = gltf.scene;
      let meshCount = 0;
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          meshCount++;
          // Store only geometric properties
          const geometry = object.geometry;
          if (geometry) {
            // Calculate bounding box
            geometry.computeBoundingBox();
            const bbox = geometry.boundingBox;
            
            // Store key geometric data
            this.geometricData.push({
              position: object.position,
              rotation: object.rotation,
              scale: object.scale,
              boundingBox: bbox,
              vertices: geometry.attributes.position.count,
              faces: geometry.index ? geometry.index.count / 3 : 0
            });
          }
        }
      });
      console.log('Geometric data extraction completed in:', performance.now() - extractStartTime, 'ms');
      console.log('Found', meshCount, 'meshes');

      // Calculate overall scene bounds
      console.log('Calculating scene bounds...');
      const boundsStartTime = performance.now();
      const sceneBounds = new THREE.Box3();
      this.geometricData.forEach(data => {
        if (data.boundingBox) {
          const tempObject = new THREE.Object3D();
          const tempGeometry = new THREE.BufferGeometry();
          tempGeometry.setAttribute('position', new THREE.Float32BufferAttribute(data.boundingBox.getSize(new THREE.Vector3()).toArray(), 3));
          tempObject.add(new THREE.Mesh(tempGeometry));
          sceneBounds.expandByObject(tempObject);
        }
      });
      console.log('Scene bounds calculation completed in:', performance.now() - boundsStartTime, 'ms');

      // Store scene dimensions
      this.sceneDimensions = {
        width: sceneBounds.max.x - sceneBounds.min.x,
        height: sceneBounds.max.y - sceneBounds.min.y,
        depth: sceneBounds.max.z - sceneBounds.min.z,
        center: sceneBounds.getCenter(new THREE.Vector3())
      };

      const duration = performance.now() - startTime;
      console.log('Total GLB loading process completed in:', duration, 'ms');
      this.logger.performance({
        startTime,
        endTime: performance.now(),
        duration,
        operations: [{
          name: 'GLB loading',
          duration,
          success: true
        }]
      });

      return gltf;
    } catch (error) {
      const duration = performance.now() - startTime;
      console.error('GLB loading failed after:', duration, 'ms');
      console.error('Error details:', error);
      this.logger.error('Failed to load GLB file', error instanceof Error ? error : new Error('Unknown error'));
      throw new Error('Failed to load GLB file');
    }
  }

  private async analyzeGLB(gltf: GLTF): Promise<GLBAnalysis> {
    const startTime = performance.now();
    try {
      console.log('Starting GLB analysis...');
      const scene = gltf.scene;
      let totalVertices = 0;
      let totalFaces = 0;
      const materials: Material[] = [];

      // Calculate total geometry stats
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          const geometry = object.geometry;
          if (geometry) {
            totalVertices += geometry.attributes.position.count;
            totalFaces += geometry.index ? geometry.index.count / 3 : 0;
          }
          if (object.material) {
            materials.push(object.material);
          }
        }
      });

      // Calculate bounding box
      const bbox = new THREE.Box3();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.computeBoundingBox();
          bbox.expandByObject(object);
        }
      });

      const center = bbox.getCenter(new THREE.Vector3());
      const dimensions = bbox.getSize(new THREE.Vector3());

      const duration = performance.now() - startTime;
      console.log('GLB analysis completed in:', duration, 'ms');

      return {
        fileInfo: {
          name: gltf.parser.json.asset?.name || 'analyzed.glb',
          size: gltf.parser.json.asset?.size || 0,
          format: 'model/gltf-binary',
          version: gltf.parser.json.version,
        },
        geometry: {
          vertexCount: totalVertices,
          faceCount: totalFaces,
          boundingBox: bbox,
          center,
          dimensions,
        },
        materials,
        metadata: gltf.parser.json,
        performance: {
          startTime,
          endTime: performance.now(),
          duration,
          operations: [],
        },
      };
    } catch (error) {
      console.error('GLB analysis failed:', error);
      throw error;
    }
  }

  private async analyzeSpatial(scene: Object3D): Promise<SpatialAnalysis> {
    // Create a bounding box from the scene's geometry
    const bbox = new Box3();
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.computeBoundingBox();
        const objectBBox = object.geometry.boundingBox;
        if (objectBBox) {
          bbox.union(objectBBox);
        }
      }
    });

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