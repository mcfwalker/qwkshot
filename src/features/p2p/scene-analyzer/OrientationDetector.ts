import { Object3D, Vector3, Mesh, Box3, Material } from 'three';
import { Logger } from '../../../types/p2p/shared';
import { ModelOrientation } from '../../../types/p2p/scene-analyzer';

interface FaceNormal {
  normal: Vector3;
  count: number;
}

interface UVMappingAnalysis {
  hasUVMapping: boolean;
  primaryDirection: Vector3 | null;
}

interface MaterialAnalysis {
  hasFrontBack: boolean;
  frontDirection: Vector3 | null;
}

export class OrientationDetector {
  constructor(private logger: Logger) {}

  async detectOrientation(scene: Object3D): Promise<ModelOrientation> {
    try {
      // Get the bounding box for scale and center
      const boundingBox = new Box3().setFromObject(scene);
      const center = new Vector3();
      boundingBox.getCenter(center);
      const dimensions = new Vector3();
      boundingBox.getSize(dimensions);
      const scale = Math.max(dimensions.x, dimensions.y, dimensions.z);

      // Analyze face normals to determine primary directions
      const faceNormals = this.analyzeFaceNormals(scene);
      
      // Analyze UV mapping for additional orientation hints
      const uvAnalysis = this.analyzeUVMapping(scene);
      
      // Analyze materials for front/back hints
      const materialAnalysis = this.analyzeMaterials(scene);

      // Combine analyses to determine orientation
      const orientation = this.determineOrientation(
        faceNormals,
        uvAnalysis,
        materialAnalysis,
        center,
        scale
      );

      this.logger.info('Orientation detection completed', { orientation });
      return orientation;
    } catch (error) {
      this.logger.error('Orientation detection failed', error);
      throw error;
    }
  }

  private analyzeFaceNormals(scene: Object3D): FaceNormal[] {
    const normals: Map<string, FaceNormal> = new Map();
    
    scene.traverse((object) => {
      if (object instanceof Mesh) {
        const geometry = object.geometry;
        if (geometry.attributes.normal) {
          const normalsArray = geometry.attributes.normal.array;
          this.logger.debug('Found mesh with normals', {
            meshName: object.name,
            normalCount: normalsArray.length / 3
          });
          
          for (let i = 0; i < normalsArray.length; i += 3) {
            const normal = new Vector3(
              normalsArray[i],
              normalsArray[i + 1],
              normalsArray[i + 2]
            );
            const key = this.vectorToKey(normal);
            if (!normals.has(key)) {
              normals.set(key, { normal: normal.clone(), count: 0 });
            }
            normals.get(key)!.count++;
          }
        } else {
          this.logger.debug('Mesh has no normals', { meshName: object.name });
        }
      }
    });

    const result = Array.from(normals.values())
      .sort((a, b) => b.count - a.count);
      
    this.logger.debug('Face normal analysis complete', {
      uniqueNormals: result.length,
      topNormals: result.slice(0, 3).map(n => ({
        normal: n.normal.toArray(),
        count: n.count
      }))
    });

    return result;
  }

  private analyzeUVMapping(scene: Object3D): UVMappingAnalysis {
    let hasUVMapping = false;
    let primaryDirection: Vector3 | null = null;
    let meshCount = 0;
    let meshesWithUV = 0;

    scene.traverse((object) => {
      if (object instanceof Mesh) {
        meshCount++;
        const geometry = object.geometry;
        if (geometry.attributes.uv) {
          hasUVMapping = true;
          meshesWithUV++;
          // Analyze UV mapping to determine primary direction
          const boundingBox = new Box3().setFromObject(object);
          const size = new Vector3();
          boundingBox.getSize(size);
          primaryDirection = new Vector3(
            size.x > size.y ? 1 : 0,
            size.y > size.z ? 1 : 0,
            size.z > size.x ? 1 : 0
          ).normalize();
        }
      }
    });

    this.logger.debug('UV mapping analysis complete', {
      totalMeshes: meshCount,
      meshesWithUV,
      hasUVMapping,
      primaryDirection: primaryDirection?.toArray()
    });

    return { hasUVMapping, primaryDirection };
  }

