# Server-Side Video Rendering Pipeline (Puppeteer-Based) – Requirements Document

## 📌 Overview

This service will convert structured **camera commands** into **high-quality MP4 videos** using a server-side rendering pipeline based on:

*   `Puppeteer` (or `Playwright`) for headless browser control and `Three.js` scene rendering.
*   `FFmpeg` for video encoding.
*   A job queue and optional cloud storage for asynchronous processing and delivery.

This system is designed to ensure **frame-accurate, deterministic, and platform-optimized output** for shareable video assets in specified aspect ratios (e.g., 16:9, 9:16, 1:1).

---

## 🎯 Goals

*   Accept structured camera animation input (camera position, target, timing, model ID).
*   Render a 3D scene frame-by-frame using Three.js within a headless browser environment.
*   Encode rendered frames into an MP4 using FFmpeg.
*   Output MP4 files in consistent resolutions (e.g., 1920×1080, 1080×1920, 1080x1080).
*   Optionally upload MP4 output to cloud storage (e.g., S3 or Supabase).
*   Expose an API for triggering jobs and retrieving results.
*   Prioritize development speed and debuggability by leveraging a full browser environment.

---

## 🔧 Core Components

### 1. Render Engine (Node.js + Puppeteer/Playwright + Three.js)

*   A Node.js service orchestrates Puppeteer/Playwright.
*   Puppeteer launches a headless Chromium/Chrome instance (or Playwright with a chosen browser).
*   A dedicated HTML page ("render page") is loaded in a browser tab. This page contains the Three.js logic to:
    *   Load the specified 3D model (e.g., GLB/GLTF fetched from Supabase Storage based on `modelId`).
    *   Set up the scene, lighting, and environment (can be minimal for "hero shots").
    *   Apply camera command data (parsed and passed from the Node.js orchestrator) to interpolate camera position/target over N frames.
*   For each frame:
    *   The Three.js camera is updated.
    *   The scene is rendered by Three.js to its canvas.
    *   Puppeteer captures a screenshot of the canvas element or a specified viewport region.
*   Screenshots (frames) are saved temporarily or streamed as PNG/JPEG to an encoder process.

### 2. Video Encoder (FFmpeg)

*   Accept image frames from disk or via stdin pipe from the Node.js orchestrator.
*   Encode to MP4 with specific encoding settings:

```bash
# Example: 30 FPS input, H.264 codec, good quality, web-optimized MP4
ffmpeg -r 30 -f image2pipe -i - \
  -c:v libx264 -crf 20 -preset medium -pix_fmt yuv420p \
  -movflags +faststart output.mp4
```

*   Support multiple aspect ratios and resolutions, e.g.:
    *   1920×1080 (16:9, landscape)
    *   1080×1920 (9:16, portrait)
    *   1080×1080 (1:1, square)

### 3. Job Orchestration (Worker/Queue)

*   Each video render runs as a job processed by the Node.js service.
*   Queue manager (e.g., BullMQ with Redis, or a simpler cloud-native queue like Google Cloud Tasks) processes render jobs.
*   Each job includes:
    *   `modelId` (to fetch the correct 3D model)
    *   Camera command data
    *   Scene parameters (if any, beyond the blank environment)
    *   Output format/size (e.g., "1080x1080_mp4")
    *   `userId` (for association and notifications)

### 4. API Layer (Node.js)

*   **POST `/render`**
    *   Accepts `modelId`, camera commands, output settings, and `userId`.
    *   Validates input.
    *   Adds a new job to the queue.
    *   Returns a `jobId` and status (e.g., "queued").
*   **GET `/render/status/:jobId`**
    *   Returns status of render job (queued, processing, complete, failed, progress percentage if available).
*   **GET `/render/download/:jobId`** (or a field in status response)
    *   If complete, returns a signed URL to the output MP4 from cloud storage, or directly streams the file (less ideal for larger files).

---

## 📟 Input Format (Example)

```json
{
  "userId": "user_abc_123",
  "modelId": "uuid_of_the_3d_model",
  "cameraPath": [
    { "time": 0, "position": [0, 1.5, 5], "target": [0, 1, 0], "fov": 50 },
    { "time": 10, "position": [5, 2, 0], "target": [0, 1, 0], "fov": 50 },
    { "time": 20, "position": [0, 1.5, -5], "target": [0, 1, 0], "fov": 50 }
  ],
  "animationDurationSeconds": 20, // Max 20 seconds
  "fps": 30,
  "outputResolution": "1080x1080", // e.g., "1920x1080", "1080x1920"
  "outputFormat": "mp4"
}
```

---

## 📤 Output Format

*   `MP4` video file.
*   H.264 encoded (via `libx264`).
*   Target FPS (e.g., 30 FPS).
*   Downloadable via API.
*   Stored on chosen cloud storage:
    *   Supabase Storage (preferred, to keep assets together).
    *   Amazon S3 or Google Cloud Storage.
    *   Local `/output` directory (for development).

