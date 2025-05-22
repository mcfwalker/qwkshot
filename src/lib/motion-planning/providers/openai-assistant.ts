import OpenAI from 'openai';
import { 
    MotionPlan,
    MotionPlannerService,
    OpenAIAssistantProviderConfig 
} from "../types";
import { 
    MotionPlannerError, 
    AssistantInteractionError, 
    MotionPlanParsingError, 
    ConfigurationError 
} from '../errors';

// --- EXPORT Type --- 
export type TimerDelayFunction = (ms: number) => Promise<void>;

/**
 * Default timer delay using setTimeout.
 */
const defaultTimerDelay: TimerDelayFunction = (ms: number) => 
    new Promise(resolve => setTimeout(resolve, ms));

/**
 * MotionPlannerService implementation using the OpenAI Assistants API.
 *
 * Manages interaction with a specific OpenAI Assistant, including:
 * - Creating threads for conversations.
 * - Adding user messages to threads.
 * - Creating and polling runs.
 * - Ensuring the specified Assistant ID and Knowledge Base (via Retrieval tool) are used.
 * - Parsing the final structured MotionPlan JSON from the Assistant's response.
 */
export class OpenAIAssistantAdapter implements MotionPlannerService {
    private config: OpenAIAssistantProviderConfig;
    private openai: OpenAI;
    private timerDelayFn: TimerDelayFunction;
    private maxRetries: number = 3;
    private retryDelayMs: number = 2000;

    constructor(config: OpenAIAssistantProviderConfig, timerDelayFn?: TimerDelayFunction) {
        // Validate required configuration
        if (!config.apiKey) {
            throw new ConfigurationError('OpenAI API key is required');
        }
        if (!config.assistantId) {
            throw new ConfigurationError('OpenAI Assistant ID is required');
        }

        this.config = config;
        this.openai = new OpenAI({ apiKey: config.apiKey });
        this.timerDelayFn = timerDelayFn || defaultTimerDelay;

        // Log configuration (without sensitive data)
        console.log("OpenAIAssistantAdapter initialized with:", {
            pollingIntervalMs: config.pollingIntervalMs || 500,  // Reduced from 1000 to 500
            timeoutMs: config.timeoutMs || 120000
        });

        // Validate the configuration by attempting to retrieve the Assistant
        this.validateConfiguration().catch(error => {
            console.error("Failed to validate OpenAI Assistant configuration:", error);
            throw new ConfigurationError(`Failed to validate OpenAI Assistant configuration: ${error.message}`);
        });
    }

    /**
     * Cleanup function to delete a thread and its associated runs
     */
    private async cleanupThread(threadId: string): Promise<void> {
        try {
            await this.openai.beta.threads.del(threadId);
            console.log(`Cleaned up thread: ${threadId}`);
        } catch (error) {
            console.warn(`Failed to cleanup thread ${threadId}:`, error);
        }
    }