  private analyzeMaterials(scene: Object3D): MaterialAnalysis {
    let hasFrontBack = false;
    let frontDirection: Vector3 | null = null;
    let materialCount = 0;
    let materialsWithFrontBack = 0;

    scene.traverse((object) => {
      if (object instanceof Mesh) {
        const material = object.material;
        if (material) {
          materialCount++;
          // Check for double-sided materials
          hasFrontBack = !material.side;
          if (hasFrontBack) {
            materialsWithFrontBack++;
            // Use the object's local Z-axis as a hint for front direction
            frontDirection = new Vector3(0, 0, -1);
            frontDirection.applyQuaternion(object.quaternion);
          }
        }
      }
    });

    this.logger.debug('Material analysis complete', {
      totalMaterials: materialCount,
      materialsWithFrontBack,
      hasFrontBack,
      frontDirection: frontDirection?.toArray()
    });

    return { hasFrontBack, frontDirection };
  }

  private determineOrientation(
    faceNormals: FaceNormal[],
    uvAnalysis: UVMappingAnalysis,
    materialAnalysis: MaterialAnalysis,
    center: Vector3,
    scale: number
  ): ModelOrientation {
    // Use the most common face normal as the primary direction
    const primaryNormal = faceNormals[0]?.normal || new Vector3(0, 0, -1);
    
    // Determine front direction based on all available hints
    let front = primaryNormal;
    if (materialAnalysis.frontDirection) {
      front = materialAnalysis.frontDirection;
    } else if (uvAnalysis.primaryDirection) {
      front = uvAnalysis.primaryDirection;
    }

    // Calculate other directions based on front
    const up = new Vector3(0, 1, 0);
    const right = new Vector3().crossVectors(front, up).normalize();
    up.crossVectors(right, front).normalize();

    return {
      front,
      back: front.clone().multiplyScalar(-1),
      left: right.clone().multiplyScalar(-1),
      right,
      top: up,
      bottom: up.clone().multiplyScalar(-1),
      center,
      scale,
      confidence: this.calculateConfidence(faceNormals, uvAnalysis, materialAnalysis)
    };
  }

  private calculateConfidence(
    faceNormals: FaceNormal[],
    uvAnalysis: UVMappingAnalysis,
    materialAnalysis: MaterialAnalysis
  ): number {
    let confidence = 0;
    let factors = 0;

    // Factor 1: Face normal consistency (0.4 weight)
    if (faceNormals.length > 0) {
      const totalFaces = faceNormals.reduce((sum, n) => sum + n.count, 0);
      const primaryNormalRatio = faceNormals[0].count / totalFaces;
      confidence += primaryNormalRatio * 0.4;
      factors++;
      this.logger.debug('Face normal confidence factor', {
        totalFaces,
        primaryNormalCount: faceNormals[0].count,
        primaryNormalRatio,
        contribution: primaryNormalRatio * 0.4
      });
    }

    // Factor 2: UV mapping presence (0.3 weight)
    if (uvAnalysis.hasUVMapping) {
      confidence += 0.3;
      factors++;
      this.logger.debug('UV mapping confidence factor', {
        hasUVMapping: true,
        contribution: 0.3
      });
    }

    // Factor 3: Material front/back (0.3 weight)
    if (materialAnalysis.hasFrontBack) {
      confidence += 0.3;
      factors++;
      this.logger.debug('Material front/back confidence factor', {
        hasFrontBack: true,
        contribution: 0.3
      });
    }

    const finalConfidence = factors > 0 ? confidence / factors : 0;
    this.logger.debug('Final confidence calculation', {
      totalConfidence: confidence,
      factors,
      finalConfidence
    });

    return finalConfidence;
  }

  private vectorToKey(v: Vector3): string {
    return `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
  }
} 