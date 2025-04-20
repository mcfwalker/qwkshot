# Canonical Descriptors Refinement Plan

## 1. Goals & Rationale

### Goals
- Replace the direct mapping of varied user qualitative language (e.g., "close", "a bit", "far away") to numeric parameters (`distance`, `factor`) with a more robust, two-stage approach.
- Leverage the LLM's strength in semantic understanding to map fuzzy user language to a small set of **canonical descriptors** (e.g., `tiny`, `small`, `medium`, `large`, `huge`).
- Empower the deterministic `SceneInterpreter` to quantify these canonical descriptors into context-aware numeric values (distances, factors) based on scene/object geometry.
- Improve the reliability and predictability of motions requested with qualitative magnitude/intensity.
- Simplify Assistant instructions by removing large synonym lists for magnitudes.
- Make tuning the "feel" of qualitative distances easier by centralizing the mapping logic in the Interpreter code.
- Provide a clear mechanism for users to input explicit numeric overrides.

### Rationale
Recent testing revealed brittleness in the V3 pipeline when handling nuanced qualitative magnitude prompts ("way above", "very close", "as close as possible"). The Assistant struggled to consistently map these to appropriate numeric parameters, sometimes defaulting to generic values or misinterpreting intent. Relying on extensive synonym lists in instructions is unscalable. This refinement shifts responsibilities: LLM categorizes semantically, Interpreter quantifies deterministically using context. This does **not** address state-dependent instructions like "return to start", which requires separate solutions.

## 2. Phased Implementation Plan

### Phase 1: KB Schema Update
*   **Goal:** Update the Motion Knowledge Base schema to replace numeric/string distance/factor parameters with canonical descriptor enums and numeric overrides.
*   **Action Items:**
    *   [x] **Define Parameters:**
        *   Define `distance_descriptor: enum["tiny", "small", "medium", "large", "huge"]` (required if no override).
        *   Define `distance_override: number` (optional).
        *   Define `factor_descriptor: enum["tiny", "small", "medium", "large", "huge"]` (required if no override).
        *   Define `factor_override: number` (optional).
        *   Define `pass_distance_descriptor: enum["tiny", "small", "medium", "large", "huge"]` (optional, default medium).
        *   Define `pass_distance_override: number` (optional).
    *   [x] **Apply to Motions in `motion_kb.json`:**
        *   For `dolly`, `truck`, `pedestal`, `fly_away`: Replace old `distance` param with `distance_descriptor` and `distance_override`.
        *   For `zoom`: Replace old `factor` param with `factor_descriptor` and `factor_override`.
        *   For `fly_by`: Replace old `pass_distance` param with `pass_distance_descriptor` and `pass_distance_override`.
    *   [x] **Update Descriptions:** Update parameter descriptions in `motion_kb.json` to reflect the new structure and purpose.
    *   [x] **Sync KB:** Manually upload the updated `motion_kb.json` file to the configured OpenAI Assistant, replacing the old version.

### Phase 2: Assistant Instruction Update
*   **Goal:** Instruct the Assistant to map qualitative magnitudes to canonical descriptors and handle numeric overrides correctly.
*   **Action Items:**
    *   [x] **Get Timestamp:** Run `date "+%Y-%m-%d-%H%M"` to get the current timestamp.
    *   [x] **Create New Instruction File:** Create `docs/ai/assistant-references/SYSTEM_INSTRUCTIONS_REF_<timestamp>.txt`.
    *   [x] **Remove Old Guidance:** Delete instructions related to interpreting specific qualitative synonyms (e.g., "close means factor 0.5") for distance and factor.
    *   [x] **Add Descriptor Mapping Rule:** Add clear instructions stating:
        *   For any user phrasing indicating magnitude/intensity/closeness for distance (`dolly`, `truck`, `pedestal`, `fly_away`), zoom factor (`zoom`), or pass distance (`fly_by`), map it to the *closest* canonical descriptor: `tiny`, `small`, `medium`, `large`, or `huge`.
        *   Output this chosen descriptor using the corresponding parameter field (e.g., `distance_descriptor`, `factor_descriptor`, `pass_distance_descriptor`).
    *   [x] **Add Numeric Override Rule:** Instruct the Assistant:
        *   If the user provides an explicit number for distance, factor, or pass distance, output that number using the corresponding `_override` parameter field (e.g., `distance_override`, `factor_override`, `pass_distance_override`).
        *   If an `_override` field is used, **OMIT** the corresponding `_descriptor` field for that motion step.
    *   [x] **Review & Save:** Ensure instructions are clear and consistent.
    *   [x] **Sync Instructions:** Manually copy the plain text content from the new file and update the Assistant's configuration on the OpenAI platform.
    *   [x] **Update README:** Add the new instruction file reference to `docs/ai/assistant-references/README.md`.

