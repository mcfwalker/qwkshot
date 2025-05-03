# Feature Requirements: User-Triggered Square Thumbnail Generation

**ID:** THUMB-CLIENT-01
**Date:** 2025-05-02

## 1. Goal

Allow users to capture a square (1:1 aspect ratio) thumbnail image from the current state of the 3D viewer to visually represent their uploaded models within the model library.

## 2. User Story

As a user viewing my uploaded 3D model, I want to position the camera to frame the model effectively and click a button to capture a square thumbnail image based on this view, so that my model library provides useful visual previews.

## 3. High-Level Requirements

- **UI Element:**
    - A dedicated "Capture Thumbnail" button shall be added to the main viewer interface (e.g., within the `BottomToolbar`).
    - The button shall include a relevant icon (e.g., Camera).
    - The button shall be enabled only when:
        - A model is successfully loaded (`isModelLoaded` is true).
        - The scene is not locked (`isLocked` is false).
        - An animation is not playing (`isPlaying` is false).
    - Appropriate tooltips should explain the button's function and disabled states.
- **Capture Process:**
    - Clicking the enabled button shall trigger the thumbnail capture process.
    - The process must capture the current visual content of the main R3F `<canvas>` element.
- **Cropping:**
    - The captured image data must be cropped to a 1:1 square aspect ratio.
    - The cropping should target the center of the original canvas capture.
    - A temporary 2D `<canvas>` element should be used for the cropping operation.
- **Image Format & Upload:**
    - The cropped square image data shall be converted to a standard web image format (e.g., PNG via `canvas.toBlob('image/png')`).
    - The resulting image Blob/File shall be uploaded to a designated location within Supabase Storage (e.g., a `thumbnails` bucket/folder).
    - The uploaded thumbnail filename should be uniquely associated with the model (e.g., `[model_id].png`).
- **Database Update:**
    - Upon successful upload to storage, the public URL of the thumbnail image must be obtained.
    - The `models` table in the Supabase database shall be updated, storing the obtained `thumbnail_url` in the corresponding model's record.
    - A new nullable `thumbnail_url` text column must be added to the `models` table schema.
- **Feedback:**
    - Clear visual feedback (e.g., toast notifications) shall indicate the start, success, or failure of the thumbnail capture and upload process.
- **Library Display:**
    - The `/library` page components (e.g., `ModelCard`) shall fetch the `thumbnail_url` along with other model data.
    - If a `thumbnail_url` exists for a model, it shall be displayed as the model's preview image.
    - If `thumbnail_url` is null or empty, a default placeholder image or representation shall be displayed.

## 4. Technical Approach

- **Capture:** Utilize the HTML5 Canvas API (`canvas.toBlob('image/png')`) on the client-side, accessing the R3F canvas via `canvasRef`.
- **Cropping:** Employ the 2D Canvas API (`drawImage` with source/destination rectangles) on a temporary, offscreen canvas element created dynamically in JavaScript.
- **Upload & DB Update:** Use the Supabase JavaScript client library (`supabase-js`) for:
    - Uploading the generated Blob/File to Supabase Storage.
    - Updating the `models` table record via `supabase.from('models').update(...)` (requires appropriate RLS policies) OR preferably via a dedicated Server Action for security and data validation.

## 5. Out of Scope (Initial Implementation)

- Fully automatic thumbnail generation on model upload.
- Backend/server-side rendering for thumbnails.
- Advanced camera controls specifically for framing the thumbnail shot (uses current viewer camera state).
- User-side image editing/cropping tools beyond the automatic center square crop.
- Thumbnail regeneration options (initially, capture overwrites any existing thumbnail). 