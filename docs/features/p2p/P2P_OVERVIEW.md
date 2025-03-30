# 📽️ Prompt-to-Path Pipeline Responsibilities

This document outlines the major components and responsibilities of the LLM-driven camera control system used to translate natural language prompts into dynamic camera paths within a Three.js scene.

---

## 🧩 Prompt Compiler Responsibilities

| **Task**                | **What it does**                                                                  |
|-------------------------|-----------------------------------------------------------------------------------|
| Merge prompts           | Combine system prompt, user prompt, and context into a cohesive message          |
| Insert scene metadata   | Embed object center, bounding volume, and camera start into the prompt           |
| Format for LLM          | Structure the full payload (ChatML, JSON, markdown block, etc.)                  |
| Control verbosity       | Adjust how much detail goes into the prompt (e.g., "tight mode" vs verbose)      |
| Token length management | Optionally trim or simplify to stay under token limits                           |
| Track metadata          | Attach request ID, timestamp, or user info to the payload                        |

---

## 🧠 LLM Engine Responsibilities

| **Task**                | **What it does**                                                                  |
|-------------------------|-----------------------------------------------------------------------------------|
| Parse intent            | Understand the user's language and convert to actionable motion instructions     |
| Compose motion segments | Break down prompt into structured `cameraPath` JSON with segment types           |
| Apply spatial reasoning | Use embedded scene context to reason about motion direction, proximity, etc.     |
| Maintain camera framing | Ensure object stays in view, if asked                                             |
| Respond in JSON         | Return structured, interpretable path format (typed segments, durations, etc.)   |

---

## 🛠 Scene Interpreter Responsibilities

| **Task**                | **What it does**                                                                  |
|-------------------------|-----------------------------------------------------------------------------------|
| Parse camera segments   | Understand types like `push-in`, `orbit`, `crane`, etc.                          |
| Interpolate motion      | Generate frame-by-frame or keyframe transitions (e.g., `THREE.CatmullRomCurve3`) |
| Apply `lookAt` vectors  | Keep camera focused on the target throughout the move                            |
| Handle easing/duration  | Smooth transitions over time                                                     |
| Validate safety         | Clamp camera to scene bounds if needed                                           |
| Preview and playback    | Optional debug path rendering in the scene                                       |

---

## 🖼 Three.js Viewer Responsibilities

| **Task**                | **What it does**                                                                  |
|-------------------------|-----------------------------------------------------------------------------------|
| Animate camera          | Move camera per interpreter's frame-by-frame or keyframe output                  |
| Visualize scene         | Render object, ground plane, camera helper(s), and optional guides               |
| Render path previews    | (Optional) Draw motion curves, vectors, or debug lines                           |
| Handle user control     | Allow play/pause/reset; potentially adjust camera during review                  |
| Export output           | Enable capture, export, or transition to video-processing pipeline               |

---

## 📝 Feedback & Logging Layer Responsibilities

| **Task**                | **What it does**                                                                  |
|-------------------------|-----------------------------------------------------------------------------------|
| Log input/output        | Store prompt, scene data, LLM response, and result ID for each session           |
| Record playback metadata| Duration, path length, number of segments, etc.                                  |
| Collect user feedback   | Capture ratings (1–5), tags, or freeform comments                                |
| Store training candidates| Flag data for future LoRA fine-tuning or evaluation loops                       |
| Monitor model health    | Optionally track error rate, malformed paths, or prompt failures                 |

---

> ✨ Use this breakdown to guide development, testing, and scaling of your virtual cinematographer pipeline.