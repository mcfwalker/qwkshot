'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, PerspectiveCamera, useGLTF } from '@react-three/drei';
import { Suspense, useRef, useState, useCallback, useEffect } from 'react';
import { Vector3, PerspectiveCamera as ThreePerspectiveCamera, Object3D, MOUSE } from 'three';
// Commented out unused imports (keeping for reference)
// import CameraControls from './CameraControls';
// import FloorControls from './FloorControls';
import CameraTelemetry from './CameraTelemetry';
import { CameraAnimationSystem } from './CameraAnimationSystem';
import Floor, { FloorType } from './Floor';
import { SceneControls } from './SceneControls';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useViewerStore } from '@/store/viewerStore';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { ModelSelectorTabs } from './ModelSelectorTabs';
import { TextureLibraryModal } from './TextureLibraryModal';
import { FloorTexture } from '@/lib/supabase';

// Model component that handles GLTF/GLB loading
function Model({ url, modelRef, height = 0 }: { url: string; modelRef: React.RefObject<Object3D | null>; height?: number }) {
  const { scene } = useGLTF(url);
  
  // Update the ref when the scene changes
  if (modelRef.current !== scene) {
    modelRef.current = scene;
  }
  
  // Apply height offset
  scene.position.y = height;
  
  return <primitive object={scene} />;
}

interface ViewerProps {
  className?: string;
  modelUrl: string;
  onModelSelect: (url: string) => void;
}