    /**
     * Validates the configuration by attempting to retrieve the Assistant details.
     */
    async validateConfiguration(): Promise<boolean> {
        try {
            const assistant = await this.openai.beta.assistants.retrieve(this.config.assistantId);
            console.log("Successfully validated OpenAI Assistant configuration:", {
                name: assistant.name,
                model: assistant.model
            });
            return true;
        } catch (error) {
            console.error("Failed to validate OpenAI Assistant:", error);
            throw new ConfigurationError(`Failed to validate OpenAI Assistant: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Generates a structured motion plan using the configured OpenAI Assistant.
     */
    async generatePlan(userPrompt: string, requestedDuration?: number): Promise<MotionPlan> {
        console.log(`Generating plan with prompt: "${userPrompt}", duration: ${requestedDuration}`);
        let threadId: string | null = null;
        let runId: string | null = null;
        let retryCount = 0;
        let lastStatus: string | null = null;

        while (retryCount < this.maxRetries) {
            try {
                // 1. Create a Thread
                const thread = await this.openai.beta.threads.create();
                threadId = thread.id;
                console.log('Created new thread');

                // 2. Add User Message
                await this.openai.beta.threads.messages.create(threadId, {
                    role: "user",
                    content: userPrompt,
                });
                console.log('Added user message to thread');

                // 3. Create a Run
                const run = await this.openai.beta.threads.runs.create(threadId, {
                    assistant_id: this.config.assistantId,
                });
                runId = run.id;
                console.log('Created new run');

                // 4. Poll Run Status with exponential backoff
                const initialPollingIntervalMs = 500;  // Start with 500ms
                const maxPollingIntervalMs = 2000;     // Max 2 seconds
                const timeoutMs = this.config.timeoutMs || 120000;
                const startTime = Date.now();
                let retrievedRun = run;
                let currentPollingInterval = initialPollingIntervalMs;
                let lastStatusChangeTime = Date.now();

                while (
                    retrievedRun.status === 'queued' || 
                    retrievedRun.status === 'in_progress' ||
                    retrievedRun.status === 'requires_action' 
                ) {
                    if (Date.now() - startTime > timeoutMs) {
                        try {
                            await this.openai.beta.threads.runs.cancel(threadId, retrievedRun.id);
                        } catch (cancelError) { /* Ignore cancel error */ }
                        
                        await this.cleanupThread(threadId);
                        
                        if (retryCount < this.maxRetries - 1) {
                            console.log(`Run timed out, retrying (${retryCount + 1}/${this.maxRetries})...`);
                            retryCount++;
                            await this.timerDelayFn(this.retryDelayMs);
                            continue;
                        }
                        
                        throw new AssistantInteractionError(`Run timed out after ${timeoutMs / 1000} seconds.`, 'TIMEOUT', { threadId, runId });
                    }

                    // Log status changes
                    if (retrievedRun.status !== lastStatus) {
                        const timeInStatus = Date.now() - lastStatusChangeTime;
                        console.log(`Run status changed to: ${retrievedRun.status} (was in previous status for ${(timeInStatus / 1000).toFixed(1)}s)`);
                        lastStatus = retrievedRun.status;
                        lastStatusChangeTime = Date.now();
                    }

                    await this.timerDelayFn(currentPollingInterval);
                    retrievedRun = await this.openai.beta.threads.runs.retrieve(threadId, retrievedRun.id);
                    
                    // Exponential backoff: increase interval up to max
                    currentPollingInterval = Math.min(currentPollingInterval * 1.5, maxPollingIntervalMs);
                }

                // Check for unsuccessful terminal states
                if (retrievedRun.status !== 'completed') {
                    const errorDetails = retrievedRun.last_error ? 
                        `${retrievedRun.last_error.code} - ${retrievedRun.last_error.message}` : 
                        'No error details provided.';
                    
                    // Cleanup before throwing
                    await this.cleanupThread(threadId);
                    
                    if (retryCount < this.maxRetries - 1) {
                        console.log(`Run failed, retrying (${retryCount + 1}/${this.maxRetries})...`);
                        retryCount++;
                        await this.timerDelayFn(this.retryDelayMs);
                        continue;
                    }
                    
                    throw new AssistantInteractionError(`Run failed or was cancelled. Final status: ${retrievedRun.status}. ${errorDetails}`, retrievedRun.status, { threadId, runId, lastError: retrievedRun.last_error });
                }

                // 5. Retrieve Assistant Message
                const messages = await this.openai.beta.threads.messages.list(threadId, { order: "desc", limit: 1 });
                const assistantMessage = messages.data.find(m => m.role === 'assistant');

                if (!assistantMessage) {
                    throw new AssistantInteractionError('Assistant did not respond in the thread.', 'NO_RESPONSE', { threadId, runId });
                }

                // 6. Parse JSON
                let motionPlan: MotionPlan | null = null;
                let jsonParseError: string | null = null;
                let rawJsonString: string | null = null;

                if (assistantMessage.content.length > 0 && assistantMessage.content[0].type === 'text') {
                    rawJsonString = assistantMessage.content[0].text.value;
                    let jsonToParse: string | null = null;

                    // --- Robust JSON Extraction --- 
                    try {
                        const startIndex = rawJsonString.indexOf('{');
                        const endIndex = rawJsonString.lastIndexOf('}');

                        if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
                            jsonToParse = rawJsonString.substring(startIndex, endIndex + 1);
                            console.debug('[Adapter DEBUG] Extracted potential JSON:', jsonToParse); // Use console
                        } else {
                            // Could not find valid braces, maybe it IS pure JSON?
                            jsonToParse = rawJsonString.trim(); 
                            if (!jsonToParse.startsWith('{') || !jsonToParse.endsWith('}')) {
                               // If it doesn't look like JSON after trim, parsing will fail
                               jsonToParse = null; 
                            }
                        }
                    } catch (extractError) {
                         console.error('[Adapter ERROR] Error during JSON string extraction:', extractError); // Use console
                         jsonToParse = null; // Ensure parsing fails if extraction errors
                    }
                    // --- End Robust JSON Extraction ---
                    
                    try {
                        if (jsonToParse) {
                            // ADDED: Strip comments before parsing
                            const cleanedJsonString = jsonToParse
                                .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments /* ... */
                                .replace(/\/\/.*/g, '');           // Remove single-line comments // ...

                            // MODIFIED: Attempt to parse the *cleaned* string
                            const parsedJson = JSON.parse(cleanedJsonString);
                            // Validate structure
                            if (parsedJson && Array.isArray(parsedJson.steps)) {
                                motionPlan = parsedJson as MotionPlan;
                            } else {
                                jsonParseError = "Extracted JSON does not conform to MotionPlan structure (missing 'steps' array).";
                            }
                        } else {
                             jsonParseError = "Could not find valid JSON block in Assistant response.";
                        }
                    } catch (e) {
                        jsonParseError = `Failed to parse extracted JSON: ${e instanceof Error ? e.message : String(e)}`;
                        console.error("[Adapter ERROR] JSON Parsing Error. Raw content:"); // Use console
                        console.error("---");
                        console.error(rawJsonString);
                        console.error("---");
                    }
                } else {
                    jsonParseError = "Assistant message content is empty or not in the expected text format.";
                }

                if (!motionPlan) {
                    throw new MotionPlanParsingError(jsonParseError || "Unknown error parsing MotionPlan.", { threadId, runId, rawContent: rawJsonString });
                }

                // 8. Add metadata
                if (!motionPlan.metadata) motionPlan.metadata = {};
                if (requestedDuration !== undefined) motionPlan.metadata.requested_duration = requestedDuration;
                motionPlan.metadata.original_prompt = userPrompt;

                // Cleanup successful thread
                await this.cleanupThread(threadId);
                return motionPlan;

            } catch (error: unknown) {
                console.error("Error during Assistant API interaction:", error);
                
                // Cleanup thread if it exists
                if (threadId) {
                    await this.cleanupThread(threadId);
                }
                
                if (error instanceof MotionPlannerError) {
                    throw error;
                }
                
                const message = error instanceof Error ? error.message : 'Unknown error during assistant interaction';
                const statusCode = (error as any)?.status;
                
                if (retryCount < this.maxRetries - 1) {
                    console.log(`Error occurred, retrying (${retryCount + 1}/${this.maxRetries})...`);
                    retryCount++;
                    await this.timerDelayFn(this.retryDelayMs);
                    continue;
                }
                
                throw new AssistantInteractionError(message, statusCode, { threadId, runId, originalError: error });
            }
        }

        throw new AssistantInteractionError(`Failed after ${this.maxRetries} retries`, 'MAX_RETRIES_EXCEEDED', { threadId, runId });
    }

    /**
     * Gets capabilities, including the model used by the Assistant.
     */
    async getCapabilities?(): Promise<Record<string, any>> {
        let assistantModel = 'unknown';
        try {
            const assistant = await this.openai.beta.assistants.retrieve(this.config.assistantId);
            assistantModel = assistant.model;
        } catch (error) {
            console.warn(`Could not retrieve full capabilities for Assistant ID ${this.config.assistantId}:`, error);
            // Fallback, but indicate model couldn't be retrieved
        }

        return {
            provider: "OpenAI Assistants API",
            assistantId: this.config.assistantId,
            model: assistantModel,
            // Add other capabilities as needed
        };
    }

} 