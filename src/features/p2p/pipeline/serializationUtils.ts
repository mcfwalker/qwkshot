import { Vector3, Box3 } from 'three';
// Import types from their specific files
import type {
    SerializedVector3,
    SerializedOrientation,
    Feature,
    SpatialBounds,
    SafetyConstraints, // Base type from shared
    Orientation, // Base type from shared
    PerformanceMetrics,
} from '../../../types/p2p/shared'; // Correct path

import type {
    SceneAnalysis,
    GLBAnalysis,
    SpatialAnalysis,
    FeatureAnalysis,
    SceneSafetyConstraints, // Specific type from scene-analyzer
    ModelOrientation, // Specific type from scene-analyzer
    SerializedSceneAnalysis,
    SerializedGLBAnalysis,
    SerializedSpatialAnalysis,
    SerializedFeatureAnalysis,
    SerializedSceneSafetyConstraints,
    SerializedFeature,
    SerializedSpatialBounds,
    SerializedGLBGeometry,
    SerializedSpatialReferencePoints,
    SerializedSymmetry,
    SerializedBox3
} from '../../../types/p2p/scene-analyzer'; // Correct path

// --- Serialization Helpers ---

function serializeVector3(v: Vector3 | undefined | null): SerializedVector3 {
    if (!v) {
      return { x: 0, y: 0, z: 0 };
    }
    return { x: v.x || 0, y: v.y || 0, z: v.z || 0 };
}

function serializeBox3(box: Box3 | undefined | null): SerializedBox3 {
    const defaultVector = { x: 0, y: 0, z: 0 };
    if (!box) {
      return { min: defaultVector, max: defaultVector };
    }
    return {
      min: serializeVector3(box.min),
      max: serializeVector3(box.max),
    };
}

function serializeFeature(feature: Feature): SerializedFeature {
    return {
      id: feature.id,
      type: feature.type,
      position: serializeVector3(feature.position),
      description: feature.description,
      metadata: feature.metadata,
    };
}

function serializeSpatialBounds(bounds: SpatialBounds | undefined | null): SerializedSpatialBounds {
    const defaultVector = { x: 0, y: 0, z: 0 };
    if (!bounds) {
      return {
        min: defaultVector,
        max: defaultVector,
        center: defaultVector,
        dimensions: defaultVector,
      };
    }
    return {
      min: serializeVector3(bounds.min),
      max: serializeVector3(bounds.max),
      center: serializeVector3(bounds.center),
      dimensions: serializeVector3(bounds.dimensions),
    };
}

function serializeGLBGeometry(geometry: SceneAnalysis['glb']['geometry']): SerializedGLBGeometry {
    return {
      vertexCount: geometry.vertexCount || 0,
      faceCount: geometry.faceCount || 0,
      boundingBox: serializeBox3(geometry.boundingBox),
      center: serializeVector3(geometry.center),
      dimensions: serializeVector3(geometry.dimensions),
    };
}

function serializeGLBAnalysis(glb: GLBAnalysis): SerializedGLBAnalysis {
    return {
      fileInfo: glb.fileInfo,
      geometry: serializeGLBGeometry(glb.geometry),
      metadata: glb.metadata,
      performance: glb.performance,
    };
}

function serializeReferencePoints(points: SceneAnalysis['spatial']['referencePoints']): SerializedSpatialReferencePoints {
    return {
      center: serializeVector3(points.center),
      highest: serializeVector3(points.highest),
      lowest: serializeVector3(points.lowest),
      leftmost: serializeVector3(points.leftmost),
      rightmost: serializeVector3(points.rightmost),
      frontmost: serializeVector3(points.frontmost),
      backmost: serializeVector3(points.backmost),
    };
}

function serializeSymmetry(symmetry: SceneAnalysis['spatial']['symmetry']): SerializedSymmetry {
    return {
      hasSymmetry: symmetry.hasSymmetry,
    };
}

function serializeSpatialAnalysis(spatial: SpatialAnalysis): SerializedSpatialAnalysis {
    return {
      bounds: serializeSpatialBounds(spatial.bounds),
      referencePoints: serializeReferencePoints(spatial.referencePoints),
      symmetry: serializeSymmetry(spatial.symmetry),
      complexity: spatial.complexity,
      performance: spatial.performance,
    };
}