---

## 📁 Folder Structure (Suggested for Rendering Service)

```
/video-render-service
  /src
    index.js          # Main Node.js server (API, queue listener)
    render-job.js     # Logic for a single render job (Puppeteer, FFmpeg)
    ffmpeg-utils.js   # Helper for FFmpeg commands
    queue-manager.js  # Interface for BullMQ or other queue
    /render-page      # Static HTML/JS/CSS for the Three.js rendering environment
      index.html
      viewer.js       # Three.js logic, model loading, animation playback
      style.css
  /output             # (Dev only) Local rendered videos
  Dockerfile          # To package Node.js, Puppeteer, FFmpeg, and render-page
  package.json
  README.md
```

---

## 🔐 Security & Permissions

*   Input `modelId` and other parameters are validated.
*   API access can be protected (e.g., API key, or internal VPC access if called from Vercel backend).
*   Puppeteer launched with minimal necessary permissions (e.g., disable networking for the render page if all assets are local or pre-fetched by Node).
*   FFmpeg commands constructed carefully to prevent injection vulnerabilities (use library functions for arguments, not string concatenation).
*   Ensure the rendering service only accesses models the `userId` is authorized for (if models are private).

---

## 🚀 Deployment Considerations

*   Dockerized service containing Node.js, a compatible version of headless Chrome (via Puppeteer), FFmpeg, and all necessary system libraries (graphics libs for browser, fontconfig, etc.).
*   Deploy with a service suited for potentially long-running, containerized applications:
    *   Google Cloud Run (with increased timeout settings, e.g., up to 60 mins).
    *   AWS Fargate.
    *   Render.com (supports Docker deployments).
    *   Fly.io.
*   Ensure base Docker image has all dependencies for Puppeteer and FFmpeg.
*   Consider CPU allocation; video encoding is CPU-intensive.
*   Persistent job queue (Redis for BullMQ) needs to be managed or hosted.

---

## 🔪 Testing

*   Unit tests for camera path interpolation and parameter validation.
*   Integration tests for the render job:
    *   Give sample input JSON.
    *   Verify an MP4 is created.
    *   Verify video duration, resolution, and basic content (e.g., by checking a few key frames).
*   Test Puppeteer's ability to load and render the `render-page` correctly.
*   Benchmark performance (time per frame, encoding time) and resource usage.
*   Visual regression testing (comparing output frames/videos to known good versions) is ideal but complex to set up. Start with manual visual checks.

---

## 🗜️ Future Enhancements (Similar to original plan)

*   Add audio support (e.g., background music layer).
*   Watermark or overlay logo.
*   Real-time progress notifications (via WebSocket or webhook to Vercel app).
*   Support for more output formats (e.g., GIF).
*   Allow users to choose different "blank environment" styles or lighting presets.

---

## 📞 Next Steps (Illustrative, aligned with coaching approach)

1.  **Setup Basic Node.js Server & Docker:** Create a simple Node.js/Express server, Dockerize it, and deploy a "hello world" to Google Cloud Run (or chosen platform).
2.  **Puppeteer & Frame Capture:** Integrate Puppeteer to launch a browser, navigate to a simple page, and capture a single screenshot.
3.  **FFmpeg - Image to Video:** Add FFmpeg to Docker. Script Puppeteer to capture a few simple frames and pipe them to FFmpeg to create a basic MP4.
4.  **Three.js Render Page:** Develop the static `render-page/index.html` with Three.js logic to load a hardcoded model and animate a camera simply.
5.  **Integrate Puppeteer with Render Page:** Have Puppeteer load the `render-page` and capture frames from its Three.js canvas.
6.  **API for Dynamic Renders:** Implement the `/render` API endpoint to accept dynamic `modelId`, camera path, etc., and pass this to the render job.
7.  **Job Queue & Storage:** Integrate a basic job queue and save output to Supabase Storage.
8.  **Frontend Call:** Your Vercel app calls this new rendering service.

---

## 🌟 Key Differences from `headless-gl` Approach

*   **Render Engine:** Uses a full headless browser (Puppeteer/Playwright) instead of `headless-gl`.
    *   **Pros:** Higher compatibility with web standards and Three.js, easier debugging (can run headed locally), potentially faster initial development and troubleshooting.
    *   **Cons:** Slightly larger resource footprint per instance compared to a highly optimized `headless-gl` solution.
*   **Development Focus:** Emphasis on leveraging existing browser technology for rendering, reducing the need to manage low-level GL contexts directly in Node.js. This can simplify development, especially when dealing with complex scenes or specific Three.js features.
*   **Environment Complexity:** Docker setup will need to include a full browser environment, but this is well-documented for Puppeteer.

This approach prioritizes robustness and developer experience for achieving the core rendering task, potentially at the cost of some raw performance compared to a perfectly tuned `headless-gl` setup, but with a likely faster path to a working, reliable solution. 