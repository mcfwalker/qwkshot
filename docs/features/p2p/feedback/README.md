# Feedback System

## Overview
The Feedback System is responsible for monitoring and improving the p2p pipeline's performance. It handles session logging, user feedback collection, health monitoring, and training data preparation, including feedback for camera start positions and animation features.

## Status
🚧 **Current Status**: Planned
- Interface defined
- Implementation planned
- Integration requirements documented
- Start position feedback planned
- Animation feedback planned

## Interface

### Core Functions
```typescript
interface FeedbackSystem {
  // Log session data
  logSession(session: SessionData): Promise<LogResult>;
  
  // Collect user feedback
  collectFeedback(feedback: UserFeedback): Promise<FeedbackResult>;
  
  // Monitor system health
  monitorHealth(): Promise<HealthStatus>;
  
  // Prepare training data
  prepareTrainingData(data: TrainingData): Promise<PreparedData>;

  // Log animation metrics
  logAnimationMetrics(metrics: AnimationMetrics): Promise<LogResult>;
}
```

### Types
```typescript
interface SessionData {
  timestamp: Date;
  duration: number;
  components: ComponentMetrics[];
  performance: PerformanceMetrics;
  errors: ErrorLog[];
  startPosition?: StartPositionMetrics;
  animation?: AnimationMetrics;
}

interface StartPositionMetrics {
  setTime: number;
  validationTime: number;
  success: boolean;
  distance: number;
  angle: number;
  height: number;
  issues: string[];
}

interface AnimationMetrics {
  duration: number;
  keyframeCount: number;
  smoothness: number;
  performance: number;
  issues: string[];
  startPosition?: StartPositionMetrics;
}

interface UserFeedback {
  sessionId: string;
  rating: number;
  comments: string;
  issues: FeedbackIssue[];
  suggestions: string[];
  startPosition?: StartPositionFeedback;
  animation?: AnimationFeedback;
}

interface StartPositionFeedback {
  easeOfUse: number;
  accuracy: number;
  suggestions: string[];
  issues: string[];
}

interface AnimationFeedback {
  smoothness: number;
  naturalness: number;
  suggestions: string[];
  issues: string[];
  startPosition?: StartPositionFeedback;
}

interface HealthStatus {
  status: 'healthy' | 'warning' | 'error';
  metrics: HealthMetrics;
  issues: HealthIssue[];
  recommendations: string[];
  startPosition?: StartPositionHealth;
  animation?: AnimationHealth;
}

interface StartPositionHealth {
  successRate: number;
  averageTime: number;
  commonIssues: string[];
  recommendations: string[];
}

interface AnimationHealth {
  performance: number;
  smoothness: number;
  commonIssues: string[];
  recommendations: string[];
  startPosition?: StartPositionHealth;
}

interface TrainingData {
  sessions: SessionData[];
  feedback: UserFeedback[];
  performance: PerformanceMetrics[];
  metadata: TrainingMetadata;
}
```

## Implementation Details

### 1. Monitoring Process
1. **Data Collection**
   - Session metrics
   - Performance data
   - Error logs
   - User feedback
   - Start position metrics
   - Animation metrics

2. **Analysis**
   - Performance analysis
   - Error tracking
   - Usage patterns
   - Quality metrics
   - Start position analysis
   - Animation analysis

3. **Reporting**
   - Health status
   - Recommendations
   - Training data
   - Improvement suggestions
   - Start position insights
   - Animation insights

### 2. Feedback Types
- **Session Feedback**
  - Overall experience
  - Performance issues
  - Feature requests
  - Bug reports
  - Start position experience
  - Animation experience

- **Component Feedback**
  - Prompt quality
  - Path generation
  - Animation smoothness
  - Control responsiveness
  - Start position accuracy
  - Animation naturalness

### 3. Error Handling
- Data collection errors
- Analysis failures
- Storage issues
- Privacy concerns
- Start position validation
- Animation validation

## Integration

### Component Integration
```typescript
// Log session data with start position and animation metrics
const logResult = await feedbackSystem.logSession({
  timestamp: new Date(),
  duration: sessionDuration,
  components: componentMetrics,
  performance: performanceMetrics,
  errors: errorLogs,
  startPosition: {
    setTime: 0.5,
    validationTime: 0.2,
    success: true,
    distance: 5,
    angle: 45,
    height: 2,
    issues: []
  },
  animation: {
    duration: 10,
    keyframeCount: 100,
    smoothness: 0.9,
    performance: 0.95,
    issues: [],
    startPosition: {
      setTime: 0.5,
      validationTime: 0.2,
      success: true,
      distance: 5,
      angle: 45,
      height: 2,
      issues: []
    }
  }
});

// Collect user feedback with start position and animation feedback
const feedbackResult = await feedbackSystem.collectFeedback({
  sessionId: 'session123',
  rating: 4,
  comments: 'Good experience',
  issues: [],
  suggestions: ['Add more camera angles'],
  startPosition: {
    easeOfUse: 4,
    accuracy: 5,
    suggestions: [],
    issues: []
  },
  animation: {
    smoothness: 4,
    naturalness: 5,
    suggestions: [],
    issues: [],
    startPosition: {
      easeOfUse: 4,
      accuracy: 5,
      suggestions: [],
      issues: []
    }
  }
});

// Monitor system health
const healthStatus = await feedbackSystem.monitorHealth();
```

## Usage Examples

### Basic Usage
```typescript
const feedback = new FeedbackSystem();

// Log session with metrics
const logResult = await feedback.logSession(sessionData);

// Collect feedback
const feedbackResult = await feedback.collectFeedback(userFeedback);

// Monitor health
const healthStatus = await feedback.monitorHealth();

// Log animation metrics
const animationLog = await feedback.logAnimationMetrics({
  duration: 10,
  keyframeCount: 100,
  smoothness: 0.9,
  performance: 0.95,
  issues: [],
  startPosition: {
    setTime: 0.5,
    validationTime: 0.2,
    success: true,
    distance: 5,
    angle: 45,
    height: 2,
    issues: []
  }
});
```

## Planned Implementation
1. **Core Features**
   - Session logging
   - Feedback collection
   - Health monitoring
   - Training data preparation
   - Start position monitoring
   - Animation monitoring

2. **Integration**
   - Component integration
   - Data storage integration
   - Analysis integration
   - Error handling
   - Start position integration
   - Animation integration

## Future Improvements
1. **Monitoring**
   - Enhanced metrics
   - Better analysis
   - Improved reporting
   - Performance optimization
   - Start position optimization
   - Animation optimization

2. **Integration**
   - Better component coordination
   - Enhanced error handling
   - Improved logging
   - Performance monitoring
   - Start position validation
   - Animation validation

## Testing
The feedback system will include tests covering:
- Session logging
- Feedback collection
- Health monitoring
- Training data preparation
- Error handling
- Integration testing
- Start position monitoring
- Animation monitoring

## Related Components
- Scene Analyzer
- Environmental Analyzer
- Metadata Manager
- LLM Engine
- Scene Interpreter
- Viewer Integration
- CameraAnimationSystem
- StartPositionHint 