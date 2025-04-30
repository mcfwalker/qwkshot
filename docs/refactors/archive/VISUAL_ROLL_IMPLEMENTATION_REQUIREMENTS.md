> **ARCHIVED: This document represents the initial plan for implementing visual roll based on `<OrbitControls>`. Subsequent testing revealed fundamental conflicts between manual orientation control and `<OrbitControls>`. The final implementation uses `<TrackballControls>` for user interaction and a modified `AnimationController` with conditional orientation handling (direct quaternion update for roll, `lookAt` for others). Refer to `ARCHITECTURE_v3.1_TrackballControls.md` and `TECHNICAL_DESIGN_v1.1_TrackballControls.md` for the current architecture.**

---

# Visual Roll Implementation Requirements

## 1. Introduction

This document outlines the requirements for implementing the visual effect of the `rotate` motion primitive when `axis: 'roll'` is specified. Currently, the interpreter recognizes the 'roll' axis but intentionally skips applying any visual rotation. The goal is to enable the camera to perform a banking motion left or right around its viewing axis.

This builds upon the completed Backend Normalization and Primitive Implementation refactors.

## 2. Definitions

-   **Roll:** Rotation of the camera around its local Z-axis (the axis pointing out from the lens, assuming a standard camera coordinate system where Y is up and -Z is forward). Visually, this results in the image appearing to tilt sideways.
-   **Yaw:** Rotation around the camera's local Y-axis (up/down axis). Equivalent to a **Pan**.
-   **Pitch:** Rotation around the camera's local X-axis (right/left axis). Equivalent to a **Tilt**.
-   **Quaternion:** A mathematical structure used to represent 3D orientation and rotation, avoiding issues like gimbal lock common with Euler angles. Represented as (x, y, z, w).
-   **SLERP:** Spherical Linear Interpolation. A method for smoothly interpolating between two orientations represented by quaternions.

## 3. Core Requirements

### 3.1. Scene Interpreter (`interpreter.ts`)

1.  **Modify `case 'rotate':` Logic:**
    *   Remove the `if (axis === 'roll') { ... continue; }` block that currently skips roll execution.
    *   When `axis === 'roll'`, calculate the final camera *orientation* (not just target) after applying the specified `angle` of roll.
    *   **Axis Calculation:** The roll axis is the camera's current viewing direction vector (local Z-axis). This can be calculated as `viewDirection = target.clone().sub(position).normalize()`.
    *   **Rotation Calculation:** Create a quaternion representing the roll rotation: `rollQuaternion = new THREE.Quaternion().setFromAxisAngle(viewDirection, THREE.MathUtils.degToRad(angle))`. Note: The sign of `angle` needs careful testing to match user expectation ("roll right" vs "roll left").
    *   **Current Orientation:** Determine the camera's *current* orientation quaternion before the roll. This can be derived using `new THREE.Matrix4().lookAt(currentPosition, currentTarget, currentCameraUp).decompose(dummyPos, currentOrientationQuaternion, dummyScale)`. (Requires calculating `currentCameraUp`).
    *   **Final Orientation:** Calculate the final orientation by multiplying the current orientation by the roll rotation: `finalOrientationQuaternion = currentOrientationQuaternion.multiply(rollQuaternion)`.
2.  **Update Command Generation:**
    *   Modify the `CameraCommand` objects generated for `rotate` (and potentially other relevant primitives if needed later) to include the calculated orientation.
    *   The start command should include the *current* orientation.
    *   The end command should include the *final* orientation calculated after the roll.

### 3.2. `CameraCommand` Type (`types/p2p/scene-interpreter.ts`)

1.  **Add Orientation Field:** Add an optional `orientation` field to the `CameraCommand` interface to store the target orientation as a serialized quaternion.
    ```typescript
    interface CameraCommand {
      position: { x: number; y: number; z: number };
      target: { x: number; y: number; z: number };
      duration: number;
      easing: EasingFunctionName;
      orientation?: { // Optional orientation quaternion
          x: number;
          y: number;
          z: number;
          w: number;
      };
      // ... other potential fields from smoothing plan ...
    }
    ```
2.  **Serialization:** Ensure the backend API (`/api/camera-path/route.ts`) correctly serializes the quaternion components (x, y, z, w) when sending commands to the client.

