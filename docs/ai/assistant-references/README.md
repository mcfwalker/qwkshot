# AI Assistant Reference Files\n\nThis directory contains reference files used by the OpenAI Assistant for motion planning.\n\n## Files\n\n*   `motion_kb.json`: This is the local source-of-truth and reference copy of the Motion Knowledge Base used by the Assistant. Changes made here MUST be manually uploaded to the OpenAI Assistant via the File API to take effect.\n*   `SYSTEM_INSTRUCTIONS_REF_YYYY-MM-DD-HHMM.txt`: Contains the plain text system instructions for the OpenAI Assistant. \n    *   **Versioning:** New versions of the instructions are saved in separate files with a timestamp suffix (`YYYY-MM-DD-HHMM`). The file with the **latest timestamp** represents the currently active instructions that should be configured in the OpenAI Assistant settings.\n    *   **Updating:** To update the Assistant's instructions, copy the entire content of the latest timestamped `.txt` file and paste it directly into the instructions field in the OpenAI Assistant configuration dashboard.\n

## Current Instruction Versions

*   `SYSTEM_INSTRUCTIONS_REF_2025-04-28-1737.txt` - Refined Step 3 to emphasize extracting ALL required parameters.
*   `SYSTEM_INSTRUCTIONS_REF_2025-04-28-1730.txt` - Base ...1429 + new primitives, pattern layer, rule refinements (no-op, focus_on, roll, override).
*   `SYSTEM_INSTRUCTIONS_REF_2025-04-28-1654.txt` - Reverted JSON example to concrete, added no-op/focus_on clarifications, noted roll unimplemented.
*   `SYSTEM_INSTRUCTIONS_REF_2025-04-28-1207.txt` - Added rotate/move_to/focus_on primitives, removed fly_by/fly_away, introduced pattern layer concept.
*   `SYSTEM_INSTRUCTIONS_REF_2025-04-19-1041.txt` - Introduced canonical descriptors (`tiny`...`huge`) for qualitative magnitudes and numeric `_override` parameters. Removed direct qualitative mapping.
*   `SYSTEM_INSTRUCTIONS_REF_2025-04-18-1156.txt` - Refined zoom consistency check to prioritize direction.
*   `SYSTEM_INSTRUCTIONS_REF_2025-04-18-1900.txt`