'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, PerspectiveCamera, useGLTF } from '@react-three/drei';
import { Suspense, useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Vector3, PerspectiveCamera as ThreePerspectiveCamera, Object3D, MOUSE, AxesHelper, Box3, Box3Helper, Scene, Color } from 'three';
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
import { Button } from '@/components/ui/button';
import { CameraCommand } from '@/types/p2p/scene-interpreter';
import { AnimationController } from './AnimationController';
import { usePathname, useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CameraControlsPanel } from './CameraControlsPanel';
import { useFrame } from '@react-three/fiber';
import { CenterReticle } from './CenterReticle';
import { BottomToolbar } from './BottomToolbar';
import React from 'react';
import { ClearSceneConfirmPortal } from './ClearSceneConfirmPortal';
import { supabase } from '@/lib/supabase';
import { updateThumbnailUrlAction, uploadThumbnailAction } from '@/app/actions/thumbnail';
import { playSound, Sounds } from '@/lib/soundUtils';
import { ThumbnailPreviewModal } from './ThumbnailPreviewModal';
import { DesignSettingsDialog } from './DesignSettingsDialog';

// Model component - simplified to load GLTF/GLB without client normalization
function Model({ url, modelRef }: { url: string; modelRef: React.RefObject<Object3D | null>; }) {
  const { scene: originalScene } = useGLTF(url); // Load the scene (now pre-normalized)

  // Clone the scene to avoid modifying the cache and allow direct manipulation if needed
  // Memoize the cloned scene based on the original scene
  const clonedScene = useMemo(() => { 
    if (!originalScene) return null;
    console.log("Viewer.tsx <Model>: Cloning scene...");
    return originalScene.clone();
  }, [originalScene]);

  // Update the external modelRef with the container group
  useEffect(() => {
    // Assign the cloned scene directly to the ref
    if (clonedScene) {
       modelRef.current = clonedScene;
       console.log("Viewer.tsx <Model>: Assigned cloned scene to modelRef.");
    }
    // Cleanup ref when component unmounts or URL changes
    return () => { modelRef.current = null; };
  }, [clonedScene, modelRef]); // Depend on the cloned scene

  // Render the cloned scene directly
  // The parent <group> in Viewer will handle userVerticalAdjustment
  return clonedScene ? <primitive object={clonedScene} /> : null;
}

