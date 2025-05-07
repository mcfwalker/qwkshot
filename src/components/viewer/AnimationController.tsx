'use client';

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, PerspectiveCamera, Clock } from 'three';
// We might need a more specific type for OrbitControls ref if available
// import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'; 
import { CameraCommand } from '@/types/p2p/scene-interpreter';
import { easingFunctions, EasingFunctionName, DEFAULT_EASING } from '@/lib/easing'; 
import { PathProcessor, ProcessedPathDataV1 } from '@/features/p2p/animation/PathProcessor';

// Helper hook to get the previous value of a prop/state
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined); 
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

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
  const processedPathDataRef = useRef<ProcessedPathDataV1 | null>(null);
  const animationClockRef = useRef<Clock>(new Clock(false));
  const frameCounterRef = useRef(0);
  
  // Refs needed for original LERP target calculation
  const initialControlsTargetRef = useRef<Vector3 | null>(null); 
  // We don't need initialCameraPositionRef because position comes from spline

  const prevIsPlaying = usePrevious(isPlaying);
  const prevCommands = usePrevious(commands); // Keep for detecting command changes

  // Effect to process commands and manage clock state
  useEffect(() => {
    const commandsJustChanged = commands !== prevCommands;
    const justStartedPlaying = isPlaying && !prevIsPlaying;
    const justStoppedPlaying = !isPlaying && prevIsPlaying;
    const shouldRestart = isPlaying && commandsJustChanged;

    if (justStartedPlaying || shouldRestart) {
      if (commands.length > 0 && cameraRef.current && controlsRef.current) { // Added controlsRef check
        console.log(`AnimationController: Processing V1 commands. Reason: ${justStartedPlaying ? 'Start Playing' : 'Commands Changed'}`);
        
        // Process for position path
        const data = PathProcessor.processV1(commands); 
        processedPathDataRef.current = data;

        // Store initial target for LERP start
        initialControlsTargetRef.current = controlsRef.current.target.clone();
        
        animationClockRef.current.stop(); 
        const progressToUse = justStartedPlaying ? currentProgress : 0;
        const initialElapsedTime = (processedPathDataRef.current?.totalDuration || 0) * (progressToUse / 100);
        const safePlaybackSpeed = playbackSpeed === 0 ? 1 : playbackSpeed;
        animationClockRef.current.elapsedTime = initialElapsedTime / safePlaybackSpeed; 
        animationClockRef.current.start();

      } else {
        processedPathDataRef.current = null; 
        initialControlsTargetRef.current = null;
        if (animationClockRef.current.running) {
            animationClockRef.current.stop();
        }
      }
    } 
    else if (justStoppedPlaying) {
      if (animationClockRef.current.running) {
          animationClockRef.current.stop();
      }
    }
  }, [commands, isPlaying, cameraRef, controlsRef, playbackSpeed, currentProgress]); // Added controlsRef dependency

  useFrame((state, _delta) => {
    frameCounterRef.current++;
    
    if (!animationClockRef.current.running || !processedPathDataRef.current || !cameraRef.current || !controlsRef.current) {
      return; 
    }

    const {
      sampledPositions,
      totalDuration,
    } = processedPathDataRef.current;

    // --- Zero duration handling --- (use LERP logic for target)
    if (totalDuration <= 1e-6) {
       if (animationClockRef.current.running) {
            animationClockRef.current.stop(); 
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
            onComplete();
       }
       return;
    }
    
    const safePlaybackSpeed = playbackSpeed === 0 ? 1 : playbackSpeed;
    const elapsedTime = animationClockRef.current.getElapsedTime() * safePlaybackSpeed;

    // --- Animation Completion Check --- (use LERP logic for target)
    if (elapsedTime >= totalDuration) {
      if (animationClockRef.current.running) {
            animationClockRef.current.stop(); 
            const finalCommand = commands[commands.length - 1];
            // Use final sampled position if available, else final command position
            const finalSampleIndex = (sampledPositions.length / 3) - 1;
            if (finalSampleIndex >= 0) {
                cameraRef.current.position.fromArray(sampledPositions, finalSampleIndex * 3);
            } else {
                 cameraRef.current.position.copy(finalCommand.position);
            }
            // Use final command target
            cameraRef.current.lookAt(finalCommand.target);
            
            if (controlsRef.current) {
                controlsRef.current.target.copy(finalCommand.target);
                controlsRef.current.update();
            }
            onProgressUpdate(100);
            onComplete();
      }
      return;
    }

    // --- Calculate Current Position from Sampled Path ---
    const numSamples = sampledPositions.length / 3;
    const pathProgress = Math.min(1.0, elapsedTime / totalDuration);
    const sampleIndexFloat = pathProgress * (numSamples - 1);
    const currentSampleIndex = Math.max(0, Math.min(numSamples - 1, Math.floor(sampleIndexFloat + 0.5) )); 
    const currentPosition = new Vector3(); // Create a temp vector
    if (numSamples > 0) {
         currentPosition.fromArray(sampledPositions, currentSampleIndex * 3);
    }
    
    // --- Calculate Current Target using Original LERP Logic --- 
    const targetTimeUnadjusted = elapsedTime / safePlaybackSpeed * playbackSpeed; // = elapsedTime (if safePlaybackSpeed === playbackSpeed)
    let accumulatedDurationUnadjusted = 0;
    let currentCommandIndex = 0;
    // Find the command segment corresponding to the current unadjusted time
    while (currentCommandIndex < commands.length - 1 && 
           accumulatedDurationUnadjusted + commands[currentCommandIndex].duration < targetTimeUnadjusted) {
        accumulatedDurationUnadjusted += commands[currentCommandIndex].duration;
        currentCommandIndex++;
    }
    
    const command = commands[currentCommandIndex]; 
    if (!command) { 
        // Should not happen if completion check is working, but safety fallback
        console.warn("AnimationController: Could not find current command in useFrame.");
        if(animationClockRef.current.running) onComplete(); // Trigger completion 
        return;
    }

    // Determine start target for LERP
    const segmentStartTarget = (currentCommandIndex === 0 && initialControlsTargetRef.current)
        ? initialControlsTargetRef.current
        : commands[currentCommandIndex - 1]?.target ?? initialControlsTargetRef.current ?? new Vector3(0,1,0); // Added fallback

    const segmentEndTarget = command.target;

    // Calculate progress `t` within the current command segment (0 to 1)
    const timeElapsedInSegmentUnadjusted = targetTimeUnadjusted - accumulatedDurationUnadjusted;
    const t = command.duration > 0 
        ? Math.min(1.0, Math.max(0.0, timeElapsedInSegmentUnadjusted / command.duration)) 
        : 1.0; 

    // Apply easing
    let effectiveEasingName: EasingFunctionName = DEFAULT_EASING;
    if (command.easing && command.easing in easingFunctions) {
      effectiveEasingName = command.easing as EasingFunctionName;
    }
    const easingFunction = easingFunctions[effectiveEasingName]; 
    const easedT = easingFunction(t);

    // Interpolate target
    const currentTarget = new Vector3().lerpVectors(segmentStartTarget, segmentEndTarget, easedT);

    // --- Update Camera --- 
    cameraRef.current.position.copy(currentPosition); // Use position from spline
    cameraRef.current.lookAt(currentTarget); // Use LERPed target

    // --- Force render to canvas if recording ---
    if (isRecording) {
      state.gl.render(state.scene, state.camera);
    }
    // --- End force render ---

    // Update shared progress state (for UI slider etc.) - throttled
    if (frameCounterRef.current % 3 === 0) { 
        onProgressUpdate(Math.min(100, pathProgress * 100));
    }
    
    // Check if animation finished
    if (pathProgress >= 1.0) {
        const finalCommand = commands[commands.length - 1];
        cameraRef.current.position.copy(finalCommand.position);
        cameraRef.current.lookAt(finalCommand.target);
        
        // Sync controls to final state 
        if (controlsRef.current) {
          controlsRef.current.target.copy(finalCommand.target);
          controlsRef.current.update();
        }

        // Reset internal state and call completion callback
        processedPathDataRef.current = null;
        initialControlsTargetRef.current = null;
        onProgressUpdate(100); // Ensure UI shows 100
        onComplete(); // This should trigger isPlaying=false 
    }
  });

  // This component doesn't render anything itself
  return null;
};
