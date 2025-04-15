import OpenAI from 'openai';
import { 
    MotionPlan,
    MotionPlannerService,
    OpenAIAssistantProviderConfig 
} from "../types";

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

    constructor(config: OpenAIAssistantProviderConfig) {
        this.config = config;
        // Initialize OpenAI client using config.apiKey
        this.openai = new OpenAI({ apiKey: config.apiKey });
        console.log("OpenAIAssistantAdapter initialized with Assistant ID:", config.assistantId);
    }

    /**
     * Generates a structured motion plan using the configured OpenAI Assistant.
     */
    async generatePlan(userPrompt: string, requestedDuration?: number): Promise<MotionPlan> {
        console.log(`Generating plan with prompt: "${userPrompt}", duration: ${requestedDuration}`);
        
        try {
            // 1. Create a Thread
            const thread = await this.openai.beta.threads.create();
            console.log('Created thread:', thread.id);

            // 2. Add User Message to Thread
            await this.openai.beta.threads.messages.create(thread.id, {
                role: "user",
                content: userPrompt,
            });
            console.log('Added user message to thread:', thread.id);

            // 3. Create a Run
            const run = await this.openai.beta.threads.runs.create(thread.id, {
                assistant_id: this.config.assistantId,
                // TODO: Add instructions or model overrides if necessary
                // instructions: "Your instructions here...",
                // model: "gpt-4-turbo-preview" // Or another compatible model
            });
            console.log(`Created run ${run.id} for thread ${thread.id}`);

            // === Step 4: Poll the Run status ===
            const pollingIntervalMs = this.config.pollingIntervalMs || 1000; // Default 1 second
            const timeoutMs = this.config.timeoutMs || 60000; // Default 60 seconds
            const startTime = Date.now();

            let retrievedRun = run;
            while (
                retrievedRun.status === 'queued' || 
                retrievedRun.status === 'in_progress' ||
                retrievedRun.status === 'requires_action' // Handle potential tool calls later if needed
            ) {
                if (Date.now() - startTime > timeoutMs) {
                    // Attempt to cancel the run before throwing timeout error
                    try {
                        await this.openai.beta.threads.runs.cancel(thread.id, retrievedRun.id);
                        console.log(`Run ${retrievedRun.id} cancelled due to timeout.`);
                    } catch (cancelError) {
                        console.error(`Failed to cancel run ${retrievedRun.id} after timeout:`, cancelError);
                    }
                    throw new Error(`Run timed out after ${timeoutMs / 1000} seconds.`);
                }

                console.log(`Run status: ${retrievedRun.status}, polling again in ${pollingIntervalMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, pollingIntervalMs));
                retrievedRun = await this.openai.beta.threads.runs.retrieve(thread.id, retrievedRun.id);
            }

            console.log(`Run ${retrievedRun.id} finished with status: ${retrievedRun.status}`);

            // Check for unsuccessful terminal states
            if (retrievedRun.status !== 'completed') {
                 const errorDetails = retrievedRun.last_error ? 
                    `Error: ${retrievedRun.last_error.code} - ${retrievedRun.last_error.message}` : 
                    'No error details provided.';
                throw new Error(`Run failed or was cancelled. Final status: ${retrievedRun.status}. ${errorDetails}`);
            }

            // === Run Completed Successfully ===

            // === Step 5: Retrieve Assistant message ===
            const messages = await this.openai.beta.threads.messages.list(thread.id, {
                order: "desc", // Get newest messages first
                limit: 10 // Limit retrieval for efficiency
            });

            // Find the latest message from the assistant
            const assistantMessage = messages.data.find(m => m.role === 'assistant');

            if (!assistantMessage) {
                throw new Error('Assistant did not respond in the thread.');
            }

            // Log the raw assistant message content (useful for debugging)
            console.log("Raw Assistant Message Content:", JSON.stringify(assistantMessage.content, null, 2));

            // === Step 6: Parse JSON from message content ===
            let motionPlan: MotionPlan | null = null;
            let parseError: string | null = null;

            if (assistantMessage.content.length > 0 && assistantMessage.content[0].type === 'text') {
                const jsonString = assistantMessage.content[0].text.value;
                try {
                    const parsedJson = JSON.parse(jsonString);
                    
                    // === Step 7: Validate JSON Structure ===
                    // Basic validation: Check if it has a 'steps' array.
                    // More robust validation (e.g., using Zod) could be added here.
                    if (parsedJson && Array.isArray(parsedJson.steps)) {
                        motionPlan = parsedJson as MotionPlan;
                        console.log("Successfully parsed and validated MotionPlan.");
                    } else {
                        parseError = "Parsed JSON does not conform to MotionPlan structure (missing 'steps' array).";
                    }
                } catch (e) {
                    parseError = `Failed to parse JSON from Assistant response: ${e instanceof Error ? e.message : String(e)}. Raw content: ${jsonString}`;
                }
            } else {
                parseError = "Assistant message content is empty or not in the expected text format.";
            }

            if (!motionPlan) {
                // Throw the parsing/validation error
                throw new Error(parseError || "Unknown error parsing MotionPlan.");
            }

            // === Step 8: Add metadata ===
            // Ensure metadata object exists
            if (!motionPlan.metadata) {
                motionPlan.metadata = {};
            }
            // Add optional metadata from the request
            if (requestedDuration !== undefined) {
                motionPlan.metadata.requested_duration = requestedDuration;
            }
            motionPlan.metadata.original_prompt = userPrompt;

            // === Step 9: Return MotionPlan ===
            console.log("Returning final MotionPlan:", JSON.stringify(motionPlan, null, 2));
            return motionPlan;

        } catch (error) {
            console.error("Error during Assistant API interaction:", error);
            // TODO: Implement more specific error handling (e.g., wrap in a custom error type)
            throw error; // Re-throw for now
        }
    }

    /**
     * Validates the configuration by attempting to retrieve the Assistant details.
     */
    async validateConfiguration?(): Promise<boolean> {
        try {
            await this.openai.beta.assistants.retrieve(this.config.assistantId);
            console.log(`Successfully validated configuration for Assistant ID: ${this.config.assistantId}`);
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