# 📽️ Prompt-to-Path Pipeline Responsibilities

This document outlines the major components and responsibilities of the LLM-driven camera control system used to translate natural language prompts into dynamic camera paths within a Three.js scene.

---

## 🔍 Scene Analyzer Responsibilities

| **Task**                | **What it does**                                                                  |
|-------------------------|-----------------------------------------------------------------------------------|
| Parse GLB files         | Extract geometry, materials, and basic scene information                          |
| Analyze spatial structure| Identify key points, boundaries, and spatial relationships                        |
| Calculate safety zones  | Determine safe camera distances and movement boundaries                          |
| Extract reference points| Identify important features and landmarks in the scene                           |
| Support large files     | Handle files up to 100MB with efficient processing                               |
| Detect symmetry         | Identify symmetry planes and patterns in the scene                               |
| Optimize start position | Determine optimal initial camera position and orientation                        |
| Validate animation paths| Ensure generated paths meet safety and quality standards                        |

---

## 🌍 Environmental Analyzer Responsibilities

| **Task**                | **What it does**                                                                  |
|-------------------------|-----------------------------------------------------------------------------------|
| Environment bounds      | Calculate and validate environment boundaries and constraints                    |
| Object measurements     | Extract and validate object dimensions and positioning                           |
| Distance calculations   | Compute distances from object to environment boundaries                          |
| Camera constraints     | Define safe camera positioning and movement constraints                          |
| Position validation    | Validate camera positions against environment and object constraints             |
| Height restrictions    | Enforce minimum and maximum camera heights                                      |
| Movement boundaries    | Define safe movement zones and restricted areas                                 |
| Start position validation| Validate and optimize initial camera position                                   |
| Animation constraints  | Define safe animation paths and movement patterns                              |

---

## 📊 Metadata Manager Responsibilities

| **Task**                | **What it does**                                                                  |
|-------------------------|-----------------------------------------------------------------------------------|
| Store user metadata     | Save and retrieve user-specified model information and preferences               |
| Handle model orientation| Track and manage model orientation and reference points                          |
| Track feature points    | Store and manage user-defined features and landmarks                            |
| Database integration    | Interface with Supabase for persistent storage                                   |
| Analysis data storage   | Store scene and environmental analysis results                                   |
| User preferences       | Manage default camera settings and viewing preferences                           |
| Start position storage | Store and retrieve camera start positions and preferences                       |
| Animation preferences  | Store and manage animation settings and constraints                             |

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
| Safety validation       | Enforce distance, height, and movement constraints                               |
| Start position context  | Include start position information in prompt context                            |
| Animation constraints   | Include animation preferences and constraints in prompt                         |

---

## 🧠 LLM Engine Responsibilities

| **Task**                       | **What it does**                                                                  |
|--------------------------------|-----------------------------------------------------------------------------------|
| Select LLM Provider            | Choose the active external LLM service (e.g., OpenAI, Gemini) based on config.   |
| Apply Provider Formatting      | Add final, provider-specific instructions or formatting to the compiled prompt.    |
| Send API Request               | Transmit the formatted prompt to the selected external LLM service API.            |
| Receive API Response           | Capture the raw response (typically JSON text) from the external LLM.              |
| Initial Response Validation    | Perform basic checks (e.g., is it valid JSON? Does it roughly match expected structure?). |
| Handle API Errors              | Manage communication issues like timeouts, authentication errors, rate limits.      |
| Parse Validated Response       | Convert the validated JSON string into usable keyframe data objects.               |
| (Future) Manage Retries/Fallback| Implement strategies for handling temporary LLM failures or switching providers.    |
| Pass Data to Interpreter       | Hand off the clean, parsed keyframe data to the Scene Interpreter component.       |
| Generate Motion Segments       | Create structured camera movements from LLM output                                |
| Validate Path Safety           | Ensure generated paths meet safety and quality standards                          |
| Consider start position        | Use start position as context for path generation                                |
| Generate animation paths       | Create smooth, natural camera movements                                          |

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
| Generate keyframes      | Create detailed camera positions and orientations                                |
| Handle motion types     | Process linear, spline, orbital, and composite movements                         |
| Start position handling | Manage initial camera position and transitions                                  |
| Animation execution     | Execute smooth camera movements with proper timing                               |

---

## 🖼 Three.js Viewer Responsibilities

| **Task**                | **What it does**                                                                  |
|-------------------------|-----------------------------------------------------------------------------------|
| Animate camera          | Move camera per interpreter's frame-by-frame or keyframe output                  |
| Visualize scene         | Render object, ground plane, camera helper(s), and optional guides               |
| Render path previews    | (Optional) Draw motion curves, vectors, or debug lines                           |
| Handle user control     | Allow play/pause/reset; potentially adjust camera during review                  |
| Export output           | Enable capture, export, or transition to video-processing pipeline               |
| Preview generation      | Create visual previews of planned camera movements                               |
| Interactive controls    | Manage playback speed, position, and camera adjustments                          |
| Start position UI       | Provide interface for setting and adjusting start position                      |
| Animation controls      | Manage animation playback, timing, and transitions                              |

---

## 📝 Feedback & Logging Layer Responsibilities

| **Task**                | **What it does**                                                                  |
|-------------------------|-----------------------------------------------------------------------------------|
| Log input/output        | Store prompt, scene data, LLM response, and result ID for each session           |
| Record playback metadata| Duration, path length, number of segments, etc.                                  |
| Collect user feedback   | Capture ratings (1–5), tags, or freeform comments                                |
| Store training candidates| Flag data for future LoRA fine-tuning or evaluation loops                       |
| Monitor model health    | Optionally track error rate, malformed paths, or prompt failures                 |
| Component metrics       | Track performance and usage of individual pipeline components                    |
| Health monitoring       | Monitor system health and provide recommendations                                |
| Start position metrics  | Track start position success rate and user satisfaction                         |
| Animation metrics       | Monitor animation smoothness and performance                                     |

---

> ✨ Use this breakdown to guide development, testing, and scaling of your virtual cinematographer pipeline.