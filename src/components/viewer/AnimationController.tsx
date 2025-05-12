'use client';

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
// We might need a more specific type for OrbitControls ref if available
// import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'; 
import { CameraControls } from '@react-three/drei';
// import { CameraCommand } from '@/types/p2p/scene-interpreter'; // OLD
import { ControlInstruction } from '@/types/p2p/camera-controls'; // NEW

// Remove placeholder easing functions
// const easingFunctions: Record<string, (t: number) => number> = { ... };
// type EasingFunctionName = keyof typeof easingFunctions;


interface AnimationControllerProps {
  // commands: CameraCommand[]; // OLD
  instructions: ControlInstruction[]; // NEW
  isPlaying: boolean;
  isLocked: boolean;
  // isRecording: boolean; // Removed unused prop
  playbackSpeed: number;
  // cameraRef: React.RefObject<PerspectiveCamera>; // Removed unused prop
  // controlsRef: React.RefObject<any>; // Removed unused prop
  onProgressUpdate: (progress: number) => void;
  onComplete: () => void;
  // currentProgress: number; // Removed unused prop
  duration: number;
  initialState: { position: Vector3; target: Vector3 } | null;
  triggerReset?: number; // ADDED: Prop to trigger a reset to default view
  isModelLoaded: boolean; // <<< ADD isModelLoaded prop
}

