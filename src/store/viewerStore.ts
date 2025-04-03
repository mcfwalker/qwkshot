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
  modelId: string | null;
  toggleLock: () => void;
  setLock: (locked: boolean) => void;
  setModelId: (id: string | null) => void;
  storeEnvironmentalMetadata: (
    modelRef: Object3D,
    cameraRef: PerspectiveCamera,
    controlsRef: any
  ) => Promise<void>;
}

export const useViewerStore = create<ViewerState>((set, get) => ({
  isLocked: false,
  modelId: null,
  toggleLock: () => {
    const currentState = get();
    console.log('Toggling lock state in store. Current state:', {
      isLocked: currentState.isLocked,
      modelId: currentState.modelId
    });
    set((state) => {
      const newState = { isLocked: !state.isLocked };
      console.log('New state:', newState);
      return newState;
    });
  },
  setLock: (locked) => set({ isLocked: locked }),
  setModelId: (id) => set({ modelId: id }),
  storeEnvironmentalMetadata: async (modelRef, cameraRef, controlsRef) => {
    const { modelId } = get();
    if (!modelId) {
      console.error('No model ID available');
      throw new Error('No model ID available');
    }

    try {
      console.log('Storing environmental metadata for model:', modelId);
      
      // Analyze the current scene
      const sceneGeometry = analyzeSceneGeometry(modelRef);
      console.log('Scene geometry analyzed:', sceneGeometry);
      
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

      console.log('Created environmental metadata:', environmentalMetadata);

      // Initialize and store/update metadata
      await metadataManager.initialize();
      try {
        console.log('Attempting to get existing metadata...');
        await metadataManager.getEnvironmentalMetadata(modelId);
        console.log('Existing metadata found, updating...');
        await metadataManager.updateEnvironmentalMetadata(modelId, environmentalMetadata);
        console.log('Metadata updated successfully');
      } catch (error) {
        console.log('No existing metadata found, storing new metadata...');
        await metadataManager.storeEnvironmentalMetadata(modelId, environmentalMetadata);
        console.log('New metadata stored successfully');
      }
    } catch (error) {
      console.error('Failed to store environmental metadata:', error);
      throw error;
    }
  }
}));
