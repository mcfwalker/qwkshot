// Define the structure for a single motion primitive, matching SceneInterpreter input
export interface Primitive {
  type: string; // e.g., 'dolly', 'orbit', 'truck'
  parameters: Record<string, any>; // Primitive-specific parameters
  duration_ratio?: number; // Optional duration hint (proportion of total)
}

// Define the structure for scene context needed by composers
// Placeholder - will likely need refinement based on composer needs
export interface SceneMeta {
  boundingBox: any; // TODO: Define specific bounding box type
  objectRadius: number;
  // Potentially add initialCameraState, environmentalAnalysis etc. if needed
}

// Define argument types based on Pattern KB for each pattern
export interface ZigzagArgs {
  pattern: 'zigzag';
  segments?: number;   // Default: 4
  amplitude?: string;  // Default: 'small'
}

export interface FlyByArgs {
  pattern: 'fly_by';
  apex_height?: string; // Default: 'large'
  speed?: string;       // Default: 'fast'
  second_pass?: boolean; // Default: false
}

// Union type for all possible pattern arguments
// Add other pattern argument interfaces here as they are defined
export type PatternArgs = ZigzagArgs | FlyByArgs; // | SpiralArgs | BounceArgs etc.

import { zigzagComposer } from './zigzagComposer';
import { flyByComposer } from './flyByComposer'; // Import the new composer
// TODO: Import other composer functions (e.g., flyByComposer) when created

/**
 * Takes a pattern name and arguments, along with scene context,
 * and returns a flat list of primitive motion steps.
 * This function acts as the main entry point and delegates to specific composers.
 *
 * @param args The pattern identifier and its parameters.
 * @param sceneMeta Contextual information about the 3D scene/model.
 * @returns An array of Primitive objects representing the expanded motion sequence.
 */
export function composePattern(args: PatternArgs, sceneMeta: SceneMeta): Primitive[] {
  switch (args.pattern) {
    case 'zigzag':
      // Destructure args for clarity, applying defaults if necessary
      const { segments, amplitude } = args;
      return zigzagComposer({ segments, amplitude }, sceneMeta);
    case 'fly_by':
      // Destructure args for clarity, applying defaults if necessary
      const { apex_height, speed, second_pass } = args;
      return flyByComposer({ apex_height, speed, second_pass }, sceneMeta);
    // Add cases for other patterns here
    default:
      // Use a type assertion to satisfy the compiler about the default case
      const exhaustiveCheck: never = args;
      console.warn(`Unknown pattern type encountered: ${(exhaustiveCheck as any).pattern}`);
      // Consider throwing an error or returning an empty array
      return [];
  }
}

// TODO: Implement individual composer functions (e.g., zigzagComposer, flyByComposer)
// These will likely live in separate files within this directory 