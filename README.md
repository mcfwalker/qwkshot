# MiniMav

A browser-based React app that allows users to direct cinematic camera movement in a Three.js scene using natural language prompts. The system integrates with OpenAI GPT-4 for intelligent camera path generation.

## Features

- 🎥 Natural language camera path generation
- 🎮 Real-time 3D model viewing with intuitive controls
- 🌈 Modern UI powered by shadcn components
- 🔄 Smooth camera transitions and animations
- 🏃‍♂️ Scene geometry analysis for intelligent path finding
- 🎨 Customizable floor textures and grid options
- 📚 Model library management
- 🔐 Authentication with Supabase

## Tech Stack

- Next.js 14
- React
- Three.js
- OpenAI GPT-4
- Supabase
- shadcn/ui
- TypeScript
- Tailwind CSS

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/mcfwalker/minimav.git
cd minimav
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file with the following:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Upload or select a 3D model (supported formats: GLTF, GLB)
2. Use the camera presets or enter natural language instructions
3. Adjust floor settings and model position as needed
4. Generate and preview camera paths
5. Save or export your camera animations

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT License](LICENSE)

---
Built with ❤️ using Next.js and Three.js
