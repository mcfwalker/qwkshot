import { EnvironmentalAnalyzer, EnvironmentalAnalyzerConfig, EnvironmentalAnalyzerFactory as IEnvironmentalAnalyzerFactory } from '@/types/p2p/environmental-analyzer';
import { Logger } from '@/types/p2p/shared';
import { EnvironmentalAnalyzerImpl } from './EnvironmentalAnalyzer';

/**
 * Factory class for creating EnvironmentalAnalyzer instances
 */
export class EnvironmentalAnalyzerFactory implements IEnvironmentalAnalyzerFactory {
  constructor(private logger: Logger) {}

  /**
   * Create a new EnvironmentalAnalyzer instance with the specified configuration
   */
  create(config: EnvironmentalAnalyzerConfig): EnvironmentalAnalyzer {
    return new EnvironmentalAnalyzerImpl(config, this.logger);
  }
} 