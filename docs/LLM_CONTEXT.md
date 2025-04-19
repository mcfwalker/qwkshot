# Modern 3D Viewer - LLM Context Guide

## Project Overview
Modern 3D Viewer is a web application built with Next.js, React, and Three.js that allows users to view, interact with, and generate 3D models. The application features a camera animation system, path generation, and integration with AI services for model analysis and generation.

## Core Technologies
- **Frontend**: Next.js, React, TypeScript
- **3D Rendering**: Three.js, React Three Fiber
- **State Management**: Zustand
- **UI Components**: Radix UI, Framer Motion, Sonner
- **Authentication**: Supabase Auth
- **AI Integration**: Google Generative AI, OpenAI
- **Testing**: Vitest, React Testing Library
- **Deployment**: Vercel

## Project Structure
- `/src/app`: Next.js app router structure
- `/src/components`: Reusable UI components
- `/src/features`: Feature-specific components and logic
- `/src/lib`: Utility functions and shared code
- `/src/store`: Zustand state management
- `/src/types`: TypeScript type definitions

## Key Features
1. **Camera Animation System**: Allows recording and playback of camera movements
2. **Path Generation**: AI-powered generation of camera paths based on user prompts
3. **3D Model Viewer**: Interactive 3D model viewing with OrbitControls
4. **Library Management**: Organization and management of 3D models
5. **AI Integration**: Analysis and generation of 3D content using AI services

## Development Workflow
- Feature branches created from `main` branch
- Regular rebasing to keep branches up-to-date
- Development server runs in background mode (`npm run dev &`)
- Technical debt and issues tracked in project management software

## Documentation Structure
- `/docs/features`: Feature-specific documentation
- `/docs/development`: Development process documentation
- `/docs/ai`: AI integration documentation
- `/docs/status-reports`: Regular status updates
- `/docs/archive`: Archived documentation

## Coding Standards and Conventions
- **TypeScript**: Strict mode enabled, explicit typing preferred
- **Component Structure**: Functional components with hooks, props interface defined above component
- **File Naming**: PascalCase for components, camelCase for utilities and hooks
- **Import Order**: React imports first, then external libraries, then internal modules
- **State Management**: Zustand stores in `/src/store`, feature-specific state in feature directories
- **Error Handling**: Try/catch blocks with proper error logging and user feedback
- **Comments**: JSDoc for functions and components, inline comments for complex logic
- **CSS**: Tailwind utilities with custom components when needed, CSS modules for complex styling

## Architectural Decisions
- **Next.js App Router**: Chosen for its file-based routing and server components
- **Zustand over Redux**: Selected for simplicity, less boilerplate, and better TypeScript support
- **Feature-based Structure**: Organized by feature to improve maintainability and scalability
- **Server Components**: Used where possible to reduce client-side JavaScript
- **Supabase Auth**: Chosen for its simplicity and integration with Next.js
- **React Three Fiber**: Selected for its React integration with Three.js
- **Vitest**: Chosen for its speed and compatibility with Vite

## Common Patterns
- **State Management**: Zustand stores with actions and selectors
- **API Calls**: Server actions for data mutations, React Query for data fetching
- **Form Handling**: React Hook Form with Zod validation
- **Error Boundaries**: Used at route level to catch and handle errors
- **Loading States**: Suspense boundaries with loading fallbacks
- **Authentication**: Supabase auth with session persistence
- **3D Rendering**: React Three Fiber components with custom hooks
- **UI Components**: Radix UI primitives with custom styling

## Development Environment Setup
- **Prerequisites**: Node.js, npm/yarn
- **Installation**: `npm install` or `yarn install`
- **Environment Variables**: Copy `.env.example` to `.env.local` and fill in required values
- **Development Server**: `npm run dev &` (runs in background)
- **Testing**: `npm run test` or `npm run test:watch` for watch mode
- **Linting**: `npm run lint`
- **Building**: `npm run build`
- **Common Issues**: 
  - Port conflicts: Change port in `next.config.js`
  - Environment variables: Ensure all required variables are set
  - Cache issues: Clear `.next` directory with `rm -rf .next`

## Important Context for LLM
1. **Branch Strategy**: Feature branches created from `main`, regular rebasing
2. **Development Environment**: Server runs in background mode (`npm run dev &`)
3. **Authentication**: Supabase auth with session persistence
4. **Testing**: Vitest with React Testing Library, JSDOM environment
5. **Deployment**: Vercel with serverless functions

## Session Initialization
When starting a new session, please:
1. Acknowledge this context document
2. Confirm understanding of the project's current state
3. Ask for specific goals or tasks for the current session
4. Reference relevant documentation when making suggestions
5. Consider the project's architecture and patterns when proposing solutions

## Communication Guidelines
- Be concise and focused on the task at hand
- Reference specific files and line numbers when discussing code
- Suggest incremental changes rather than large refactors
- Consider the project's established patterns and conventions
- Provide explanations for suggested changes
- Ask for clarification when needed

*This document is designed to provide the LLM with essential context at the beginning of each new chat session. It should be included at the start of each conversation to ensure consistent and informed assistance.* 