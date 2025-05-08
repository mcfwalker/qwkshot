import { Vector3, CatmullRomCurve3, Quaternion, Matrix4 } from 'three';
import * as THREE from 'three';
import { CameraCommand } from '@/types/p2p/scene-interpreter';

const TARGET_FPS = 60;
const POSITION_EPSILON = 1e-6;
// --- Blending Constants (Now Used in V2) --- 
const CORNER_ANGLE_THRESHOLD_RADIANS = THREE.MathUtils.degToRad(30); 
const BLEND_OFFSET_FRACTION = 0.3; // Start with 0.3 again
const MIN_BLEND_OFFSET = 0.75; // Last value tested
const MAX_BLEND_OFFSET_FACTOR = 0.45; // Limit max
// --- End Constants ---

export interface ProcessedPathDataV1 {
  sampledPositions: Float32Array;
  totalDuration: number;
}

export interface ProcessedPathDataV2 {
  sampledPositions: Float32Array;
  keyframeQuaternions: Quaternion[];
  segmentDurations: number[];
  totalDuration: number;
}

export class PathProcessor {
  /**
   * (V1 - Position Spline Only)
   * Processes an array of CameraCommands to generate a smoothed position path.
   * Does not handle orientation, filtering, or blending yet.
   * @param commands - The array of CameraCommand waypoints from the backend.
   * @returns ProcessedPathDataV1 object or null if input is invalid.
   */
  public static processV1(
    commands: CameraCommand[],
  ): ProcessedPathDataV1 | null {
    if (!commands || commands.length === 0) {
      console.warn('[PathProcessor.processV1] No commands provided.');
      return null;
    }

    const waypoints: Vector3[] = commands.map(cmd => cmd.position.clone());
    let totalDuration = commands.reduce((sum, cmd) => sum + cmd.duration, 0);

    // Ensure totalDuration is slightly positive if it calculates to zero but commands exist
    // This helps avoid division by zero later if all command durations were 0
    if (totalDuration <= 1e-6 && commands.length > 0) {
        totalDuration = 1e-6; 
    }

    if (waypoints.length === 0) {
      console.warn('[PathProcessor.processV1] No waypoints extracted.');
      return null;
    }

    let positionCurve: CatmullRomCurve3;
    if (waypoints.length === 1) {
      // Handle static path: CatmullRomCurve3 needs at least 2 points
      positionCurve = new CatmullRomCurve3([waypoints[0].clone(), waypoints[0].clone()], false, 'centripetal');
    } else {
      positionCurve = new CatmullRomCurve3(waypoints, false, 'centripetal');
    }

    // Pre-sample positions
    const numSamples = Math.max(2, Math.ceil(TARGET_FPS * totalDuration));
    const sampledPositions = new Float32Array(numSamples * 3);

    for (let i = 0; i < numSamples; i++) {
      const t = (numSamples === 1) ? 0 : i / (numSamples - 1);
      const point = positionCurve.getPointAt(t);
      sampledPositions.set([point.x, point.y, point.z], i * 3);
    }

    return {
      sampledPositions,
      totalDuration,
    };
  }

