import { Vector3, CatmullRomCurve3, Quaternion, Matrix4 } from 'three';
import * as THREE from 'three';
import { CameraCommand } from '@/types/p2p/scene-interpreter';

const TARGET_FPS = 60;
const POSITION_EPSILON = 1e-6;
// --- Blending Constants --- 
const CORNER_ANGLE_THRESHOLD_RADIANS = THREE.MathUtils.degToRad(30); 
const BLEND_OFFSET_FRACTION = 0.3; 
const MIN_BLEND_OFFSET = 0.75; 
const MAX_BLEND_OFFSET_FACTOR = 0.45; 
// --- End Constants ---

export interface ProcessedPathDataV2 {
  sampledPositions: Float32Array;
  keyframeQuaternions: Quaternion[]; 
  segmentDurations: number[]; 
  totalDuration: number;
  allTargets: Vector3[];
}

export class PathProcessor {
  /**
   * (V2 - Blending + Slerp Support)
   * Processes commands, calculates orientations, filters points, blends corners,
   * generates smoothed position path, and returns data for Slerp.
   */
  public static processV2(
    commands: CameraCommand[],
    initialCameraOrientation: Quaternion,
  ): ProcessedPathDataV2 | null {
    if (!commands || commands.length === 0) { return null; }

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
    if (totalDuration <= 1e-6 && commands.length > 0) { totalDuration = 1e-6; }

    // --- Step 2: Filter Duplicate Positional Waypoints ---
    const filteredWaypoints: Vector3[] = [];
    if (allWaypoints.length > 0) { filteredWaypoints.push(allWaypoints[0].clone()); }
    for (let i = 1; i < allWaypoints.length; i++) {
        if (allWaypoints[i].distanceToSquared(filteredWaypoints[filteredWaypoints.length - 1]) > POSITION_EPSILON * POSITION_EPSILON) {
            filteredWaypoints.push(allWaypoints[i].clone());
        }
    }

    console.log("[PathProcessor.processV2] Filtered Waypoints (count="+filteredWaypoints.length+"):", 
        filteredWaypoints.slice(0, 3).map(p => p.toArray().map(n=>n.toFixed(2)).join(',')), 
        filteredWaypoints.length > 3 ? '...' : '');

    // --- Step 3 & 4: Corner Detection & Blend Point Injection (ENABLED) --- 
    let augmentedWaypoints: Vector3[] = []; 
    if (filteredWaypoints.length < 3) {
      console.log('[PathProcessor.processV2] Less than 3 unique points, skipping corner blending.');
      augmentedWaypoints = filteredWaypoints; 
    } else {
      augmentedWaypoints.push(filteredWaypoints[0].clone()); 
      for (let i = 1; i < filteredWaypoints.length - 1; i++) { 
        const pPrev = filteredWaypoints[i-1];
        const pCurr = filteredWaypoints[i];
        const pNext = filteredWaypoints[i+1];

        console.log(`[PathProcessor.processV2] Checking corner at index ${i}`);
        console.log(`  P_Prev: ${pPrev.toArray().map(n => n.toFixed(3)).join(', ')}`);
        console.log(`  P_Curr: ${pCurr.toArray().map(n => n.toFixed(3)).join(', ')}`);
        console.log(`  P_Next: ${pNext.toArray().map(n => n.toFixed(3)).join(', ')}`);

        const vIn = new Vector3().subVectors(pCurr, pPrev);
        const vOut = new Vector3().subVectors(pNext, pCurr);
        const angle = vIn.angleTo(vOut); 
        console.log(`  Angle (rad): ${angle.toFixed(3)}`);
        
        const distToPrev = pCurr.distanceTo(pPrev);
        console.log(`  distToPrev: ${distToPrev.toFixed(3)}`);
        const distToNext = pCurr.distanceTo(pNext);
        console.log(`  distToNext: ${distToNext.toFixed(3)}`);

        const angleThreshold = CORNER_ANGLE_THRESHOLD_RADIANS;
        const isSharpEnough = Math.abs(angle) > angleThreshold;
        const isNotReversal = Math.abs(angle) < (Math.PI - 0.1);
        const hasPrevLength = distToPrev > POSITION_EPSILON;
        const hasNextLength = distToNext > POSITION_EPSILON;

        console.log(`  Checks: isSharp=${isSharpEnough}, isNotReversal=${isNotReversal}, hasPrevLen=${hasPrevLength}, hasNextLen=${hasNextLength}`);

        if (isSharpEnough && isNotReversal && hasPrevLength && hasNextLength) {
          console.log(`  >>> Corner DETECTED at index ${i}, proceeding with blend calculation.`); // Confirm entry
          
          let offset = Math.min(distToPrev, distToNext) * BLEND_OFFSET_FRACTION;
          offset = Math.max(MIN_BLEND_OFFSET, offset); 
          offset = Math.min(offset, distToPrev * MAX_BLEND_OFFSET_FACTOR, distToNext * MAX_BLEND_OFFSET_FACTOR); 
          console.log(`    blend offset = ${offset.toFixed(3)}`);
          const vInNormalized = vIn.normalize(); 
          const vOutNormalized = vOut.normalize(); 
          const b1 = new Vector3().copy(pCurr).addScaledVector(vInNormalized, -offset); 
          const b2 = new Vector3().copy(pCurr).addScaledVector(vOutNormalized, offset);  
          augmentedWaypoints.push(b1);
          augmentedWaypoints.push(b2);
        } else {
          console.log(`  --- Corner NOT detected or invalid segment length at index ${i}. Skipping blend.`);
          augmentedWaypoints.push(pCurr.clone()); 
        }
      }
      augmentedWaypoints.push(filteredWaypoints[filteredWaypoints.length - 1].clone()); 
    }

    console.log("[PathProcessor.processV2] Augmented Waypoints (count="+augmentedWaypoints.length+"):", 
        augmentedWaypoints.slice(0, 5).map(p => p.toArray().map(n=>n.toFixed(2)).join(',')), 
        augmentedWaypoints.length > 5 ? '...' : '');

    // --- Fallback if augmentation failed ---
    if (augmentedWaypoints.length < 2) {
        console.warn("[PathProcessor.processV2] Augmented path has < 2 points. Using filtered path.");
        augmentedWaypoints = filteredWaypoints.length > 1 ? filteredWaypoints : 
                             (filteredWaypoints.length === 1 ? [filteredWaypoints[0].clone(), filteredWaypoints[0].clone()] : [new Vector3(), new Vector3()]);
        if(augmentedWaypoints.length < 2) augmentedWaypoints = [new Vector3(), new Vector3()];
    }

    // --- Step 5: Generate Position Spline (Using augmentedWaypoints) ---
    const positionCurve = new CatmullRomCurve3(augmentedWaypoints, false, 'centripetal');

    // --- Step 6: Pre-sample positions --- 
    const numSamples = Math.max(2, Math.ceil(TARGET_FPS * totalDuration));
    const sampledPositions = new Float32Array(numSamples * 3);
    for (let i = 0; i < numSamples; i++) {
      const t = (numSamples === 1) ? 0 : i / (numSamples - 1);
      const clampedT = Math.max(0, Math.min(1, t)); 
      const point = positionCurve.getPointAt(clampedT);
      sampledPositions.set([point.x, point.y, point.z], i * 3);
    }
    console.log("[PathProcessor.processV2] Sampled Positions (count="+numSamples+") First 3:", 
        Array.from(sampledPositions.slice(0, 9)).map(n=>n.toFixed(2)).join(','));
    console.log("[PathProcessor.processV2] Sampled Positions Last 3:", 
        Array.from(sampledPositions.slice(-9)).map(n=>n.toFixed(2)).join(','));

    // --- Step 7: Return combined data ---
    return {
      sampledPositions,       
      keyframeQuaternions,   
      segmentDurations,      
      totalDuration,         
      allTargets,
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