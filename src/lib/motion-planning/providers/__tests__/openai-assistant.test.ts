// src/lib/motion-planning/providers/__tests__/openai-assistant.test.ts

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import OpenAI from 'openai';
import { OpenAIAssistantAdapter, TimerDelayFunction } from '../openai-assistant';
import { OpenAIAssistantProviderConfig, MotionPlan } from '../../types';
import { AssistantInteractionError, MotionPlanParsingError } from '../../errors';

// Mock the entire OpenAI library
vi.mock('openai', () => {
    // Define mock functions
    const mockThreadsCreate = vi.fn();
    const mockMessagesCreate = vi.fn();
    const mockRunsCreate = vi.fn();
    const mockRunsRetrieve = vi.fn();
    const mockRunsCancel = vi.fn();
    const mockMessagesList = vi.fn();
    const mockAssistantsRetrieve = vi.fn();

    // Structure the mock to mimic the OpenAI client structure
    const MockOpenAI = vi.fn().mockImplementation(() => ({
        beta: {
            threads: {
                create: mockThreadsCreate,
                messages: {
                    create: mockMessagesCreate,
                    list: mockMessagesList,
                },
                runs: {
                    create: mockRunsCreate,
                    retrieve: mockRunsRetrieve,
                    cancel: mockRunsCancel,
                },
            },
            assistants: {
                retrieve: mockAssistantsRetrieve,
            }
        }
    }));

    // --- REMOVE Direct Mock Exports --- 
    return {
        default: MockOpenAI,
        // REMOVE mockThreadsCreate,
        // REMOVE mockMessagesCreate,
        // ... etc ...
    };
});

// --- REMOVE Import of specific mock functions ---
// // @ts-expect-error - Vitest handles this mock resolution, but TS cannot see it
// import { 
//     mockThreadsCreate, ...
// } from 'openai'; 

