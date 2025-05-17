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
  const [sceneBackgroundColor, setSceneBackgroundColor] = useState('#121212'); // Changed to #121212
  const [fov, setFov] = useState(50);
  const [userVerticalAdjustment, setUserVerticalAdjustment] = useState(0);
  const [activeLeftPanelTab, setActiveLeftPanelTab] = useState<'model' | 'camera'>(modelUrl ? 'camera' : 'model');
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
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // --- State for Toolbar Toggles ---
  // const [showBoundingBox, setShowBoundingBox] = useState(true); 
  // const [isBoundingBoxLoading, setIsBoundingBoxLoading] = useState(false);
  const [showReticle, setShowReticle] = useState(true);       
  const [isReticleLoading, setIsReticleLoading] = useState(false);

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

  // Use useRef to track previous model URL value
  const prevModelUrlRef = useRef<string | null>(null);

  // Effect to set the active tab to camera when a model is loaded
  useEffect(() => {
    // If we go from no model to having a model, switch to camera tab
    if (!prevModelUrlRef.current && modelUrl) {
      setActiveLeftPanelTab('camera');
    }
    
    // Update previous value ref
    prevModelUrlRef.current = modelUrl;
  }, [modelUrl]);

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
    if (cameraRef.current && controlsRef.current) {
      // Define hardcoded initial state
      // Adjust target to be approx center of normalized model (Y=1)
      // Adjust position to be relative to new target (e.g., higher and back)
      const initialPosition = new Vector3(0, 2, 5); // Example: Above and in front
      const initialTarget = new Vector3(0, 1, 0); // Target center of normalized model

      cameraRef.current.position.copy(initialPosition);
      controlsRef.current.target.copy(initialTarget);
      // controlsRef.current.update(); // Let R3F handle update
      setMovementDirection({ up: false, down: false, left: false, right: false });
      toast.info('Camera position reset');
    } else {
      toast.error('Camera references not available for reset.');
    }
  }, [isLocked, isPlaying]); // Removed defaultCameraState dependency
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
  const handleClearStageReset = useCallback(() => {
    // Check if user has opted out of confirmation dialog
    const dontShowConfirm = localStorage.getItem('dontShowClearConfirm') === 'true';
    
    if (dontShowConfirm) {
      // Skip dialog and perform reset directly
      performStageReset();
    } else {
      // Show confirmation dialog
      setShowClearConfirm(true);
    }
  }, []);
  
  // Function to perform the actual reset
  const performStageReset = useCallback(() => {
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

    // 5. Feedback & Reset Confirmation State
    toast.success("Stage Reset Successfully");
    setIsConfirmingReset(false);
    setShowClearConfirm(false);
    setActiveLeftPanelTab('model'); // Switch back to model tab
    router.push('/viewer');
  }, [onModelSelect, setModelId, setLock, setCommands, setIsPlaying, setProgress, setDuration, setPlaybackSpeed, setFov, setUserVerticalAdjustment, setFloorTexture, setGridVisible, setResetCounter, router, setActiveLeftPanelTab]);

  // Handler to REMOVE the texture
  const handleRemoveTexture = useCallback(() => {
    setFloorTexture(null);
    // toast.info("Floor texture removed."); // Removing this toast notification
  }, []);

  // >>> NEW Handler for model selection <<<
  const handleModelSelected = useCallback((modelId: string | null) => {
    // Call the original prop function passed from the parent
    onModelSelect(modelId); 

    // If a valid model was selected, switch to the camera tab
    if (modelId) {
      console.log('[Viewer.tsx] Model selected, switching to camera tab.');
      setActiveLeftPanelTab('camera');
    }
    // Optionally, switch back to model tab if model is cleared?
    // else {
    //   setActiveLeftPanelTab('model'); 
    // }
  }, [onModelSelect, setActiveLeftPanelTab]); // Dependencies

  // --- Toggle Handlers with Loading State ---
  // Removed handleToggleBoundingBox

  const handleToggleReticle = useCallback(() => {
      if (isReticleLoading) return; 
      console.log(`[Viewer.tsx] handleToggleReticle called. Current showReticle: ${showReticle}`); 
      setIsReticleLoading(true);
      setShowReticle(prev => !prev);
      setTimeout(() => setIsReticleLoading(false), 1000); // Reduce timeout to 1000ms
  }, [showReticle, isReticleLoading]); 

  const [isCapturingThumbnail, setIsCapturingThumbnail] = useState(false);
  const [showThumbnailPreview, setShowThumbnailPreview] = useState(false);
  const [capturedThumbnail, setCapturedThumbnail] = useState<string | null>(null);
  const [isSavingThumbnail, setIsSavingThumbnail] = useState(false);
  const [isThumbnailSaved, setIsThumbnailSaved] = useState(false);

  // Handler for capturing thumbnail
  const handleCaptureThumbnail = useCallback(async () => {
    if (!modelRef.current || !currentModelId || !canvasRef.current) {
      toast.error('Cannot capture thumbnail: Model or canvas not available');
      return;
    }
    
    if (isLocked || isPlaying) {
      toast.error('Cannot capture thumbnail while scene is locked or playing animation');
      return;
    }

    // Directly fetch the model name to ensure it's up-to-date
    if (currentModelId) {
      try {
        const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/models?id=eq.${currentModelId}&select=name`;
        console.log('Capture thumbnail: Fetching model name from:', apiUrl);
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0 && data[0].name) {
            console.log('Capture thumbnail: Setting model name to:', data[0].name);
            setModelName(data[0].name);
          }
        }
      } catch (error) {
        console.error('Error fetching model name during capture:', error);
        // Continue with capture even if name fetch fails
      }
    }

    // Show the modal immediately with loading state
    setIsCapturingThumbnail(true);
    setCapturedThumbnail(null);
    setShowThumbnailPreview(true);
    setIsThumbnailSaved(false);
    
    try {
      // Play camera shutter sound
      await playSound(Sounds.CAMERA_SHUTTER, 0.8);
      
      // Create a copy of canvas DOM element with rendering
      const captureCanvas = document.createElement('canvas');
      const captureContext = captureCanvas.getContext('2d');
      
      if (!captureContext) {
        throw new Error('Could not create capture context');
      }
      
      // Match dimensions of original canvas
      const canvas = canvasRef.current;
      captureCanvas.width = canvas.width;
      captureCanvas.height = canvas.height;
      
      // For debugging purposes
      console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);
      
      // Force a render by requesting an animation frame and waiting
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          try {
            // Draw the existing canvas to our capture canvas
            captureContext.drawImage(canvas, 0, 0);
            resolve(true);
          } catch (e) {
            console.error('Error during capture:', e);
            resolve(false);
          }
        });
      });
      
      // Create a square crop
      const size = Math.min(captureCanvas.width, captureCanvas.height);
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = size;
      tempCanvas.height = size;
      const ctx = tempCanvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Could not get 2D context for temporary canvas');
      }
      
      // Draw a clean dark background
      ctx.fillStyle = '#222222'; // Slightly darker than black for better contrast
      ctx.fillRect(0, 0, size, size);
      
      // Calculate the position to crop from (center of original canvas)
      const sourceX = (captureCanvas.width - size) / 2;
      const sourceY = (captureCanvas.height - size) / 2;
      
      // Draw the cropped region to the temp canvas
      ctx.drawImage(
        captureCanvas,
        sourceX, sourceY, size, size, // Source rectangle
        0, 0, size, size // Destination rectangle
      );
      
      // Convert the canvas to a base64 data URL
      const base64Image = tempCanvas.toDataURL('image/png');
      
      // Store the thumbnail to show in modal
      setCapturedThumbnail(base64Image);
      
    } catch (error) {
      console.error('Error capturing thumbnail:', error);
      toast.error('Failed to capture thumbnail', { 
        description: error instanceof Error ? error.message : 'Unknown error' 
      });
      // Close modal on error
      setShowThumbnailPreview(false);
    } finally {
      setIsCapturingThumbnail(false);
    }
  }, [modelRef, currentModelId, canvasRef, isLocked, isPlaying]);
  
  const [modelName, setModelName] = useState<string>('model');
  
  // Effect to fetch model name when currentModelId changes
  useEffect(() => {
    if (currentModelId) {
      const fetchModelName = async () => {
        console.log('Starting to fetch model name for ID:', currentModelId);
        try {
          // Use a direct fetch request instead of the Supabase client
          // This bypasses potential client configuration issues
          const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/models?id=eq.${currentModelId}&select=name`;
          console.log('Fetching from URL:', apiUrl);
          
          // Use fetch API directly with proper headers
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
          console.log('Received data for model name:', data);
          if (data && data.length > 0 && data[0].name) {
            console.log('Setting model name to:', data[0].name);
            setModelName(data[0].name || 'model');
          } else {
            console.log('Model name not found in response:', data);
            setModelName('model');
          }
        } catch (err) {
          console.error('Error fetching model name:', err);
          // Use a default name instead of failing
          setModelName('model');
        }
      };
      
      fetchModelName();
    }
  }, [currentModelId]);
  
  // Function to resize an image to specific dimensions
  const resizeImage = (base64Image: string, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Create a canvas to resize the image
        const canvas = document.createElement('canvas');
        canvas.width = maxWidth;
        canvas.height = maxHeight;
        
        // Draw the image on the canvas at the reduced size
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        // Draw with black background
        ctx.fillStyle = '#222222';
        ctx.fillRect(0, 0, maxWidth, maxHeight);
        
        // Draw the image centered
        ctx.drawImage(img, 0, 0, maxWidth, maxHeight);
        
        // Get the reduced image as base64
        const resizedImage = canvas.toDataURL('image/png');
        resolve(resizedImage);
      };
      
      img.onerror = () => {
        reject(new Error('Error loading image for resizing'));
      };
      
      img.src = base64Image;
    });
  };
  
  // Handler for saving thumbnail to server
  const handleSaveThumbnail = useCallback(async () => {
    if (!capturedThumbnail || !currentModelId) {
      toast.error('Thumbnail data is missing');
      return;
    }
    
    setIsSavingThumbnail(true);
    
    // Get the most up-to-date model name directly before saving
    let nameToUse = modelName;
    
    if (nameToUse === 'model' || !nameToUse) {
      try {
        // Use Supabase client directly instead of fetch API
        const { data, error } = await supabase
          .from('models')
          .select('name')
          .eq('id', currentModelId)
          .single();
          
        if (!error && data && data.name) {
          console.log('Save: Got fresh model name from DB:', data.name);
          nameToUse = data.name;
          // Also update the state for future use
          setModelName(data.name);
        } else {
          console.error('Error fetching name before save:', error);
        }
      } catch (err) {
        console.error('Exception fetching model name:', err);
      }
    }
    
    try {
      // Resize the image to a more reasonable size for storage (512x512)
      const resizedImage = await resizeImage(capturedThumbnail, 512, 512);
      
      console.log('Viewer: Uploading optimized thumbnail via server action for model ID:', currentModelId);
      console.log('Viewer: Using model name for server action:', nameToUse);
      
      // Use the server action to upload the resized image with the model name
      let result;

      try {
        // First try with the model name parameter
        // @ts-ignore - Ignore type error because server action accepts optional third parameter
        result = await uploadThumbnailAction(currentModelId, resizedImage, nameToUse);
        
        if (!result.success) {
          console.error('Viewer: Thumbnail upload failed with error:', result.error);
          throw new Error(`Failed to upload thumbnail: ${result.error}`);
        }
      } catch (uploadError) {
        console.error('Error attempting upload with model name:', uploadError);
        
        // Fallback to calling without the model name param if there was an error
        console.log('Falling back to standard upload without model name parameter');
        // @ts-ignore - Intentionally ignore TS errors for fallback approach
        result = await uploadThumbnailAction(currentModelId, resizedImage);
        
        if (!result.success) {
          console.error('Viewer: Fallback thumbnail upload failed with error:', result.error);
          throw new Error(`Failed to upload thumbnail: ${result.error}`);
        }
      }
      
      console.log('Viewer: Thumbnail uploaded successfully, URL:', result.url);
      toast.success('Thumbnail saved successfully');
      
      // Keep the modal open, user may want to download the image too
      // Mark as saved to update the UI
      setIsThumbnailSaved(true);
      
      // Force a refresh after a brief delay to ensure the UI updates
      setTimeout(() => {
        supabase.auth.refreshSession();
      }, 500);
      
    } catch (error) {
      console.error('Viewer: Error saving thumbnail:', error);
      toast.error('Failed to save thumbnail', { 
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 5000 // Show error longer
      });
    } finally {
      setIsSavingThumbnail(false);
    }
  }, [capturedThumbnail, currentModelId, modelName]);
  
  // Handler for downloading the thumbnail
  const handleDownloadThumbnail = useCallback(async () => {
    if (!capturedThumbnail) {
      toast.error('No thumbnail to download');
      return;
    }
    
    console.log('Download thumbnail - current model name state:', modelName);
    
    // Get the most up-to-date model name directly before downloading
    let nameToUse = modelName;
    
    if (currentModelId && nameToUse === 'model') {
      try {
        // Use Supabase client directly instead of fetch API
        const { data, error } = await supabase
          .from('models')
          .select('name')
          .eq('id', currentModelId)
          .single();
          
        if (!error && data && data.name) {
          console.log('Download: Got fresh model name from DB:', data.name);
          nameToUse = data.name;
          // Also update the state for future use
          setModelName(data.name);
        } else {
          console.error('Error fetching name before download:', error);
        }
      } catch (err) {
        console.error('Exception fetching model name:', err);
      }
    }
    
    // Create a formatted date string for the filename
    const now = new Date();
    const formattedDate = now.getFullYear() +
      ('0' + (now.getMonth() + 1)).slice(-2) +
      ('0' + now.getDate()).slice(-2) +
      ('0' + now.getHours()).slice(-2) +
      ('0' + now.getMinutes()).slice(-2);
    
    // Create a sanitized version of the model name (remove characters that aren't good for filenames)
    const safeModelName = nameToUse.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    console.log('Using safe model name for download:', safeModelName);
    
    // Create filename 
    const filename = `${safeModelName}-${formattedDate}.png`;
    console.log('Generated download filename:', filename);
    
    // Create a temporary link element
    const downloadLink = document.createElement('a');
    downloadLink.href = capturedThumbnail;
    downloadLink.download = filename;
    
    // Append to the document, click it, and remove it
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    toast.success('Thumbnail downloaded');
  }, [capturedThumbnail, modelName, currentModelId]);

  // Effect to update scene background color when it changes
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new Color(sceneBackgroundColor);
    }
  }, [sceneBackgroundColor]);

  return (
    <div className={cn('relative w-full h-full min-h-screen -mt-14', className)}>
      {/* Reticle Overlay - Conditionally HIDE via className */}
      <div className={cn(!showReticle && "hidden")}> 
          <CenterReticle />
      </div>

      <Canvas
        className="w-full h-full min-h-screen"
        ref={canvasRef}
        shadows
        camera={{ position: [5, 5, 5], fov }}
        onCreated={({ scene, gl }) => { 
          sceneRef.current = scene; 
          scene.background = new Color(sceneBackgroundColor); // Set initial background color
          // gl.setClearColor(new Color(sceneBackgroundColor)); // Alternative: set renderer clear color
        }} // Capture scene reference and set initial background
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
      <div className="absolute top-[96px] left-4 w-[200px] z-10 flex flex-col gap-4"> {/* REMOVED bg, rounded, p-4 */}
        {/* --- NEW Tabbed Panel for Model/Camera --- */}
        {/* ADDED Wrapper Div for Model/Camera Tabs Panel with styling */}
        <div className="bg-[#1D1D1D] rounded-xl p-4 flex flex-col flex-1 min-h-0">
          <Tabs
              value={activeLeftPanelTab}
              onValueChange={(value) => setActiveLeftPanelTab(value as 'model' | 'camera')}
              className="flex flex-col flex-1 min-h-0 gap-6" // Use flex-col within the tab root
          >
            <TabsList className="flex items-center justify-center h-[40px] w-full"> {/* Changed from TabsPrimitive.List. No gap for 200px panel, no bg/rounding */}
              <TabsTrigger
                value="model"
              >
                MODEL
              </TabsTrigger>
              <TabsTrigger
                value="camera"
              >
                CAMERA
              </TabsTrigger>
            </TabsList>

            {/* Model Tab Content */}
            <TabsContent value="model">
              <ErrorBoundary name="ModelSelectorTabs">
                <ModelSelectorTabs onModelSelect={handleModelSelected} />
              </ErrorBoundary>
            </TabsContent>

            {/* Camera Tab Content (Placeholder for now) */}
            <TabsContent value="camera">
              <CameraControlsPanel 
                fov={fov} 
                onFovChange={setFov} 
                onCameraReset={handleCameraReset} // Pass real handler
              />
            </TabsContent>

          </Tabs>
        </div> {/* END of ADDED Wrapper Div for Model/Camera Tabs Panel */}
        {/* --- END Tabbed Panel --- */}
        
        {/* Scene Controls (Remains separate below the tabs, now a direct sibling to the Model/Camera panel div) */}
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
      <div className="absolute top-[96px] right-4 z-10"> {/* Changed from top-16 to top-[96px] */}
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

      {/* Camera telemetry display - Comment Out Wrapper Div Too */}
      {/* 
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <CameraTelemetry
          cameraRef={cameraRef}
          controlsRef={controlsRef}
        />
      </div>
      */}

      {/* Texture Modal - onSelect prop matches now */}
      <TextureLibraryModal 
        isOpen={showTextureModal}
        onClose={() => setShowTextureModal(false)} // Just close, don't call handleTextureSelect
        onSelect={handleTextureSelect}
      />

      {/* >>> Render Basic BottomToolbar <<< */}
      <BottomToolbar 
        onClearStageReset={handleClearStageReset} 
        // >>> Add Reticle Props <<<
        onToggleReticle={handleToggleReticle} 
        isReticleVisible={showReticle} 
        isReticleLoading={isReticleLoading}
        // >>> Add Thumbnail Props <<< 
        onCaptureThumbnail={handleCaptureThumbnail}
        isModelLoaded={!!modelUrl}
        isCapturingThumbnail={isCapturingThumbnail}
      />
      
      {/* Clear Scene Confirmation Dialog */}
      {showClearConfirm && (
        <ClearSceneConfirmPortal
          isOpen={showClearConfirm}
          onConfirm={performStageReset}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}

      {/* Thumbnail Preview Modal */}
      <ThumbnailPreviewModal
        isOpen={showThumbnailPreview}
        onClose={() => setShowThumbnailPreview(false)}
        thumbnailImage={capturedThumbnail}
        onSetAsThumbnail={handleSaveThumbnail}
        onDownload={handleDownloadThumbnail}
        isProcessing={isSavingThumbnail}
        isSaved={isThumbnailSaved}
        isCapturing={isCapturingThumbnail}
      />
    </div>
  );
}

export default React.memo(ViewerComponent); 