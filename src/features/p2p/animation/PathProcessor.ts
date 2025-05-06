import { Vector3, CatmullRomCurve3 } from 'three';
import * as THREE from 'three'; // Ensure THREE is imported for MathUtils
import { CameraCommand } from '@/types/p2p/scene-interpreter';

const TARGET_FPS = 60; // Target frames per second for pre-sampling
const POSITION_EPSILON = 1e-6; // Small tolerance for comparing Vector3 equality

// --- Constants for Phase 2 Blending --- 
const CORNER_ANGLE_THRESHOLD_RADIANS = THREE.MathUtils.degToRad(30); 
const BLEND_OFFSET_FRACTION = 0.3; 
const MIN_BLEND_OFFSET = 0.1; 
const MAX_BLEND_OFFSET_FACTOR = 0.45; 
// --- End Constants ---

export interface ProcessedPathData {
  sampledPositions: Float32Array; // Pre-sampled positions (x1,y1,z1, x2,y2,z2, ...)
  segmentDurations: number[]; // Durations of each segment between original waypoints
  totalDuration: number; // Total duration of the animation path
}

export class PathProcessor {
  /**
   * Processes commands, filters duplicate consecutive positions, and generates path data.
   * @param commands - The array of CameraCommand waypoints from the backend.
   * @returns ProcessedPathData object or null if input is invalid.
   */
  public static process(
    commands: CameraCommand[],
  ): ProcessedPathData | null {
    if (!commands || commands.length === 0) {
      console.warn('PathProcessor: No commands provided.');
      return null;
    }

    // --- Step 1: Filter duplicate consecutive waypoints & prepare initial lists ---
    const filteredWaypoints: Vector3[] = [];
    const filteredSegmentDurations: number[] = []; 
    let filteredTotalDuration = 0;

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      const currentPosition = cmd.position.clone();
      const currentDuration = cmd.duration;

      if (filteredWaypoints.length > 0) {
        const previousPosition = filteredWaypoints[filteredWaypoints.length - 1];
        if (currentPosition.distanceToSquared(previousPosition) < POSITION_EPSILON * POSITION_EPSILON) {
          // Duplicate position found.
          // Add current command's duration to the *last added* duration in filteredSegmentDurations,
          // as that previous duration corresponds to the waypoint we are now effectively merging with.
          if (filteredSegmentDurations.length > 0) {
            filteredSegmentDurations[filteredSegmentDurations.length - 1] += currentDuration;
          }
          filteredTotalDuration += currentDuration; // Still count duration towards total
          console.log(`PathProcessor: Filtered duplicate waypoint at index ${i}. Accumulated duration for previous point.`);
          continue; // Skip adding this waypoint position
        }
      }
      
      // If not a duplicate, add it.
      filteredWaypoints.push(currentPosition);
      filteredSegmentDurations.push(currentDuration); // Each waypoint now has its original command's duration associated with it.
      filteredTotalDuration += currentDuration;
    }
    // --- End Step 1 ---

    if (filteredWaypoints.length === 0) {
      console.warn('PathProcessor: No valid waypoints after initial filtering.');
      return null;
    }

    // Fallback for paths too short for corner detection/blending (less than 3 unique points)
    if (filteredWaypoints.length < 3) { 
      console.warn(`PathProcessor: Path has ${filteredWaypoints.length} unique points, not enough for corner blending. Generating simple path.`);
      let curveForShortPath: CatmullRomCurve3;
      if (filteredWaypoints.length === 1) {
        // Create a curve with the single point duplicated to satisfy CatmullRomCurve3 requiring at least 2 points
        curveForShortPath = new CatmullRomCurve3([filteredWaypoints[0].clone(), filteredWaypoints[0].clone()], false, 'centripetal');
      } else { // Exactly 2 points
        curveForShortPath = new CatmullRomCurve3(filteredWaypoints, false, 'centripetal');
      }
      
      const numSamplesFallback = Math.max(2, Math.ceil(TARGET_FPS * filteredTotalDuration));
      const sampledPositionsFallback = new Float32Array(numSamplesFallback * 3);
      for (let k = 0; k < numSamplesFallback; k++) {
        const t = (numSamplesFallback === 1 && filteredWaypoints.length === 1) ? 0 : k / (numSamplesFallback - 1);
        const point = curveForShortPath.getPointAt(t);
        sampledPositionsFallback.set([point.x, point.y, point.z], k * 3);
      }
      return {
        sampledPositions: sampledPositionsFallback,
        segmentDurations: filteredSegmentDurations, 
        totalDuration: filteredTotalDuration,
      };
    }
    
    // --- Step 2 & 3: Corner Detection and Blend Point Calculation --- 
    const augmentedWaypoints: Vector3[] = [];
    if (filteredWaypoints.length > 0) {
      augmentedWaypoints.push(filteredWaypoints[0].clone()); // Always add the first point
    }

