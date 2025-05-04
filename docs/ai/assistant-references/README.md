# AI Assistant Reference Files

This directory contains reference files used by the OpenAI Assistant for motion planning.

## Structure

-   `/system-instructions`: Contains timestamped versions of the system instructions provided to the Assistant.
-   `/motion-kb`: Contains timestamped versions of the Motion Knowledge Base JSON file provided to the Assistant via Retrieval.
-   `/pattern-kb`: Contains timestamped versions of the Pattern Knowledge Base JSON file provided to the Assistant via Retrieval.

## Files & Workflow

*   **Motion Knowledge Base (`motion_kb_YYYY-MM-DD-HHMM.json`):** 
    *   This JSON file defines the available motion primitives and their parameters.
    *   It is provided to the Assistant via the Retrieval tool.
    *   **Versioning:** To update the KB, create a **new file** with the current timestamp suffix (`YYYY-MM-DD-HHMM`). Do not edit older files directly.
    *   **Updating:** Changes made locally MUST be manually uploaded to the OpenAI Assistant via the File API (replacing the previous file used for Retrieval) to take effect. Update the list below.

*   **Pattern Knowledge Base (`pattern_kb_YYYY-MM-DD-HHMM.json`):**
    *   This JSON file defines high-level motion patterns (e.g., `zigzag`, `fly_by`) and their parameters.
    *   It is used by the Assistant, likely via Retrieval, to understand available patterns and potentially inform the use of the `compose_pattern` function.
    *   **Versioning:** To update the Pattern KB, create a **new file** with the current timestamp suffix (`YYYY-MM-DD-HHMM`) in the `/pattern-kb/` directory. Do not edit older files directly.
    *   **Updating:** Like the Motion KB, changes made locally MUST be manually uploaded to the OpenAI Assistant's configuration (e.g., associated with the Retrieval tool) to take effect. Update the list below.

*   **System Instructions (`SYSTEM_INSTRUCTIONS_REF_YYYY-MM-DD-HHMM.txt`):** 
    *   Contains the plain text system instructions for the OpenAI Assistant.
    *   **Versioning:** New versions of the instructions are saved in separate files with a timestamp suffix (`YYYY-MM-DD-HHMM`). The file with the **latest timestamp** represents the currently active instructions.
    *   **Updating:** To update the Assistant's instructions, copy the entire content of the latest timestamped `.txt` file and paste it directly into the instructions field in the OpenAI Assistant configuration dashboard. Update the list below.

**Note on Reliability:** While the files below represent the history, the version `SYSTEM_INSTRUCTIONS_REF_2025-04-22-1429.txt` is the last version confirmed to pass extensive regression testing with high reliability before the introduction of new primitives (`rotate`, `move_to`, `focus_on`) and the pattern layer concept. Subsequent versions incorporate necessary updates but require further validation to regain the same confidence level.

## Current Instruction Version
*(Latest file represents the instructions configured in the OpenAI Assistant)*

*   `system-instructions/SYSTEM_INSTRUCTIONS_REF_2025-04-29-1322.txt` - Failed implementation of the motion type roll.
*   `system-instructions/SYSTEM_INSTRUCTIONS_REF_2025-04-29-0658.txt` - 
*   `system-instructions/SYSTEM_INSTRUCTIONS_REF_2025-04-28-1737.txt` - Refined Step 3 to emphasize extracting ALL required parameters.
*   `system-instructions/SYSTEM_INSTRUCTIONS_REF_2025-04-28-1730.txt` - Base ...1429 + new primitives, pattern layer, rule refinements (no-op, focus_on, roll, override).
*   `system-instructions/SYSTEM_INSTRUCTIONS_REF_2025-04-28-1654.txt` - Reverted JSON example to concrete, added no-op/focus_on clarifications, noted roll unimplemented.
*   `system-instructions/SYSTEM_INSTRUCTIONS_REF_2025-04-28-1617.txt` - Clarified focus_on behavior, added handling for no-op requests, noted roll is visually unimplemented.
*   `system-instructions/SYSTEM_INSTRUCTIONS_REF_2025-04-28-1207.txt` - Added rotate/move_to/focus_on primitives, removed fly_by/fly_away, introduced pattern layer concept.
*   `system-instructions/SYSTEM_INSTRUCTIONS_REF_2025-04-22-1429.txt` - Stable base before primitive additions.
*   `system-instructions/SYSTEM_INSTRUCTIONS_REF_2025-04-19-1041.txt` - Introduced canonical descriptors (`tiny`...`huge`) for qualitative magnitudes and numeric `_override` parameters. Removed direct qualitative mapping.
*   ... (list other older versions if needed)

## Current Motion KB Version
*(Latest file represents the KB uploaded for Assistant Retrieval)*

*   `motion-kb/motion_kb_2025-04-28-1805.json` - Added `rotate`, `move_to`, `focus_on`; removed `fly_by`, `fly_away`; aligned `rotate` params.
*   `motion-kb/motion_kb_4-28-2025-1224.json` - (Older version, check content if needed)

## Current Pattern KB Version
*(Latest file represents the KB uploaded for Assistant Retrieval/Tools)*

*   `pattern-kb/pattern_kb_2024-07-25-1530.json` - Initial creation with `zigzag` and `fly_by`.

## Tips for Updating System Instructions

Based on experience, keep the following in mind when modifying the `SYSTEM_INSTRUCTIONS_REF_*.txt` files:

*   **Strict JSON Output is Fragile:** The Assistant can be very sensitive to instructions about output format. Strongly emphasize the requirement for *only* JSON output and explicitly prohibit *any* surrounding text, markdown, or citations (using phrasing like "ABSOLUTE PROHIBITION").
*   **Concrete Examples Preferred:** Using concrete examples (like the final JSON schema structure) seems more reliable than abstract placeholders (`<...>`). Avoid adding markdown fences around JSON examples in the instructions.
*   **Rule Specificity and Scope:** Be very precise when defining rules and their exceptions. Test edge cases carefully. For example:
    *   Clearly define the scope of rules like "Numeric Overrides" (e.g., explicitly stating it *doesn't* apply to angles).
    *   Clearly define exceptions to general rules (e.g., ensuring the "No-Op" rule doesn't incorrectly override `focus_on`).
*   **Reinforce KB Parameter Requirements:** Explicitly instruct the Assistant to include *all* parameters marked as `required: true` in the `motion_kb.json` for the chosen primitive type.
*   **Iterative Testing is Key:** After making instruction changes, test thoroughly with prompts specifically designed to exercise the modified rules or potentially affected primitives. Don't assume a logically sound change will work perfectly without verification.
*   **Sync with Platform:** Always remember to copy the *entire* content of the latest local `.txt` file and paste it into the Assistant's configuration on the OpenAI platform for the changes to take effect.