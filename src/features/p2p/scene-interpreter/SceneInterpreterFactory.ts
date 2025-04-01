import { SceneInterpreter, SceneInterpreterConfig, SceneInterpreterFactory as ISceneInterpreterFactory } from '@/types/p2p/scene-interpreter';
import { Logger } from '@/types/p2p/shared';
import { SceneInterpreterImpl } from './SceneInterpreter';

/**
 * Factory class for creating SceneInterpreter instances
 */
export class SceneInterpreterFactory implements ISceneInterpreterFactory {
  constructor(private logger: Logger) {}

  /**
   * Create a new SceneInterpreter instance with the specified configuration
   */
  create(config: SceneInterpreterConfig): SceneInterpreter {
    return new SceneInterpreterImpl(config, this.logger);
  }
} 