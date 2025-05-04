import { Primitive, ZigzagArgs, SceneMeta } from './composer'; // Assuming types are in composer.ts

/**
 * Generates a sequence of primitives for the 'zigzag' pattern.
 * Alternates lateral trucks with backward dollies.
 *
 * Note: This is a basic implementation based on the requirements document.
 * It needs refinement for proper geometry, context-aware distance mapping,
 * and duration ratio calculation.
 *
 * @param args The arguments for the zigzag pattern (segments, amplitude).
 * @param sceneMeta Contextual information about the 3D scene (currently unused in this basic version).
 * @returns An array of Primitive objects for the zigzag sequence.
 */
export function zigzagComposer(
  { segments = 4, amplitude = 'small' }: Omit<ZigzagArgs, 'pattern'>,
  sceneMeta: SceneMeta // Pass sceneMeta even if unused for future expansion
): Primitive[] {
  const prim: Primitive[] = [];

  // TODO: Refine distance mapping - 'amplitude' descriptor needs conversion
  //       based on sceneMeta (e.g., objectRadius or boundingBox size).
  // TODO: Refine direction logic - 'backward' might need context.
  // TODO: Calculate and assign appropriate duration_ratios per primitive.

  for (let i = 0; i < segments; i++) {
    // Lateral truck
    prim.push({
      type: "truck",
      parameters: {
        direction: i % 2 ? "right" : "left",
        distance_descriptor: amplitude // Pass descriptor to interpreter
        // Consider adding target: 'current_target' or similar if needed
      }
      // duration_ratio: TBD
    });

    // Backward dolly (or could be forward depending on desired effect)
    prim.push({
      type: "dolly",
      parameters: {
        direction: "backward", // Or maybe 'forward' depending on definition
        distance_descriptor: amplitude // Simplistic: use same amplitude for depth
        // Consider adding target: 'current_target' or similar if needed
      }
      // duration_ratio: TBD
    });
  }

  return prim;
} 