'use client';

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, PerspectiveCamera, Clock } from 'three';
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

// Helper hook to get the previous value of a prop/state
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined); // Explicitly initialize with undefined
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
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
  currentProgress,
}) => {
  const processedPathDataRef = useRef<ProcessedPathData | null>(null);
  const animationClockRef = useRef<Clock>(new Clock(false));
  const frameCounterRef = useRef(0);
  
  // Initialize with a default, but update from commands
  const fixedTargetRef = useRef(new Vector3(0, 1, 0)); 

  const prevIsPlaying = usePrevious(isPlaying);
  const prevCommands = usePrevious(commands);

  useEffect(() => {
    const commandsJustChanged = commands !== prevCommands;
    const justStartedPlaying = isPlaying && !prevIsPlaying;
    const justStoppedPlaying = !isPlaying && prevIsPlaying;
    const shouldRestart = isPlaying && commandsJustChanged;

    if (justStartedPlaying || shouldRestart) {
      if (commands.length > 0 && cameraRef.current) {
        console.log(`AnimationController: Processing commands. Reason: ${justStartedPlaying ? 'Start Playing' : 'Commands Changed'}`);
        
        // --- Update fixedTargetRef from the first command --- 
        if (commands[0]?.target) {
          fixedTargetRef.current.copy(commands[0].target);
          console.log('AnimationController: Updated fixedTargetRef to:', commands[0].target);
        } else {
          // Fallback if first command has no target (should not happen with valid commands)
          fixedTargetRef.current.set(0,1,0); 
          console.warn('AnimationController: First command missing target, using default (0,1,0) for lookAt.');
        }
        // --- End update fixedTargetRef ---

        const data = PathProcessor.process(commands); 
        processedPathDataRef.current = data;

        animationClockRef.current.stop(); 
        const progressToUse = justStartedPlaying ? currentProgress : 0;
        const initialElapsedTime = (processedPathDataRef.current?.totalDuration || 0) * (progressToUse / 100);
        console.log(`AnimationController: Setting initial time. progressToUse=${progressToUse}, initialElapsedTime=${initialElapsedTime}`);
        const safePlaybackSpeed = playbackSpeed === 0 ? 1 : playbackSpeed;
        animationClockRef.current.elapsedTime = initialElapsedTime / safePlaybackSpeed; 
        animationClockRef.current.start();

      } else {
        processedPathDataRef.current = null; 
        if (animationClockRef.current.running) {
            animationClockRef.current.stop();
        }
      }
    } 
    else if (justStoppedPlaying) {
      console.log("AnimationController: Stopping playback.");
      if (animationClockRef.current.running) {
          animationClockRef.current.stop();
      }
    }
  }, [commands, isPlaying, cameraRef, playbackSpeed, currentProgress]); // prevCommands and prevIsPlaying are not needed as direct deps here

  useFrame((state, delta) => {
    frameCounterRef.current++;
    
    if (!animationClockRef.current.running || !processedPathDataRef.current || !cameraRef.current) {
      return;
    }

    const {
      sampledPositions,
      segmentDurations,
      totalDuration,
    } = processedPathDataRef.current;

    // If totalDuration is effectively zero, complete immediately
    if (totalDuration <= 1e-6) {
       // Ensure we only call completion logic once if stopped
       if (animationClockRef.current.running) {
            animationClockRef.current.stop(); // Stop clock before calling complete
             // Apply final state if commands exist
            if (commands.length > 0 && cameraRef.current) {
                const lastCommand = commands[commands.length - 1];
                cameraRef.current.position.copy(lastCommand.position);
                cameraRef.current.lookAt(fixedTargetRef.current);
                if (controlsRef.current) {
                    controlsRef.current.target.copy(fixedTargetRef.current);
                    controlsRef.current.update();
                }
            }
            onProgressUpdate(100);
            onComplete(); // This should trigger isPlaying=false in parent
       }
       return;
    }
    
    const safePlaybackSpeed = playbackSpeed === 0 ? 1 : playbackSpeed;
    const elapsedTime = animationClockRef.current.getElapsedTime() * safePlaybackSpeed;

    // --- Animation Completion Check ---
    if (elapsedTime >= totalDuration) {
      // Ensure completion logic only runs once clock is stopped
      if (animationClockRef.current.running) {
            animationClockRef.current.stop(); // Stop clock first
            const finalSampleIndex = (sampledPositions.length / 3) - 1;
            if (finalSampleIndex >= 0) {
                cameraRef.current.position.fromArray(sampledPositions, finalSampleIndex * 3);
            }
            // Apply final lookAt
            cameraRef.current.lookAt(fixedTargetRef.current);
            
            // Sync OrbitControls target if it exists
            if (controlsRef.current) {
                controlsRef.current.target.copy(fixedTargetRef.current); // Use the same fixed target
                controlsRef.current.update();
            }

            onProgressUpdate(100);
            onComplete(); // This should trigger isPlaying=false
      }
      return;
    }

    // --- Calculate Current Position from Sampled Path ---
    const numSamples = sampledPositions.length / 3;
    const pathProgress = Math.min(1.0, elapsedTime / totalDuration);
    
    // Use precise calculation for index: floor(progress * (numSamples - 1)) ensures index stays within [0, N-1]
    // Adding 0.5 before flooring rounds to nearest, which might be slightly better visually.
    const sampleIndexFloat = pathProgress * (numSamples - 1);
    const currentSampleIndex = Math.max(0, Math.min(numSamples - 1, Math.floor(sampleIndexFloat + 0.5) ));

    if (numSamples > 0) {
         cameraRef.current.position.fromArray(sampledPositions, currentSampleIndex * 3);
         // --- Apply dynamic lookAt ---
         cameraRef.current.lookAt(fixedTargetRef.current);
    }

    // --- Update UI Progress ---
    const currentOverallProgressPercent = Math.min(100, (elapsedTime / totalDuration) * 100);
    if (frameCounterRef.current % 3 === 0) {
      onProgressUpdate(currentOverallProgressPercent);
    }
  });

  return null; // Component doesn't render anything itself
};