### Phase 3: Scene Interpreter Implementation
*   **Goal:** Update the Interpreter logic to handle the new descriptor/override parameters and calculate context-aware numeric values.
*   **Action Items:**
    *   [x] **Refactor/Create Mapping Helper:**
        *   Decide whether to refactor `_calculateEffectiveDistance` or create a new helper function (e.g., `_mapDescriptorToValue`).
        *   This helper needs input parameters: `descriptor`, `motionType`, `sceneAnalysis`, `envAnalysis`, `currentPosition`, `currentTarget`.
        *   Implement the core mapping logic inside: use `sceneAnalysis.spatial.bounds.dimensions` (and potentially `currentDistance`, `min/maxDistance` constraints) to calculate a numeric distance/factor based on the `descriptor` and `motionType`. Define multipliers or formulas for `tiny`...`huge`.
    *   [x] **Update Motion Generators (`dolly`, `truck`, `pedestal`, `fly_away`):**
        *   Read `distance_override` and `distance_descriptor` from `step.parameters`.
        *   If `distance_override` is valid, use it directly as `effectiveDistance`.
        *   Else if `distance_descriptor` is valid, call the mapping helper to get `effectiveDistance`.
        *   Else, handle error or use a default distance.
        *   Use the final `effectiveDistance` in subsequent movement calculations.
    *   [x] **Update Motion Generator (`zoom`):**
        *   Read `factor_override` and `factor_descriptor` from `step.parameters`.
        *   If `factor_override` is valid, use it directly as `effectiveFactor`.
        *   Else if `factor_descriptor` is valid, call mapping helper (or use inline logic) to get `effectiveFactor`.
        *   **Added:** Handle `target_distance_descriptor` to calculate `effectiveFactor` based on goal proximity.
        *   Ensure calculated `effectiveFactor` is consistent with the `direction` parameter.
        *   Use the final `effectiveFactor` in zoom calculations.
    *   [ ] **Update Motion Generator (`fly_by`):**
        *   Read `pass_distance_override` and `pass_distance_descriptor` from `step.parameters`.
        *   Prioritize `pass_distance_override`.
        *   If using descriptor, call mapping helper to get `effectivePassDistance`. Use a default descriptor (e.g., 'medium') if neither is provided.
        *   Use the final `effectivePassDistance` in fly-by path calculation.

### Phase 4: Testing & Refinement
*   **Goal:** Verify the new system correctly interprets varied qualitative inputs and produces contextually appropriate movements. Tune the mapping logic.
*   **Status:** Approximately 70% complete. Core functionality for distance/factor descriptors and overrides is implemented and anecdotally tested. Goal-distance logic for dolly/zoom added and tested. Remaining work involves comprehensive testing across various scenarios and object sizes, plus specific tests for spatial targets.
*   **Action Items:**
    *   [~] **Update Regression Prompts:** Add more prompts to `docs/testing/REGRESSION_PROMPTS.md` using diverse qualitative phrasing (e.g., "zoom in just a tiny bit", "truck way across the scene", "pedestal a smidge", "dolly back substantially", "fly by extremely close"). *Needs more systematic additions.* 
    *   [~] **Add Override Tests:** Include prompts explicitly testing numeric overrides (e.g., "dolly forward 5 units", "zoom factor 0.1"). *Needs more systematic additions.* 
    *   [~] **Execute E2E Tests:** Run the updated regression prompts through the application. *Anecdotal testing done; full regression pending.* 
    *   [~] **Analyze Results:**
        *   Check Assistant `MotionPlan` output in logs: Does it correctly map phrasing to descriptors (e.g., "way across" -> `distance_descriptor: "huge"`)? Does it correctly use overrides (e.g., "5 units" -> `distance_override: 5`)? *Initial checks positive.* 
        *   Observe resulting animation: Does the *magnitude* of the movement feel appropriate given the descriptor and the object's size? (e.g., Does `huge` feel significantly larger than `medium`? Does `medium` scale reasonably between small and large objects?). *Initial checks positive; needs wider object size testing.* 
    *   [~] **Tune Interpreter Mapping:** Adjust the multipliers/formulas within the Interpreter's descriptor mapping logic based on test results until the "feel" of `tiny`...`huge` is satisfactory across different scenarios. Repeat testing as needed. *Adjustments made for dolly/zoom goal-distance; further tuning may be needed after full tests.* 

### Phase 5: Documentation Update
*   **Goal:** Ensure project documentation accurately reflects the canonical descriptor implementation.
*   **Action Items:**
    *   [ ] Update `docs/features/camera-animation/ARCHITECTURE.md` (P2P Overview) to describe the canonical descriptor pattern for relevant parameters.
    *   [ ] Update relevant sections of `docs/TECHNICAL_DESIGN.md` (e.g., P2P Pipeline section, potentially API structure if parameter names changed significantly).
    *   [ ] Add/update JSDoc comments in `SceneInterpreterImpl` code for new helper functions and modified generator logic.

## 3. Open Questions/Considerations
- How exactly should zoom `factor` map from descriptors (e.g., should `tiny` approach `minDistance`, `huge` approach `maxDistance`)? Needs careful design in Phase 3.
- Default descriptor for `fly_by` `pass_distance` if unspecified? (Suggest `medium`).
- Will this approach be extended to `angle` parameters later? (Track as future enhancement). 