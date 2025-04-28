# Regression Test Prompts

This document contains a set of standard prompts used for regression testing the Prompt-to-Path pipeline, especially after changes to the Assistant instructions, Motion KB, or Scene Interpreter.

## Test Categories

### 1. Individual Motion Types

*   **Static:**
    *   `"Just hold the camera still for 5 seconds."`
*   **Zoom:**
    *   `"Zoom in halfway towards the object center, quickly."`
    *   `"Slowly zoom out by a factor of 2."`
    *   `"Zoom in very close to the current target."`
*   **Orbit:**
    *   `"Slowly orbit 180 degrees clockwise around the object."` 
    *   `"Orbit 90 degrees left around the object center."`
*   **Pan:**
    *   `"Pan left by 45 degrees."`
    *   `"Look right 90 degrees slowly."`
*   **Tilt:**
    *   `"Tilt the camera up 30 degrees."`
    *   `"Look down 20 degrees quickly."`
*   **Dolly:**
    *   `"Move the camera forward towards the object by 2 units."`
    *   `"Dolly in close."`
    *   `"Dolly backward a large distance."` x large is not large
*   **Truck:**
    *   `"Move the camera sideways to the right by 3 units."`
    *   `"Truck right a bit."`
    *   `"Truck left significantly."` x significantly not large enough
*   **Pedestal:**
    *   `"Move the camera straight up by 1 unit."`
    *   `"Pedestal up slightly."`
    *   `"Pedestal down a medium distance."`
*   **Focus On (with Spatial References):**
    *   `"Focus on the top of the object."`
    *   `"Look at the bottom center."`
    *   `"Center the view on the left side."`
    *   `"Focus on the front edge."` 

### 2. Sequential Motions (2-3 Steps)

*   `"Zoom out a little, then orbit 90 degrees counter-clockwise."`
*   `"Pedestal up slightly, then tilt down to look at the object center."`
*   `"Truck left, then dolly forward fast."`
*   `"Orbit 45 degrees clockwise, pause briefly, then zoom in close."`
*   `"Look up 20 degrees, then pan right 45 degrees."`

### 3. Qualitative Modifiers & Edge Cases

*   `"Perform a very slow orbit 360 degrees around the entire model."`
*   `"Rapidly push in towards the object's center."`
*   `"Gently pedestal down while panning right."` (Note: Expected sequential execution)
*   `"Zoom out factor 0.5"` (Test contradictory parameters - should be handled by Interpreter/Assistant)
*   `"Zoom in factor 2.0"` (Test contradictory parameters - should be handled by Interpreter/Assistant)
*   `"Orbit 0 degrees clockwise"` (Test zero movement)
*   `"Dolly forward 0 units"` (Test zero movement)
*   `"Truck left a tiny bit"` (Test potentially unsupported qualitative terms)

### 4. Canonical Descriptors & Overrides (NEW)

*   **Descriptor Tests:**
    *   `"Zoom in just a tiny bit."`
    *   `"Truck way across the scene to the right."` x distance should be larger?
    *   `"Pedestal a smidge up."` (Should map to 'tiny')
    *   `"Dolly back substantially."` (Should map to 'large' or 'huge') x needs to be larger distance; maps to 'large' but should be 'huge'
    *   `"Fly by extremely close to the object center."` (Requires fly_by implementation)
    *   `"Zoom out a huge amount."`x not a great deal of distance covered
    *   `"Move forward a medium distance."`
    *   `"Pedestal down small amount."`
*   **Override Tests:**
    *   `"Dolly forward 5 units."`
    *   `"Zoom factor 0.1."` (Should zoom in) x kinda works depending on camera start position
    *   `"Pedestal down 2.5 units."`
    *   `"Truck left 10."`
    *   `"Zoom out with a factor of 3.0."`
    *   `"Fly by the object center, passing 0.5 units away."` (Requires fly_by implementation)
    *   `"Move back exactly 4.2 units."`

### 5. Spatial Reference Targeting (Renumbered)

*   `"Tilt down to look at the bottom center."`
*   `"Orbit 90 degrees around the left side."`
*   `"Dolly in towards the front edge."` x might violate clamping
*   `"Pan left to face the back center of the object."`
*   `"Pedestal up towards the top edge."`

---

*TODO: Add more complex scenarios, fly_by, fly_away, arc, reveal, set_view tests once those motion types are fully implemented and tested.* 