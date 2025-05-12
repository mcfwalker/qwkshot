# Scene Interpreter Primitive Handling Refactor Requirements

## 1. Motivation & Goal

**Motivation:** The primary `SceneInterpreterImpl` class in `src/features/p2p/scene-interpreter/interpreter.ts` has grown excessively large (over 2000 lines), primarily due to containing the detailed implementation logic for interpreting all motion primitives within a single large `switch` statement in the `_interpretPrimitiveStep` (or previously, directly in `interpretPath`). This size hinders readability, maintainability, testability, and potentially the effectiveness of AI-assisted editing tools. A previous attempt to refactor by simply calling external handlers without removing the original code failed to reduce size and encountered persistent tooling/linter issues, likely exacerbated by the file's complexity.

**Goal:** Refactor the primitive interpretation logic by extracting the implementation for **each individual motion primitive** (`static`, `zoom`, `orbit`, `pan`, `tilt`, `dolly`, `truck`, `pedestal`, `rotate`, `focus_on`, `move_to`) into its own dedicated module/file. The main `SceneInterpreterImpl` class will be significantly reduced in size, acting primarily as an orchestrator and dispatcher. This refactor aims to improve code organization, modularity, testability, and developer/AI tooling effectiveness, paving the way for future work like blending implementation.

## 2. Scope

*   **In Scope:**
    *   Moving the core calculation and `CameraCommand` generation logic for each distinct primitive type (`static`, `zoom`, etc.) from the `switch` statement within `SceneInterpreterImpl._interpretPrimitiveStep` into separate handler functions, each residing in its own file.
    *   Moving shared helper functions (e.g., `_resolveTargetPosition`, `_mapDescriptorToValue`, `_clampPositionWithRaycast`) into a dedicated utility file.
    *   Updating `SceneInterpreterImpl._interpretPrimitiveStep` to become a simple dispatcher that calls the appropriate external handler function based on the `step.type`.
    *   Ensuring camera state (position, target) is correctly managed and updated after each step handler is called by having handlers return the next state.
    *   Performing incremental testing after each primitive is refactored to ensure functional equivalence.
*   **Out of Scope (for this specific refactor):**
    *   Implementing new features (like motion blending).
    *   Changing the core logic or behavior of any existing primitive (unless necessary to fix bugs discovered during refactoring).
    *   Refactoring the main `SceneInterpreterImpl.interpretPath` orchestration logic (duration calculation, target blending *between* steps, main loop structure).
    *   Refactoring the placeholder `_interpretBlendStep` method.
    *   Refactoring non-primitive-related methods in `SceneInterpreterImpl` (e.g., `initialize`, `validateCommands`, `executeCommand`).

## 3. Proposed Architecture

1.  **`SceneInterpreterImpl` (`interpreter.ts`):**
    *   Remains the main class implementing the `SceneInterpreter` interface.
    *   The `interpretPath` method retains its core orchestration role (looping, duration, target blending between steps, state management).
    *   The `_interpretPrimitiveStep` method becomes significantly smaller, containing only a `switch` statement that imports and calls the specific handler function for the given `step.type`. It receives the results (commands and next state) from the handler and returns them.
    *   No longer contains the large blocks of primitive-specific implementation code within `_interpretPrimitiveStep`.
    *   No longer contains the private helper methods for calculations (these move to utils).
2.  **`interpreter-utils.ts` (New File):**
    *   Located at `src/features/p2p/scene-interpreter/interpreter-utils.ts`.
    *   Contains the shared helper functions previously defined as private methods (e.g., `resolveTargetPosition`, `clampPositionWithRaycast`, `mapDescriptorToValue`, `mapDescriptorToGoalDistance`, `normalizeDescriptor`).
    *   These functions will be exported and will accept necessary context (sceneAnalysis, envAnalysis, logger, etc.) as arguments.
3.  **`primitive-handlers/` (New Directory):**
    *   Located at `src/features/p2p/scene-interpreter/primitive-handlers/`.
    *   Contains one `.ts` file per primitive type (e.g., `handleDollyStep.ts`, `handleOrbitStep.ts`).
4.  **Handler Functions (e.g., `handleDollyStep`):**
    *   Each file exports a single function responsible for handling one primitive type.
    *   **Signature:** `(step: PrimitiveStep, currentPosition: Vector3, currentTarget: Vector3, stepDuration: number, sceneAnalysis: SceneAnalysis, envAnalysis: EnvironmentalAnalysis, logger: Logger) => { commands: CameraCommand[], nextPosition: Vector3, nextTarget: Vector3 }`
    *   **Responsibility:** Takes the current state and step definition, performs all necessary calculations (using imported utils), applies constraints, generates the `CameraCommand[]` for that step, and returns both the commands AND the resulting camera position and target for the *end* of that step.

## 4. Implementation Plan (Incremental)

The refactoring will proceed one primitive at a time to minimize risk and allow for testing at each stage.

1.  **Setup:**
    *   Create the `primitive-handlers/` directory.
    *   Create `interpreter-utils.ts`.
    *   Move the shared private helper methods from `SceneInterpreterImpl` to `interpreter-utils.ts`, make them exported functions, and update their signatures to accept context/logger arguments.
    *   Update `SceneInterpreterImpl` to import and use these utility functions where the private methods were previously called. Ensure this step is fully working and tested before proceeding.