  /**
   * (V2 - Blending + Slerp Support)
   * Processes commands, calculates orientations, filters points, blends corners,
   * generates smoothed position path, and returns data for Slerp.
   */
  public static processV2(
    commands: CameraCommand[],
    initialCameraOrientation: Quaternion,
  ): ProcessedPathDataV2 | null {
    if (!commands || commands.length === 0) {
      console.warn('[PathProcessor.processV2] No commands provided.');
      return null;
    }

    // --- Step 1: Extract Initial Data & Calculate Quaternions for ALL commands ---
    const allWaypoints: Vector3[] = [];
    const allTargets: Vector3[] = []; 
    const keyframeQuaternions: Quaternion[] = [];
    const segmentDurations: number[] = [];
    let totalDuration = 0;

    keyframeQuaternions.push(initialCameraOrientation.clone()); 
    const lookAtMatrix = new Matrix4();
    const upVector = new Vector3(0, 1, 0);

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      const pos = cmd.position.clone();
      const target = cmd.target.clone();
      const duration = cmd.duration;

      allWaypoints.push(pos);
      allTargets.push(target);
      segmentDurations.push(duration); 
      totalDuration += duration;

      // REVERTED: Calculate orientation for EVERY command's state
      let currentQuaternion: Quaternion;
      if (pos.distanceToSquared(target) < POSITION_EPSILON * POSITION_EPSILON) {
          console.warn(`[PathProcessor.processV2] Waypoint ${i} pos/target identical. Reusing last quat.`);
          currentQuaternion = keyframeQuaternions[keyframeQuaternions.length - 1]?.clone() || initialCameraOrientation.clone();
          keyframeQuaternions.push(currentQuaternion);
      } else {
          lookAtMatrix.lookAt(pos, target, upVector);
          currentQuaternion = new Quaternion().setFromRotationMatrix(lookAtMatrix);
          keyframeQuaternions.push(currentQuaternion); 
      }
    }
    // keyframeQuaternions now has N+1 elements 
    // segmentDurations has N elements
    if (totalDuration <= 1e-6 && commands.length > 0) { totalDuration = 1e-6; }

    // --- Step 2: Filter Duplicate *Positional* Waypoints (Input for Blending/Spline) ---
    const filteredWaypoints: Vector3[] = [];
    // Optional: Could store filteredIndices map here if needed later
    if (allWaypoints.length > 0) {
        filteredWaypoints.push(allWaypoints[0].clone());
    }
    for (let i = 1; i < allWaypoints.length; i++) {
        if (allWaypoints[i].distanceToSquared(filteredWaypoints[filteredWaypoints.length - 1]) > POSITION_EPSILON * POSITION_EPSILON) {
            filteredWaypoints.push(allWaypoints[i].clone());
        }
    }

    // --- Step 3 & 4: Corner Detection & Blend Point Injection -> TEMPORARILY DISABLED ---
    console.log('[PathProcessor.processV2] Corner blending DISABLED for testing.');
    let augmentedWaypoints: Vector3[] = filteredWaypoints; // Use filtered points directly
    // --- End Temp Disable ---

    // --- Fallback if filteredWaypoints has < 2 points ---
    if (augmentedWaypoints.length < 2) { // Check augmentedWaypoints (which is filteredWaypoints here)
        console.warn("[PathProcessor.processV2] Path has < 2 points after filtering. Fallback needed.");
        augmentedWaypoints = allWaypoints.length > 1 ? allWaypoints : 
                             (allWaypoints.length === 1 ? [allWaypoints[0].clone(), allWaypoints[0].clone()] : [new Vector3(), new Vector3()]);
        if(augmentedWaypoints.length < 2) augmentedWaypoints = [new Vector3(), new Vector3()];
    }

    // --- Step 5: Generate Position Spline (Using filtered points due to disable above) ---
    const positionCurve = new CatmullRomCurve3(augmentedWaypoints, false, 'centripetal');

    // --- Step 6: Pre-sample positions ---
    const numSamples = Math.max(2, Math.ceil(TARGET_FPS * totalDuration));
    const sampledPositions = new Float32Array(numSamples * 3);
    for (let i = 0; i < numSamples; i++) {
      const t = (numSamples === 1) ? 0 : i / (numSamples - 1);
      // Clamp t to prevent potential curve errors at exact endpoints with some versions
      const clampedT = Math.max(0, Math.min(1, t)); 
      const point = positionCurve.getPointAt(clampedT);
      sampledPositions.set([point.x, point.y, point.z], i * 3);
    }

    // --- Step 7: Return combined data ---
    return {
      sampledPositions,
      keyframeQuaternions,
      segmentDurations,
      totalDuration,
    };
  }
  
  // --- V3 with Blending (Placeholder for later) ---
  /*
  public static processV3(...) {
      // 1. Initial filter (like V2, get quaternions, filtered waypoints/durations)
      // 2. Corner detection + Blend point injection on filtered waypoints -> augmentedWaypoints
      // 3. Generate spline from augmentedWaypoints
      // 4. Sample spline
      // 5. Return sampledPositions, keyframeQuaternions (from step 1), filteredSegmentDurations (from step 1), totalDuration
  }
  */
} 