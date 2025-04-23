'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, PerspectiveCamera, useGLTF } from '@react-three/drei';
import { Suspense, useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Vector3, PerspectiveCamera as ThreePerspectiveCamera, Object3D, MOUSE, AxesHelper, Box3, Box3Helper, Scene, Group } from 'three';
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
import { CenterReticle } from './CenterReticle';
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { CameraControlsPanel } from './CameraControlsPanel';
import { useFrame } from '@react-three/fiber';

// Model component that handles GLTF/GLB loading and NORMALIZATION
function Model({ url, modelRef }: { url: string; modelRef: React.RefObject<Object3D | null>; }) {
  const { scene: originalScene } = useGLTF(url);
  const setModelVerticalOffset = useViewerStore((s) => s.setModelVerticalOffset);

  // Memoize the normalized model to avoid recomputation on every render
  const normalizedModelContainer = useMemo(() => {
    if (!originalScene) return null;

    console.log("Viewer.tsx <Model>: Normalizing GLTF scene...");

    // Clone scene to avoid modifying the cache from useGLTF
    const scene = originalScene.clone();

    /* --- Container-based normalization --- */
    const container = new Group();
    container.add(scene);
    // Note: We don't add container to the main scene here,
    // it will be returned by this component for the Canvas to render.

    // 1. Initial box -> scale so longest edge == 2 units (or adjust target size)
    const box1 = new Box3().setFromObject(container);
    const size1 = box1.getSize(new Vector3());
    const maxDim = Math.max(size1.x, size1.y, size1.z);
    const targetSize = 2.0; // Define the target normalized size
    const scale = maxDim > 0 ? targetSize / maxDim : 1;
    container.scale.setScalar(scale);
    console.log(`Viewer.tsx <Model>: Calculated scale: ${scale.toFixed(4)} (maxDim: ${maxDim.toFixed(4)})`);


    // 2. Recalculate box after scaling
    const box2 = new Box3().setFromObject(container);

    // 3. Translate: Lift so bottom rests on y=0 (Only Y translation)
    // We keep XZ centered around the container's local origin,
    // which is appropriate if the GLTF itself is reasonably centered.
    const offsetY = -box2.min.y; // Amount to lift (already scaled)
    container.position.set(0, offsetY, 0);
    console.log(`Viewer.tsx <Model>: Calculated offsetY: ${offsetY.toFixed(4)}`);

    // 4. Persist unscaled vertical offset for metadata
    const unscaledOffsetY = offsetY / scale;
    setModelVerticalOffset(unscaledOffsetY); // Update Zustand store
    console.log(`Viewer.tsx <Model>: Stored unscaledOffsetY: ${unscaledOffsetY.toFixed(4)}`);

    // 5. Bounding box after translation (for debugging)
    const finalBox = new Box3().setFromObject(container);
    console.log(`Viewer.tsx <Model>: Final container world box min.y: ${finalBox.min.y.toFixed(4)}, max.y: ${finalBox.max.y.toFixed(4)}`);

    return container; // Return the normalized container group

  }, [originalScene, setModelVerticalOffset]); // Dependencies

  // Update the external modelRef with the container group
  useEffect(() => {
    if (normalizedModelContainer) {
       modelRef.current = normalizedModelContainer;
    }
    // Cleanup ref when component unmounts or URL changes
    return () => { modelRef.current = null; };
  }, [normalizedModelContainer, modelRef]);

  // Render the normalized container or null if not ready
  return normalizedModelContainer ? <primitive object={normalizedModelContainer} /> : null;
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

export default function Viewer({ className, modelUrl, onModelSelect }: ViewerProps) {
  const [fov, setFov] = useState(50);
  const [userVerticalAdjustment, setUserVerticalAdjustment] = useState(0);
  const [activeLeftPanelTab, setActiveLeftPanelTab] = useState<'model' | 'camera'>('model');
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
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);

  // --- Lifted Animation State ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // Animation progress 0-100
  const [commands, setCommands] = useState<CameraCommand[]>([]);
  const [duration, setDuration] = useState(10); // Default/initial duration
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [resetCounter, setResetCounter] = useState(0); // State to trigger child reset
  // --- End Lifted State ---

  // ADD state for the current model ID within Viewer
  const [currentModelId, setCurrentModelId] = useState<string | null>(null);

  const router = useRouter();
  const modelRef = useRef<Object3D | null>(null);
  const cameraRef = useRef<ThreePerspectiveCamera>(null!);
  const controlsRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null!);
  const { isLocked, setModelId, setLock } = useViewerStore();
  const pathname = usePathname();

  const [boundingBoxHelper, setBoundingBoxHelper] = useState<Box3Helper | null>(null);
  const sceneRef = useRef<Scene | null>(null);

  // State for tracking active camera movement directions
  const [movementDirection, setMovementDirection] = useState<MovementDirection>({ up: false, down: false, left: false, right: false });

  // State to store the calculated default camera position/target after normalization
  const [defaultCameraState, setDefaultCameraState] = useState<{ position: Vector3, target: Vector3 } | null>(null);

  // Effect now depends on pathname and modelUrl
  useEffect(() => {
    let extractedModelId: string | undefined;
    // Use pathname from hook instead of window.location
    const currentPath = pathname; 
    console.log('>>> Viewer useEffect: Running. Pathname:', currentPath, 'modelUrl prop:', modelUrl);

    // Prioritize extracting from pathname
    if (currentPath) {
        const pathParts = currentPath.split('/');
        extractedModelId = pathParts.find(part => 
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(part)
        );
        console.log('>>> Viewer useEffect: Extracted from path:', extractedModelId);
    }

    // Fallback to modelUrl prop ONLY if not found in path
    if (!extractedModelId && modelUrl) {
        extractedModelId = modelUrl.split('/').find(part => 
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(part)
        );
        console.log('>>> Viewer useEffect: Extracted from modelUrl prop (fallback):', extractedModelId);
    }

    const finalModelId = extractedModelId || null;
    console.log('>>> Viewer useEffect: Final determined modelId:', finalModelId);
    // Avoid unnecessary state updates if ID hasn't changed
    setCurrentModelId(prevId => {
        if (prevId !== finalModelId) {
            // Defer the Zustand store update slightly
            setTimeout(() => setModelId(finalModelId), 0); 
            setResetCounter(prev => prev + 1); // Trigger reset only on change
            return finalModelId; // Update local state
        }
        return prevId; // Keep existing state
    }); 

  }, [pathname, modelUrl, setModelId, setResetCounter]); // ADD pathname to dependencies

  // --- Effect to Add/Remove Bounding Box Helper --- START
  useEffect(() => {
    const currentScene = sceneRef.current;
    let helper: Box3Helper | null = boundingBoxHelper; // Use state variable

    if (modelRef.current && currentScene) {
      console.log("Viewer: Model ref updated OR adjustment changed, adding/updating bounding box helper.");
      const box = new Box3().setFromObject(modelRef.current);
      
      // Calculate the world position of the wrapper group
      const wrapperWorldPosition = new Vector3(0, userVerticalAdjustment, 0);

      if (helper) {
        helper.box = box; // Update box geometry
        helper.position.copy(wrapperWorldPosition); // Update helper position
        helper.updateMatrixWorld(true);
        console.log("Viewer: Updated existing bounding box helper position:", helper.position);
      } else {
        helper = new Box3Helper(box, 0xffff00);
        helper.position.copy(wrapperWorldPosition); // Set initial position
        setBoundingBoxHelper(helper); // Update state ONLY if creating new
        currentScene.add(helper);
        console.log("Viewer: Created new bounding box helper at position:", helper.position);
      }
    } else {
      // Cleanup if model is unloaded
      if (helper && currentScene) {
        console.log("Viewer: Model null or ref changed, cleaning up bounding box helper (effect).");
        currentScene.remove(helper);
        setBoundingBoxHelper(null);
        helper = null;
      }
    }

    // Cleanup function
    return () => {
      if (helper && currentScene) {
        console.log("Viewer: Cleaning up bounding box helper (in cleanup).");
        currentScene.remove(helper);
        setBoundingBoxHelper(null); // Ensure state is cleared on unmount/dependency change
      }
    };
  }, [modelRef.current, userVerticalAdjustment]); // Corrected dependencies
  // --- Effect to Add/Remove Bounding Box Helper --- END

  // --- Camera Movement Handlers (Updated Dependencies) ---
  const handleCameraMove = useCallback((direction: 'up' | 'down' | 'left' | 'right', active: boolean) => {
    if (isLocked || isPlaying) return;
    setMovementDirection(prev => ({ ...prev, [direction]: active }));
  }, [isLocked, isPlaying]); // Dependencies: isLocked, isPlaying

  const handleCameraReset = useCallback(() => {
    if (isLocked || isPlaying) {
      toast.error('Cannot reset camera while locked or playing animation.');
      return;
    }
    if (defaultCameraState && cameraRef.current && controlsRef.current) {
      cameraRef.current.position.copy(defaultCameraState.position);
      controlsRef.current.target.copy(defaultCameraState.target);
      // controlsRef.current.update(); // Let R3F handle update on next frame
      setMovementDirection({ up: false, down: false, left: false, right: false });
      toast.info('Camera position reset to default');
    } else {
      toast.info('Default camera state not captured yet.');
    }
  }, [defaultCameraState, isLocked, isPlaying]); // Dependencies
  // --- END Camera Movement Handlers ---

  // --- Keyboard Controls Effect (Updated Dependencies) ---
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent handling if focus is inside an input/textarea
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
  }, [handleCameraMove]); // Dependency is the memoized handler
  // --- END Keyboard Controls Effect ---

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
    const urlToSet = texture ? texture.file_url : null;
    console.log('Viewer: handleTextureSelect - Setting floorTexture to:', urlToSet); // Log the URL being set
    if (texture) {
        setFloorTexture(texture.file_url); 
    } else {
        setFloorTexture(null);
    }
    setShowTextureModal(false); // Close modal
  };

  // Handler for the new reset button
  const handleClearStageReset = () => {
    if (!isConfirmingReset) {
      setIsConfirmingReset(true);
      toast.warning("Click again to confirm stage reset.");
      return;
    }

    console.log("PERFORMING STAGE RESET");

    // Use a functional update to ensure we have the latest helper state
    setBoundingBoxHelper(currentHelper => {
      if (currentHelper && sceneRef.current) {
        console.log("Reset: Explicitly removing bounding box helper (functional update).");
        sceneRef.current.remove(currentHelper);
      }
      return null; // Always set state to null after attempting removal
    });
    
    // 1. Clear Model (Trigger callback passed from parent/page)
    onModelSelect(''); // Pass empty string instead of null
    setModelId(null); // Clear model ID in store

    // 2. Reset Camera Position/Target
    if (controlsRef.current) {
      controlsRef.current.reset(); 
    }

    // 3. Reset Viewer State
    setLock(false); // Call the action from useViewerStore
    setCommands([]);
    setIsPlaying(false);
    setProgress(0);
    setDuration(10); // Reset to default duration
    setPlaybackSpeed(1); // Reset to default speed
    setFov(50); // Reset FOV
    setUserVerticalAdjustment(0);
    setFloorTexture(null); // Reset floor texture
    setGridVisible(true); // Ensure grid is visible
    // Add any other relevant state resets here

    // 4. Trigger Child Reset
    setResetCounter(prev => prev + 1); 

    // 5. Feedback & Confirmation Reset
    toast.success("Stage Reset Successfully");
    setIsConfirmingReset(false); 

    // 6. Navigate back to base viewer route
    router.push('/viewer');
  };

  // Handler to REMOVE the texture
  const handleRemoveTexture = useCallback(() => {
    setFloorTexture(null);
    toast.info("Floor texture removed."); 
  }, []);

  return (
    <div className={cn('relative w-full h-full', className)}>
      {/* Reticle Overlay - Placed after Canvas but inside relative container */}
      <CenterReticle />

      <Canvas
        className="w-full h-full"
        ref={canvasRef}
        shadows
        camera={{ position: [5, 5, 5], fov }}
        onCreated={({ scene }) => { sceneRef.current = scene; }} // Capture scene reference
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
          {(() => { // Immediately invoked function expression for logging
            const controlsEnabled = !isPlaying && !isLocked;
            console.log(`Viewer Render: Setting OrbitControls enabled=${controlsEnabled} (isPlaying=${isPlaying}, isLocked=${isLocked})`);
            return (
              <OrbitControls
                ref={controlsRef}
                enableDamping
                dampingFactor={0.05}
                mouseButtons={{
                  LEFT: MOUSE.ROTATE,
                  MIDDLE: MOUSE.DOLLY,
                  RIGHT: MOUSE.PAN
                }}
                enabled={controlsEnabled}
                target={[0, 1, 0]} // Target the approximate center of the normalized (height=2) model
              />
            );
          })()}

          {/* Floor */}
          <Floor type={gridVisible ? floorType : 'none'} texture={floorTexture} />

          {/* Model - Now wrapped in a group for user adjustment */} 
          <group position-y={userVerticalAdjustment}> 
            {modelUrl ? (
              <Model url={modelUrl} modelRef={modelRef} />
            ) : (
              /*{
                Fallback cube - Commented out
                <mesh castShadow receiveShadow ref={modelRef} position={[0, 0, 0]}>
                  <boxGeometry args={[1, 1, 1]} />
                  <meshStandardMaterial color="white" />
                </mesh>
              }*/
              null // Render nothing if no modelUrl
            )}
          </group>
          
          {/* Environment for realistic lighting */}
          <Environment preset="city" />

          {/* --- Animation Controller (Inside Canvas) --- */}
          <AnimationController 
            commands={commands}
            isPlaying={isPlaying}
            playbackSpeed={playbackSpeed}
            cameraRef={cameraRef}
            controlsRef={controlsRef}
            onProgressUpdate={setProgress} // Pass setProgress directly
            onComplete={() => { setIsPlaying(false); setProgress(0); }}
            currentProgress={progress} // Pass current progress for pause/resume
            isRecording={isRecording}
          />

          {/* --- Render CameraMover inside Canvas --- */}
          <CameraMover 
            movementDirection={movementDirection}
            cameraRef={cameraRef}
            controlsRef={controlsRef}
            isLocked={isLocked}
            isPlaying={isPlaying}
          />

        </Suspense>
      </Canvas>

      {/* This is the CORRECT container for BOTH left panels */}
      <div className="absolute top-16 left-4 w-[200px] z-10 flex flex-col gap-4"> {/* Reverted to original narrower width */} 
        {/* --- NEW Tabbed Panel for Model/Camera --- */}
        <TabsPrimitive.Root 
            value={activeLeftPanelTab}
            onValueChange={(value) => setActiveLeftPanelTab(value as 'model' | 'camera')}
            className="flex flex-col gap-4" // Use flex-col within the tab root
        >
          <TabsPrimitive.List className="flex items-center justify-center h-10 rounded-[20px] bg-[#121212] text-muted-foreground w-full">
            <TabsPrimitive.Trigger 
              value="model" 
              className={cn(
                  "flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ring-offset-background transition-all h-10 uppercase",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:pointer-events-none disabled:opacity-50",
                  activeLeftPanelTab === 'model' ? "bg-[#1D1D1D] text-foreground shadow-sm rounded-[20px]" : "hover:text-foreground/80"
              )}
            >
              MODEL
            </TabsPrimitive.Trigger>
            <TabsPrimitive.Trigger 
              value="camera" 
              className={cn(
                  "flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ring-offset-background transition-all h-10 uppercase",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:pointer-events-none disabled:opacity-50",
                  activeLeftPanelTab === 'camera' ? "bg-[#1D1D1D] text-foreground shadow-sm rounded-[20px]" : "hover:text-foreground/80"
              )}
            >
              CAMERA
            </TabsPrimitive.Trigger>
          </TabsPrimitive.List>

          {/* Model Tab Content */}
          <TabsPrimitive.Content value="model">
            <ErrorBoundary name="ModelSelectorTabs">
              <ModelSelectorTabs onModelSelect={onModelSelect} />
            </ErrorBoundary>
          </TabsPrimitive.Content>

          {/* Camera Tab Content (Placeholder for now) */}
          <TabsPrimitive.Content value="camera">
            <CameraControlsPanel 
              fov={fov} 
              onFovChange={setFov} 
              onCameraMove={handleCameraMove} // Pass real handler
              onCameraReset={handleCameraReset} // Pass real handler
            />
          </TabsPrimitive.Content>

        </TabsPrimitive.Root>
        {/* --- END Tabbed Panel --- */}
        
        {/* Scene Controls (Remains separate below the tabs) */}
        <SceneControls
          userVerticalAdjustment={userVerticalAdjustment}
          onUserVerticalAdjustmentChange={setUserVerticalAdjustment}
          gridVisible={gridVisible}
          onGridToggle={handleGridToggle}
          onAddTextureClick={handleAddTextureClick}
          texture={floorTexture}
          onRemoveTexture={handleRemoveTexture}
        />
      </div>

      {/* Camera Animation System */}
      <div className="absolute top-16 right-4 z-10">
        <CameraAnimationSystem
          // PASS modelId as prop
          modelId={currentModelId}
          userVerticalAdjustment={userVerticalAdjustment}
          // Pass down relevant state
          isPlaying={isPlaying}
          progress={progress}
          duration={duration} 
          playbackSpeed={playbackSpeed}
          fov={fov}
          // Pass down relevant handlers/callbacks
          onPlayPause={isPlaying ? () => { setIsPlaying(false); setProgress(0); } : () => { setIsPlaying(true); setProgress(0); }}
          onStop={() => { setIsPlaying(false); setProgress(0); }}
          onProgressChange={setProgress}
          onSpeedChange={setPlaybackSpeed}
          onDurationChange={setDuration}
          onGeneratePath={(commands, duration) => {
            setCommands(commands);
            setDuration(duration);
            setProgress(0);
            setIsPlaying(false);
          }}
          // Pass down refs needed by CameraAnimationSystem (e.g., for lock, download)
          modelRef={modelRef}
          cameraRef={cameraRef}
          controlsRef={controlsRef}
          canvasRef={canvasRef}
          // Other props
          disabled={!modelRef.current}
          isModelLoaded={!!modelUrl}
          isRecording={isRecording}
          setIsRecording={setIsRecording}
          resetCounter={resetCounter}
        />
      </div>

      {/* Camera telemetry display - Center Position */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <CameraTelemetry
          cameraRef={cameraRef}
          controlsRef={controlsRef}
        />
      </div>

      {/* Texture Modal - onSelect prop matches now */}
      <TextureLibraryModal 
        isOpen={showTextureModal}
        onClose={() => setShowTextureModal(false)} // Just close, don't call handleTextureSelect
        onSelect={handleTextureSelect}
      />

      {/* Clear Stage Button - Conditionally Rendered */}
      {modelUrl && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10">
          <Button
            variant="ghost" // Keep ghost for base structure, override visuals
            // Remove size="sm"
            className={cn(
              // Flex layout (already default for button)
              // Size & Padding
              "h-10 px-6 py-0",
              // Appearance
              "rounded-full border border-[#444] bg-[#121212]",
              // Hover state
              "hover:bg-[#1f1f1f]", 
              // Text style
              "text-foreground/80 hover:text-foreground",
              // Remove backdrop blur if present
              // Keep default focus/disabled states from variant if needed
            )}
            onClick={handleClearStageReset}
          >
            {isConfirmingReset ? "Confirm Reset?" : "Clear Stage & Reset"}
          </Button>
        </div>
      )}
    </div>
  );
} 