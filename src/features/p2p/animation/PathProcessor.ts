import { Vector3, CatmullRomCurve3, Quaternion, Matrix4 } from 'three';
import { CameraCommand } from '@/types/p2p/scene-interpreter';

const TARGET_FPS = 60;
const POSITION_EPSILON = 1e-6;
// --- Blending constants - Unused in V2, keep for reference for V3 ---
// const CORNER_ANGLE_THRESHOLD_RADIANS = THREE.MathUtils.degToRad(30);
// const BLEND_OFFSET_FRACTION = 0.3; 
// const MIN_BLEND_OFFSET = 0.75; 
// const MAX_BLEND_OFFSET_FACTOR = 0.45;
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
   * (V2 - Position Spline + Orientation Keyframes)
   * Processes commands to generate smoothed position path AND keyframe orientations for Slerp.
   * Handles orientation-only changes correctly. Does NOT yet do corner blending.
   * @param commands - The array of CameraCommand waypoints from the backend.
   * @param initialCameraOrientation - The initial camera orientation.
   * @returns ProcessedPathDataV2 object or null if input is invalid.
   */
  public static processV2(
    commands: CameraCommand[],
    initialCameraOrientation: Quaternion,
  ): ProcessedPathDataV2 | null {
    if (!commands || commands.length === 0) {
      console.warn('[PathProcessor.processV2] No commands provided.');
      return null;
    }

    // --- Step 1: Extract data and Calculate Quaternions for ALL commands ---
    const waypoints: Vector3[] = [];
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

      waypoints.push(pos);
      segmentDurations.push(duration); 
      totalDuration += duration;

      let currentQuaternion: Quaternion;
      if (pos.distanceToSquared(target) < POSITION_EPSILON * POSITION_EPSILON) {
          console.warn(`[PathProcessor.processV2] Waypoint ${i} position and target identical. Reusing previous orientation.`);
          currentQuaternion = keyframeQuaternions[keyframeQuaternions.length - 1] || initialCameraOrientation;
          keyframeQuaternions.push(currentQuaternion.clone());
      } else {
          lookAtMatrix.lookAt(pos, target, upVector);
          currentQuaternion = new Quaternion().setFromRotationMatrix(lookAtMatrix);
          keyframeQuaternions.push(currentQuaternion);
      }
    }
    
    // Ensure totalDuration is slightly positive if it calculates to zero but commands exist
    if (totalDuration <= 1e-6 && commands.length > 0) {
        totalDuration = 1e-6; 
    }
    
    // --- Step 2: Generate Position Spline --- 
    // Use ALL waypoints for the spline initially in V2 (no filtering/blending yet)
    let positionCurve: CatmullRomCurve3;
    if (waypoints.length === 0) {
         console.warn('[PathProcessor.processV2] No waypoints to create spline.');
         return null; // Or return static data if appropriate
    } else if (waypoints.length === 1) {
      positionCurve = new CatmullRomCurve3([waypoints[0].clone(), waypoints[0].clone()], false, 'centripetal');
    } else {
      positionCurve = new CatmullRomCurve3(waypoints, false, 'centripetal');
    }

    // --- Step 3: Pre-sample positions --- 
    const numSamples = Math.max(2, Math.ceil(TARGET_FPS * totalDuration));
    const sampledPositions = new Float32Array(numSamples * 3);
    for (let i = 0; i < numSamples; i++) {
      const t = (numSamples === 1) ? 0 : i / (numSamples - 1);
      const point = positionCurve.getPointAt(t);
      sampledPositions.set([point.x, point.y, point.z], i * 3);
    }

    // --- Step 4: Return combined data ---
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