    for (let i = 1; i < filteredWaypoints.length - 1; i++) { // Iterate internal points
      const pPrev = filteredWaypoints[i-1];
      const pCurr = filteredWaypoints[i];
      const pNext = filteredWaypoints[i+1];

      const vIn = new Vector3().subVectors(pCurr, pPrev);
      const vOut = new Vector3().subVectors(pNext, pCurr);
      // No need to normalize here for angleTo, but normalize if using for scaledVector later with fixed offset

      const angle = vIn.angleTo(vOut); // Radians

      // Blend if angle is sharp enough, but not a near 180-degree reversal (which this simple blend isn\'t for)
      // Also ensure segments have some length to avoid issues with zero-length segments for offset calculation
      const distToPrev = pCurr.distanceTo(pPrev);
      const distToNext = pCurr.distanceTo(pNext);

      if (Math.abs(angle) > CORNER_ANGLE_THRESHOLD_RADIANS && 
          Math.abs(angle) < (Math.PI - CORNER_ANGLE_THRESHOLD_RADIANS) &&
          distToPrev > POSITION_EPSILON && distToNext > POSITION_EPSILON) { 
        
        console.log(`PathProcessor: Detected corner at original filtered index ${i}, angle: ${THREE.MathUtils.radToDeg(angle).toFixed(1)} deg`);
        
        let offset = Math.min(distToPrev, distToNext) * BLEND_OFFSET_FRACTION;
        offset = Math.max(MIN_BLEND_OFFSET, offset); 
        // Ensure offset doesn\'t exceed a factor of segment length to prevent B1/B2 crossing midpoint or pPrev/pNext
        offset = Math.min(offset, distToPrev * MAX_BLEND_OFFSET_FACTOR, distToNext * MAX_BLEND_OFFSET_FACTOR); 

        const vInNormalized = vIn.normalize(); // Normalize for scaled vector
        const vOutNormalized = vOut.normalize(); // Normalize for scaled vector

        const b1 = new Vector3().copy(pCurr).addScaledVector(vInNormalized, -offset); // Move back along vIn
        const b2 = new Vector3().copy(pCurr).addScaledVector(vOutNormalized, offset);  // Move forward along vOut
        
        augmentedWaypoints.push(b1);
        augmentedWaypoints.push(b2);
        console.log(`PathProcessor: Injected blend points B1, B2 around original P[${i}] at dist: ${offset.toFixed(3)}`);
      } else {
        augmentedWaypoints.push(pCurr.clone()); // Not a sharp corner or too short segments, add original point
      }
    }

    if (filteredWaypoints.length > 1) { // Add last point if it exists and wasn\'t the first one
      augmentedWaypoints.push(filteredWaypoints[filteredWaypoints.length - 1].clone());
    }
    // --- End Step 2 & 3 ---
    
    if (augmentedWaypoints.length < 2) {
        console.warn("PathProcessor: Augmented path has less than 2 points. Using simplified filtered path.");
        let finalWaypointsForCurve_fallback = filteredWaypoints;
        if (filteredWaypoints.length === 1) { 
            finalWaypointsForCurve_fallback = [filteredWaypoints[0].clone(), filteredWaypoints[0].clone()];
        }
         const fallbackCurve = new CatmullRomCurve3(finalWaypointsForCurve_fallback, false, 'centripetal');
         const numSamplesFallbackE = Math.max(2, Math.ceil(TARGET_FPS * filteredTotalDuration));
         const sampledPositionsFallbackE = new Float32Array(numSamplesFallbackE * 3);
         for (let k = 0; k < numSamplesFallbackE; k++) {
            const t = (numSamplesFallbackE === 1 && finalWaypointsForCurve_fallback.length ===1) ? 0 : k / (numSamplesFallbackE - 1);
            const point = fallbackCurve.getPointAt(t);
            sampledPositionsFallbackE.set([point.x, point.y, point.z], k * 3);
         }
         return {
            sampledPositions: sampledPositionsFallbackE,
            segmentDurations: filteredSegmentDurations,
            totalDuration: filteredTotalDuration,
         };
    }

    // --- Step 5: Generate Spline (using augmentedWaypoints) ---
    const positionCurve = new CatmullRomCurve3(augmentedWaypoints, false, 'centripetal');

    // --- Step 6: Pre-sample positions & Return Data ---
    const numSamples = Math.max(2, Math.ceil(TARGET_FPS * filteredTotalDuration));
    const sampledPositions = new Float32Array(numSamples * 3);

    for (let k = 0; k < numSamples; k++) {
      const t = (numSamples === 1) ? 0 : k / (numSamples - 1); // Check for numSamples === 1, not just curve points
      const point = positionCurve.getPointAt(t);
      sampledPositions.set([point.x, point.y, point.z], k * 3);
    }

    return {
      sampledPositions,
      segmentDurations: filteredSegmentDurations, 
      totalDuration: filteredTotalDuration,
    };
  }
} 