function serializeFeatureAnalysis(featureAnalysis: FeatureAnalysis): SerializedFeatureAnalysis {
    return {
      features: featureAnalysis.features.map(serializeFeature),
      landmarks: featureAnalysis.landmarks.map(serializeFeature),
      constraints: featureAnalysis.constraints.map(serializeFeature),
      performance: featureAnalysis.performance,
    };
}

function serializeSafetyConstraints(constraints: SceneSafetyConstraints): SerializedSceneSafetyConstraints {
    return {
      minHeight: constraints.minHeight,
      maxHeight: constraints.maxHeight,
      minDistance: constraints.minDistance,
      maxDistance: constraints.maxDistance,
    };
}

// We need a helper for ModelOrientation -> SerializedOrientation
// Note: The existing one in P2PPipeline took `any` and had specific logic
function serializeModelOrientation(orientation: ModelOrientation): SerializedOrientation {
    return {
      front: serializeVector3(orientation.front),
      back: serializeVector3(orientation.back),
      left: serializeVector3(orientation.left),
      right: serializeVector3(orientation.right),
      top: serializeVector3(orientation.top),
      bottom: serializeVector3(orientation.bottom),
      center: serializeVector3(orientation.center),
      scale: orientation.scale,
      confidence: orientation.confidence,
      // Use the already plain position/rotation if they exist
      position: orientation.position || {x:0, y:0, z:0},
      rotation: orientation.rotation || {x:0, y:0, z:0},
    };
}

// Top-level EXPORTED serialization function
export function serializeSceneAnalysis(analysis: SceneAnalysis): SerializedSceneAnalysis {
    return {
      glb: serializeGLBAnalysis(analysis.glb),
      spatial: serializeSpatialAnalysis(analysis.spatial),
      featureAnalysis: serializeFeatureAnalysis(analysis.featureAnalysis),
      safetyConstraints: serializeSafetyConstraints(analysis.safetyConstraints),
      orientation: serializeModelOrientation(analysis.orientation), // Use specific helper
      features: analysis.features.map(serializeFeature),
      performance: analysis.performance,
    };
}

// --- Deserialization Helpers ---

function deserializeVector3(sv: SerializedVector3 | undefined | null): Vector3 {
    if (!sv) {
      return new Vector3(0, 0, 0);
    }
    return new Vector3(sv.x || 0, sv.y || 0, sv.z || 0);
}

function deserializeBox3(sb: SerializedBox3 | undefined | null): Box3 {
    if (!sb) {
      return new Box3(new Vector3(0, 0, 0), new Vector3(0, 0, 0));
    }
    return new Box3(
      deserializeVector3(sb.min),
      deserializeVector3(sb.max)
    );
}

function deserializeFeature(sf: SerializedFeature): Feature {
    return {
      id: sf.id,
      type: sf.type,
      position: deserializeVector3(sf.position),
      description: sf.description,
      metadata: sf.metadata,
    };
}

function deserializeSpatialBounds(ssb: SerializedSpatialBounds | undefined | null): SpatialBounds {
     const defaultVector = new Vector3(0, 0, 0);
     if (!ssb) {
        return {
            min: defaultVector,
            max: defaultVector,
            center: defaultVector,
            dimensions: defaultVector,
        };
     }
     return {
        min: deserializeVector3(ssb.min),
        max: deserializeVector3(ssb.max),
        center: deserializeVector3(ssb.center),
        dimensions: deserializeVector3(ssb.dimensions),
     };
}

function deserializeGLBGeometry(sg: SerializedGLBGeometry): SceneAnalysis['glb']['geometry'] {
     return {
        vertexCount: sg.vertexCount,
        faceCount: sg.faceCount,
        boundingBox: deserializeBox3(sg.boundingBox),
        center: deserializeVector3(sg.center),
        dimensions: deserializeVector3(sg.dimensions),
     };
}