### 3.3. Animation Controller (`AnimationController.tsx`)

1.  **Deserialize Orientation:** When receiving commands, deserialize the `orientation` data back into `THREE.Quaternion` objects. Handle cases where `orientation` might be missing (default to an upright orientation calculated from position/target).
2.  **Interpolate Orientation:** In the `useFrame` loop, in addition to interpolating `position` and `target`:
    *   Identify the start and end orientation quaternions (`qStart`, `qEnd`) for the current animation segment.
    *   Use `THREE.Quaternion.slerp(qStart, qEnd, interpolatedQuaternion, t)` to calculate the smoothly interpolated orientation for the current frame time `t` (where `t` is the easing-adjusted interpolation factor 0-1 for the segment).
3.  **Apply Orientation to Camera:**
    *   Apply the interpolated position: `cameraRef.current.position.copy(interpolatedPosition)`.
    *   Apply the interpolated orientation: `cameraRef.current.quaternion.copy(interpolatedQuaternion)`.
    *   **Crucially:** AVOID calling `cameraRef.current.lookAt(interpolatedTarget)` *after* setting the quaternion, as `lookAt` recalculates orientation and would likely override the roll. The `target` vector is still needed for interpolation *between* commands but might not be directly used in `lookAt` during roll segments. Alternatively, carefully manage `cameraRef.current.up` before calling `lookAt`.

## 4. Implementation Considerations & Challenges

1.  **`OrbitControls` Conflict:** `OrbitControls` actively manages the camera's orientation and `up` vector. Manually setting `camera.quaternion` or `camera.up` might conflict with OrbitControls, causing jitter or snapping back.
    *   **Mitigation:** Investigate disabling `OrbitControls` temporarily during animation segments that involve roll. Re-enable afterwards, ensuring the controls' internal state is updated correctly (e.g., `controlsRef.current.target.copy(finalTarget)`).
    *   **Mitigation:** Experiment with updating `camera.up` based on the interpolated quaternion *before* calling `lookAt`, to see if OrbitControls respects it.
2.  **Quaternion Math:** Ensure correct understanding and application of quaternion multiplication order and SLERP.
3.  **Determining Initial Orientation:** Reliably getting the camera's "current" orientation quaternion at the start of each step in the interpreter requires careful calculation using `Matrix4.lookAt().decompose()`.
4.  **Roll Direction:** Define and test clearly whether a positive `angle` corresponds to a clockwise or counter-clockwise roll from the viewer's perspective and ensure consistency with user prompts ("roll left"/"roll right"). Update instructions/KB if needed.
5.  **Interaction with Other Rotations:** Ensure roll combines correctly (mathematically) with subsequent or preceding yaw/pitch rotations if they occur in the same logical step (though currently unlikely based on primitive design).

## 5. Testing Requirements

1.  **Basic Roll:** Test `rotate` with `axis: 'roll'` and various positive/negative `angle` values. Verify smooth visual banking.
2.  **Roll + Position Change:** Test sequences like "dolly forward then roll right", "roll left then pedestal up". Verify roll occurs correctly relative to the camera's path.
3.  **Roll + Orientation Change:** Test sequences like "roll right then tilt up", "pan left then roll left". Verify orientations combine correctly.
4.  **OrbitControls Interaction:** Verify that after a roll animation completes, manual interaction with OrbitControls behaves predictably and doesn't cause sudden snapping.
5.  **Easing:** Test roll with different easing functions.

## 6. Deliverables

-   Updated `SceneInterpreterImpl` with logic to handle `axis: 'roll'` and generate `orientation` data.
-   Updated `CameraCommand` type definition.
-   Updated `/api/camera-path/route.ts` to serialize orientation data.
-   Updated `AnimationController.tsx` to deserialize, interpolate (SLERP), and apply camera orientation.
-   Resolution or mitigation strategy for potential `OrbitControls` conflicts.
-   Unit/integration tests for roll logic and orientation interpolation.
-   Updated documentation (Architecture, Technical Design) if necessary.
-   **Update System Instructions:** Remove the note indicating roll is visually unimplemented.
-   **Update Motion KB:** Refine description/examples for the `rotate` primitive to clearly include roll functionality and direction conventions.

---
_End of document_ 