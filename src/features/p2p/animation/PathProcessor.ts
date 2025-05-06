import { Vector3, Quaternion, CatmullRomCurve3, Matrix4 } from 'three';
import { CameraCommand } from '@/types/p2p/scene-interpreter';

const TARGET_FPS = 60; // Target frames per second for pre-sampling

export interface ProcessedPathData {
  sampledPositions: Float32Array; // Pre-sampled positions (x1,y1,z1, x2,y2,z2, ...)
  keyframeQuaternions: Quaternion[]; // Array of Quaternions, one for each original waypoint
  segmentDurations: number[]; // Durations of each segment between original waypoints
  totalDuration: number; // Total duration of the animation path
}

export class PathProcessor {
  /**
   * Processes an array of CameraCommands to generate data for smooth animation.
   * @param commands - The array of CameraCommand waypoints from the backend.
   * @param initialCameraOrientation - The initial orientation of the camera before the animation starts.
   *                                    This is important for the first segment's Slerp.
   * @returns ProcessedPathData object or null if input is invalid.
   */
  public static process(
    commands: CameraCommand[],
    initialCameraOrientation: Quaternion
  ): ProcessedPathData | null {
    if (!commands || commands.length === 0) {
      console.warn('PathProcessor: No commands provided.');
      return null;
    }

    const waypoints: Vector3[] = [];
    const keyframeQuaternions: Quaternion[] = [];
    const segmentDurations: number[] = [];
    let totalDuration = 0;

    // The first keyframeQuaternion will be the initialCameraOrientation.
    keyframeQuaternions.push(initialCameraOrientation.clone()); // Start with the camera's current orientation

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      waypoints.push(cmd.position.clone()); // Ensure we're using clones
      segmentDurations.push(cmd.duration);
      totalDuration += cmd.duration;

      // Calculate orientation for this waypoint's end state
      const lookAtMatrix = new Matrix4().lookAt(
        cmd.position,
        cmd.target,
        new Vector3(0, 1, 0) // Assuming standard 'up' vector
      );
      const quaternion = new Quaternion().setFromRotationMatrix(lookAtMatrix);
      keyframeQuaternions.push(quaternion);
    }
    
    if (waypoints.length === 0) { // Should not happen if commands.length > 0, but as a safe guard.
        console.warn('PathProcessor: No waypoints to process, though commands were present.');
        return null;
    }

    if (waypoints.length === 1 && commands.length === 1) {
        // Special case: A single command implies a segment from current orientation to this command's state.
        const cmd = commands[0];
        const numSamples = Math.max(1, Math.ceil(TARGET_FPS * cmd.duration));
        const sampledPositions = new Float32Array(numSamples * 3);
        
        // For a single command, position samples should interpolate from an assumed 'initialPosition'
        // This information isn't directly available to PathProcessor.
        // For Phase 1, we'll make sampledPositions for a single command represent the target position repeated.
        // AnimationController will need to handle the interpolation from its current position to this target.
        // Alternatively, AnimationController could create a CatmullRomCurve3 with 2 points (currentPos, cmd.pos)
        // if it receives this simplified ProcessedPathData.
        // Let's simplify PathProcessor: it creates samples for the path defined *by the commands*.
        // If only one command, the "path" is just that one point.
        // The CatmullRomCurve3 below will handle a single waypoint by essentially creating a static point.
        // So the more general logic might cover this. Let's test that idea.
    }


    // Create the Catmull-Rom curve
    // If waypoints has only one point, CatmullRomCurve3 will still be created.
    // getPointAt(t) for a single-point curve will always return that single point.
    const positionCurve = new CatmullRomCurve3(waypoints, false, 'centripetal');

    // Pre-sample positions
    // Ensure at least 2 samples for interpolation, even if duration is very short or zero.
    // One sample for the start, one for the end.
    const numSamples = Math.max(2, Math.ceil(TARGET_FPS * totalDuration));
    const sampledPositions = new Float32Array(numSamples * 3);

    for (let i = 0; i < numSamples; i++) {
      // For a curve with a single point, getPointAt(t) returns that point.
      // For a curve with multiple points, it interpolates.
      const t = (numSamples === 1) ? 0 : i / (numSamples - 1); // Normalized time (0 to 1) along the entire curve
      const point = positionCurve.getPointAt(t);
      sampledPositions.set([point.x, point.y, point.z], i * 3);
    }

    return {
      sampledPositions,
      keyframeQuaternions, // Includes initial orientation + one for each command
      segmentDurations,
      totalDuration,
    };
  }
} 