// Type for movement state
interface MovementDirection {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

// --- <<< NEW: Helper component for useFrame logic >>> ---
interface CameraMoverProps {
  movementDirection: MovementDirection;
  cameraRef: React.RefObject<ThreePerspectiveCamera>;
  controlsRef: React.RefObject<any>; // Type for OrbitControls is complex
  isLocked: boolean;
  isPlaying: boolean;
}

function CameraMover({ 
  movementDirection, 
  cameraRef, 
  controlsRef, 
  isLocked, 
  isPlaying 
}: CameraMoverProps) {

  const moveSpeed = 5.0; // Adjust speed as needed (units per second)

  // Vectors for calculation (reused to avoid allocations)
  const cameraRight = useMemo(() => new Vector3(), []);
  const cameraUp = useMemo(() => new Vector3(), []);
  const moveVector = useMemo(() => new Vector3(), []);

  // Define World Axes
  const worldAxisX = useMemo(() => new Vector3(1, 0, 0), []);
  const worldAxisY = useMemo(() => new Vector3(0, 1, 0), []);

  useFrame((state, delta) => {
    if (isLocked || isPlaying) return; // Don't move if locked or animating
    moveVector.set(0, 0, 0); // Reset moveVector for this frame

    // Accumulate movement based on active directions using WORLD axes
    if (movementDirection.up)    moveVector.add(worldAxisY);
    if (movementDirection.down)  moveVector.sub(worldAxisY);
    if (movementDirection.left)  moveVector.sub(worldAxisX);
    if (movementDirection.right) moveVector.add(worldAxisX);

    if (moveVector.lengthSq() > 0) { // Only move if a direction is active
      // Normalize the combined direction and scale by speed and frame time
      moveVector.normalize().multiplyScalar(moveSpeed * delta);

      // Apply the movement to both camera position and target
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (camera && controls) {
        camera.position.add(moveVector);
        controls.target.add(moveVector); // Move target parallel to camera
      }
    }
  });

  return null; // This component doesn't render anything itself
}
// --- <<< END CameraMover component >>> ---

interface ViewerProps {
  className: string;
  modelUrl: string | null;
  onModelSelect: (modelId: string | null) => void;
}

function ViewerComponent({ className, modelUrl, onModelSelect }: ViewerProps) {
  // Zustand store selectors and actions
  const {
    sceneBackgroundColor, setSceneBackgroundColor,
    gridColor, setGridColor,
    gridVisible, setGridVisible,
    fov, setFov,
    showReticle, setShowReticle,
    floorType, setFloorType,
    floorTexture, setFloorTexture,
    userVerticalAdjustment, setUserVerticalAdjustment,
    activeLeftPanelTab, setActiveLeftPanelTab,
    animationCommands, setAnimationCommands,
    animationDuration, setAnimationDuration,
    animationPlaybackSpeed, setAnimationPlaybackSpeed,
    isAnimationPlaying, setIsAnimationPlaying,
    animationProgress, setAnimationProgress,
    isLocked, setLock,
    modelId: storeModelId, // Alias to avoid conflict with local currentModelId if needed by handlers
    setModelId,
    resetViewerSettings
  } = useViewerStore();

  // Local UI state (dialogs, modals, etc.) - REMAINS LOCAL
  const [isDesignDialogOpen, setIsDesignDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [isRecordingComplete, setIsRecordingComplete] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadComplete, setIsDownloadComplete] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isPathGenerated, setIsPathGenerated] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isModelError, setIsModelError] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isSystemLoading, setIsSystemLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showTextureModal, setShowTextureModal] = useState(false);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isReticleLoading, setIsReticleLoading] = useState(false);
  const [resetCounter, setResetCounter] = useState(0);

  // Local state for thumbnail functionality RESTORED
  const [isCapturingThumbnail, setIsCapturingThumbnail] = useState(false);
  const [showThumbnailPreview, setShowThumbnailPreview] = useState(false);
  const [capturedThumbnail, setCapturedThumbnail] = useState<string | null>(null);
  const [isSavingThumbnail, setIsSavingThumbnail] = useState(false);
  const [isThumbnailSaved, setIsThumbnailSaved] = useState(false);
  const [modelName, setModelName] = useState<string>('model'); // Restored for thumbnail naming

  // REMOVED: const [currentModelId, setCurrentModelId] = useState<string | null>(null);
  // INSTEAD: Get modelId directly from the store for local effects if needed.
  // ViewerContainer is responsible for setting the modelId in the store.
  const storeDrivenModelId = useViewerStore(state => state.modelId); // Subscribe to store's modelId

  const router = useRouter();
  const modelRef = useRef<Object3D | null>(null);
  const cameraRef = useRef<ThreePerspectiveCamera>(null!);
  const controlsRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null!);
  const pathname = usePathname();
  const [boundingBoxHelper, setBoundingBoxHelper] = useState<Box3Helper | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const [movementDirection, setMovementDirection] = useState<MovementDirection>({ up: false, down: false, left: false, right: false });
  const prevModelUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (modelUrl) {
        setIsModelLoaded(true); // Set local isModelLoaded when modelUrl is present
    } else {
        setIsModelLoaded(false);
    }
  }, [modelUrl]);

  useEffect(() => {
    const actualModelId = useViewerStore.getState().modelId; // Can use storeDrivenModelId here too
    if (!prevModelUrlRef.current && modelUrl && actualModelId) {
      setActiveLeftPanelTab('camera');
    }
    prevModelUrlRef.current = modelUrl;
  }, [modelUrl, setActiveLeftPanelTab]); // Consider adding storeDrivenModelId if actualModelId logic relies on it

  // Effect to fetch model name when storeDrivenModelId changes (for thumbnail naming etc.)
  useEffect(() => {
    if (storeDrivenModelId) { // Use the ID from the store
      const fetchModelName = async () => {
        console.log('Viewer.tsx: Starting to fetch model name for ID from store:', storeDrivenModelId);
        try {
          const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/models?id=eq.${storeDrivenModelId}&select=name`;
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
              'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });
          if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
          }
          const data = await response.json();
          if (data && data.length > 0 && data[0].name) {
            setModelName(data[0].name || 'model');
          } else {
            setModelName('model');
          }
        } catch (err) {
          console.error('Error fetching model name:', err);
          setModelName('model');
        }
      };
      fetchModelName();
    } else {
      setModelName('model'); // Reset if no model ID in store
    }
  }, [storeDrivenModelId]); // Depend on the store's modelId

  const handleCameraMove = useCallback((direction: 'up' | 'down' | 'left' | 'right', active: boolean) => {
    if (isLocked || isAnimationPlaying) return;
    setMovementDirection(prev => ({ ...prev, [direction]: active }));
  }, [isLocked, isAnimationPlaying]);

  const handleCameraReset = useCallback(() => {
    if (isLocked || isAnimationPlaying) {
      toast.error('Cannot reset camera while locked or playing animation.');
      return;
    }
    if (cameraRef.current && controlsRef.current) {
      const initialPosition = new Vector3(0, 2, 5);
      const initialTarget = new Vector3(0, 1, 0);
      cameraRef.current.position.copy(initialPosition);
      controlsRef.current.target.copy(initialTarget);
      setMovementDirection({ up: false, down: false, left: false, right: false });
      toast.info('Camera position reset');
    } else {
      toast.error('Camera references not available for reset.');
    }
  }, [isLocked, isAnimationPlaying]);

  const performStageReset = useCallback(() => {
    console.log("PERFORMING STAGE RESET");
    setBoundingBoxHelper(currentHelper => {
      if (currentHelper && sceneRef.current) {
        sceneRef.current.remove(currentHelper);
      }
      return null;
    });
    onModelSelect('');
    resetViewerSettings();
    if (controlsRef.current) {
      controlsRef.current.reset(); 
    }
    setResetCounter(prev => prev + 1); 
    toast.success("Stage Reset Successfully");
    setIsConfirmingReset(false);
    setShowClearConfirm(false);
    router.push('/viewer');
  }, [onModelSelect, resetViewerSettings, router]);

  const handleRemoveTexture = useCallback(() => {
    setFloorTexture(null);
  }, [setFloorTexture]);

  const handleModelSelected = useCallback((selectedModelId: string | null) => {
    onModelSelect(selectedModelId);
  }, [onModelSelect]);

  const handleToggleReticle = useCallback(() => {
      if (isReticleLoading) return; 
      setIsReticleLoading(true);
      setShowReticle(!showReticle);
      setTimeout(() => setIsReticleLoading(false), 1000);
  }, [showReticle, isReticleLoading, setShowReticle]);

  // RESTORED: handleAddTextureClick
  const handleAddTextureClick = () => {
    if (isLocked) {
        toast.error("Cannot change texture while scene is locked.");
        return;
    }
    setShowTextureModal(true);
  };

  // RESTORED: handleTextureSelect
  const handleTextureSelect = (texture: FloorTexture | null) => {
    const urlToSet = texture ? texture.file_url : null;
    setFloorTexture(urlToSet);
    setFloorType(urlToSet ? 'textured' : 'grid'); // Corrected: 'texture' to 'textured'
    setShowTextureModal(false);
  };
  
  // RESTORED: Thumbnail related handlers
  const captureThumbnail = useCallback(async () => {
    const activeModelId = useViewerStore.getState().modelId; // Use store modelId
    if (!modelRef.current || !activeModelId || !canvasRef.current) {
      toast.error('Cannot capture thumbnail: Model or canvas not available');
      return;
    }
    if (isLocked || isAnimationPlaying) {
      toast.error('Cannot capture thumbnail while scene is locked or playing animation');
      return;
    }
    setIsCapturingThumbnail(true);
    setCapturedThumbnail(null);
    setShowThumbnailPreview(true);
    setIsThumbnailSaved(false);
    try {
      await playSound(Sounds.CAMERA_SHUTTER, 0.8);
      const captureCanvas = document.createElement('canvas');
      const captureContext = captureCanvas.getContext('2d');
      if (!captureContext) throw new Error('Could not create capture context');
      const canvas = canvasRef.current;
      captureCanvas.width = canvas.width;
      captureCanvas.height = canvas.height;
      await new Promise(resolve => requestAnimationFrame(() => {
          try {
            captureContext.drawImage(canvas, 0, 0);
            resolve(true);
        } catch (e) { resolve(false); }
      }));
      const size = Math.min(captureCanvas.width, captureCanvas.height);
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = size; tempCanvas.height = size;
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) throw new Error('Could not get 2D context for temporary canvas');
      ctx.fillStyle = '#222222'; ctx.fillRect(0, 0, size, size);
      const sourceX = (captureCanvas.width - size) / 2;
      const sourceY = (captureCanvas.height - size) / 2;
      ctx.drawImage(captureCanvas, sourceX, sourceY, size, size, 0, 0, size, size);
      const base64Image = tempCanvas.toDataURL('image/png');
      setCapturedThumbnail(base64Image);
    } catch (error) {
      console.error('Error capturing thumbnail:', error);
      toast.error('Failed to capture thumbnail', { description: error instanceof Error ? error.message : 'Unknown error' });
      setShowThumbnailPreview(false);
    } finally {
      setIsCapturingThumbnail(false);
    }
  }, [isLocked, isAnimationPlaying, playSound]); // Removed modelName dependency, use currentModelId from store via activeModelId

  const resizeImage = (base64Image: string, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = maxWidth; canvas.height = maxHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Could not get canvas context')); return; }
        ctx.fillStyle = '#222222'; ctx.fillRect(0, 0, maxWidth, maxHeight);
        ctx.drawImage(img, 0, 0, maxWidth, maxHeight);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Error loading image for resizing'));
      img.src = base64Image;
    });
  };
  
  const saveThumbnail = useCallback(async () => {
    const activeModelId = useViewerStore.getState().modelId; // Use store modelId
    if (!capturedThumbnail || !activeModelId) {
      toast.error('Thumbnail data or Model ID is missing');
      return;
    }
    setIsSavingThumbnail(true);
    let nameToUse = modelName; // modelName is local state, updated by useEffect [currentModelId]

    try {
      const resizedImage = await resizeImage(capturedThumbnail, 512, 512);
      // @ts-ignore 
      const result = await uploadThumbnailAction(activeModelId, resizedImage, nameToUse);
        if (!result.success) {
          throw new Error(`Failed to upload thumbnail: ${result.error}`);
        }
      toast.success('Thumbnail saved successfully');
      setIsThumbnailSaved(true);
      setTimeout(() => supabase.auth.refreshSession(), 500);
    } catch (error) {
      console.error('Viewer: Error saving thumbnail:', error);
      toast.error('Failed to save thumbnail', { description: error instanceof Error ? error.message : 'Unknown error', duration: 5000 });
    } finally {
      setIsSavingThumbnail(false);
    }
  }, [capturedThumbnail, modelName, resizeImage]); // supabase dep removed as it's globally available
  
  const downloadThumbnail = useCallback(async () => {
    if (!capturedThumbnail) {
      toast.error('No thumbnail to download'); return;
    }
    let nameToUse = modelName; // modelName is local state
    const now = new Date();
    const formattedDate = now.getFullYear() + ('0' + (now.getMonth() + 1)).slice(-2) + ('0' + now.getDate()).slice(-2) + ('0' + now.getHours()).slice(-2) + ('0' + now.getMinutes()).slice(-2);
    const safeModelName = nameToUse.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const filename = `${safeModelName}-${formattedDate}.png`;
    const downloadLink = document.createElement('a');
    downloadLink.href = capturedThumbnail;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    toast.success('Thumbnail downloaded');
  }, [capturedThumbnail, modelName]);

  // Keyboard Controls Effect
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      switch (event.key) {
        case 'ArrowUp': case 'w': handleCameraMove('up', true); break;
        case 'ArrowDown': case 's': handleCameraMove('down', true); break;
        case 'ArrowLeft': case 'a': handleCameraMove('left', true); break;
        case 'ArrowRight': case 'd': handleCameraMove('right', true); break;
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      switch (event.key) {
        case 'ArrowUp': case 'w': handleCameraMove('up', false); break;
        case 'ArrowDown': case 's': handleCameraMove('down', false); break;
        case 'ArrowLeft': case 'a': handleCameraMove('left', false); break;
        case 'ArrowRight': case 'd': handleCameraMove('right', false); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      setMovementDirection({ up: false, down: false, left: false, right: false });
    };
  }, [handleCameraMove]);

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new Color(sceneBackgroundColor);
    }
  }, [sceneBackgroundColor]);


  return (
    <div className={cn('relative w-full h-full min-h-screen -mt-14', className)}>
      <div className={cn(!showReticle && "hidden")}> 
          <CenterReticle />
      </div>

      <Canvas
        className="w-full h-full min-h-screen"
        ref={canvasRef}
        shadows
        camera={{ position: [5, 5, 5], fov: useViewerStore.getState().fov }}
        onCreated={({ scene }) => {
          sceneRef.current = scene; 
          scene.background = new Color(useViewerStore.getState().sceneBackgroundColor);
        }}
      >
        <Suspense fallback={null}>
          <PerspectiveCamera
            makeDefault
            position={[5, 5, 5]}
            fov={fov}
            ref={cameraRef}
          />
          {(() => {
            const controlsEnabled = !isAnimationPlaying && !isLocked;
            return (
              <OrbitControls
                ref={controlsRef}
                enableDamping
                dampingFactor={0.05}
                mouseButtons={{ LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
                enabled={controlsEnabled}
                target={[0, 1, 0]}
              />
            );
          })()}
          <Floor 
            type={gridVisible ? floorType : 'none'} 
            texture={floorTexture} 
            gridMainColor={gridColor}
          />
          <group position-y={userVerticalAdjustment}> 
            {modelUrl ? (
              <Model url={modelUrl} modelRef={modelRef} />
            ) : null}
          </group>
          <Environment preset="city" />
          {/* Basic Lighting */}
          <ambientLight intensity={Math.PI / 2} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} decay={0} intensity={Math.PI} />
          <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />

          <AnimationController 
            commands={animationCommands}
            isPlaying={isAnimationPlaying}
            playbackSpeed={animationPlaybackSpeed}
            cameraRef={cameraRef}
            controlsRef={controlsRef}
            onProgressUpdate={setAnimationProgress}
            onComplete={() => { setIsAnimationPlaying(false); setAnimationProgress(0); }}
            currentProgress={animationProgress}
            isRecording={isRecording}
          />
          <CameraMover 
            movementDirection={movementDirection}
            cameraRef={cameraRef}
            controlsRef={controlsRef}
            isLocked={isLocked}
            isPlaying={isAnimationPlaying}
          />
        </Suspense>
      </Canvas>

      <div className="absolute top-[96px] left-4 w-[200px] z-10 flex flex-col gap-4">
        <div className="bg-[#1D1D1D] rounded-xl p-4 flex flex-col flex-1 min-h-0">
          <Tabs
              value={activeLeftPanelTab}
              onValueChange={(value) => setActiveLeftPanelTab(value as 'model' | 'camera')}
              className="flex flex-col flex-1 min-h-0 gap-6"
          >
            <TabsList className="flex items-center justify-center h-[40px] w-full">
              <TabsTrigger value="model">MODEL</TabsTrigger>
              <TabsTrigger value="camera">CAMERA</TabsTrigger>
            </TabsList>
            <TabsContent value="model">
              <ErrorBoundary name="ModelSelectorTabs">
                <ModelSelectorTabs onModelSelect={handleModelSelected} />
              </ErrorBoundary>
            </TabsContent>
            <TabsContent value="camera">
              <CameraControlsPanel 
                fov={fov} 
                onFovChange={setFov} 
                onCameraReset={handleCameraReset}
              />
            </TabsContent>
          </Tabs>
        </div>
        <SceneControls
          onAddTextureClick={handleAddTextureClick}
          texture={floorTexture}
          onRemoveTexture={handleRemoveTexture}
          userVerticalAdjustment={userVerticalAdjustment}
          onUserVerticalAdjustmentChange={setUserVerticalAdjustment}
          onOpenDesignDialog={() => setIsDesignDialogOpen(true)}
        />
      </div>

      <div className="absolute top-[96px] right-4 z-10">
        <CameraAnimationSystem
          modelId={useViewerStore.getState().modelId}
          userVerticalAdjustment={userVerticalAdjustment}
          isPlaying={isAnimationPlaying}
          progress={animationProgress}
          duration={animationDuration}
          playbackSpeed={animationPlaybackSpeed}
          fov={fov}
          onPlayPause={() => {
              setIsAnimationPlaying(!isAnimationPlaying);
              if (isAnimationPlaying) setAnimationProgress(0);
          }}
          onStop={() => { setIsAnimationPlaying(false); setAnimationProgress(0); }}
          onProgressChange={setAnimationProgress}
          onSpeedChange={setAnimationPlaybackSpeed}
          onDurationChange={setAnimationDuration}
          onGeneratePath={(newCommands, newDuration) => {
            setAnimationCommands(newCommands);
            setAnimationDuration(newDuration);
            setAnimationProgress(0);
            setIsAnimationPlaying(false);
          }}
          modelRef={modelRef}
          cameraRef={cameraRef}
          controlsRef={controlsRef}
          canvasRef={canvasRef}
          disabled={!modelRef.current || !useViewerStore.getState().modelId}
          isModelLoaded={isModelLoaded && !!useViewerStore.getState().modelId}
          isRecording={isRecording}
          setIsRecording={setIsRecording}
          resetCounter={resetCounter}
        />
      </div>

      <TextureLibraryModal 
        isOpen={showTextureModal}
        onClose={() => setShowTextureModal(false)}
        onSelect={handleTextureSelect}
      />

      <BottomToolbar 
        onClearStageReset={() => setShowClearConfirm(true)}
        onToggleReticle={handleToggleReticle} 
        isReticleVisible={showReticle} 
        isReticleLoading={isReticleLoading}
        onCaptureThumbnail={captureThumbnail}
        isModelLoaded={isModelLoaded}
        isCapturingThumbnail={isCapturingThumbnail}
      />
      
      {showClearConfirm && (
        <ClearSceneConfirmPortal
          isOpen={showClearConfirm}
          onConfirm={performStageReset}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}

      <ThumbnailPreviewModal
        isOpen={showThumbnailPreview}
        onClose={() => setShowThumbnailPreview(false)}
        thumbnailImage={capturedThumbnail}
        onSetAsThumbnail={saveThumbnail}
        onDownload={downloadThumbnail}
        isProcessing={isSavingThumbnail}
        isSaved={isThumbnailSaved}
        isCapturing={isCapturingThumbnail}
      />

      <DesignSettingsDialog
        isOpen={isDesignDialogOpen}
        onOpenChange={setIsDesignDialogOpen}
        canvasBackgroundColor={sceneBackgroundColor}
        onCanvasBackgroundColorChange={setSceneBackgroundColor}
        gridVisible={gridVisible}
        onGridVisibleChange={setGridVisible}
        gridColor={gridColor}
        onGridColorChange={setGridColor}
      />
    </div>
  );
}

const Viewer = (props: ViewerProps) => (
  <ErrorBoundary name="ViewerComponent">
    <ViewerComponent {...props} />
  </ErrorBoundary>
);

export default Viewer; 