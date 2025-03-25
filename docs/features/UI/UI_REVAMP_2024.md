# UI Revamp Plan 2024

## Overview
This document outlines the implementation plan for the Modern 3D Viewer UI revamp, focusing on improving user experience through a more coherent workflow and better-organized interface elements.

## Key Changes

### 1. Tab-Based Navigation
- **Stage Tab**: Environment setup and model placement
- **Shoot Tab**: Camera path creation and animation recording
- Maintains state consistency between views

### 2. Panel Reorganization
#### Stage View
- Cast Panel
  - Upload tab (drag-and-drop + click upload)
  - Library tab (model selection)
- Scene Controls Panel
  - Position height control
  - FOV adjustment
  - Floor type selection with texture popup

#### Shoot View
- Camera Instructions Panel
  - Create tab (natural language input)
  - Pre-existing tab (preset paths)
- Animation Controls Panel
  - Timeline slider
  - Playback controls
  - Record & Download button

### 3. Telemetry Display
- Horizontal bar at bottom of screen
- Real-time camera position data
- Improved visibility and professional feel

## Technical Implementation

### Existing Components Reuse
1. **Core Functionality** (Low Risk)
   - ViewerContainer and Viewer
   - CameraTelemetry
   - CameraControls
   - ModelLoader
   - FloorControls

2. **State Management** (Low Risk)
   - Model state handling
   - Camera position tracking
   - Scene configuration state

3. **Upload System** (Low Risk)
   - Upload functionality
   - Supabase integration
   - File handling

### New Component Structure
```typescript
src/
  components/
    layout/
      MainTabs.tsx        // Top-level Stage/Shoot tabs
      ViewerContainer.tsx // 3D viewer wrapper
      TelemetryBar.tsx   // Camera data display
    stage/
      StageView.tsx      // Stage tab container
      CastPanel/
        index.tsx
        UploadTab.tsx
        LibraryTab.tsx
        UploadDialog.tsx
      ScenePanel/
        index.tsx
        PositionControl.tsx
        FOVControl.tsx
        FloorTypeControl.tsx
        TextureDialog.tsx
    shoot/
      ShootView.tsx      // Shoot tab container
      CameraPanel/
        index.tsx
        CreateTab.tsx
        PresetTab.tsx
      AnimationPanel/
        index.tsx
        TimelineControl.tsx
        PlaybackControl.tsx
```

## Implementation Phases

### Phase 1: Layout Foundation
- Create feature branch from stable
- Implement tab-based navigation
- Set up basic panel structure
- Add telemetry bar component

### Phase 2: Stage View Migration
- Migrate existing upload functionality
- Implement drag-and-drop
- Create library tab interface
- Move scene controls to new panel

### Phase 3: Shoot View Migration
- Migrate camera controls
- Create animation panel
- Implement preset paths UI (placeholder)
- Add record/download functionality

### Phase 4: State Management & Integration
- Ensure state preservation between tabs
- Implement panel state management
- Add transitions and polish

## Risk Assessment & Mitigation

### Medium Risk Areas
1. **Layout Structure**
   - Tab-based navigation system
   - Panel reorganization
   - State preservation between tabs

2. **Component Restructuring**
   - Moving controls into new panel structure
   - Splitting Stage/Shoot functionality
   - State sharing between views

### Risk Mitigation Strategy
1. Keep existing routes functional during development
2. Implement feature flags for new UI
3. Create comprehensive test suite
4. Maintain rollback capability
5. Phase-based migration approach

## Testing Strategy

### Unit Tests
- New layout components
- Panel functionality
- State management

### Integration Tests
- Tab switching
- State preservation
- Component interaction

### E2E Tests
- Complete user workflows
- Upload process
- Camera path creation
- Recording and download

## Future Considerations

### Planned Features (Not in Current Scope)
- User-saved camera path presets
- Enhanced texture management
- Advanced animation controls

### Technical Debt Prevention
- Maintain component documentation
- Regular performance monitoring
- State management optimization

## Timeline and Milestones
1. **Week 1**: Layout Foundation
2. **Week 2**: Stage View Migration
3. **Week 3**: Shoot View Migration
4. **Week 4**: Integration and Testing

## Success Metrics
- Successful state preservation between tabs
- Improved user workflow
- Maintained performance metrics
- Positive user feedback

## Rollback Plan
- Maintain feature flags
- Keep existing routes until full testing
- Document state migration process
- Prepare reversion scripts 