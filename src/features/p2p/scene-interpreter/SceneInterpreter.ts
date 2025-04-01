import { Vector3, Camera } from 'three';
import { Logger, ValidationResult, PerformanceMetrics } from '@/types/p2p/shared';
import { 
  SceneInterpreter,
  SceneInterpreterConfig,
  CameraCommand,
  CameraPath,
  ExecutionError,
  InterpretationError,
  ValidationError
} from '@/types/p2p/scene-interpreter';

export class SceneInterpreterImpl implements SceneInterpreter {
  private config: SceneInterpreterConfig;
  private metrics: PerformanceMetrics = {
    startTime: 0,
    endTime: 0,
    duration: 0,
    operations: [],
    cacheHits: 0,
    cacheMisses: 0,
    databaseQueries: 0,
    averageResponseTime: 0,
  };

  constructor(config: SceneInterpreterConfig, private logger: Logger) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    this.metrics.startTime = Date.now();
    this.logger.info('Scene Interpreter initialized with config:', this.config);
  }

  interpretPath(path: CameraPath): CameraCommand[] {
    try {
      const commands: CameraCommand[] = [];
      
      // Convert each keyframe to a camera command
      for (let i = 0; i < path.keyframes.length; i++) {
        const keyframe = path.keyframes[i];
        const nextKeyframe = path.keyframes[i + 1];
        
        // Calculate duration based on timestamps
        const duration = nextKeyframe 
          ? nextKeyframe.timestamp - keyframe.timestamp
          : path.duration - keyframe.timestamp;

        commands.push({
          position: keyframe.position,
          target: keyframe.target,
          duration,
          easing: (t) => t // Linear easing by default
        });
      }

      return commands;
    } catch (error) {
      this.logger.error('Failed to interpret camera path:', error);
      throw new InterpretationError('Failed to interpret camera path');
    }
  }

  async executeCommand(camera: Camera, command: CameraCommand): Promise<void> {
    try {
      // Set camera position and target immediately for now
      // In a real implementation, this would be animated over the duration
      camera.position.copy(command.position);
      camera.lookAt(command.target);
      
      // Simulate the duration
      await new Promise(resolve => setTimeout(resolve, command.duration));
    } catch (error) {
      this.logger.error('Failed to execute camera command:', error);
      throw new ExecutionError('Failed to execute camera command');
    }
  }

  async executeCommands(camera: Camera, commands: CameraCommand[]): Promise<void> {
    try {
      // Execute each command in sequence
      for (const command of commands) {
        await this.executeCommand(camera, command);
      }
    } catch (error) {
      this.logger.error('Failed to execute camera commands:', error);
      throw new ExecutionError('Failed to execute camera commands');
    }
  }

  validateCommands(commands: CameraCommand[]): ValidationResult {
    try {
      const errors: string[] = [];

      if (!commands || commands.length === 0) {
        errors.push('No commands to validate');
        return { isValid: false, errors };
      }

      commands.forEach((command, index) => {
        // Validate position
        if (!command.position || !this.isValidVector3(command.position)) {
          errors.push(`Invalid position in command ${index}`);
        }

        // Validate target
        if (!command.target || !this.isValidVector3(command.target)) {
          errors.push(`Invalid target in command ${index}`);
        }

        // Validate duration
        if (typeof command.duration !== 'number' || command.duration <= 0) {
          errors.push(`Invalid duration in command ${index}`);
        }
      });

      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      this.logger.error('Failed to validate commands:', error);
      throw new ValidationError('Failed to validate commands');
    }
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return this.metrics;
  }

  private isValidVector3(v: Vector3): boolean {
    return (
      v instanceof Vector3 &&
      typeof v.x === 'number' &&
      typeof v.y === 'number' &&
      typeof v.z === 'number' &&
      !isNaN(v.x) &&
      !isNaN(v.y) &&
      !isNaN(v.z)
    );
  }
} 