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
    private openai: OpenAI; // Now initialized
    private timerDelayFn: TimerDelayFunction; // Added for testable delays

    constructor(config: OpenAIAssistantProviderConfig, timerDelayFn?: TimerDelayFunction) {
        this.config = config;
        // Initialize OpenAI client using config.apiKey
        this.openai = new OpenAI({ apiKey: config.apiKey });
        this.timerDelayFn = timerDelayFn || defaultTimerDelay; // Use provided or default
        console.log("OpenAIAssistantAdapter initialized with Assistant ID:", config.assistantId);
    }

    /**
     * Generates a structured motion plan using the configured OpenAI Assistant.
     */
    async generatePlan(userPrompt: string, requestedDuration?: number): Promise<MotionPlan> {
        console.log(`Generating plan with prompt: "${userPrompt}", duration: ${requestedDuration}`);
        let threadId: string | null = null; // Keep track for potential cleanup/logging
        let runId: string | null = null;

        try {
            // 1. Create a Thread
            const thread = await this.openai.beta.threads.create();
            threadId = thread.id;
            console.log('Created thread:', threadId);

            // 2. Add User Message
            await this.openai.beta.threads.messages.create(threadId, {
                role: "user",
                content: userPrompt,
            });
            console.log('Added user message to thread:', threadId);

            // 3. Create a Run
            const run = await this.openai.beta.threads.runs.create(threadId, {
                assistant_id: this.config.assistantId,
            });
            runId = run.id;
            console.log(`Created run ${runId} for thread ${threadId}`);

            // 4. Poll Run Status
            const pollingIntervalMs = this.config.pollingIntervalMs || 1000; 
            const timeoutMs = this.config.timeoutMs || 60000; 
            const startTime = Date.now();
            let retrievedRun = run;

            while (
                retrievedRun.status === 'queued' || 
                retrievedRun.status === 'in_progress' ||
                retrievedRun.status === 'requires_action' 
            ) {
                if (Date.now() - startTime > timeoutMs) {
                    try {
                        await this.openai.beta.threads.runs.cancel(threadId, retrievedRun.id);
                    } catch (cancelError) { /* Ignore cancel error */ }
                    throw new AssistantInteractionError(`Run timed out after ${timeoutMs / 1000} seconds.`, 'TIMEOUT', { threadId, runId });
                }

                // --- Use injected timer delay function --- 
                await this.timerDelayFn(pollingIntervalMs); 
                // --- End timer handling --- 
                
                retrievedRun = await this.openai.beta.threads.runs.retrieve(threadId, retrievedRun.id);
            }

            // Check for unsuccessful terminal states
            if (retrievedRun.status !== 'completed') {
                 const errorDetails = retrievedRun.last_error ? 
                    `${retrievedRun.last_error.code} - ${retrievedRun.last_error.message}` : 
                    'No error details provided.';
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
                        // Attempt to parse the extracted or trimmed string
                        const parsedJson = JSON.parse(jsonToParse);
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

            // 9. Return MotionPlan
            return motionPlan;

        } catch (error: unknown) {
            console.error("Error during Assistant API interaction:", error);
            if (error instanceof MotionPlannerError) {
                throw error;
            }
            const message = error instanceof Error ? error.message : 'Unknown error during assistant interaction';
            const statusCode = (error as any)?.status; 
            throw new AssistantInteractionError(message, statusCode, { threadId, runId, originalError: error });
        }
    }

    /**
     * Validates the configuration by attempting to retrieve the Assistant details.
     */
    async validateConfiguration?(): Promise<boolean> {
        try {
            await this.openai.beta.assistants.retrieve(this.config.assistantId);
            return true;
        } catch (error) {
            console.error(`Configuration validation failed for Assistant ID ${this.config.assistantId}:`, error);
            return false;
        }
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