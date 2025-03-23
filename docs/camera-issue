# Camera Path Generation Issue Report

## Issue Description
The AI-generated camera paths are not producing natural or contextually aware movements, particularly when instructed to focus on specific model features (e.g., a statue's face).

## Current Behavior
1. Camera movements are overly linear and mechanical
2. Target point remains fixed at model center: (-0.00012993, -0.0010629, -0.005801)
3. No true rotation around object despite instructions
4. Fails to identify and focus on specific model features

## Technical Analysis
From the debug logs, key issues identified:

1. **Target Point Limitation**
   - All keyframes target the exact same center point
   - No variation in target to track features
   ```json
   "target": {"x": -0.00012993500000002545, "y": -0.0010629890000000142, "z": -0.005801498999999988}
   ```

2. **Movement Pattern**
   - Linear position changes only
   - Example movement:
     ```json
     {x: 8.08 → 6.08 → 4.08 → 4.08}
     {y: 3.14 → 2.74 → 2.34 → 2.34}
     {z: 4.96 → 4.96 → 2.96 → 1.96}
     ```
   - No true orbital or rotational movement

3. **Model Orientation**
   - Front direction vector (0, 0, 1) not effectively utilized
   - No correlation between "front" and actual model features

## Root Causes
1. LLM lacks spatial understanding of model features
2. Camera path generation is too constrained to model center
3. No feature detection or semantic understanding of model geometry
4. Prompt engineering doesn't effectively convey spatial relationships

## Potential Solutions
1. Implement feature detection for key model points (face, edges, etc.)
2. Add intermediate target points for more dynamic camera movements
3. Enhance scene geometry data with feature mapping
4. Improve prompt engineering to better describe spatial relationships
5. Add capability to specify multiple target points in camera path

## Impact
- Limited cinematic quality in generated paths
- Reduced usefulness for feature-specific viewing
- May affect user adoption of AI camera features

## Priority
Medium - System is functional but needs improvement for better user experience

## Related Components
- `src/app/api/camera-path/route.ts`
- `src/components/viewer/CameraAnimationSystem.tsx`
- OpenAI integration
