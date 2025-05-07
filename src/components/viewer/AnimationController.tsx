'use client';

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { PerspectiveCamera, Clock, Quaternion, Vector3 } from 'three';
// We might need a more specific type for OrbitControls ref if available
// import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'; 
import { CameraCommand } from '@/types/p2p/scene-interpreter';
import { easingFunctions, EasingFunctionName, DEFAULT_EASING } from '@/lib/easing'; 
import { PathProcessor, ProcessedPathDataV2 } from '@/features/p2p/animation/PathProcessor';

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
  const processedPathDataRef = useRef<ProcessedPathDataV2 | null>(null);
  const animationClockRef = useRef<Clock>(new Clock(false));
  const frameCounterRef = useRef(0);
  
  // Ref to store the consistent target for the lookAt test
  const testLookAtTargetRef = useRef<Vector3>(new Vector3(0, 1, 0)); 

  const prevIsPlaying = usePrevious(isPlaying);
  const prevCommands = usePrevious(commands);

  useEffect(() => {
    const commandsJustChanged = commands !== prevCommands;
    const justStartedPlaying = isPlaying && !prevIsPlaying;
    const justStoppedPlaying = !isPlaying && prevIsPlaying;
    const shouldRestart = isPlaying && commandsJustChanged;

    if (justStartedPlaying || shouldRestart) {
      if (commands.length > 0 && cameraRef.current) {
        console.log(`AnimationController: Processing V2 commands. Reason: ${justStartedPlaying ? 'Start Playing' : 'Commands Changed'}`);
        
        const currentCameraQuaternion = new Quaternion();
        cameraRef.current.getWorldQuaternion(currentCameraQuaternion);

        const data = PathProcessor.processV2(commands, currentCameraQuaternion);
        processedPathDataRef.current = data;
        
        animationClockRef.current.stop(); 
        const progressToUse = justStartedPlaying ? currentProgress : 0;
        const initialElapsedTime = (processedPathDataRef.current?.totalDuration || 0) * (progressToUse / 100);
        const safePlaybackSpeed = playbackSpeed === 0 ? 1 : playbackSpeed;
        animationClockRef.current.elapsedTime = initialElapsedTime / safePlaybackSpeed; 
        animationClockRef.current.start();

        // Store the target from the *first command* for the lookAt test
        if (commands[0]?.target) {
          testLookAtTargetRef.current.copy(commands[0].target);
        } else {
          testLookAtTargetRef.current.set(0,1,0); // Fallback
        }
      } else {
        processedPathDataRef.current = null; 
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
  }, [commands, isPlaying, cameraRef, playbackSpeed, currentProgress]);

  useFrame((state, _delta) => {
    frameCounterRef.current++;
    
    if (!animationClockRef.current.running || !processedPathDataRef.current || !cameraRef.current) {
      return; 
    }

    const {
      sampledPositions,
      keyframeQuaternions,
      segmentDurations,
      totalDuration,
    } = processedPathDataRef.current;

    if (totalDuration <= 1e-6) {
       if (animationClockRef.current.running) {
            animationClockRef.current.stop(); 
            if (commands.length > 0 && cameraRef.current) {
                const lastCommand = commands[commands.length - 1];
                cameraRef.current.position.copy(lastCommand.position);
                cameraRef.current.lookAt(testLookAtTargetRef.current); // Use stored target
                if (keyframeQuaternions && keyframeQuaternions.length > 0) {
                    cameraRef.current.setRotationFromQuaternion(keyframeQuaternions[keyframeQuaternions.length - 1]);
                }
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

    if (elapsedTime >= totalDuration) {
      if (animationClockRef.current.running) {
            animationClockRef.current.stop(); 
            const finalSampleIndex = (sampledPositions.length / 3) - 1;
            if (finalSampleIndex >= 0) {
                cameraRef.current.position.fromArray(sampledPositions, finalSampleIndex * 3);
            }
            if (keyframeQuaternions && keyframeQuaternions.length > 0) {
                cameraRef.current.setRotationFromQuaternion(keyframeQuaternions[keyframeQuaternions.length - 1]);
            }
            if (controlsRef.current && commands.length > 0) { 
                controlsRef.current.target.copy(commands[commands.length - 1].target);
                controlsRef.current.update();
            }
            cameraRef.current.lookAt(testLookAtTargetRef.current); // Use stored target
            onProgressUpdate(100);
            onComplete();
      }
      return;
    }

    const numSamples = sampledPositions.length / 3;
    const pathProgress = Math.min(1.0, elapsedTime / totalDuration);
    const sampleIndexFloat = pathProgress * (numSamples - 1);
    const currentSampleIndex = Math.max(0, Math.min(numSamples - 1, Math.floor(sampleIndexFloat + 0.5) )); 
    if (numSamples > 0) {
         cameraRef.current.position.fromArray(sampledPositions, currentSampleIndex * 3);
    }
    
    let accumulatedDuration = 0;
    let currentSegmentIndex = 0;
    if (segmentDurations && keyframeQuaternions && keyframeQuaternions.length === segmentDurations.length + 1) {
        for (let i = 0; i < segmentDurations.length; i++) {
          if (elapsedTime < accumulatedDuration + segmentDurations[i] || i === segmentDurations.length - 1) {
            currentSegmentIndex = i;
            break;
          }
          accumulatedDuration += segmentDurations[i];
        }

        const segmentStartTime = accumulatedDuration;
        const currentSegmentDuration = segmentDurations[currentSegmentIndex] ?? 0;
        const timeInCurrentSegment = elapsedTime - segmentStartTime;
        
        let tSegment = 0;
        if (currentSegmentDuration > 1e-6) {
          tSegment = Math.max(0, Math.min(1, timeInCurrentSegment / currentSegmentDuration));
        } else if (timeInCurrentSegment >= 0) {
          tSegment = 1.0;
        }

        const commandForEasing = commands[currentSegmentIndex];
        let easedT = tSegment;
        if (commandForEasing?.easing && commandForEasing.easing in easingFunctions) {
            const easingFunction = easingFunctions[commandForEasing.easing as EasingFunctionName];
            easedT = easingFunction(tSegment);
        } else if (DEFAULT_EASING in easingFunctions) {
            const easingFunction = easingFunctions[DEFAULT_EASING];
            easedT = easingFunction(tSegment);
        }

        const qStart = keyframeQuaternions[currentSegmentIndex]; 
        const qEnd = keyframeQuaternions[currentSegmentIndex + 1]; 

        if (qStart && qEnd) {
            // tempSlerpQuaternionRef.current.copy(qStart).slerp(qEnd, easedT);
            // cameraRef.current.setRotationFromQuaternion(tempSlerpQuaternionRef.current);
        } else if (qStart) { 
            // cameraRef.current.setRotationFromQuaternion(qStart);
        }
    } else {
        console.warn("AnimationController: Mismatched keyframeQuaternions or segmentDurations data.");
    }

    if (isRecording) {
      state.gl.render(state.scene, state.camera);
    }

    if (frameCounterRef.current % 3 === 0) { 
        onProgressUpdate(Math.min(100, pathProgress * 100));
    }
    
    if (pathProgress >= 1.0) {
        const finalCommand = commands[commands.length - 1];
        cameraRef.current.position.copy(finalCommand.position);
        if (keyframeQuaternions && keyframeQuaternions.length > 0) {
            cameraRef.current.setRotationFromQuaternion(keyframeQuaternions[keyframeQuaternions.length - 1]);
        }
        if (controlsRef.current) {
          controlsRef.current.target.copy(finalCommand.target);
          controlsRef.current.update();
        }
        processedPathDataRef.current = null;
        onProgressUpdate(100);
        onComplete();
    }

    // --- Apply LookAt for TEST ---
    if (cameraRef.current) {
        cameraRef.current.lookAt(testLookAtTargetRef.current); // Force lookAt stored target
    }
  });

  return null;
};