describe('OpenAIAssistantAdapter', () => {
    let adapter: OpenAIAssistantAdapter;
    const mockConfig: OpenAIAssistantProviderConfig = {
        type: 'openai-assistant',
        apiKey: 'test-api-key',
        assistantId: 'test-assistant-id',
        pollingIntervalMs: 10, 
        timeoutMs: 500,        
    };

    beforeEach(() => {
        // Reset mocks before each test
        vi.clearAllMocks();
        // --- Wrap advancement function to match type --- 
        const testTimerDelayFn: TimerDelayFunction = async (ms: number) => {
            await vi.advanceTimersByTimeAsync(ms);
            return Promise.resolve(); // Explicitly return Promise<void>
        };
        adapter = new OpenAIAssistantAdapter(mockConfig, testTimerDelayFn);
        // Use fake timers
        vi.useFakeTimers();

        // --- REMOVE: Retrieval of mocks from constructor ---
        // const MockedOpenAIConstructor = OpenAI as any; // REMOVE
        // mockThreadsCreate = MockedOpenAIConstructor.mockThreadsCreate; // REMOVE
        // ... remove other mock retrievals ...

        // --- REMOVE: Manual mock clear (vi.clearAllMocks should handle it) ---
        // mockThreadsCreate.mockClear(); // REMOVE
        // ... remove other manual clears ...
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('constructor', () => {
        it('should initialize OpenAI client with API key', () => {
            expect(OpenAI).toHaveBeenCalledWith({ apiKey: mockConfig.apiKey });
        });
    });

    describe('generatePlan', () => {
        const userPrompt = "Test prompt";
        const requestedDuration = 30;
        const mockThreadId = 'thread_123';
        const mockRunId = 'run_456';
        const mockMotionPlan: MotionPlan = {
            steps: [{ type: 'static', parameters: {}, duration_ratio: 1.0 }],
            metadata: {}
        };

        it('should successfully generate a motion plan (happy path)', async () => {
            // Arrange: Mock the sequence of OpenAI calls for success
            ( (adapter as any).openai.beta.threads.create as Mock ).mockResolvedValue({ id: mockThreadId });
            ( (adapter as any).openai.beta.threads.messages.create as Mock ).mockResolvedValue({}); 
            ( (adapter as any).openai.beta.threads.runs.create as Mock ).mockResolvedValue({ id: mockRunId, status: 'queued' });
            ( (adapter as any).openai.beta.threads.runs.retrieve as Mock )
                .mockResolvedValueOnce({ id: mockRunId, status: 'in_progress' })
                .mockResolvedValueOnce({ id: mockRunId, status: 'completed' });
            ( (adapter as any).openai.beta.threads.messages.list as Mock ).mockResolvedValue({
                data: [
                    {
                        id: 'msg_789',
                        role: 'assistant',
                        content: [{ type: 'text', text: { value: JSON.stringify(mockMotionPlan) } }],
                        created_at: Date.now(),
                        thread_id: mockThreadId,
                        run_id: mockRunId,
                        assistant_id: mockConfig.assistantId,
                        metadata: {},
                        file_ids: [],
                        object: 'thread.message'
                    }
                ]
            });

            // Act
            const result = await adapter.generatePlan(userPrompt, requestedDuration);

            // Assert
            expect((adapter as any).openai.beta.threads.create).toHaveBeenCalledTimes(1);
            expect((adapter as any).openai.beta.threads.messages.create).toHaveBeenCalledWith(mockThreadId, { role: 'user', content: userPrompt });
            expect((adapter as any).openai.beta.threads.runs.create).toHaveBeenCalledWith(mockThreadId, { assistant_id: mockConfig.assistantId });
            expect((adapter as any).openai.beta.threads.runs.retrieve).toHaveBeenCalledTimes(2); 
            expect((adapter as any).openai.beta.threads.messages.list).toHaveBeenCalledWith(mockThreadId, { order: 'desc', limit: 1 });
            
            // Check the final result includes added metadata
            expect(result).toEqual({
                ...mockMotionPlan,
                metadata: {
                    original_prompt: userPrompt,
                    requested_duration: requestedDuration
                }
            });
        });

        it('should throw AssistantInteractionError if run fails', async () => {
            // Arrange
            const failureReason = { code: 'api_error', message: 'The run failed unexpectedly.' };
            ( (adapter as any).openai.beta.threads.create as Mock ).mockResolvedValue({ id: mockThreadId });
            ( (adapter as any).openai.beta.threads.messages.create as Mock ).mockResolvedValue({});
            ( (adapter as any).openai.beta.threads.runs.create as Mock ).mockResolvedValue({ id: mockRunId, status: 'queued' });
            
            // --- Explicitly mock retrieve to return 'failed' consistently after first call --- 
            const retrieveMock = (adapter as any).openai.beta.threads.runs.retrieve as Mock;
            retrieveMock.mockResolvedValueOnce({ // First call returns 'failed'
                id: mockRunId, 
                status: 'failed', 
                last_error: failureReason 
            });
            // Subsequent calls (if any happen unexpectedly) also return failed
            retrieveMock.mockResolvedValue({ 
                id: mockRunId, 
                status: 'failed', 
                last_error: failureReason 
            });

            // Act & Assert on a SINGLE call
            const planPromise = adapter.generatePlan(userPrompt, requestedDuration);
            
            await expect(planPromise).rejects.toThrowError(AssistantInteractionError);
            await expect(planPromise).rejects.toThrow(/Run failed or was cancelled. Final status: failed. api_error - The run failed unexpectedly./);
            
            // Check cancel was not called AFTER awaiting the promise
            try {
                await planPromise;
            } catch (e) {
                // Expected rejection
            } finally {
                 expect((adapter as any).openai.beta.threads.runs.cancel).not.toHaveBeenCalled();
            }
        });

        it('should throw AssistantInteractionError on timeout', async () => {
            // Arrange
            ( (adapter as any).openai.beta.threads.create as Mock ).mockResolvedValue({ id: mockThreadId });
            ( (adapter as any).openai.beta.threads.messages.create as Mock ).mockResolvedValue({});
            ( (adapter as any).openai.beta.threads.runs.create as Mock ).mockResolvedValue({ id: mockRunId, status: 'queued' });
            ( (adapter as any).openai.beta.threads.runs.retrieve as Mock ).mockResolvedValue({ id: mockRunId, status: 'in_progress' }); 

            // Act
            const promise = adapter.generatePlan(userPrompt, requestedDuration);
            // Advance timers using vi directly
            const timeoutDuration = mockConfig.timeoutMs ?? 500; 
            // We still advance timers globally here; the injected fn handles the *internal* loop delay
            await vi.advanceTimersByTimeAsync(timeoutDuration + 100); 

            // Assert
            await expect(promise).rejects.toThrowError(AssistantInteractionError);
            await expect(promise).rejects.toThrow(`Run timed out after ${timeoutDuration / 1000} seconds.`);
            expect((adapter as any).openai.beta.threads.runs.cancel).toHaveBeenCalledWith(mockThreadId, mockRunId); // Should try to cancel on timeout
        });

        it('should throw MotionPlanParsingError for invalid JSON response', async () => {
            // Arrange (Successful run, but invalid JSON in message)
            ( (adapter as any).openai.beta.threads.create as Mock ).mockResolvedValue({ id: mockThreadId });
            ( (adapter as any).openai.beta.threads.messages.create as Mock ).mockResolvedValue({});
            ( (adapter as any).openai.beta.threads.runs.create as Mock ).mockResolvedValue({ id: mockRunId, status: 'queued' });
            ( (adapter as any).openai.beta.threads.runs.retrieve as Mock ).mockResolvedValue({ id: mockRunId, status: 'completed' });
            ( (adapter as any).openai.beta.threads.messages.list as Mock ).mockResolvedValue({
                data: [
                    {
                        id: 'msg_err',
                        role: 'assistant',
                        content: [{ type: 'text', text: { value: 'This is not JSON' } }],
                        created_at: Date.now(),
                        thread_id: mockThreadId,
                        run_id: mockRunId,
                        assistant_id: mockConfig.assistantId,
                        metadata: {},
                        file_ids: [],
                        object: 'thread.message'
                    }
                ]
            });

            // --- Act & Assert on a SINGLE call ---
            const planPromise = adapter.generatePlan(userPrompt, requestedDuration);
            await expect(planPromise).rejects.toThrowError(MotionPlanParsingError);
            await expect(planPromise).rejects.toThrow(/Failed to parse JSON/);
            // --- End single call assertion ---
        });

        it('should throw MotionPlanParsingError for JSON missing steps', async () => {
             // Arrange (Successful run, JSON missing 'steps')
             ( (adapter as any).openai.beta.threads.create as Mock ).mockResolvedValue({ id: mockThreadId });
             ( (adapter as any).openai.beta.threads.messages.create as Mock ).mockResolvedValue({});
             ( (adapter as any).openai.beta.threads.runs.create as Mock ).mockResolvedValue({ id: mockRunId, status: 'queued' });
             ( (adapter as any).openai.beta.threads.runs.retrieve as Mock ).mockResolvedValue({ id: mockRunId, status: 'completed' });
             ( (adapter as any).openai.beta.threads.messages.list as Mock ).mockResolvedValue({
                 data: [
                     {
                         id: 'msg_nosteps',
                         role: 'assistant',
                         content: [{ type: 'text', text: { value: JSON.stringify({ metadata: {} }) } }], // Valid JSON, but no steps
                         created_at: Date.now(),
                         thread_id: mockThreadId,
                         run_id: mockRunId,
                         assistant_id: mockConfig.assistantId,
                         metadata: {},
                         file_ids: [],
                         object: 'thread.message'
                     }
                 ]
             });
 
             // --- Act & Assert on a SINGLE call ---
             const planPromise = adapter.generatePlan(userPrompt, requestedDuration);
             await expect(planPromise).rejects.toThrowError(MotionPlanParsingError);
             await expect(planPromise).rejects.toThrow(/Parsed JSON does not conform to MotionPlan structure \(missing 'steps' array\)/);
             // --- End single call assertion ---
        });

        it('should throw AssistantInteractionError if no assistant message found', async () => {
            // Arrange (Successful run, but message list is empty or lacks assistant role)
            ( (adapter as any).openai.beta.threads.create as Mock ).mockResolvedValue({ id: mockThreadId });
            ( (adapter as any).openai.beta.threads.messages.create as Mock ).mockResolvedValue({});
            ( (adapter as any).openai.beta.threads.runs.create as Mock ).mockResolvedValue({ id: mockRunId, status: 'queued' });
            ( (adapter as any).openai.beta.threads.runs.retrieve as Mock ).mockResolvedValue({ id: mockRunId, status: 'completed' });
            ( (adapter as any).openai.beta.threads.messages.list as Mock ).mockResolvedValue({ data: [] }); // No messages returned

            // --- Act & Assert on a SINGLE call ---
            const planPromise = adapter.generatePlan(userPrompt, requestedDuration);
            await expect(planPromise).rejects.toThrowError(AssistantInteractionError);
            await expect(planPromise).rejects.toThrow(/Assistant did not respond in the thread/);
            // --- End single call assertion ---
        });

        // - General API error during creation/polling (Optional, covers broad failures)
        it('should wrap generic OpenAI error during thread creation', async () => {
             // Arrange
             const apiError = new Error("Invalid API Key");
             ( (adapter as any).openai.beta.threads.create as Mock ).mockRejectedValue(apiError);
 
             // --- Act & Assert on a SINGLE call ---
             const planPromise = adapter.generatePlan(userPrompt, requestedDuration);
             await expect(planPromise).rejects.toThrowError(AssistantInteractionError);
             await expect(planPromise).rejects.toThrow(/Invalid API Key/);
             // --- End single call assertion ---
        });
    });

    describe('validateConfiguration', () => {
        it('should return true if assistant retrieval succeeds', async () => {
            // Arrange
            ( (adapter as any).openai.beta.assistants.retrieve as Mock ).mockResolvedValue({ id: mockConfig.assistantId, model: 'gpt-4' });

            // Act
            const isValid = await adapter.validateConfiguration?.();

            // Assert
            expect(isValid).toBe(true);
            expect((adapter as any).openai.beta.assistants.retrieve).toHaveBeenCalledWith(mockConfig.assistantId);
        });

        it('should return false if assistant retrieval fails', async () => {
            // Arrange
            ( (adapter as any).openai.beta.assistants.retrieve as Mock ).mockRejectedValue(new Error('Assistant not found'));

            // Act
            const isValid = await adapter.validateConfiguration?.();

            // Assert
            expect(isValid).toBe(false);
            expect((adapter as any).openai.beta.assistants.retrieve).toHaveBeenCalledWith(mockConfig.assistantId);
        });
    });

    describe('getCapabilities', () => {
        it('should return capabilities including model if retrieval succeeds', async () => {
             // Arrange
             const mockModel = 'gpt-4-turbo-preview';
             ( (adapter as any).openai.beta.assistants.retrieve as Mock ).mockResolvedValue({ id: mockConfig.assistantId, model: mockModel });
 
             // Act
             const capabilities = await adapter.getCapabilities?.();
 
             // Assert
             expect(capabilities).toEqual({
                 provider: "OpenAI Assistants API",
                 assistantId: mockConfig.assistantId,
                 model: mockModel,
             });
             expect((adapter as any).openai.beta.assistants.retrieve).toHaveBeenCalledWith(mockConfig.assistantId);
        });

        it('should return capabilities with unknown model if retrieval fails', async () => {
             // Arrange
             ( (adapter as any).openai.beta.assistants.retrieve as Mock ).mockRejectedValue(new Error('API error'));
 
             // Act
             const capabilities = await adapter.getCapabilities?.();
 
             // Assert
             expect(capabilities).toEqual({
                 provider: "OpenAI Assistants API",
                 assistantId: mockConfig.assistantId,
                 model: 'unknown', // Should fallback
             });
             expect((adapter as any).openai.beta.assistants.retrieve).toHaveBeenCalledWith(mockConfig.assistantId);
        });
    });
}); 