# Model Thumbnails Feature

## Overview
Automatically generate and manage thumbnails for 3D models in the library view, providing users with visual previews of their models.

## Technical Implementation

### Thumbnail Generation
```typescript
interface ThumbnailGenerator {
  // Core functionality
  generateThumbnail: (modelUrl: string) => Promise<string>
  uploadThumbnail: (imageData: string, modelId: string) => Promise<string>
  
  // Error handling
  handleGenerationError: (error: Error) => void
  retryGeneration: (modelId: string) => Promise<void>
}
```

### Components
1. **Off-screen Renderer**
   - Three.js WebGLRenderer setup
   - Canvas size: 512x512 pixels
   - Alpha channel support for transparency

2. **Scene Setup**
   - Isometric camera position (5, 5, 5)
   - Look-at point (0, 0, 0)
   - Ambient and directional lighting
   - Optional grid or platform beneath model

3. **Model Processing**
   - Load GLB using GLTFLoader
   - Auto-center model in view
   - Scale to fit viewport
   - Apply consistent materials/lighting

### Storage & Database
1. **Supabase Integration**
   - Separate 'thumbnails' storage bucket
   - `thumbnail_url` column in models table
   - Cleanup old thumbnails on model update/delete

2. **Caching Strategy**
   - Browser-level caching
   - CDN caching configuration
   - Cache invalidation on model update

## Implementation Phases

### Phase 1: Core Infrastructure
1. Create thumbnail generation utility
2. Set up Supabase storage bucket
3. Add database schema updates
4. Implement basic error handling

### Phase 2: Integration
1. Add thumbnail generation to model upload flow
2. Update ModelGrid component to show thumbnails
3. Add loading states and placeholders
4. Implement error recovery UI

### Phase 3: Optimization
1. Add caching layer
2. Implement batch processing for existing models
3. Add regeneration capabilities
4. Optimize rendering performance

## UI/UX Considerations

### Loading States
- Placeholder styling during generation
- Progress indicators for long-running operations
- Fallback display on generation failure

### Error Handling
- Retry mechanisms for failed generations
- User feedback for failures
- Manual regeneration option in UI

### Performance
- Lazy loading for thumbnails
- Progressive loading for slow connections
- Proper cleanup of Three.js resources

## Success Criteria
- [ ] Thumbnails generated for all new model uploads
- [ ] Existing models can be batch processed
- [ ] Failed generations have clear error handling
- [ ] UI remains responsive during generation
- [ ] Storage and cleanup properly managed 