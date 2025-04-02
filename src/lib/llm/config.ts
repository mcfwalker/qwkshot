import { ProviderType, ProviderConfig, OpenAIProviderConfig, GeminiProviderConfig } from './types';

type EnvKeys = {
  [K in ProviderType]: K extends 'openai' 
    ? { apiKey: string; organization: string; model: string; }
    : { apiKey: string; model: string; }
};

/**
 * Environment variable keys for different providers
 */
const ENV_KEYS: EnvKeys = {
  openai: {
    apiKey: 'OPENAI_API_KEY',
    organization: 'OPENAI_ORGANIZATION',
    model: 'OPENAI_MODEL',
  },
  gemini: {
    apiKey: 'GEMINI_API_KEY',
    model: 'GEMINI_MODEL',
  },
};

/**
 * Default configurations for providers
 */
const DEFAULT_CONFIG = {
  openai: {
    model: 'gpt-4-turbo-preview',
    temperature: 0.7,
    maxTokens: 2000,
  },
  gemini: {
    model: 'gemini-pro',
    temperature: 0.7,
    maxTokens: 2000,
  },
} as const;

/**
 * Get configuration for a specific provider from environment variables
 */
export function getProviderConfig(type: ProviderType): ProviderConfig {
  const envKeys = ENV_KEYS[type];
  const defaults = DEFAULT_CONFIG[type];

  switch (type) {
    case 'openai': {
      const apiKey = process.env[envKeys.apiKey];
      if (!apiKey) {
        throw new Error(`Missing ${envKeys.apiKey} environment variable`);
      }

      const organization = process.env[(envKeys as any).organization];

      const config: OpenAIProviderConfig = {
        type: 'openai',
        apiKey,
        organization,
        model: process.env[envKeys.model] || defaults.model,
        temperature: defaults.temperature,
        maxTokens: defaults.maxTokens,
      };

      return config;
    }

    case 'gemini': {
      const apiKey = process.env[envKeys.apiKey];
      if (!apiKey) {
        throw new Error(`Missing ${envKeys.apiKey} environment variable`);
      }

      const config: GeminiProviderConfig = {
        type: 'gemini',
        apiKey,
        model: process.env[envKeys.model] || defaults.model,
        temperature: defaults.temperature,
        maxTokens: defaults.maxTokens,
      };

      return config;
    }

    default:
      throw new Error(`Unsupported provider type: ${type}`);
  }
}

/**
 * Check if a provider is configured in the environment
 */
export function isProviderConfigured(type: ProviderType): boolean {
  const envKeys = ENV_KEYS[type];
  return !!process.env[envKeys.apiKey];
}

/**
 * Get all configured provider types
 */
export function getConfiguredProviders(): ProviderType[] {
  return Object.keys(ENV_KEYS).filter((type) => 
    isProviderConfigured(type as ProviderType)
  ) as ProviderType[];
} 