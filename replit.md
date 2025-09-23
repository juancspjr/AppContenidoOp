# Pixshop - Photo Editor and Story Builder

## Overview
Pixshop is a React + TypeScript application built with Vite that provides two main features:
1. Photo Editor - Image editing and manipulation tools
2. Story Builder - AI-powered story creation with visual assets

## Recent Changes (September 23, 2025)
- Fixed import paths in StoryBuilder component for hooks and utils
- Configured Vite for Replit environment (host: 0.0.0.0, port: 5000)
- Set up development workflow with proper host binding
- Configured deployment settings for production (autoscale)

## Project Architecture
- **Build System**: Vite 6.x with React plugin
- **Frontend**: React 19.x with TypeScript
- **UI Framework**: Tailwind CSS (via CDN)
- **Key Dependencies**: 
  - @google/genai for AI services
  - react-image-crop for image manipulation
  - react-zoom-pan-pinch for canvas interactions
  - jszip for file handling
  - zod for validation

## File Structure
- `components/` - React components including story-builder modules
- `hooks/` - Custom React hooks
- `services/` - Business logic and API services
- `utils/` - Utility functions
- `public/workers/` - Web workers for background processing

## Development Setup
- Development server runs on port 5000 with host 0.0.0.0
- Hot module replacement (HMR) enabled
- TypeScript strict mode enabled
- Path aliases configured for cleaner imports (@/ -> root)

## Deployment
- Target: Autoscale (stateless website)
- Build: `npm run build`
- Run: `npm run preview`
- Optimized for production serving