export default function Viewer({ className, modelUrl, onModelSelect }: ViewerProps) {
  const [fov, setFov] = useState(50);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(10);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [modelHeight, setModelHeight] = useState(0);
  const [floorType, setFloorType] = useState<FloorType>('grid');
  const [floorTexture, setFloorTexture] = useState<string | null>(null);
  const [gridVisible, setGridVisible] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [isRecordingComplete, setIsRecordingComplete] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadComplete, setIsDownloadComplete] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isPathGenerated, setIsPathGenerated] = useState(false);
  const [isAnimationPaused, setIsAnimationPaused] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isModelError, setIsModelError] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializationError, setIsInitializationError] = useState(false);
  const [isMetadataLoaded, setIsMetadataLoaded] = useState(false);
  const [isMetadataError, setIsMetadataError] = useState(false);
  const [isMetadataLoading, setIsMetadataLoading] = useState(true);
  const [isSceneAnalyzed, setIsSceneAnalyzed] = useState(false);
  const [isSceneError, setIsSceneError] = useState(false);
  const [isSceneAnalyzing, setIsSceneAnalyzing] = useState(true);
  const [isEnvironmentLoaded, setIsEnvironmentLoaded] = useState(false);
  const [isEnvironmentError, setIsEnvironmentError] = useState(false);
  const [isEnvironmentLoading, setIsEnvironmentLoading] = useState(true);
  const [isLightingSetup, setIsLightingSetup] = useState(false);
  const [isLightingError, setIsLightingError] = useState(false);
  const [isLightingLoading, setIsLightingLoading] = useState(true);
  const [isCameraSetup, setIsCameraSetup] = useState(false);
  const [isCameraError, setIsCameraError] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [isControlsSetup, setIsControlsSetup] = useState(false);
  const [isControlsError, setIsControlsError] = useState(false);
  const [isControlsLoading, setIsControlsLoading] = useState(true);
  const [isRendererSetup, setIsRendererSetup] = useState(false);
  const [isRendererError, setIsRendererError] = useState(false);
  const [isRendererLoading, setIsRendererLoading] = useState(true);
  const [isAnimationSetup, setIsAnimationSetup] = useState(false);
  const [isAnimationError, setIsAnimationError] = useState(false);
  const [isAnimationLoading, setIsAnimationLoading] = useState(true);
  const [isRecordingSetup, setIsRecordingSetup] = useState(false);
  const [isRecordingError, setIsRecordingError] = useState(false);
  const [isRecordingLoading, setIsRecordingLoading] = useState(true);
  const [isDownloadSetup, setIsDownloadSetup] = useState(false);
  const [isDownloadError, setIsDownloadError] = useState(false);
  const [isDownloadLoading, setIsDownloadLoading] = useState(true);
  const [isPathSetup, setIsPathSetup] = useState(false);
  const [isPathError, setIsPathError] = useState(false);
  const [isPathLoading, setIsPathLoading] = useState(true);
  const [isUISetup, setIsUISetup] = useState(false);
  const [isUIError, setIsUIError] = useState(false);
  const [isUILoading, setIsUILoading] = useState(true);
  const [isSystemSetup, setIsSystemSetup] = useState(false);
  const [isSystemError, setIsSystemError] = useState(false);
  const [isSystemLoading, setIsSystemLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showTextureModal, setShowTextureModal] = useState(false);

  const modelRef = useRef<Object3D | null>(null);
  const cameraRef = useRef<ThreePerspectiveCamera>(null!);
  const controlsRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null!);
  const { isLocked, setModelId } = useViewerStore();

  // Extract and set modelId when modelUrl changes
  useEffect(() => {
    if (modelUrl) {
      // First try to get modelId from URL pathname
      const pathParts = window.location.pathname.split('/');
      let modelId = pathParts.find(part => 
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(part)
      );

      // If not found in pathname, try to extract from modelUrl
      if (!modelId) {
        modelId = modelUrl.split('/').find(part => 
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(part)
        );
      }

      console.log('Setting modelId in store:', modelId);
      setModelId(modelId || null);
    } else {
      setModelId(null);
    }
  }, [modelUrl, setModelId]);

  // Handle model height changes with validation and feedback
  const handleModelHeightChange = (newHeight: number) => {
    try {
      // Validate height
      if (typeof newHeight !== 'number' || isNaN(newHeight)) {
        throw new Error('Invalid height value');
      }

      // Update height
      setModelHeight(newHeight);

      // Show success toast
      toast.success('Floor offset updated', {
        description: `Model height set to ${newHeight.toFixed(2)} units`
      });
    } catch (error) {
      console.error('Error updating model height:', error);
      toast.error('Failed to update floor offset', {
        description: error instanceof Error ? error.message : 'Invalid height value'
      });
    }
  };

  const handleCameraUpdate = useCallback((position: Vector3, target: Vector3) => {
    if (isLocked) {
      toast.error('Viewer is locked. Unlock to move the camera.');
      return;
    }
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.copy(position);
      controlsRef.current.target.copy(target);
    }
  }, [isLocked]);

  const handleAnimationUpdate = useCallback((progress: number) => {
    if (!cameraRef.current || !controlsRef.current) {
      return;
    }

    // Calculate orbit position with playback speed adjustment
    const adjustedProgress = progress * playbackSpeed;
    const angle = adjustedProgress * Math.PI * 2; // Full circle
    const radius = 5; // Distance from center
    const height = 2; // Height above ground

    const newPosition = new Vector3(
      Math.cos(angle) * radius,
      height,
      Math.sin(angle) * radius
    );

    // Keep looking at the center
    const target = new Vector3(0, 0, 0);

    // Update camera and controls
    cameraRef.current.position.copy(newPosition);
    controlsRef.current.target.copy(target);
  }, [playbackSpeed]);

  const handleAnimationStart = useCallback(() => {
    if (cameraRef.current && controlsRef.current) {
      setIsPlaying(true);
    }
  }, []);

  const handleAnimationStop = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleAnimationPause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handlePathGenerated = useCallback(() => {
    setIsPathGenerated(true);
  }, []);

  // Handler for grid toggle
  const handleGridToggle = (visible: boolean) => {
      setGridVisible(visible);
      // Optionally update floorType based on visibility?
      // setFloorType(visible ? 'grid' : 'none'); // Example logic
  };

  // Handler for texture button click
  const handleAddTextureClick = () => {
    if (isLocked) { // Prevent action if locked
        toast.error("Cannot change texture while scene is locked.");
        return;
    }
    setShowTextureModal(true);
  };
  
  // Update handler to accept FloorTexture and use file_url
  const handleTextureSelect = (texture: FloorTexture | null) => {
    // Handle null case if user closes modal without selecting
    if (texture) {
        setFloorTexture(texture.file_url); 
    } else {
        setFloorTexture(null);
    }
    setShowTextureModal(false); // Close modal
  };

  return (
    <div className={cn('relative w-full h-full', className)}>
      <Canvas
        className="w-full h-full"
        ref={canvasRef}
        shadows
        camera={{ position: [5, 5, 5], fov }}
      >
        <Suspense fallback={null}>
          {/* Camera setup */}
          <PerspectiveCamera
            makeDefault
            position={[5, 5, 5]}
            fov={fov}
            ref={cameraRef}
          />

          {/* Controls */}
          <OrbitControls
            ref={controlsRef}
            enableDamping
            dampingFactor={0.05}
            mouseButtons={{
              LEFT: MOUSE.ROTATE,
              MIDDLE: MOUSE.DOLLY,
              RIGHT: MOUSE.PAN
            }}
            enabled={!isLocked}
          />

          {/* Floor */}
          <Floor type={gridVisible ? floorType : 'none'} texture={floorTexture} />

          {/* Model */}
          {modelUrl ? (
            <Model url={modelUrl} modelRef={modelRef} height={modelHeight} />
          ) : (
            <mesh castShadow receiveShadow ref={modelRef} position={[0, modelHeight, 0]}>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="white" />
            </mesh>
          )}
          
          {/* Environment for realistic lighting */}
          <Environment preset="city" />
        </Suspense>
      </Canvas>

      {/* This is the CORRECT container for BOTH left panels */}
      <div className="absolute top-16 left-4 w-[200px] z-10 flex flex-col gap-4">
        <ErrorBoundary name="ModelSelectorTabs">
           <ModelSelectorTabs onModelSelect={onModelSelect} />
        </ErrorBoundary>
        
        <SceneControls
          modelHeight={modelHeight}
          onModelHeightChange={handleModelHeightChange}
          fov={fov}
          onFovChange={setFov}
          gridVisible={gridVisible}
          onGridToggle={handleGridToggle}
          onAddTextureClick={handleAddTextureClick}
        />
      </div>

      {/* Camera Animation System */}
      <div className="absolute top-16 right-4 z-10">
        <CameraAnimationSystem
          onAnimationUpdate={handleAnimationUpdate}
          onAnimationStop={handleAnimationStop}
          onAnimationStart={handleAnimationStart}
          onAnimationPause={handleAnimationPause}
          isPlaying={isPlaying}
          duration={duration}
          setDuration={setDuration}
          modelRef={modelRef}
          cameraRef={cameraRef}
          controlsRef={controlsRef}
          canvasRef={canvasRef}
          onPathGenerated={handlePathGenerated}
          onPlaybackSpeedChange={setPlaybackSpeed}
          disabled={!modelRef.current}
        />
      </div>

      {/* Camera telemetry display */}
      <div className="absolute right-4 bottom-4 w-80 z-10">
        <CameraTelemetry
          cameraRef={cameraRef}
          controlsRef={controlsRef}
        />
      </div>

      {/* Texture Modal - onSelect prop matches now */}
      <TextureLibraryModal 
        isOpen={showTextureModal}
        onClose={() => handleTextureSelect(null)} // Pass null on close
        onSelect={handleTextureSelect}
      />
    </div>
  );
} 