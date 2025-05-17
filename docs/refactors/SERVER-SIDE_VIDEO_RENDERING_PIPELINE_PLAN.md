# Server-Side Video Rendering Pipeline – Requirements Document

## 📌 Overview

This service will convert structured **camera commands** into **high-quality MP4 videos** using a server-side rendering pipeline based on:

* `Three.js` for rendering 3D scenes
* `headless-gl` for offscreen WebGL in Node.js (no browser)
* `FFmpeg` for video encoding
* A job queue and optional cloud storage for async processing and delivery

This system is designed to ensure **frame-accurate, deterministic, and platform-optimized output** for shareable video assets in 16:9 or 9:16 format.

---

## 🎯 Goals

* Accept structured camera animation input (camera position, target, timing).
* Render a 3D scene frame-by-frame using Three.js in a headless Node.js environment.
* Encode rendered frames into an MP4 using FFmpeg.
* Output MP4 files in consistent resolutions (e.g., 1920×1080 or 1080×1920).
* Optionally upload MP4 output to cloud storage (e.g., S3 or Supabase).
* Expose an API for triggering jobs and retrieving results.

---

## 🔧 Core Components

### 1. Render Engine (Node.js + headless-gl + Three.js)

* Instantiate a headless WebGL context (`headless-gl`).
* Create a Three.js scene with predefined assets or dynamically loaded content.
* Parse camera command data and interpolate camera position/target over N frames.
* Render each frame to a buffer (`gl.readPixels` or canvas).
* Save or stream these frames as raw RGB or PNG to an encoder process.

### 2. Video Encoder (FFmpeg)

* Accept image frames from disk or via stdin pipe.
* Encode to MP4 with specific encoding settings:

```bash
ffmpeg -r 30 -f image2 -i frame_%04d.png \
  -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p \
  -movflags +faststart output.mp4
```

* Support multiple aspect ratios:

  * 1920×1080 (16:9, landscape)
  * 1080×1920 (9:16, portrait)

### 3. Job Orchestration (Worker/Queue)

* Each video render runs in an isolated worker thread or container.
* Queue manager (e.g., BullMQ or a basic Redis-backed queue) processes render jobs.
* Each job includes:

  * Camera command data
  * Scene ID or preset
  * Output format/size

### 4. API Layer

* POST `/render`

  * Accepts camera commands and job metadata.
* GET `/status/:jobId`

  * Returns status of render job (queued, rendering, complete, failed).
* GET `/download/:jobId`

  * Returns a signed URL or stream of the output MP4.

---

## 📟 Input Format (Example)

```json
{
  "sceneId": "scene_001",
  "cameraPath": [
    { "time": 0, "position": [0, 5, 10], "target": [0, 0, 0] },
    { "time": 2, "position": [5, 5, 5], "target": [0, 0, 0] },
    { "time": 4, "position": [10, 5, 0], "target": [0, 0, 0] }
  ],
  "fps": 30,
  "resolution": "1080x1920"
}
```

---

## 📤 Output Format

* `MP4` video file
* H.264 encoded
* 30 FPS (configurable)
* Downloadable via API or link
* Optionally stored on:

  * Supabase Storage
  * Amazon S3
  * Local `/output` directory (for dev)

---

## 📁 Folder Structure (Suggested)

```
/render-service
  /src
    render.js         # Main renderer (Three.js + headless-gl)
    encode.js         # FFmpeg wrapper or command invoker
    jobRunner.js      # Pulls jobs from queue and processes
    server.js         # API endpoints
  /public
    /scenes           # Static scene definitions or assets
  /output             # (Dev only) Local rendered videos
  Dockerfile
  package.json
  README.md
```

---

## 🔐 Security & Permissions

* Input is sanitized before passed into any shell commands.
* Workers run in sandboxed environments or Docker containers.
* Optional: Auth middleware for API access.

---

## 🚀 Deployment Considerations

* Dockerized render workers (CPU or GPU-based)
* Deploy with:

  * Google Cloud Run
  * AWS Fargate
  * Render.com
  * Fly.io
* Ensure containers support:

  * `libgl`
  * `headless-gl` compatible drivers
  * FFmpeg installed in base image

---

## 🔪 Testing

* Unit tests for frame generator and camera interpolation.
* Test render jobs using pre-defined camera paths.
* Benchmark performance and memory usage per render job.
* Regression tests for scene fidelity (rendered output should be deterministic given same input).

---

## 🗜️ Future Enhancements

* Add audio support (e.g., background music layer)
* Watermark or overlay logo
* Add progress notifications (via WebSocket or webhook)
* Batch rendering / templated scenes
* Support alpha channel (WebM or ProRes export)

---

## 📞 Next Steps

1. Scaffold Node project with rendering and encoding skeleton.
2. Test single-scene, single-camera render.
3. Pipe frames to FFmpeg for MP4 generation.
4. Add simple API layer.
5. Dockerize and test on cloud deployment.

---

## 👥 Team Roles (Optional)

| Role                | Responsibility                            |
| ------------------- | ----------------------------------------- |
| Product Owner       | Define requirements, test output          |
| Developer           | Build Node.js service, render logic       |
| DevOps              | Set up Docker and cloud deployment        |
| Designer (optional) | Provide scene assets or visual references |
