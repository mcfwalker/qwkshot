import { Vector3, CatmullRomCurve3 } from 'three';
import { CameraCommand } from '@/types/p2p/scene-interpreter';

const TARGET_FPS = 60; // Target frames per second for pre-sampling
const POSITION_EPSILON = 1e-6; // Small tolerance for comparing Vector3 equality

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

    // --- Filter duplicate consecutive waypoints --- 
    const processedWaypoints: Vector3[] = [];
    const processedSegmentDurations: number[] = [];
    let currentTotalDuration = 0;

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      const currentPosition = cmd.position.clone();
      const currentDuration = cmd.duration;

      if (processedWaypoints.length > 0) {
        const previousPosition = processedWaypoints[processedWaypoints.length - 1];
        // Check if current position is nearly identical to the previous one
        if (currentPosition.distanceToSquared(previousPosition) < POSITION_EPSILON * POSITION_EPSILON) {
          // It's a duplicate position.
          // Add its duration to the *previous* segment's duration.
          if (processedSegmentDurations.length > 0) {
            processedSegmentDurations[processedSegmentDurations.length - 1] += currentDuration;
            currentTotalDuration += currentDuration; // Still count duration towards total
          }
          // Skip adding this waypoint position
          continue; 
        }
      }

      // If it's the first point or not a duplicate, add it
      processedWaypoints.push(currentPosition);
      processedSegmentDurations.push(currentDuration);
      currentTotalDuration += currentDuration; 
    }
    // --- End filtering ---

    if (processedWaypoints.length === 0) { 
        console.warn('PathProcessor: No valid waypoints after filtering.');
        return null;
    }

    // If only one unique point remains after filtering, handle as static path
    if (processedWaypoints.length === 1) {
        console.warn('PathProcessor: Only one unique waypoint after filtering. Creating static path.');
        const numSamples = Math.max(2, Math.ceil(TARGET_FPS * currentTotalDuration));
        const sampledPositions = new Float32Array(numSamples * 3);
        const staticPos = processedWaypoints[0];
        for (let i = 0; i < numSamples; i++) {
            sampledPositions.set([staticPos.x, staticPos.y, staticPos.z], i * 3);
        }
        return {
            sampledPositions,
            segmentDurations: processedSegmentDurations, // Will contain single accumulated duration
            totalDuration: currentTotalDuration,
        };
    }
    
    // Create the Catmull-Rom curve using the filtered waypoints
    // Revert tension parameter back to default for 'centripetal' type
    const positionCurve = new CatmullRomCurve3(processedWaypoints, false, 'centripetal');

    // Pre-sample positions using the filtered total duration
    const numSamples = Math.max(2, Math.ceil(TARGET_FPS * currentTotalDuration));
    const sampledPositions = new Float32Array(numSamples * 3);

    for (let i = 0; i < numSamples; i++) {
      const t = (numSamples === 1) ? 0 : i / (numSamples - 1);
      const point = positionCurve.getPointAt(t);
      sampledPositions.set([point.x, point.y, point.z], i * 3);
    }

    return {
      sampledPositions,
      segmentDurations: processedSegmentDurations, // Use the processed durations
      totalDuration: currentTotalDuration, // Use the processed total duration
    };
  }
} 