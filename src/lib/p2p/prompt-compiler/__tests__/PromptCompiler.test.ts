import { describe, it, expect, beforeEach } from 'vitest';
import { PromptCompiler } from '../PromptCompiler';
import { Vector3, Box3 } from 'three';
import type {
  CompilePromptParams,
  CameraConstraints,
  SceneContext,
} from '@/types/p2p/prompt-compiler';

// Mock token estimator
const mockTokenEstimator = (text: string) => text.length / 4;

describe('PromptCompiler', () => {
  let compiler: PromptCompiler;

  beforeEach(() => {
    compiler = new PromptCompiler(mockTokenEstimator);
  });

  describe('compilePrompt', () => {
    it('should compile a basic prompt with default constraints', async () => {
      const params: CompilePromptParams = {
        instruction: 'Orbit around the model',
      };

      const result = await compiler.compilePrompt(params);

      expect(result.systemMessage).toContain('Maximum camera speed: 2');
      expect(result.userMessage).toBe('Orbit around the model');
      expect(result.constraints).toEqual({
        maxSpeed: 2.0,
        minDistance: 1.0,
        maxDistance: 10.0,
        maxAngleChange: Math.PI / 4,
        minFramingMargin: 0.1,
      });
      expect(result.metadata.requestId).toBeDefined();
      expect(result.metadata.version).toBe('1.0.0');
    });

    it('should include duration and style in user message', async () => {
      const params: CompilePromptParams = {
        instruction: 'Create a cinematic sequence',
        duration: 10,
        style: 'cinematic',
      };

      const result = await compiler.compilePrompt(params);

      expect(result.userMessage).toContain('Duration: 10 seconds');
      expect(result.userMessage).toContain('Style: cinematic');
    });

    it('should merge custom constraints with defaults', async () => {
      const customConstraints: Partial<CameraConstraints> = {
        maxSpeed: 3.0,
        minDistance: 2.0,
      };

      const params: CompilePromptParams = {
        instruction: 'Move quickly around the model',
        constraints: customConstraints,
      };

      const result = await compiler.compilePrompt(params);

      expect(result.constraints).toEqual({
        maxSpeed: 3.0,
        minDistance: 2.0,
        maxDistance: 10.0,
        maxAngleChange: Math.PI / 4,
        minFramingMargin: 0.1,
      });
    });
  });

  describe('optimizePrompt', () => {
    it('should determine optimization level based on token count', async () => {
      const longInstruction = 'A'.repeat(16000); // ~4000 tokens
      const params: CompilePromptParams = {
        instruction: longInstruction,
      };

      const compiled = await compiler.compilePrompt(params);
      const optimized = await compiler.optimizePrompt(compiled);

      expect(optimized.optimizationLevel).toBe('minimal');
    });

    it('should track optimization steps', async () => {
      const params: CompilePromptParams = {
        instruction: 'Test optimization',
      };

      const compiled = await compiler.compilePrompt(params);
      const optimized = await compiler.optimizePrompt(compiled);

      expect(optimized.metadata.optimizationHistory).toBeDefined();
    });
  });

  describe('addSceneContext', () => {
    it('should add scene context and perform safety checks', async () => {
      const sceneContext: SceneContext = {
        objectCenter: new Vector3(0, 0, 0),
        boundingBox: new Box3(),
        cameraStart: {
          position: new Vector3(5, 5, 5),
          target: new Vector3(0, 0, 0),
        },
        sceneScale: 5.0,
        objectType: 'model',
        objectDimensions: {
          width: 2.0,
          height: 2.0,
          depth: 2.0,
        },
      };

      const params: CompilePromptParams = {
        instruction: 'Orbit the model',
      };

      const compiled = await compiler.compilePrompt(params);
      const optimized = await compiler.optimizePrompt(compiled);
      const contextualized = await compiler.addSceneContext(optimized, sceneContext);

      expect(contextualized.sceneContext).toEqual(sceneContext);
      expect(contextualized.safetyChecks).toHaveLength(2);
      expect(contextualized.userMessage).toContain('Scene Context');
    });
  });

  describe('trackMetadata', () => {
    it('should return prompt metadata', async () => {
      const params: CompilePromptParams = {
        instruction: 'Test metadata tracking',
        userId: 'test-user',
      };

      const compiled = await compiler.compilePrompt(params);
      const optimized = await compiler.optimizePrompt(compiled);
      const contextualized = await compiler.addSceneContext(optimized, {
        objectCenter: new Vector3(),
        boundingBox: new Box3(),
        cameraStart: {
          position: new Vector3(),
          target: new Vector3(),
        },
        sceneScale: 1.0,
        objectType: 'test',
        objectDimensions: {
          width: 1.0,
          height: 1.0,
          depth: 1.0,
        },
      });

      const metadata = await compiler.trackMetadata(contextualized);

      expect(metadata).toBeDefined();
      expect(metadata.userId).toBe('test-user');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.requestId).toBeDefined();
    });
  });
}); 