import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Vector3 } from 'three';
import { PromptCompilerImpl } from '../PromptCompiler';
import { mockSceneAnalysis, mockModelMetadata } from './fixtures';
import type { CompiledPrompt } from '../../../../types/p2p/prompt-compiler';
import type { EnvironmentalAnalysis } from '../../../../types/p2p/environmental-analyzer';

// Define mock camera state used in tests
const mockCameraState = {
  position: new Vector3(1, 2, 3),
  target: new Vector3(0, 0.5, 0),
};

// Define mock environmental analysis
const mockEnvAnalysis: EnvironmentalAnalysis = {
    environment: { bounds: {} as any, dimensions: { width: 20, height: 10, depth: 20 } },
    object: { bounds: {} as any, dimensions: { width: 2, height: 2, depth: 2 } },
    distances: { fromObjectToBoundary: { left: 9, right: 9, front: 9, back: 9, top: 8, bottom: 1 } },
    cameraConstraints: { minDistance: 0.5, maxDistance: 10, minHeight: 0.1, maxHeight: 9 },
    performance: { startTime: 0, endTime: 0, duration: 0, operations: [], cacheHits: 0, cacheMisses: 0, databaseQueries: 0, averageResponseTime: 0 },
};

describe('PromptCompiler', () => {
  let compiler: PromptCompilerImpl;

  beforeEach(() => {
    compiler = new PromptCompilerImpl({
      maxTokens: 4000,
      temperature: 0.7,
    });
    compiler.initialize();
  });

  describe('compilePrompt', () => {
    it('should compile a basic prompt with correct structure and context', async () => {
      const userInput = 'Show me the front of the model';
      const result: CompiledPrompt = await compiler.compilePrompt(
        userInput,
        mockSceneAnalysis,
        mockEnvAnalysis,
        mockModelMetadata,
        mockCameraState
      );

      expect(result.systemMessage).toMatch(/You are an expert virtual cinematographer/);
      expect(result.systemMessage).toMatch(/IMPORTANT JSON OUTPUT FORMAT:/);
      expect(result.systemMessage).toMatch(/```json\s*{\s*"keyframes":\s*\[\s*/);
      expect(result.systemMessage).toMatch(/CURRENT CAMERA STATE:/);
      expect(result.systemMessage).toMatch(/Position: \(1\.00, 2\.00, 3\.00\)/);
      expect(result.systemMessage).toMatch(/Target: \(0\.00, 0\.50, 0\.00\)/);
      expect(result.systemMessage).toMatch(/SCENE & ENVIRONMENT CONTEXT:/);
      expect(result.systemMessage).toMatch(/Model Center: \(0\.00, 0\.00, 0\.00\)/);
      expect(result.systemMessage).toMatch(/Model Bounds: min: \(-1\.00, -1\.00, -1\.00\), max: \(1\.00, 1\.00, 1\.00\)/);
      expect(result.systemMessage).toMatch(/SAFETY CONSTRAINTS:/);
      expect(result.systemMessage).toMatch(/Min Distance from Center: 0\.50/);
      expect(result.systemMessage).toMatch(/Max Distance from Center: 10\.00/);

      expect(result.userMessage).toBe(userInput);

      expect(result.constraints).toBeDefined();
      expect(result.constraints.minDistance).toBe(0.5);
      expect(result.constraints.maxDistance).toBe(10.0);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.version).toBe('1.1');
      expect(result.tokenCount).toBeGreaterThan(0);
    });

    it('should extract basic constraints from user input', async () => {
      const userInput = 'Maintain a distance of 3 units';
      const result = await compiler.compilePrompt(
        userInput,
        mockSceneAnalysis,
        mockEnvAnalysis,
        mockModelMetadata,
        mockCameraState
      );

      expect(result.userMessage).toBe(userInput);
    });

    it('should use combined safety constraints', async () => {
      const stricterSceneAnalysis = {
        ...mockSceneAnalysis,
        safetyConstraints: { ...mockSceneAnalysis.safetyConstraints, minDistance: 0.6 }
      } as any;
      const stricterModelMetadata = {
        ...mockModelMetadata,
        preferences: {
          ...mockModelMetadata.preferences,
          safetyConstraints: { ...mockModelMetadata.preferences.safetyConstraints, maxDistance: 4.0 }
        }
      } as any;
      const stricterEnvAnalysis = { ...mockEnvAnalysis, cameraConstraints: { ...mockEnvAnalysis.cameraConstraints, minDistance: 0.7, maxDistance: 3.5 } };

      const result = await compiler.compilePrompt(
        'Fly around',
        stricterSceneAnalysis,
        stricterEnvAnalysis,
        stricterModelMetadata,
        mockCameraState
      );

      expect(result.constraints.minDistance).toBe(0.7);
      expect(result.constraints.maxDistance).toBe(3.5);
    });
  });

  describe('validatePrompt', () => {
    it('should validate a valid prompt with no errors', async () => {
      const prompt = await compiler.compilePrompt(
        'Show me the front',
        mockSceneAnalysis,
        mockEnvAnalysis,
        mockModelMetadata,
        mockCameraState
      );
      const validation = compiler.validatePrompt(prompt);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should return errors for invalid prompts', async () => {
      const invalidPrompt: CompiledPrompt = {
        systemMessage: '',
        userMessage: 'test',
        constraints: { minDistance: 10, maxDistance: 1, minHeight: 1, maxHeight: 0 },
        metadata: {} as any,
      };

      const validation = compiler.validatePrompt(invalidPrompt);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toBeDefined();
      expect(validation.errors?.length).toBeGreaterThan(0);
      expect(validation.errors).toContain('Missing systemMessage');
      expect(validation.errors).toContain('Invalid constraint values');
    });
  });

  describe.skip('optimizePrompt', () => {
    it('should reduce token usage (placeholder)', async () => {
      const prompt = await compiler.compilePrompt(
        'Show the front',
        mockSceneAnalysis,
        mockEnvAnalysis,
        mockModelMetadata,
        mockCameraState
      );
      const optimized = await compiler.optimizePrompt(prompt);
      expect(optimized.tokenCount).toBeDefined();
    });

    it('should maintain meaning (placeholder)', async () => {
      const prompt = await compiler.compilePrompt(
        'Show the front',
        mockSceneAnalysis,
        mockEnvAnalysis,
        mockModelMetadata,
        mockCameraState
      );
      const optimized = await compiler.optimizePrompt(prompt);
      expect(optimized.userMessage).toContain('front');
    });
  });
}); 