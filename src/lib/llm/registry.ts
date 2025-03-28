import { ProviderRegistry, ProviderType, LLMProvider, ProviderConfig, ConfigurationError, OpenAIProviderConfig, GeminiProviderConfig } from './types';
import { BaseLLMProvider } from './base-provider';
import OpenAIProvider from './providers/openai';
import GeminiProvider from './providers/gemini';
import { getProviderConfig } from './config';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

/**
 * Registry for managing LLM providers
 * Implements the singleton pattern to ensure a single registry instance
 */
export class LLMProviderRegistry implements ProviderRegistry {
  private static instance: LLMProviderRegistry;
  private providers: Map<ProviderType, BaseLLMProvider> = new Map();
  private activeProvider: ProviderType | null = null;
  private supabase = createClientComponentClient();

  private constructor() {}

  /**
   * Get the singleton instance of the registry
   */
  public static getInstance(): LLMProviderRegistry {
    if (!LLMProviderRegistry.instance) {
      LLMProviderRegistry.instance = new LLMProviderRegistry();
    }
    return LLMProviderRegistry.instance;
  }

  /**
   * Register a new provider and persist the state
   */
  async registerProvider(type: ProviderType, provider: BaseLLMProvider): Promise<void> {
    console.log('Registering provider:', type);
    this.providers.set(type, provider);
    this.activeProvider = type;
    
    // Update the persisted state
    console.log('Updating persisted state in registry for provider:', type);
    
    try {
      // First check if the row exists
      const { data, error } = await this.supabase
        .from('llm_state')
        .select('id')
        .eq('id', 1);
        
      if (error || !data || data.length === 0) {
        // Create the row if it doesn't exist
        await this.supabase
          .from('llm_state')
          .upsert(
            { id: 1, active_provider: type },
            { onConflict: 'id' }
          );
      } else {
        // Update the existing row
        await this.supabase
          .from('llm_state')
          .update({ active_provider: type })
          .eq('id', 1);
      }
      
      console.log('Provider registration complete');
    } catch (error) {
      console.error('Error updating provider state in database:', error);
    }
  }

  /**
   * Get a provider by type
   */
  getProvider(type: ProviderType): BaseLLMProvider {
    console.log('Getting provider:', type);
    const provider = this.providers.get(type);
    if (!provider) {
      throw new ConfigurationError(type, `Provider ${type} not found`);
    }
    return provider;
  }

  /**
   * Get the currently active provider
   */
  async getActiveProvider(): Promise<BaseLLMProvider | null> {
    console.log('Getting active provider, current in-memory state:', this.activeProvider);
    
    // If we have an active provider in memory and it exists in the registry, return it
    if (this.activeProvider && this.providers.has(this.activeProvider)) {
      return this.providers.get(this.activeProvider) || null;
    }
    
    // Otherwise, try to load it from the database
    console.log('No active provider in memory, checking database');
    try {
      const { data, error } = await this.supabase
        .from('llm_state')
        .select('active_provider')
        .eq('id', 1)
        .single();

      if (!error && data?.active_provider) {
        const type = data.active_provider as ProviderType;
        console.log('Found provider in database:', type);
        
        // Initialize the provider if it's not already in memory
        if (!this.providers.has(type)) {
          console.log('Provider not in memory, initializing it:', type);
          try {
            // Initialize the provider with configuration
            await this.initializeProvider(type);
            console.log('Successfully initialized provider from database');
            return this.providers.get(type) || null;
          } catch (initError) {
            console.error(`Failed to initialize provider ${type} from database:`, initError);
            return null;
          }
        } else {
          this.activeProvider = type;
          return this.providers.get(type) || null;
        }
      } else if (error && error.code === 'PGRST116') {
        console.log('No active provider row found in database, this will be created during initialization');
      } else {
        console.error('Error retrieving active provider from database:', error);
      }
    } catch (error) {
      console.error('Error retrieving active provider from database:', error);
    }

    return null;
  }

  /**
   * List all registered providers
   */
  listProviders(): ProviderType[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Validate a provider's configuration
   */
  async validateProvider(type: ProviderType): Promise<boolean> {
    const provider = this.providers.get(type);
    if (!provider) {
      return false;
    }
    return provider.validateConfiguration();
  }

  /**
   * Initialize a provider with configuration
   */
  async initializeProvider(type: ProviderType): Promise<BaseLLMProvider> {
    // Check if we already have this provider in memory
    if (this.providers.has(type)) {
      console.log(`Provider ${type} already exists in memory, using existing instance`);
      this.activeProvider = type;
      return this.providers.get(type)!;
    }
    
    const config = getProviderConfig(type);
    let provider: BaseLLMProvider;
    
    switch (type) {
      case 'openai': {
        const openaiConfig: OpenAIProviderConfig = { ...config, type: 'openai' };
        provider = new OpenAIProvider(openaiConfig);
        break;
      }
      case 'gemini': {
        const geminiConfig: GeminiProviderConfig = { ...config, type: 'gemini' };
        provider = new GeminiProvider(geminiConfig);
        break;
      }
      default:
        throw new Error(`Unsupported provider type: ${type}`);
    }

    await this.registerProvider(type, provider);
    return provider;
  }
}

// Export convenience functions that use the singleton registry
export async function initializeProvider(type: ProviderType): Promise<BaseLLMProvider> {
  return LLMProviderRegistry.getInstance().initializeProvider(type);
}

export async function getActiveProvider(): Promise<BaseLLMProvider | null> {
  return LLMProviderRegistry.getInstance().getActiveProvider();
}

export function setActiveProvider(provider: BaseLLMProvider): Promise<void> {
  return LLMProviderRegistry.getInstance().registerProvider(provider.getProviderType(), provider);
} 