'use client';

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, PerspectiveCamera } from 'three';
// We might need a more specific type for OrbitControls ref if available
// import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'; 
import { CameraControls } from '@react-three/drei';
// import { CameraCommand } from '@/types/p2p/scene-interpreter'; // OLD
import { ControlInstruction } from '@/types/p2p/camera-controls'; // NEW

// Import easing functions (assuming a shared utility path)
// Adjust path if necessary
import { easingFunctions, EasingFunctionName, DEFAULT_EASING } from '@/lib/easing'; 

// Remove placeholder easing functions
// const easingFunctions: Record<string, (t: number) => number> = { ... };
// type EasingFunctionName = keyof typeof easingFunctions;


interface AnimationControllerProps {
  // commands: CameraCommand[]; // OLD
  instructions: ControlInstruction[]; // NEW
  isPlaying: boolean;
  isLocked: boolean;
  isRecording: boolean;
  playbackSpeed: number;
  cameraRef: React.RefObject<PerspectiveCamera>;
  controlsRef: React.RefObject<any>;
  onProgressUpdate: (progress: number) => void;
  onComplete: () => void;
  currentProgress: number;
  duration: number;
}

export const AnimationController: React.FC<AnimationControllerProps> = ({
  instructions, // Renamed from commands
  isPlaying,
  isLocked,
  isRecording,
  playbackSpeed,
  cameraRef,
  controlsRef,
  onProgressUpdate,
  onComplete,
  currentProgress,
  duration,
}) => {
  const cameraControlsRef = useRef<CameraControls | null>(null);

  // Effect to handle instruction execution
  useEffect(() => {
    const controls = cameraControlsRef.current;
    let isCancelled = false;

    const executeInstructions = async () => {
      // Ensure controls are available before starting
      if (!controls || instructions.length === 0) {
        console.log('[AnimationController] No controls or instructions, completing.');
        onComplete(); // Call onComplete even if no instructions
        return;
      }
      
      console.log('[AnimationController] Starting execution (v2 logic)... ', instructions);
      onProgressUpdate(0);

      try {
        for (let i = 0; i < instructions.length; i++) {
          // Check cancellation flag BEFORE the async operation
          if (isCancelled) {
            console.log('[AnimationController] Execution cancelled before starting instruction', i + 1);
            break;
          }

          const instruction = instructions[i];
          const { method, args } = instruction;

          console.log(`[AnimationController] Executing instruction ${i + 1}: ${method}`, args);
          
          if (typeof controls[method as keyof CameraControls] === 'function') {
            const deserializedArgs = args.map(arg => {
              if (arg && typeof arg === 'object' && 'x' in arg && 'y' in arg && 'z' in arg && Object.keys(arg).length === 3) {
                return new Vector3(arg.x, arg.y, arg.z);
              }
              return arg;
            });
            
            // Await the camera-controls method
            await (controls[method as keyof CameraControls] as (...args: any[]) => Promise<void>)(...deserializedArgs);
            
            // Check cancellation flag AFTER the async operation completes
            if (isCancelled) {
              console.log('[AnimationController] Execution cancelled after completing instruction', i + 1);
              break;
            }

            // Update progress only if not cancelled
            console.log(`[AnimationController] Completed instruction ${i + 1}: ${method}`);
            onProgressUpdate(((i + 1) / instructions.length) * 100);
          } else {
            console.warn(`[AnimationController] Invalid method '${method}' called on CameraControls.`);
            // If an invalid method is encountered, should we cancel?
            // For now, continue to the next instruction.
          }
        }
      } catch (error) {
        console.error('[AnimationController] Error during instruction execution:', error);
        // Consider calling onComplete or notifying parent? For now, just log.
      } finally {
        // Call onComplete only if the loop finished naturally (wasn't cancelled)
        if (!isCancelled) {
          console.log('[AnimationController] Execution loop finished normally. Calling onComplete.');
          onComplete();
        } else {
          console.log('[AnimationController] Execution loop cancelled or errored. Not calling onComplete from finally.');
        }
      }
    };

    // Trigger execution only if playing (Lock should NOT prevent playback)
    if (isPlaying) {
      console.log('[AnimationController] useEffect triggered: isPlaying=true. Starting execution.');
      executeInstructions();
    } else {
      console.log(`[AnimationController] useEffect triggered but isPlaying=false.`);
    }

    // Cleanup function: This runs when dependencies change OR component unmounts.
    return () => {
      console.log('[AnimationController] Cleanup effect running. Setting isCancelled=true.');
      isCancelled = true;
      // Explicitly stop any ongoing transitions when the effect cleans up
      // This helps prevent transitions continuing after state changes (like pausing)
      // controls?.stop(); // Consider enabling this if pause needs immediate stop
    };
  }, [isPlaying, instructions, cameraControlsRef, onComplete, onProgressUpdate]);

  // useFrame only needed for controls.update()
  useFrame((state, delta) => {
    // Update CameraControls
    if (cameraControlsRef.current) {
      cameraControlsRef.current.update(delta);
    }
  });

  // Render CameraControls, passing down duration as smoothTime
  // Also disable user interaction if the scene is locked.
  return <CameraControls ref={cameraControlsRef} smoothTime={duration} enabled={!isLocked} />;
};