export const AnimationController: React.FC<AnimationControllerProps> = ({
  instructions, // Renamed from commands
  isPlaying,
  isLocked,
  // isRecording, // Removed from destructuring
  playbackSpeed, 
  // cameraRef, // Removed from destructuring
  // controlsRef, // Removed from destructuring
  onProgressUpdate,
  onComplete,
  // currentProgress, // Removed from destructuring
  duration,
  initialState,
  triggerReset, // ADDED: Destructure triggerReset
  isModelLoaded, // <<< Destructure isModelLoaded
}) => {
  const cameraControlsRef = useRef<CameraControls | null>(null);
  const currentInstructionIndexRef = useRef<number>(0);
  const isCancelledRef = useRef<boolean>(false);
  const runAnimationRef = useRef<() => Promise<void>>(async () => {});
  const cancelAnimationRef = useRef<() => void>(() => {});
  const isInitialStateSavedRef = useRef<boolean>(false);
  const prevTriggerResetRef = useRef<number | undefined>(triggerReset);
  const prevIsModelLoadedRef = useRef<boolean>(false);

  // === Effect 1: Set and Save Initial State ===
  // Runs when controls are ready or initial state prop changes
  useEffect(() => {
    const controls = cameraControlsRef.current;
    console.log('[AC InitEffect] Running. Controls available:', !!controls, 'Initial state:', !!initialState);
    
    // Reset the flag whenever initialState changes, forcing re-save
    isInitialStateSavedRef.current = false;
    
    if (controls && initialState) {
      const setupAndSave = async () => {
        console.log('[AC InitEffect] Controls and initialState exist. Setting and saving...');
        try {
          controls.stop();
          await controls.setLookAt(
            initialState.position.x, initialState.position.y, initialState.position.z,
            initialState.target.x, initialState.target.y, initialState.target.z,
            false // Instant snap
          );
          controls.setOrbitPoint(initialState.target.x, initialState.target.y, initialState.target.z);
          controls.saveState(); // Save this state for reset()
          isInitialStateSavedRef.current = true; // Mark as saved
          console.log('[AC InitEffect] Initial state SET and SAVED.');
        } catch (error) {
          console.error('[AC InitEffect] Error setting/saving initial state:', error);
          isInitialStateSavedRef.current = false; // Ensure flag is false on error
        }
      };
      setupAndSave(); // Execute the async setup
    } else {
      // If no controls or initialState, ensure flag is false
      isInitialStateSavedRef.current = false;
      console.log('[AC InitEffect] No controls or initialState, cannot save state.');
    }

    // No cleanup needed here, saving state doesn't require cleanup
  }, [cameraControlsRef.current, initialState]); // Depend on controls ref *value* and initialState

  // === Effect 2: Define Animation Logic ===
  useEffect(() => {
    const controls = cameraControlsRef.current;
    console.log('[AC LogicDef Effect] Defining run/cancel logic.');

    runAnimationRef.current = async () => {
      if (!controls) { console.warn('[AC Run] No controls.'); onComplete(); return; }
      if (instructions.length === 0) { console.log('[AC Run] No instructions.'); onComplete(); return; }
      
      // Check if initial state was successfully saved before running
      if (!isInitialStateSavedRef.current) {
        console.warn('[AC Run] Initial state not saved yet. Aborting run.');
        onComplete(); // Mark as complete if we can't run
        return;
      }

      // <<< RESET USING LIBRARY METHOD >>>
      console.log('[AC Run] Resetting controls via reset()...');
      try {
        controls.stop();
        await controls.reset(false); // Reset to saved state, instantly
        console.log('[AC Run] Controls reset complete.');
      } catch(resetError) {
        console.error('[AC Run] Error resetting controls via reset():', resetError);
        onComplete();
        return;
    }
      // <<< END RESET >>>

      // Reset loop state
      currentInstructionIndexRef.current = 0;
      isCancelledRef.current = false;
      onProgressUpdate(0);
      console.log('[AC Run] Starting instruction loop...');

      try {
        for (let i = 0; i < instructions.length; i++) {
          if (isCancelledRef.current) { console.log('[AC Run] Cancelled before instruction', i); break; }
          currentInstructionIndexRef.current = i;
          const instruction = instructions[i];
          const { method, args } = instruction;
          console.log(`[AC Run] Executing ${i}: ${method}`);

          if (typeof controls[method as keyof CameraControls] === 'function') {
            const deserializedArgs = args.map(arg => {
              if (arg && typeof arg === 'object' && 'x' in arg && 'y' in arg && 'z' in arg && Object.keys(arg).length === 3) {
                return new Vector3(arg.x, arg.y, arg.z);
              }
              return arg;
            });

            await (controls[method as keyof CameraControls] as (...args: any[]) => Promise<void>)(...deserializedArgs);
            if (isCancelledRef.current) { console.log('[AC Run] Cancelled after instruction', i); break; }
            console.log(`[AC Run] Completed ${i}: ${method}`);
            onProgressUpdate(((i + 1) / instructions.length) * 100);
          } else {
            console.warn(`[AC Run] Invalid method '${method}' at index ${i}. Skipping.`);
          }
        }
      } catch (error) {
        console.error('[AC Run] Error during loop:', error);
        isCancelledRef.current = true;
      } finally {
        if (!isCancelledRef.current) {
          console.log('[AC Run] Sequence finished normally.');
          onComplete();
        } else {
          console.log('[AC Run] Sequence cancelled or errored.');
        }
      }
    }; // End runAnimationRef definition

    cancelAnimationRef.current = () => {
      console.log('[AC Cancel] Setting cancel flag and stopping controls.');
      isCancelledRef.current = true;
      controls?.stop();
    };

  }, [instructions, cameraControlsRef, onComplete, onProgressUpdate, initialState]); // Keep dependencies for redefining logic

  // === Effect 3: Trigger Animation ===
  useEffect(() => {
    console.log('[AC Trigger] Running. isPlaying:', isPlaying);
    if (isPlaying) {
      if (isLocked) { console.log('[AC Trigger] isPlaying=true, isLocked=true. Playback proceeds.'); }
      console.log('[AC Trigger] isPlaying=true. Calling runAnimationRef.current().');
      runAnimationRef.current();
    } else {
      console.log('[AC Trigger] isPlaying=false. Calling cancelAnimationRef.current().');
      cancelAnimationRef.current();
    }
  }, [isPlaying, isLocked]); // Only depends on play/lock state

  // === Effect 4: Handle Manual Reset Trigger ===
  useEffect(() => {
    const controls = cameraControlsRef.current;
    const shouldTrigger = triggerReset !== undefined && triggerReset !== prevTriggerResetRef.current;
    
    if (shouldTrigger && controls) {
      console.log('[AC ResetEffect] Reset triggered! (Test: setPosition & setTarget)');
      
      const defaultPosition = new Vector3(0, 1.5, 6); 
      const defaultTarget = new Vector3(0, 1, 0);   

      const performReset = async () => {
        try {
          console.log('[AC ResetEffect] Stopping controls and setting view via setPosition/setTarget...');
          controls.stop();
          // Test 1: setPosition then setTarget
          await controls.setPosition(defaultPosition.x, defaultPosition.y, defaultPosition.z, false); // false for instant
          await controls.setTarget(defaultTarget.x, defaultTarget.y, defaultTarget.z, false);   // false for instant
          
          // Test 2 (Alternative - comment above and uncomment below if Test 1 fails to center reticle):
          // await controls.setPosition(defaultPosition.x, defaultPosition.y, defaultPosition.z, false);
          // controls.setOrbitPoint(defaultTarget.x, defaultTarget.y, defaultTarget.z); 
          // await controls.setTarget(defaultTarget.x, defaultTarget.y, defaultTarget.z, false); // Still might need setTarget after orbit point

          // controls.saveState(); // Still commented out for this test
          console.log('[AC ResetEffect] Camera view set. Reticle should be at Y=1.');
          console.log('[AC ResetEffect] Controls Position after set:', controls.getPosition(new Vector3()).toArray());
          console.log('[AC ResetEffect] Controls Target after set (focal point):', controls.getTarget(new Vector3()).toArray());

        } catch (error) {
          console.error('[AC ResetEffect] Error during camera reset:', error);
        }
      };

      performReset();
    }
    prevTriggerResetRef.current = triggerReset;

  }, [triggerReset, cameraControlsRef.current]);

  // === NEW Effect 5: Handle Initial Load Camera Set ===
  useEffect(() => {
    const controls = cameraControlsRef.current;
    // Trigger only when isModelLoaded goes from false to true
    if (isModelLoaded && !prevIsModelLoadedRef.current && controls) {
      console.log('[AC InitialLoadEffect] Model loaded. Setting initial camera view via CameraControls...');
      const initialPosition = new Vector3(0, 1.5, 6);
      const initialTarget = new Vector3(0, 1, 0); // Use the same target as reset

      const setInitialView = async () => {
        try {
          controls.stop();
          await controls.setPosition(initialPosition.x, initialPosition.y, initialPosition.z, false);
          await controls.setTarget(initialTarget.x, initialTarget.y, initialTarget.z, false);
          console.log('[AC InitialLoadEffect] Initial view set successfully.');
          // Maybe save state here too if needed for reset consistency?
          // controls.saveState();
        } catch (error) {
          console.error('[AC InitialLoadEffect] Error setting initial view:', error);
        }
      };
      setInitialView();
    }
    // Update previous value ref for edge detection
    prevIsModelLoadedRef.current = isModelLoaded;
  }, [isModelLoaded, cameraControlsRef.current]); // Depend on load state and controls ref value

  // useFrame only needed for controls.update()
  useFrame((_state, delta) => {
    // Update CameraControls
    if (cameraControlsRef.current) {
      cameraControlsRef.current.update(delta);
    }
  });

  // Experiment: Use a fraction of duration for smoothTime and factor in playbackSpeed
  const smoothTimeFactor = 0.4; 
  // Ensure playbackSpeed is not zero to avoid division by zero
  const safePlaybackSpeed = Math.max(0.01, playbackSpeed); 
  const calculatedSmoothTime = Math.max(0.1, (duration * smoothTimeFactor) / safePlaybackSpeed); // Divide by speed
  
  // Pass the calculated smoothTime, adjusted by playbackSpeed
  return <CameraControls ref={cameraControlsRef} smoothTime={calculatedSmoothTime} enabled={!isLocked} />;
};