function deserializeGLBAnalysis(sga: SerializedGLBAnalysis): GLBAnalysis {
     return {
        fileInfo: sga.fileInfo,
        geometry: deserializeGLBGeometry(sga.geometry),
        materials: [],
        metadata: sga.metadata,
        performance: sga.performance,
     };
}

function deserializeReferencePoints(srp: SerializedSpatialReferencePoints): SceneAnalysis['spatial']['referencePoints'] {
     return {
        center: deserializeVector3(srp.center),
        highest: deserializeVector3(srp.highest),
        lowest: deserializeVector3(srp.lowest),
        leftmost: deserializeVector3(srp.leftmost),
        rightmost: deserializeVector3(srp.rightmost),
        frontmost: deserializeVector3(srp.frontmost),
        backmost: deserializeVector3(srp.backmost),
     };
}

function deserializeSymmetry(ss: SerializedSymmetry): SceneAnalysis['spatial']['symmetry'] {
     return {
        hasSymmetry: ss.hasSymmetry,
        symmetryPlanes: [],
     };
}

function deserializeSpatialAnalysis(ssa: SerializedSpatialAnalysis): SpatialAnalysis {
     return {
        bounds: deserializeSpatialBounds(ssa.bounds),
        referencePoints: deserializeReferencePoints(ssa.referencePoints),
        symmetry: deserializeSymmetry(ssa.symmetry),
        complexity: ssa.complexity,
        performance: ssa.performance,
     };
}

function deserializeFeatureAnalysis(sfa: SerializedFeatureAnalysis): FeatureAnalysis {
     return {
        features: sfa.features.map(deserializeFeature),
        landmarks: sfa.landmarks.map(deserializeFeature),
        constraints: sfa.constraints.map(deserializeFeature),
        performance: sfa.performance,
     };
}

function deserializeSafetyConstraints(ssc: SerializedSceneSafetyConstraints): SceneSafetyConstraints {
     return {
        minHeight: ssc.minHeight,
        maxHeight: ssc.maxHeight,
        minDistance: ssc.minDistance,
        maxDistance: ssc.maxDistance,
        restrictedZones: [],
     };
}

function deserializeOrientation(so: SerializedOrientation | undefined | null): ModelOrientation {
    const defaultVector = new Vector3(0, 0, 0);
    if (!so) {
        return { 
            front: new Vector3(0, 0, 1), back: new Vector3(0, 0, -1),
            left: new Vector3(-1, 0, 0), right: new Vector3(1, 0, 0),
            top: new Vector3(0, 1, 0), bottom: new Vector3(0, -1, 0),
            center: defaultVector, scale: 1, confidence: 0,
            position: {x:0, y:0, z:0}, rotation: {x:0, y:0, z:0}
         }; 
    }
    return {
        front: deserializeVector3(so.front),
        back: deserializeVector3(so.back),
        left: deserializeVector3(so.left),
        right: deserializeVector3(so.right),
        top: deserializeVector3(so.top),
        bottom: deserializeVector3(so.bottom),
        center: deserializeVector3(so.center),
        scale: so.scale,
        confidence: so.confidence,
        position: so.position || {x:0, y:0, z:0},
        rotation: so.rotation || {x:0, y:0, z:0}
    };
}

// Top-level EXPORTED deserialization function
export function deserializeSceneAnalysis(ssa: SerializedSceneAnalysis | undefined | null): SceneAnalysis | null {
  if (!ssa) {
    // Optionally log here if needed, but allow API route to handle logging
    return null;
  }
  try {
    return {
      glb: deserializeGLBAnalysis(ssa.glb),
      spatial: deserializeSpatialAnalysis(ssa.spatial),
      featureAnalysis: deserializeFeatureAnalysis(ssa.featureAnalysis),
      safetyConstraints: deserializeSafetyConstraints(ssa.safetyConstraints),
      orientation: deserializeOrientation(ssa.orientation),
      features: ssa.features.map(deserializeFeature),
      performance: ssa.performance,
    };
  } catch (error) {
      // Optionally log here if needed
      console.error('Error during SceneAnalysis deserialization:', error);
      return null; // Return null on error
  }
} 