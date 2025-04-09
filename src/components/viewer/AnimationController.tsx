'use client';

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, PerspectiveCamera } from 'three';
// We might need a more specific type for OrbitControls ref if available
// import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'; 
import { CameraCommand } from '@/types/p2p/scene-interpreter';

// Import easing functions (assuming a shared utility path)
// Adjust path if necessary
import { easingFunctions, EasingFunctionName } from '@/features/p2p/scene-interpreter/interpreter'; 

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
  const frameCounterRef = useRef(0); // For throttling UI updates

  useFrame((state, delta) => {
    frameCounterRef.current++;
    
    if (!isPlaying || commands.length === 0 || !cameraRef.current || !controlsRef.current) {
      // Reset start time if we stop playing mid-animation to ensure correct restart
      startTimeRef.current = null;
      return; // Exit if not playing or prerequisites missing
    }

    const totalDuration = commands.reduce((sum, cmd) => sum + cmd.duration, 0) / playbackSpeed; // Adjust total duration by speed
    // --- Stricter Duration Check ---
    if (totalDuration <= 1e-6) { // Use a small epsilon instead of just > 0
        if (isPlaying) {
            onProgressUpdate(100);
            onComplete();
        }
        return;
    } 

    // Initialize start time and initial state on the first frame of playback *or* after scrubbing
    if (startTimeRef.current === null) {
        // Calculate adjusted start time based on current progress prop
        const startProgressValue = currentProgress / 100; // Use prop
        startTimeRef.current = state.clock.elapsedTime - (startProgressValue * totalDuration); 
        initialCameraPositionRef.current = cameraRef.current.position.clone();
        initialControlsTargetRef.current = controlsRef.current.target.clone();
    }

    // Calculate elapsed time and progress, adjusted by playback speed
    const elapsedTime = state.clock.elapsedTime - startTimeRef.current;
    let currentOverallProgress = Math.min(1.0, elapsedTime / totalDuration); // Progress based on adjusted duration
    
    const clampedProgressPercent = Math.min(100, currentOverallProgress * 100);

    // Calculate target time based on unadjusted durations for segment finding
    const targetTimeUnadjusted = elapsedTime * playbackSpeed; 

    // Find the current segment based on unadjusted time
    let accumulatedDurationUnadjusted = 0;
    let currentCommandIndex = 0;
    while (currentCommandIndex < commands.length - 1 && 
           accumulatedDurationUnadjusted + commands[currentCommandIndex].duration < targetTimeUnadjusted) {
        accumulatedDurationUnadjusted += commands[currentCommandIndex].duration;
        currentCommandIndex++;
    }
    
    const command = commands[currentCommandIndex];
    if (!command) { 
        onComplete(); // Trigger completion cleanup
        return;
    }

    // Determine start state for the LERP (handle potential missing previous command)
    const segmentStartPos = (currentCommandIndex === 0 && initialCameraPositionRef.current)
        ? initialCameraPositionRef.current
        : commands[currentCommandIndex - 1]?.position ?? initialCameraPositionRef.current ?? new Vector3(); 
    const segmentStartTarget = (currentCommandIndex === 0 && initialControlsTargetRef.current)
        ? initialControlsTargetRef.current
        : commands[currentCommandIndex - 1]?.target ?? initialControlsTargetRef.current ?? new Vector3(); 

    const segmentEndPos = command.position;
    const segmentEndTarget = command.target;

    // Calculate time elapsed *within the current segment* (using unadjusted time)
    const timeElapsedInSegmentUnadjusted = targetTimeUnadjusted - accumulatedDurationUnadjusted;
    // Calculate progress `t` within the current segment (0 to 1)
    const t = command.duration > 0 
        ? Math.min(1.0, Math.max(0.0, timeElapsedInSegmentUnadjusted / command.duration)) 
        : 1.0; 

    // Apply easing
    const easingName = command.easing || 'linear';
    const easingFunction = easingFunctions[easingName as EasingFunctionName] || easingFunctions.linear;
    const easedT = easingFunction(t);

    // Interpolate position and target
    const currentPosition = new Vector3().lerpVectors(segmentStartPos, segmentEndPos, easedT);
    const currentTarget = new Vector3().lerpVectors(segmentStartTarget, segmentEndTarget, easedT);

    // --- Update camera directly --- 
    cameraRef.current.position.copy(currentPosition);
    cameraRef.current.lookAt(currentTarget);
    // cameraRef.current.updateMatrixWorld(true); // Maybe needed?

    // --- Force render to canvas if recording ---
    if (isRecording) {
      state.gl.render(state.scene, state.camera);
    }
    // --- End force render ---

    // Update shared progress state (for UI slider etc.) - throttled
    if (frameCounterRef.current % 3 === 0) { 
        onProgressUpdate(clampedProgressPercent);
    }
    
    // Check if animation finished
    if (currentOverallProgress >= 1.0) {
        const finalCommand = commands[commands.length - 1];
        cameraRef.current.position.copy(finalCommand.position);
        cameraRef.current.lookAt(finalCommand.target);
        
        // Sync controls to final state 
        if (controlsRef.current) {
          controlsRef.current.target.copy(finalCommand.target);
          controlsRef.current.update();
        }

        // Reset internal state and call completion callback
        startTimeRef.current = null;
        initialCameraPositionRef.current = null; 
        initialControlsTargetRef.current = null;
        onProgressUpdate(100); // Ensure UI shows 100
        onComplete(); // This should trigger isPlaying=false 
    }
  });

  // This component doesn't render anything itself
  return null;
};
