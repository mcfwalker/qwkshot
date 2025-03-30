import { describe, it, expect, beforeEach } from 'vitest';
import { PromptCompilerImpl } from '../PromptCompiler';
import { mockSceneAnalysis, mockModelMetadata } from './fixtures';

describe('PromptCompiler', () => {
  let compiler: PromptCompilerImpl;

  beforeEach(() => {
    compiler = new PromptCompilerImpl({
      maxTokens: 1000,
      temperature: 0.7,
    });
  });

  describe('compilePrompt', () => {
    it('should compile a basic prompt', async () => {
      const result = await compiler.compilePrompt(
        'Show me the front of the model',
        mockSceneAnalysis,
        mockModelMetadata
      );

      expect(result).toBeDefined();
      expect(result.systemMessage).toContain('camera path');
      expect(result.userMessage).toContain('front');
      expect(result.constraints).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should handle complex instructions', async () => {
      const result = await compiler.compilePrompt(
        'Slowly rotate around the model while maintaining a distance of 3 units',
        mockSceneAnalysis,
        mockModelMetadata
      );

      expect(result).toBeDefined();
      expect(result.userMessage).toContain('rotate');
      expect(result.userMessage).toContain('distance');
      expect(result.constraints.minDistance).toBe(3);
      expect(result.constraints.maxDistance).toBe(3);
    });

    it('should respect safety constraints', async () => {
      const result = await compiler.compilePrompt(
        'Get very close to the model',
        mockSceneAnalysis,
        mockModelMetadata
      );

      expect(result).toBeDefined();
      expect(result.constraints.minDistance).toBeGreaterThanOrEqual(
        mockSceneAnalysis.safetyConstraints.minDistance
      );
    });
  });

  describe('validatePrompt', () => {
    it('should validate a valid prompt', async () => {
      const prompt = await compiler.compilePrompt(
        'Show me the front of the model',
        mockSceneAnalysis,
        mockModelMetadata
      );

      const validation = compiler.validatePrompt(prompt);
      expect(validation.isValid).toBe(true);
    });

    it('should reject invalid prompts', async () => {
      const prompt = await compiler.compilePrompt(
        'Get too close to the model',
        mockSceneAnalysis,
        mockModelMetadata
      );

      const validation = compiler.validatePrompt(prompt);
      expect(validation.isValid).toBe(false);
      expect(validation.error).toBeDefined();
    });
  });

  describe('optimizePrompt', () => {
    it('should optimize token usage', async () => {
      const prompt = await compiler.compilePrompt(
        'Show me the front of the model',
        mockSceneAnalysis,
        mockModelMetadata
      );

      const optimized = await compiler.optimizePrompt(prompt);
      expect(optimized.tokenCount).toBeLessThanOrEqual(compiler.config.maxTokens);
    });

    it('should maintain prompt meaning after optimization', async () => {
      const prompt = await compiler.compilePrompt(
        'Show me the front of the model',
        mockSceneAnalysis,
        mockModelMetadata
      );

      const optimized = await compiler.optimizePrompt(prompt);
      expect(optimized.userMessage).toContain('front');
    });
  });
}); 