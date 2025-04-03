import { create } from 'zustand';
import { MetadataManagerFactory } from '@/features/p2p/metadata-manager/MetadataManagerFactory';
import { EnvironmentalMetadata } from '@/types/p2p/environmental-metadata';
import { analyzeScene as analyzeSceneGeometry } from '@/lib/scene-analysis';
import { Object3D, PerspectiveCamera } from 'three';

// Create MetadataManagerFactory instance
const metadataManagerFactory = new MetadataManagerFactory({
  info: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
  trace: console.trace,
  performance: console.debug
});

// Create and initialize MetadataManager
const metadataManager = metadataManagerFactory.create({
  database: {
    type: 'supabase',
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  },
  caching: {
    enabled: true,
    ttl: 5 * 60 * 1000
  },
  validation: {
    strict: false,
    maxFeaturePoints: 100
  }
});

interface ViewerState {
  isLocked: boolean;
  toggleLock: () => void;
  setLock: (locked: boolean) => void;
  storeEnvironmentalMetadata: (
    modelId: string,
    modelRef: Object3D,
    cameraRef: PerspectiveCamera,
    controlsRef: any
  ) => Promise<void>;
}

export const useViewerStore = create<ViewerState>((set) => ({
  isLocked: false,
  toggleLock: () => set((state) => ({ isLocked: !state.isLocked })),
  setLock: (locked) => set({ isLocked: locked }),
  storeEnvironmentalMetadata: async (modelId, modelRef, cameraRef, controlsRef) => {
    try {
      // Analyze the current scene
      const sceneGeometry = analyzeSceneGeometry(modelRef);
      
      // Create environmental metadata
      const environmentalMetadata: EnvironmentalMetadata = {
        lighting: {
          intensity: 1.0,
          color: '#ffffff',
          position: {
            x: 0,
            y: 10,
            z: 0
          }
        },
        camera: {
          position: {
            x: cameraRef.position.x,
            y: cameraRef.position.y,
            z: cameraRef.position.z
          },
          target: {
            x: controlsRef.target.x,
            y: controlsRef.target.y,
            z: controlsRef.target.z
          },
          fov: cameraRef.fov
        },
        scene: {
          background: '#000000',
          ground: '#808080',
          atmosphere: '#87CEEB'
        },
        constraints: {
          minDistance: sceneGeometry.safeDistance.min,
          maxDistance: sceneGeometry.safeDistance.max,
          minHeight: sceneGeometry.floor.height,
          maxHeight: sceneGeometry.boundingBox.max.y,
          maxSpeed: 2.0,
          maxAngleChange: 45,
          minFramingMargin: 0.1
        }
      };

      // Initialize and store metadata
      await metadataManager.initialize();
      await metadataManager.storeEnvironmentalMetadata(modelId, environmentalMetadata);
    } catch (error) {
      console.error('Failed to store environmental metadata:', error);
      throw error;
    }
  }
}));
