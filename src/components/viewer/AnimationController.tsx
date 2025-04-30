'use client';

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, PerspectiveCamera, Quaternion } from 'three';
// We might need a more specific type for OrbitControls ref if available
// import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'; 
import { CameraCommand } from '@/types/p2p/scene-interpreter';

// Import easing functions (assuming a shared utility path)
// Adjust path if necessary
import { easingFunctions, EasingFunctionName, DEFAULT_EASING } from '@/lib/easing'; 

// Remove placeholder easing functions
// const easingFunctions: Record<string, (t: number) => number> = { ... };
// type EasingFunctionName = keyof typeof easingFunctions;


interface AnimationControllerProps {
  commands: CameraCommand[];
  isPlaying: boolean;
  isRecording: boolean;
  playbackSpeed: number;
  cameraRef: React.RefObject<PerspectiveCamera>;
  // Use 'any' for now, replace with specific OrbitControls type if available and needed
  controlsRef: React.RefObject<any>; 
  onProgressUpdate: (progress: number) => void;
  onComplete: () => void;
  // Progress state from parent, needed for pause/resume
  currentProgress: number; 
}

export const AnimationController: React.FC<AnimationControllerProps> = ({
  commands,
  isPlaying,
  isRecording,
  playbackSpeed, 
  cameraRef,
  controlsRef,
  onProgressUpdate,
  onComplete,
  currentProgress, // Receive current progress from parent
}) => {
  const startTimeRef = useRef<number | null>(null);
  const initialCameraPositionRef = useRef<Vector3 | null>(null);
  const initialControlsTargetRef = useRef<Vector3 | null>(null);
  const initialCameraOrientationRef = useRef<Quaternion | null>(null);
  const frameCounterRef = useRef(0); // For throttling UI updates
  const startQuat = useRef(new Quaternion()).current;
  const endQuat = useRef(new Quaternion()).current;
  const currentQuat = useRef(new Quaternion()).current;

  useFrame((state, delta) => {
    frameCounterRef.current++;
    
    if (!isPlaying || commands.length === 0 || !cameraRef.current || !controlsRef.current) {
      startTimeRef.current = null;
      return; 
    }

    const totalDuration = commands.reduce((sum, cmd) => sum + cmd.duration, 0) / playbackSpeed;
    if (totalDuration <= 1e-6) { 
        if (isPlaying) {
            onProgressUpdate(100);
            onComplete();
        }
        return;
    } 

    if (startTimeRef.current === null) {
        if (commands.length > 0 && cameraRef.current) {
            const firstCommand = commands[0];
            cameraRef.current.position.copy(firstCommand.position);
            if (firstCommand.orientation) {
                cameraRef.current.quaternion.copy(firstCommand.orientation);
            } else {
                cameraRef.current.lookAt(firstCommand.target); 
            }
            initialCameraOrientationRef.current = cameraRef.current.quaternion.clone();

            if (isRecording) {
              state.gl.render(state.scene, state.camera);
              console.log("AnimationController: Forced render of initial frame for recording");
            }
        }

        const startProgressValue = currentProgress / 100; 
        startTimeRef.current = state.clock.elapsedTime - (startProgressValue * totalDuration); 
        initialCameraPositionRef.current = cameraRef.current.position.clone();
        initialControlsTargetRef.current = controlsRef.current.target.clone();
    }

    const elapsedTime = state.clock.elapsedTime - startTimeRef.current;
    let currentOverallProgress = Math.min(1.0, elapsedTime / totalDuration);
    const clampedProgressPercent = Math.min(100, currentOverallProgress * 100);
    const targetTimeUnadjusted = elapsedTime * playbackSpeed; 

    let accumulatedDurationUnadjusted = 0;
    let currentCommandIndex = 0;
    while (currentCommandIndex < commands.length - 1 && 
           accumulatedDurationUnadjusted + commands[currentCommandIndex].duration < targetTimeUnadjusted) {
        accumulatedDurationUnadjusted += commands[currentCommandIndex].duration;
        currentCommandIndex++;
    }
    
    const command = commands[currentCommandIndex];
    const prevCommand = commands[currentCommandIndex - 1];

    if (!command) { 
        onComplete(); 
        return;
    }

    const segmentStartPos = prevCommand?.position ?? initialCameraPositionRef.current ?? new Vector3(); 
    const segmentStartTarget = prevCommand?.target ?? initialControlsTargetRef.current ?? new Vector3(); 
    const segmentStartOrientation = prevCommand?.orientation ?? initialCameraOrientationRef.current ?? new Quaternion();

    const segmentEndPos = command.position;
    const segmentEndTarget = command.target;
    const segmentEndOrientationOrNull = command.orientation;

    const isExplicitOrientationSegment = !!(prevCommand?.orientation || currentCommandIndex === 0) && !!segmentEndOrientationOrNull;

    const timeElapsedInSegmentUnadjusted = targetTimeUnadjusted - accumulatedDurationUnadjusted;
    const t = command.duration > 0 
        ? Math.min(1.0, Math.max(0.0, timeElapsedInSegmentUnadjusted / command.duration)) 
        : 1.0; 

    let effectiveEasingName: EasingFunctionName = command.easing && command.easing in easingFunctions 
        ? command.easing as EasingFunctionName 
        : DEFAULT_EASING;
    const easingFunction = easingFunctions[effectiveEasingName]; 
    const easedT = easingFunction(t);

    const currentPosition = new Vector3().lerpVectors(segmentStartPos, segmentEndPos, easedT);
    
    // --- Set Orientation (Conditional) --- 
    if (isExplicitOrientationSegment && segmentEndOrientationOrNull) {
        // Roll / Explicit Orientation: Use SLERP
        startQuat.copy(segmentStartOrientation);
        endQuat.copy(segmentEndOrientationOrNull); // Use the non-null version
        currentQuat.slerpQuaternions(startQuat, endQuat, easedT);
        cameraRef.current.quaternion.copy(currentQuat);
        // console.log('AnimationController: Applying orientation via SLERP'); 
    } else {
        // Other movements: Use lookAt
        const currentTarget = new Vector3().lerpVectors(segmentStartTarget, segmentEndTarget, easedT);
        // Ensure camera UP is world vertical before lookAt
        cameraRef.current.up.set(0, 1, 0);
        // <<< UNCOMMENT lookAt >>>
        cameraRef.current.lookAt(currentTarget);
        // console.log('AnimationController: Applying orientation via lookAt'); 
    }
    // --- End Set Orientation --- 

    cameraRef.current.position.copy(currentPosition);

    if (isRecording) {
      state.gl.render(state.scene, state.camera);
    }

    if (frameCounterRef.current % 3 === 0) { 
        onProgressUpdate(clampedProgressPercent);
    }
    
    if (currentOverallProgress >= 1.0) {
        const finalCommand = commands[commands.length - 1];
        cameraRef.current.position.copy(finalCommand.position);
        if (finalCommand.orientation) {
            cameraRef.current.quaternion.copy(finalCommand.orientation);
        } else {
            cameraRef.current.lookAt(finalCommand.target); 
        }
        
        // Sync controls target 
        if (controlsRef.current) {
          // Determine final target to sync controls with
          const finalTargetToSync = finalCommand.target; 
          if (finalTargetToSync instanceof Vector3 && 
              isFinite(finalTargetToSync.x) && 
              isFinite(finalTargetToSync.y) && 
              isFinite(finalTargetToSync.z)) {
             // <<< COMMENT OUT target sync and update >>>
             // controlsRef.current.target.copy(finalTargetToSync);
             // controlsRef.current.update(); // Let controls know target changed
             console.log("AnimationController: [Debug] Skipping controls target sync on complete.");
          } else {
             console.warn("AnimationController: Final command target is invalid, cannot sync controls target.");
          }
        }

        startTimeRef.current = null;
        initialCameraPositionRef.current = null; 
        initialControlsTargetRef.current = null;
        initialCameraOrientationRef.current = null;
        onProgressUpdate(100); 
        onComplete(); 
    }
  });

  return null;
};