2.  **Select First Primitive:** Choose a primitive to refactor (e.g., `static` or `dolly`).
3.  **Create Handler File:** Create the corresponding file (e.g., `handleDollyStep.ts`) in the `primitive-handlers/` directory.
4.  **Define Handler Function:** Define the exported handler function (`handleDollyStep`) with the standard signature defined in Section 3 (returning commands and next state).
5.  **Move Logic:** Cut the code block from the relevant `case` (e.g., `case 'dolly':`) within `SceneInterpreterImpl._interpretPrimitiveStep` and paste it into the new handler function.
6.  **Adapt Logic:**
    *   Add necessary imports to the handler file.
    *   Ensure all calls to helper functions now use the imported utility functions (passing the logger).
    *   Modify the function to **return an object** containing `{ commands: CameraCommand[], nextPosition: Vector3, nextTarget: Vector3 }`. The `nextPosition` and `nextTarget` should reflect the camera's state *after* the primitive's execution.
7.  **Update Dispatcher:**
    *   In `SceneInterpreterImpl._interpretPrimitiveStep`, import the new handler function.
    *   Modify the corresponding `case` block:
        *   Call the `handle...Step` function.
        *   Store the returned commands and next state.
        *   **(Crucially) Update the `currentPosition` and `currentTarget` variables** (which are local to `_interpretPrimitiveStep` or passed into it) with the `nextPosition` and `nextTarget` returned by the handler. This is essential for the *next* step in the loop.
        *   Return *only* the commands array (`result.commands`). The state update happens via side effect on the variables passed through the loop. (Self-correction: Revising state handling. The main `interpretPath` loop should manage state updates based on the *last* command returned by `_interpretPrimitiveStep`).
        *   **Revised `case` block update:**
            ```typescript
            case 'dolly': { // Example
                const result = handleDollyStep( // result = { commands, nextPosition, nextTarget }
                    step, currentPosition, currentTarget, stepDuration,
                    sceneAnalysis, envAnalysis, this.logger
                );
                commandsList.push(...result.commands);
                // State update is now handled in the main interpretPath loop after this returns
                break;
            }
            ```
    *   Modify the main `interpretPath` loop: After calling `_interpretPrimitiveStep` (or `_interpretBlendStep`), find the *last* command returned for that step, and update the loop's `currentPosition` and `currentTarget` based on that command's `position` and `target`.
8.  **Test Incrementally:** Manually test the application using prompts specifically designed to invoke the refactored primitive. Verify that the behavior and resulting animation are identical to the pre-refactor state. Fix any discrepancies.
9.  **Repeat:** Repeat steps 3-8 for all other primitives (`truck`, `pedestal`, `zoom`, `orbit`, `pan`, `tilt`, `rotate`, `focus_on`, `move_to`, `static`).
10. **Final Cleanup:** Once all primitives are refactored and tested:
    *   Remove any now-unused imports or variables from `interpreter.ts`.
    *   Verify the final file size of `interpreter.ts` is significantly reduced.
    *   Ensure all linter errors (including the persistent `commandsList` error) are resolved.

## 5. Specific Considerations

*   **State Management:** The handler functions calculate the final state (`nextPosition`, `nextTarget`), but the responsibility for updating the state used by the *next* step in the sequence lies with the main `interpretPath` loop, based on the last command generated by the handler.
*   **Shared Utilities:** Carefully identify all functions used across multiple primitive handlers and ensure they reside in `interpreter-utils.ts` with clear interfaces.
*   **Error Handling:** Handler functions should perform their internal validation and return an empty command array (`{ commands: [], nextPosition: currentPosition, nextTarget: currentTarget }`) if a step cannot be processed, logging appropriate errors/warnings. The main loop should continue gracefully.

## 6. Testing Strategy

*   **Incremental Functional Testing:** After refactoring *each* primitive handler, execute specific test prompts in the application that target that primitive with different parameters (directions, magnitudes, targets, etc.). Compare the resulting animation and behavior against the pre-refactoring version. Use existing regression test prompts where applicable.
*   **Final Regression Test:** Once all handlers are refactored, run the full suite of regression tests covering all primitives and sequences.

## 7. Definition of Done

*   All primitive-specific logic (`static` through `move_to`) is successfully extracted from `SceneInterpreterImpl._interpretPrimitiveStep` into separate handler functions in the `primitive-handlers/` directory.
*   Shared helper functions are moved to `interpreter-utils.ts`.
*   `SceneInterpreterImpl._interpretPrimitiveStep` consists only of the `switch` statement dispatching to the imported handlers and returning commands.
*   The `interpretPath` loop correctly manages state updates based on the commands returned by `_interpretPrimitiveStep`.
*   The overall line count of `src/features/p2p/scene-interpreter/interpreter.ts` is substantially reduced.
*   Incremental tests pass after each primitive refactor.
*   Final regression tests pass.
*   All TypeScript/linter errors in `interpreter.ts` and the new handler/util files are resolved. 