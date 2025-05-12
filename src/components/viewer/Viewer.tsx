'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, PerspectiveCamera, useGLTF } from '@react-three/drei';
import { Suspense, useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Vector3, PerspectiveCamera as ThreePerspectiveCamera, Object3D, MOUSE, Scene } from 'three';
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
import { ControlInstruction } from '@/types/p2p/camera-controls';
import { AnimationController } from './AnimationController';
import { usePathname, useRouter } from 'next/navigation';
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { CameraControlsPanel } from './CameraControlsPanel';
import { useFrame } from '@react-three/fiber';
import { CenterReticle } from './CenterReticle';
import { BottomToolbar } from './BottomToolbar';
import React from 'react';
import { ClearSceneConfirmPortal } from './ClearSceneConfirmPortal';
import { supabase } from '@/lib/supabase';
import { uploadThumbnailAction } from '@/app/actions/thumbnail';
import { playSound, Sounds } from '@/lib/soundUtils';
import { ThumbnailPreviewModal } from './ThumbnailPreviewModal';

// Model component - simplified to load GLTF/GLB without client normalization
function Model({ url, modelRef, onLoad }: { 
  url: string; 
  modelRef: React.RefObject<Object3D | null>;
  onLoad?: () => void;
}) {
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
       // Call onLoad callback when model is ready
       onLoad?.();
    }
    // Cleanup ref when component unmounts or URL changes
    return () => { modelRef.current = null; };
  }, [clonedScene, modelRef, onLoad]); // Added onLoad to dependencies

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
  const moveVector = useMemo(() => new Vector3(), []);

  // Define World Axes
  const worldAxisX = useMemo(() => new Vector3(1, 0, 0), []);
  const worldAxisY = useMemo(() => new Vector3(0, 1, 0), []);

  useFrame((_state, delta) => {
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
  const [fov, setFov] = useState(50);
  const [userVerticalAdjustment, setUserVerticalAdjustment] = useState(0);
  const [activeLeftPanelTab, setActiveLeftPanelTab] = useState<'model' | 'camera'>(modelUrl ? 'camera' : 'model');
  const [floorType] = useState<FloorType>('grid');
  const [floorTexture, setFloorTexture] = useState<string | null>(null);
  const [gridVisible, setGridVisible] = useState<boolean>(true);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [instructions, setInstructions] = useState<ControlInstruction[]>([]);
  const [duration, setDuration] = useState(10);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [resetCounter, setResetCounter] = useState(0);
  const [initialAnimationState, setInitialAnimationState] = useState<{ position: Vector3; target: Vector3 } | null>(null);
  const [cameraResetTrigger, setCameraResetTrigger] = useState<number>(0);
  const [currentModelId, setCurrentModelId] = useState<string | null>(null);
  const [showTextureModal, setShowTextureModal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showReticle, setShowReticle] = useState(true);
  const [isReticleLoading, setIsReticleLoading] = useState(false);
  const [isCapturingThumbnail, setIsCapturingThumbnail] = useState(false);
  const [showThumbnailPreview, setShowThumbnailPreview] = useState(false);
  const [capturedThumbnail, setCapturedThumbnail] = useState<string | null>(null);
  const [isSavingThumbnail, setIsSavingThumbnail] = useState(false);
  const [isThumbnailSaved, setIsThumbnailSaved] = useState(false);
  const [modelName, setModelName] = useState<string>('model');
  const [modelCenter, setModelCenter] = useState<Vector3>(new Vector3(0, 1, 0));

  const router = useRouter();
  const modelRef = useRef<Object3D | null>(null);
  const cameraRef = useRef<ThreePerspectiveCamera>(null!);
  const controlsRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null!);
  const { isLocked, setModelId, setLock } = useViewerStore();
  const pathname = usePathname();

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
    console.log('[Viewer] handleCameraReset: Triggering camera reset via counter.');
    setCameraResetTrigger(prev => prev + 1); // Increment counter to trigger effect in AnimationController
    toast.info('Camera reset requested.');
  }, [isLocked, isPlaying]);

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

    // 1. Clear Model (Trigger callback passed from parent/page)
    onModelSelect(''); // Pass empty string instead of null
    setModelId(null); // Clear model ID in store

    // 2. Reset Camera Position/Target
    if (controlsRef.current) {
      controlsRef.current.reset(); 
    }

    // 3. Reset Viewer State
    setLock(false); // Call the action from useViewerStore
    setInstructions([]);
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
    setShowClearConfirm(false);
    setActiveLeftPanelTab('model'); // Switch back to model tab
    router.push('/viewer');

    setInitialAnimationState(null); // Reset initial state on clear
  }, [onModelSelect, setModelId, setLock, setInstructions, setIsPlaying, setProgress, setDuration, setPlaybackSpeed, setFov, setUserVerticalAdjustment, setFloorTexture, setGridVisible, setResetCounter, router, setActiveLeftPanelTab]);

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

  // Handler for capturing thumbnail
  const handleCaptureThumbnail = useCallback(async () => {
    if (!canvasRef.current || !currentModelId) return;

    try {
      setIsCapturingThumbnail(true);
      const canvas = canvasRef.current;
      const thumbnail = canvas.toDataURL('image/png');
      setCapturedThumbnail(thumbnail);
      setShowThumbnailPreview(true);
    } catch (error) {
      console.error('Error capturing thumbnail:', error);
      toast.error('Failed to capture thumbnail');
    } finally {
      setIsCapturingThumbnail(false);
    }
  }, [currentModelId]);
  
  // Effect to fetch model name AND CENTER when currentModelId changes
  useEffect(() => {
    // Log the ID *outside* the async function to see its value when the effect triggers
    console.log('[Effect Trigger] currentModelId:', currentModelId);

    if (currentModelId) {
      const fetchModelData = async () => {
        // Log the ID *inside* the async function right before the query
        console.log('[Query Start] Fetching data for currentModelId:', currentModelId);
        try {
          // Log auth status right before the query
          const session = await supabase.auth.getSession();
          console.log('Auth session state before fetch:', session?.data?.session);
          const user = session?.data?.session?.user;
          console.log('User role before fetch:', user?.role);

          // Fetch name and metadata using maybeSingle()
          const { data, error } = await supabase
            .from('models')
            .select('name, metadata')
            .eq('id', currentModelId)
            .maybeSingle(); // Use maybeSingle() instead of single()

          if (error) {
             console.error('Fetch query failed:', error); // Log if the query itself errors
             throw error;
          }

          if (data) {
            // This block now runs only if data is not null (0 rows case handled)
            console.log('Received data (name & metadata):', data);
            setModelName(data.name || 'model');

            // Extract and set model center
            const centerData = data.metadata?.geometry?.center;
            if (centerData && typeof centerData.x === 'number' && typeof centerData.y === 'number' && typeof centerData.z === 'number') {
              console.log('Setting model center to:', centerData);
              setModelCenter(new Vector3(centerData.x, centerData.y, centerData.z));
            } else {
              console.warn('Model center data not found or invalid in metadata, using default [0, 1, 0].');
              setModelCenter(new Vector3(0, 1, 0));
            }
          } else {
            // This block runs if maybeSingle() returned null (0 rows)
            console.warn(`Model data not found for ID: ${currentModelId}. Using default center.`);
            setModelName('model');
            setModelCenter(new Vector3(0, 1, 0));
          }
        } catch (err) {
          console.error('Error during model data fetch process:', err);
          setModelName('model');
          setModelCenter(new Vector3(0, 1, 0));
        }
      };

      fetchModelData();
    } else {
      // Handle case where currentModelId is null/falsy initially
      console.log('[Effect Trigger] currentModelId is null or falsy. Resetting state.');
      setModelName('model');
      setModelCenter(new Vector3(0, 1, 0));
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

  const handleModelLoad = useCallback(() => {
    setIsModelLoaded(true);
    setActiveLeftPanelTab('camera');
    setShowReticle(true);
    setIsReticleLoading(true);
    setTimeout(() => setIsReticleLoading(false), 1000);
  }, []);

  return (
    <div className={cn('relative w-full h-full min-h-screen -mt-14', className)}>
      {/* Reticle Overlay - Conditionally render based on showReticle */}
      {showReticle && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
          <CenterReticle />
        </div>
      )}

      <Canvas
        className="w-full h-full min-h-screen"
        ref={canvasRef}
        shadows
        onCreated={({ scene }) => { sceneRef.current = scene; }}
      >
        <Suspense fallback={null}>
          {/* Camera setup */}
          <PerspectiveCamera
            makeDefault
            position={[0, 1.5, 6]}
            fov={fov}
            ref={cameraRef}
          />

          {/* Controls */}
          {(() => {
            const controlsEnabled = !isPlaying && !isLocked;
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
                target={modelCenter.toArray()}
              />
            );
          })()}

          {/* Floor */}
          <Floor type={gridVisible ? floorType : 'none'} texture={floorTexture} />

          {/* Model */}
          <group position-y={userVerticalAdjustment}>
            {modelUrl ? (
              <Model url={modelUrl} modelRef={modelRef} onLoad={handleModelLoad} />
            ) : null}
          </group>

          {/* Environment */}
          <Environment preset="city" />

          {/* --- Animation Controller --- */}
          <AnimationController 
            instructions={instructions}
            isPlaying={isPlaying}
            isLocked={isLocked}
            playbackSpeed={playbackSpeed}
            onProgressUpdate={setProgress}
            onComplete={() => { setIsPlaying(false); setProgress(0); }}
            duration={duration}
            initialState={initialAnimationState}
            isModelLoaded={isModelLoaded}
            triggerReset={cameraResetTrigger}
          />

          {/* --- Camera Mover --- */}
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
      <div className="absolute top-[96px] left-4 w-[200px] z-10 flex flex-col gap-4"> {/* Changed from top-16 to top-[96px] */} 
        {/* --- NEW Tabbed Panel for Model/Camera --- */}
        <TabsPrimitive.Root 
            value={activeLeftPanelTab}
            onValueChange={(value) => setActiveLeftPanelTab(value as 'model' | 'camera')}
            className="flex flex-col gap-4" // Use flex-col within the tab root
        >
          <TabsPrimitive.List className="flex items-center justify-center h-10 rounded-xl bg-[#121212] text-muted-foreground w-full">
            <TabsPrimitive.Trigger 
              value="model" 
              className={cn(
                  "flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ring-offset-background transition-all h-10 uppercase",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:pointer-events-none disabled:opacity-50",
                  activeLeftPanelTab === 'model' ? "bg-[#1D1D1D] text-[#C2F751] shadow-sm rounded-xl" : "hover:text-foreground/80"
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
                  activeLeftPanelTab === 'camera' ? "bg-[#1D1D1D] text-[#C2F751] shadow-sm rounded-xl" : "hover:text-foreground/80"
              )}
            >
              CAMERA
            </TabsPrimitive.Trigger>
          </TabsPrimitive.List>

          {/* Model Tab Content */}
          <TabsPrimitive.Content value="model">
            <ErrorBoundary name="ModelSelectorTabs">
              <ModelSelectorTabs onModelSelect={handleModelSelected} />
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
      <div className="absolute top-[96px] right-4 z-10"> {/* Changed from top-16 to top-[96px] */}
        <CameraAnimationSystem
          modelId={currentModelId}
          userVerticalAdjustment={userVerticalAdjustment}
          isPlaying={isPlaying}
          progress={progress}
          duration={duration} 
          playbackSpeed={playbackSpeed}
          fov={fov}
          onPlayPause={isPlaying ? () => { setIsPlaying(false); setProgress(0); } : () => { setIsPlaying(true); setProgress(0); }}
          onStop={() => { setIsPlaying(false); setProgress(0); }}
          onProgressChange={setProgress}
          onSpeedChange={setPlaybackSpeed}
          onDurationChange={setDuration}
          onGeneratePath={(instructions, duration, initialState) => {
            setInstructions(instructions);
            setDuration(duration);
            setInitialAnimationState(initialState);
            setProgress(0);
            setIsPlaying(false);
          }}
          modelRef={modelRef}
          cameraRef={cameraRef}
          controlsRef={controlsRef}
          canvasRef={canvasRef}
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
        modelName={modelName}
      />
    </div>
  );
}

export default React.memo(ViewerComponent); 