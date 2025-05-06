'use client';

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, PerspectiveCamera, Quaternion, Clock } from 'three';
// We might need a more specific type for OrbitControls ref if available
// import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'; 
import { CameraCommand } from '@/types/p2p/scene-interpreter';

// Import easing functions (assuming a shared utility path)
// Adjust path if necessary
import { easingFunctions, EasingFunctionName, DEFAULT_EASING } from '@/lib/easing'; 

// +++ Add PathProcessor imports +++
import { PathProcessor, ProcessedPathData } from '@/features/p2p/animation/PathProcessor';

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
  currentProgress, // Will be used to set initial animation time
}) => {
  // --- Refs for new smoothing logic ---
  const processedPathDataRef = useRef<ProcessedPathData | null>(null);
  const animationClockRef = useRef<Clock>(new Clock(false)); // Autostart false
  const tempSlerpQuaternionRef = useRef<Quaternion>(new Quaternion()); // For Slerp calculations

  // --- Existing refs (some might be repurposed or removed if logic changes) ---
  // startTimeRef might be replaced by animationClockRef.elapsedTime logic
  // initialCameraPositionRef and initialControlsTargetRef are handled by PathProcessor's initial orientation

  const frameCounterRef = useRef(0); // For throttling UI updates

  // Effect to process commands when they change or playback starts/stops
  useEffect(() => {
    if (isPlaying && commands.length > 0 && cameraRef.current) {
      const currentCameraQuaternion = new Quaternion();
      cameraRef.current.getWorldQuaternion(currentCameraQuaternion);
      
      const data = PathProcessor.process(commands, currentCameraQuaternion);
      processedPathDataRef.current = data;

      animationClockRef.current.stop(); // Reset clock
      // Adjust start time based on currentProgress to allow resuming
      const initialElapsedTime = (processedPathDataRef.current?.totalDuration || 0) * (currentProgress / 100);
      animationClockRef.current.elapsedTime = initialElapsedTime / playbackSpeed; // Adjust for playback speed
      animationClockRef.current.start();
      
      // If recording, immediately apply the first frame's state (start of the path)
      // This might need more careful handling with pre-sampled paths.
      // For now, let PathProcessor handle the full path generation.
      // The useFrame will pick up from the correct starting point due to adjusted elapsedTime.

    } else if (!isPlaying) {
      animationClockRef.current.stop();
      // Optionally clear processed data if not playing to free memory
      // processedPathDataRef.current = null; 
    }
  }, [commands, isPlaying, cameraRef, currentProgress, playbackSpeed]); // Added playbackSpeed to dependencies

  useFrame((state, delta) => {
    frameCounterRef.current++;
    
    if (!isPlaying || !processedPathDataRef.current || !cameraRef.current) {
      // If not playing or no data, ensure clock is stopped
      if (!isPlaying && animationClockRef.current.running) {
        animationClockRef.current.stop();
      }
      return; 
    }

    const {
      sampledPositions,
      keyframeQuaternions,
      segmentDurations,
      totalDuration,
    } = processedPathDataRef.current;

    // If totalDuration is effectively zero, complete immediately
    if (totalDuration <= 1e-6) {
      if (isPlaying) {
        // Apply final state if commands exist
        if (commands.length > 0 && cameraRef.current) {
            const lastCommand = commands[commands.length - 1];
            cameraRef.current.position.copy(lastCommand.position);
            cameraRef.current.lookAt(lastCommand.target);
            if (controlsRef.current) {
                controlsRef.current.target.copy(lastCommand.target);
                controlsRef.current.update();
            }
        }
        onProgressUpdate(100);
        onComplete(); // This should trigger isPlaying=false in parent
      }
      return;
    }
    
    // Get elapsed time, adjusted for playback speed
    // Clock's elapsedTime is already managed correctly with start/stop and initial setting
    const elapsedTime = animationClockRef.current.getElapsedTime() * playbackSpeed;

    // --- Animation Completion Check ---
    if (elapsedTime >= totalDuration) {
      // Apply final state precisely from the end of the sampled path / last quaternion
      const finalSampleIndex = (sampledPositions.length / 3) - 1;
      if (finalSampleIndex >= 0) {
        cameraRef.current.position.fromArray(sampledPositions, finalSampleIndex * 3);
      }
      if (keyframeQuaternions.length > 0) {
        cameraRef.current.setRotationFromQuaternion(keyframeQuaternions[keyframeQuaternions.length - 1]);
      }
      
      // Sync OrbitControls target if it exists (using last command's target)
      if (controlsRef.current && commands.length > 0) {
        controlsRef.current.target.copy(commands[commands.length - 1].target);
        controlsRef.current.update();
      }

      onProgressUpdate(100);
      onComplete(); // This should trigger isPlaying=false
      return;
    }

    // --- Calculate Current Position from Sampled Path ---
    const numSamples = sampledPositions.length / 3;
    // Ensure pathProgress doesn't exceed 1 to prevent out-of-bounds access if elapsedTime slightly overshoots
    const pathProgress = Math.min(1.0, elapsedTime / totalDuration); 
    
    // Ensure sampleIndex is within bounds [0, numSamples - 1]
    // For pathProgress = 1.0, sampleIndex should be numSamples - 1
    // For pathProgress = 0.0, sampleIndex should be 0
    const sampleIndex = Math.max(0, Math.min(numSamples - 1, Math.floor(pathProgress * (numSamples -1) + 0.5) )); // add 0.5 for rounding to nearest sample
                                                                                                          // or Math.floor(pathProgress * numSamples) for flooring
                                                                                                          // Let's use flooring approach as it's simpler for start of path
    const currentSampleIndex = Math.min(numSamples - 1, Math.floor(pathProgress * numSamples));


    if (currentSampleIndex * 3 + 2 < sampledPositions.length) {
        cameraRef.current.position.fromArray(sampledPositions, currentSampleIndex * 3);
    } else if (numSamples > 0) { // Fallback to last sample if calculation is off
        cameraRef.current.position.fromArray(sampledPositions, (numSamples - 1) * 3);
    }


    // --- Calculate Current Orientation using Slerp ---
    let accumulatedDuration = 0;
    let currentSegmentIndex = 0;
    for (let i = 0; i < segmentDurations.length; i++) {
      // elapsedTime is already adjusted for playbackSpeed
      if (elapsedTime < accumulatedDuration + segmentDurations[i]) {
        currentSegmentIndex = i;
        break;
      }
      accumulatedDuration += segmentDurations[i];
      // If elapsedTime matches or exceeds total sum of durations, stick to last segment
      if (i === segmentDurations.length - 1 && elapsedTime >= accumulatedDuration) {
          currentSegmentIndex = i;
          break;
      }
    }
    // Ensure currentSegmentIndex is valid for keyframeQuaternions (which has N+1 elements)
    // N commands = N segments = N segmentDurations. N+1 keyframeQuaternions.
    // So currentSegmentIndex should go from 0 to segmentDurations.length - 1
    currentSegmentIndex = Math.min(currentSegmentIndex, keyframeQuaternions.length - 2); 
    currentSegmentIndex = Math.max(0, currentSegmentIndex); // Ensure it's not negative if segmentDurations is empty


    const segmentStartTime = accumulatedDuration;
    const currentSegmentDuration = segmentDurations[currentSegmentIndex] ?? 0; // Handle undefined if array empty
    const timeInCurrentSegment = elapsedTime - segmentStartTime;
    
    let tSegment = 0; // Normalized time (0 to 1) within the current segment
    if (currentSegmentDuration > 1e-6) { 
      tSegment = Math.max(0, Math.min(1, timeInCurrentSegment / currentSegmentDuration));
    } else if (timeInCurrentSegment >= 0 && currentSegmentDuration <= 1e-6) { // Snap to end for zero/tiny duration segments
      tSegment = 1.0;
    }

    // Apply original per-segment easing if command specifies it
    const commandForEasing = commands[currentSegmentIndex];
    if (commandForEasing?.easing && commandForEasing.easing in easingFunctions) {
        const easingFunction = easingFunctions[commandForEasing.easing as EasingFunctionName];
        tSegment = easingFunction(tSegment);
    } else if (DEFAULT_EASING in easingFunctions) { // Fallback to default project easing
        const easingFunction = easingFunctions[DEFAULT_EASING];
        tSegment = easingFunction(tSegment);
    }
    // If no easing, tSegment remains linear

    const qStart = keyframeQuaternions[currentSegmentIndex];
    // Ensure qEnd index is valid
    const qEndIndex = Math.min(currentSegmentIndex + 1, keyframeQuaternions.length - 1);
    const qEnd = keyframeQuaternions[qEndIndex];

    if (qStart && qEnd) { // Ensure quaternions are valid
        tempSlerpQuaternionRef.current.copy(qStart).slerp(qEnd, tSegment);
        cameraRef.current.setRotationFromQuaternion(tempSlerpQuaternionRef.current);
    } else if (qStart) { // If qEnd is somehow invalid, just use qStart
        cameraRef.current.setRotationFromQuaternion(qStart);
    }
    // If both are invalid, orientation remains unchanged from previous frame (less ideal)


    // --- Force render to canvas if recording ---
    if (isRecording) {
      // state.gl.render(state.scene, state.camera); // This can be expensive
      // Consider if this is still the best approach for recording smoothed paths.
      // For now, retain if it was working, but it might interact oddly.
    }

    // --- Update UI Progress ---
    const currentOverallProgressPercent = Math.min(100, (elapsedTime / totalDuration) * 100);
    if (frameCounterRef.current % 3 === 0) { 
      onProgressUpdate(currentOverallProgressPercent);
    }
  });

  return null; // Component doesn't render anything itself
};
