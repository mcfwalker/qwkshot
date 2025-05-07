import { Vector3, CatmullRomCurve3 } from 'three';
import { CameraCommand } from '@/types/p2p/scene-interpreter';

const TARGET_FPS = 60;

export interface ProcessedPathDataV1 {
  sampledPositions: Float32Array;
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
} 