
# MiniMav: LLM-Driven Camera Path Tool for Three.js

## Goal
Create a browser-based React app (working title: **MiniMav**) that allows users to direct cinematic camera movement in a Three.js scene using natural language prompts. The system integrates with an LLM (e.g., OpenAI GPT-4) and exports camera paths for use in generative video platforms like Runway or Luma.

---

## Key Concepts

### Scene Abstraction
The LLM does *not* need full 3D geometry. A simple JSON abstraction is enough:

```json
{
  "cameraStart": { "position": [-10, 2, 0], "lookAt": [0, 1, 0] },
  "centralObject": {
    "name": "Spaceship",
    "type": "cylinder",
    "position": [0, 0, 0],
    "height": 3,
    "radius": 1
  },
  "bounds": { "x": [-20, 20], "y": [0, 10], "z": [-20, 20] }
}
```

---

## Prompt Strategy

Use a **system prompt** to instruct the LLM how to behave. Example:

> "You are an assistant that creates smooth camera paths in 3D environments for cinematic rendering. The camera should always move fluidly, avoid sharp angles, and always face the main object in the scene. The main object is identified in the JSON under the 'centralObject' key."

Then send the scene + user prompt as the `user` message.

---

## LLM Integration Options

| Tool/Feature         | Use Case                                | Notes |
|----------------------|------------------------------------------|-------|
| **System Prompts**   | Guide the LLM’s behavior and rules       | Use to enforce camera style, object focus, etc. |
| **Function Calling** | Structure the output as a clean JS/JSON object | Ensures predictable paths for easy parsing |
| **JSON Mode**        | Force raw JSON output (no markdown)      | Use `response_format: "json"` |
| **Assistants API**   | Keep multi-turn thread context, support file uploads | Optional — heavier setup, useful for persistent workflows |

---

## Example Payload (GPT-4 API)

```json
{
  "model": "gpt-4",
  "messages": [
    {
      "role": "system",
      "content": "You are an assistant that creates smooth camera paths..."
    },
    {
      "role": "user",
      "content": "Scene description: {...}\nPrompt: Orbit the object from right to left."
    }
  ]
}
```

---

## Deployment Notes

- You **do not** need a deployed server to test — local backend is fine.
- Avoid using your API key directly in the browser (use a Node backend).
- Store the API key in an `.env` file and use it securely on the server side.

---

## Naming Notes

Working name: **MiniMav**  
Alternatives considered: Shotline, Dolly, Take, Orbit, PromptCam, ScenePilot, etc.

---

## Next Steps (When Ready)

- Create an Express or Node backend to proxy API requests
- Implement function calling for structured camera path generation
- Add a draggable/tweakable visual editor for refining paths

