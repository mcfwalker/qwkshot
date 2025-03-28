import { LLMProviderRegistry } from './registry';
import { getConfiguredProviders } from './config';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { SupabaseClient } from '@supabase/supabase-js';
import { ProviderType } from './types';

let isInitialized = false;

/**
 * Ensure the llm_state table has the required row
 */
async function ensureLLMStateTableInitialized(
  supabase: SupabaseClient, 
  defaultProvider: ProviderType
) {
  console.log('Ensuring llm_state table is initialized');
  
  // First check if the row exists
  const { data, error } = await supabase
    .from('llm_state')
    .select('id')
    .eq('id', 1);
  
  if (error || !data || data.length === 0) {
    console.log('llm_state row not found, creating it');
    
    // Row doesn't exist, create it with upsert
    const { error: upsertError } = await supabase
      .from('llm_state')
      .upsert(
        { id: 1, active_provider: defaultProvider },
        { onConflict: 'id' }
      );
      
    if (upsertError) {
      console.error('Failed to create llm_state row:', upsertError);
    } else {
      console.log(`Created llm_state row with default provider: ${defaultProvider}`);
    }
  } else {
    console.log('llm_state row exists');
  }
}

/**
 * Initialize the LLM system with a default provider
 */
export async function initializeLLMSystem() {
  // Prevent multiple initializations
  if (isInitialized) {
    console.log('LLM system already initialized');
    return;
  }

  const registry = LLMProviderRegistry.getInstance();
  const configuredProviders = getConfiguredProviders();

  console.log('Available LLM providers:', configuredProviders);

  if (configuredProviders.length === 0) {
    console.error('No LLM providers configured');
    throw new Error('No LLM providers configured. Please check your environment variables.');
  }

  // Determine default provider
  const defaultProvider = configuredProviders.includes('openai') 
    ? 'openai' 
    : configuredProviders[0];
    
  // Create Supabase client
  const supabase = createClientComponentClient();
  
  // Ensure the llm_state table is initialized
  await ensureLLMStateTableInitialized(supabase, defaultProvider);

  // Try to get the active provider from the database
  try {
    const { data, error } = await supabase
      .from('llm_state')
      .select('active_provider')
      .eq('id', 1)
      .single();

    // If we have a valid provider in the database, use that
    if (!error && data?.active_provider && configuredProviders.includes(data.active_provider)) {
      try {
        console.log(`Initializing provider from database: ${data.active_provider}`);
        await registry.initializeProvider(data.active_provider);
        console.log(`Initialized provider from database: ${data.active_provider}`);
        isInitialized = true;
        return;
      } catch (error) {
        console.error(`Failed to initialize provider ${data.active_provider} from database:`, error);
        // Fall through to default initialization
      }
    } else {
      console.log('No valid provider found in database or database error:', error);
    }
  } catch (dbError) {
    console.error('Error accessing database:', dbError);
  }

  // Fall back to default provider logic only if database lookup failed
  try {
    console.log(`Initializing default provider: ${defaultProvider}`);
    await registry.initializeProvider(defaultProvider);
    console.log(`Initialized default LLM provider: ${defaultProvider}`);
    isInitialized = true;
  } catch (error) {
    console.error(`Failed to initialize default provider ${defaultProvider}:`, error);
    throw error; // Re-throw to prevent the app from starting with an invalid state
  }
}

/**
 * Check if the LLM system is initialized
 */
export function isLLMSystemInitialized(): boolean {
  return isInitialized;
}

/**
 * Ensure the LLM system is initialized
 */
export async function ensureLLMSystemInitialized() {
  if (!isInitialized) {
    await initializeLLMSystem();
  }
} 