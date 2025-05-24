import { create } from 'zustand';
import { MetadataManagerFactory } from '@/features/p2p/metadata-manager/MetadataManagerFactory';
import { EnvironmentalMetadata } from '@/types/p2p/environmental-metadata';
import { analyzeScene as analyzeSceneGeometry } from '@/lib/scene-analysis';
import { Object3D, PerspectiveCamera } from 'three';
import { NotFoundError } from '@/types/p2p/metadata-manager';
import { CameraCommand } from '@/types/p2p/scene-interpreter';
import { FloorType } from '@/components/viewer/Floor';

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
  sceneBackgroundColor: string;
  gridColor: string;
  gridVisible: boolean;
  fov: number;
  showReticle: boolean;
  floorType: FloorType;
  floorTexture: string | null;
  userVerticalAdjustment: number;
  activeLeftPanelTab: 'model' | 'camera';
  animationCommands: CameraCommand[];
  animationDuration: number;
  animationPlaybackSpeed: number;
  isAnimationPlaying: boolean;
  animationProgress: number;
  toggleLock: () => void;
  setLock: (locked: boolean) => void;
  setModelId: (id: string | null) => void;
  setSceneBackgroundColor: (color: string) => void;
  setGridColor: (color: string) => void;
  setGridVisible: (visible: boolean) => void;
  setFov: (fov: number) => void;
  setShowReticle: (visible: boolean) => void;
  setFloorType: (type: FloorType) => void;
  setFloorTexture: (textureUrl: string | null) => void;
  setUserVerticalAdjustment: (adjustment: number) => void;
  setActiveLeftPanelTab: (tab: 'model' | 'camera') => void;
  setAnimationCommands: (commands: CameraCommand[]) => void;
  setAnimationDuration: (duration: number) => void;
  setAnimationPlaybackSpeed: (speed: number) => void;
  setIsAnimationPlaying: (playing: boolean) => void;
  setAnimationProgress: (progress: number) => void;
  storeEnvironmentalMetadata: (
    modelRef: Object3D,
    cameraRef: PerspectiveCamera,
    controlsRef: any,
    fov: number
  ) => Promise<void>;
  resetViewerSettings: () => void;
}

const defaultSettings = {
  sceneBackgroundColor: '#121212',
  gridColor: '#444444',
  gridVisible: true,
  fov: 50,
  showReticle: true,
  floorType: 'grid' as FloorType,
  floorTexture: null as string | null,
  userVerticalAdjustment: 0,
  activeLeftPanelTab: 'model' as 'model' | 'camera',
  animationCommands: [] as CameraCommand[],
  animationDuration: 10,
  animationPlaybackSpeed: 1,
  isAnimationPlaying: false,
  animationProgress: 0,
};

export const useViewerStore = create<ViewerState>((set, get) => ({
  isLocked: false,
  modelId: null,
  ...defaultSettings,
  toggleLock: () => {
    const currentState = get();
    console.log('Toggling lock state in store. Current state:', {
      isLocked: currentState.isLocked,
      modelId: currentState.modelId
    });
    set((state) => {
      const newState = { ...state, isLocked: !state.isLocked };
      console.log('New state:', newState);
      return newState;
    });
  },
  setLock: (locked) => set({ isLocked: locked }),
  setModelId: (id) => set({ modelId: id }),
  setSceneBackgroundColor: (color) => set({ sceneBackgroundColor: color }),
  setGridColor: (color) => set({ gridColor: color }),
  setGridVisible: (visible) => set({ gridVisible: visible }),
  setFov: (fov) => set({ fov: fov }),
  setShowReticle: (visible) => set({ showReticle: visible }),
  setFloorType: (type) => set({ floorType: type }),
  setFloorTexture: (textureUrl) => set({ floorTexture: textureUrl }),
  setUserVerticalAdjustment: (adjustment) => set({ userVerticalAdjustment: adjustment }),
  setActiveLeftPanelTab: (tab) => set({ activeLeftPanelTab: tab }),
  setAnimationCommands: (commands) => set({ animationCommands: commands }),
  setAnimationDuration: (duration) => set({ animationDuration: duration }),
  setAnimationPlaybackSpeed: (speed) => set({ animationPlaybackSpeed: speed }),
  setIsAnimationPlaying: (playing) => set({ isAnimationPlaying: playing }),
  setAnimationProgress: (progress) => set({ animationProgress: progress }),
  storeEnvironmentalMetadata: async (modelRef, cameraRef, controlsRef, fov) => {
    const { modelId } = get();
    if (!modelId) {
      console.error('No model ID available');
      throw new Error('No model ID available');
    }

    // Construct the metadata object first
    let environmentalMetadata: EnvironmentalMetadata;
    try {
      const sceneGeometry = analyzeSceneGeometry(modelRef);
      environmentalMetadata = {
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
          fov: fov
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
    } catch (error) {
        console.error('Failed to analyze scene or construct metadata object:', error);
        throw new Error('Failed to prepare metadata for storage');
    }

    // Initialize and attempt to store/update
    try {
      await metadataManager.initialize(); // Ensure initialized

      try {
        console.log('Attempting to get existing metadata...');
        await metadataManager.getEnvironmentalMetadata(modelId);
        // If get succeeds, metadata exists, proceed to update
        console.log('Existing metadata found, attempting update...');
        try {
          await metadataManager.updateEnvironmentalMetadata(modelId, environmentalMetadata);
          console.log('Metadata updated successfully via updateEnvironmentalMetadata.');
        } catch (updateError) {
          console.error('Failed during updateEnvironmentalMetadata call:', updateError);
          // Rethrow or handle specific update errors if necessary
          throw updateError; 
        }
      } catch (getError) {
        // If get fails, check if it was NotFoundError
        console.log('getEnvironmentalMetadata failed, checking error type...');
        if (getError instanceof NotFoundError) {
          // Metadata doesn't exist, so store it for the first time
          console.log('NotFoundError caught, storing new metadata...');
          try {
            await metadataManager.storeEnvironmentalMetadata(modelId, environmentalMetadata);
            console.log('New metadata stored successfully via storeEnvironmentalMetadata.');
          } catch (storeError) {
            console.error('Failed during storeEnvironmentalMetadata call:', storeError);
             // Rethrow or handle specific store errors if necessary
            throw storeError;
          }
        } else {
          // The error during get was something else (DB connection, RLS, etc.)
          console.error('Failed to get existing metadata due to unexpected error:', getError);
          throw getError; // Re-throw the unexpected error
        }
      }
    } catch (error) {
      // Catch errors from initialize, or re-thrown errors from update/store/unexpected get
      console.error('Failed to store or update environmental metadata:', error);
      // Ensure the error is propagated
      throw error instanceof Error ? error : new Error('Failed to save environmental metadata');
    }
  },
  resetViewerSettings: () => {
    set({
      ...defaultSettings,
      modelId: get().modelId,
      isLocked: false,
    });
    if (get().modelId) {
      set({ activeLeftPanelTab: 'camera' });
    }
  }
}));
