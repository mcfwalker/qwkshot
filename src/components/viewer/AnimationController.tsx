'use client';

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, PerspectiveCamera, Quaternion, CatmullRomCurve3 } from 'three';
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
  // --- Add cache for generated curves ---
  const orbitCurveCacheRef = useRef<Record<number, CatmullRomCurve3>>({});
  // -------------------------------------

  useFrame((state, delta) => {
    // >>> Add log at the VERY START of useFrame <<<
    // console.log(`useFrame running: isPlaying=${isPlaying}, commands.length=${commands.length}, cameraRef=${!!cameraRef.current}`);

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

    // --- MODIFIED: Interpolate Position (Curve or Linear) ---
    let currentPosition: Vector3;
    const isOrbitSegment = command.animationType === 'orbit';
    // <<< Add log to inspect command type >>>
    console.log(`Frame Check: cmd Index=${currentCommandIndex}, type=${command.animationType}, duration=${command.duration}, isOrbit=${isOrbitSegment}`);

    if (isOrbitSegment) {
      // Get or create the curve for this orbit segment
      let curve = orbitCurveCacheRef.current[currentCommandIndex];
      if (!curve) {
        const orbitCenter = segmentEndTarget; // Orbit commands have the center as target
        const startVec = new Vector3().subVectors(segmentStartPos, orbitCenter);
        const endVec = new Vector3().subVectors(segmentEndPos, orbitCenter);

        // Estimate radius and axis (crude estimate, assumes Y-axis orbit if vectors are parallel)
        const radius = startVec.length();
        let axis = new Vector3().crossVectors(startVec, endVec).normalize();
        if (axis.lengthSq() < 1e-6) { 
             axis.crossVectors(startVec, new Vector3(0, 1, 0)).normalize();
            if(axis.lengthSq() < 1e-6) axis.set(0, 0, 1); 
        }

        // --- Detect if it's a closed loop (start ~= end) ---
        const isClosedLoop = segmentStartPos.distanceTo(segmentEndPos) < 0.01; // Tolerance for floating point comparison
        if (isClosedLoop) {
          console.log('[AnimationController] Orbit detected as closed loop.');
        }

        // Create intermediate points
        const numIntermediatePoints = 3; // Create 3 intermediate points (e.g., 90, 180, 270 deg for closed)
        const points: Vector3[] = [segmentStartPos.clone()];
        
        if (isClosedLoop) {
            // Generate intermediate points for a full circle
            for (let i = 1; i <= numIntermediatePoints; i++) {
                const angle = (i / (numIntermediatePoints + 1)) * Math.PI * 2; // Fractions of 360 deg
                const q = new Quaternion().setFromAxisAngle(axis, angle);
                const intermediateVec = startVec.clone().applyQuaternion(q);
                points.push(new Vector3().addVectors(orbitCenter, intermediateVec));
            }
            // DO NOT add segmentEndPos when closed - curve handles it
             console.log('[AnimationController] Generated points for closed loop:', points.map(p => p.toArray()));
        } else {
            // Generate intermediate points for a partial arc
            const totalAngle = Math.acos(Math.max(-1, Math.min(1, startVec.dot(endVec) / (startVec.length() * endVec.length()))));
            // Ensure totalAngle is a valid number
            const validTotalAngle = isNaN(totalAngle) ? 0 : totalAngle;

            for (let i = 1; i <= numIntermediatePoints; i++) {
                const angle = (i / (numIntermediatePoints + 1)) * validTotalAngle; 
                const q = new Quaternion().setFromAxisAngle(axis, angle);
                const intermediateVec = startVec.clone().applyQuaternion(q);
                points.push(new Vector3().addVectors(orbitCenter, intermediateVec));
            }
            points.push(segmentEndPos.clone()); // Add the actual end position for open arcs
             console.log('[AnimationController] Generated points for open arc:', points.map(p => p.toArray()));
        }

        // --- Pass closed parameter to constructor ---
        curve = new CatmullRomCurve3(points, isClosedLoop, 'catmullrom', 0.5); 
        orbitCurveCacheRef.current[currentCommandIndex] = curve;
      }

      // Get point on the curve
      currentPosition = curve.getPointAt(easedT);
      // console.log('AnimationController: Applying position via Curve.getPointAt');
    } else {
      // Linear interpolation for non-orbit segments
      currentPosition = new Vector3().lerpVectors(segmentStartPos, segmentEndPos, easedT);
      // console.log('AnimationController: Applying position via lerpVectors');
    }
    // --- END MODIFIED ---

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
        
        // <<< Temporarily disable lookAt for orbit segments >>>
        // if (!isOrbitSegment) { // REVERT THIS BLOCK
            // <<< UNCOMMENT lookAt >>>
            cameraRef.current.lookAt(currentTarget);
            // console.log('AnimationController: Applying orientation via lookAt'); 
        // } else {
        //     // console.log('AnimationController: Skipping lookAt during orbit segment');
        // }
        // <<< End temporary modification >>> // REVERT THIS BLOCK
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
        // --- Clear curve cache on completion ---
        orbitCurveCacheRef.current = {};
        // -------------------------------------
        onProgressUpdate(100); 
        onComplete(); 
    }
  });

  return null;
};
