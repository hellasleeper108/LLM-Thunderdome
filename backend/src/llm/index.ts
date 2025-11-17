/**
 * LLM Module
 * Exports LLM provider system and factory function
 */

import {
  LLMProvider,
  BasicLocalMockProvider,
  ConfigurableHttpLLMProvider,
  AnthropicClaudeProvider,
} from './LLMProvider';

export type {
  LLMRequest,
  LLMResponse,
  LLMProvider,
} from './LLMProvider';

export {
  BasicLocalMockProvider,
  ConfigurableHttpLLMProvider,
  AnthropicClaudeProvider,
};

/**
 * Provider type selection
 */
export type LLMProviderType = 'mock' | 'openai' | 'anthropic' | 'http';

/**
 * Get LLM Provider instance based on environment configuration
 * @returns LLMProvider instance
 */
export function getLLMProvider(type?: LLMProviderType): LLMProvider {
  const mode = type || (process.env.LLM_MODE as LLMProviderType) || 'mock';

  console.log(`[LLM] Initializing provider: ${mode}`);

  switch (mode) {
    case 'mock':
      return new BasicLocalMockProvider();

    case 'openai':
    case 'http':
      // Generic HTTP provider (OpenAI-compatible)
      const apiUrl = process.env.LLM_API_URL || 'https://api.openai.com/v1/chat/completions';
      const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';
      const model = process.env.LLM_MODEL || 'gpt-3.5-turbo';

      if (!apiKey) {
        console.warn('[LLM] No API key found. Falling back to mock provider.');
        return new BasicLocalMockProvider();
      }

      return new ConfigurableHttpLLMProvider({ apiUrl, apiKey, model });

    case 'anthropic':
      const anthropicKey = process.env.ANTHROPIC_API_KEY || '';
      const anthropicModel = process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307';

      if (!anthropicKey) {
        console.warn('[LLM] No Anthropic API key found. Falling back to mock provider.');
        return new BasicLocalMockProvider();
      }

      return new AnthropicClaudeProvider({ apiKey: anthropicKey, model: anthropicModel });

    default:
      console.warn(`[LLM] Unknown mode: ${mode}. Using mock provider.`);
      return new BasicLocalMockProvider();
  }
}

/**
 * Create a custom LLM provider with specific configuration
 */
export function createCustomProvider(config: {
  type: 'http' | 'anthropic';
  apiKey: string;
  apiUrl?: string;
  model?: string;
}): LLMProvider {
  if (config.type === 'anthropic') {
    return new AnthropicClaudeProvider({
      apiKey: config.apiKey,
      model: config.model,
    });
  } else {
    return new ConfigurableHttpLLMProvider({
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
      model: config.model,
    });
  }
}

// Default export
export default {
  getLLMProvider,
  createCustomProvider,
  BasicLocalMockProvider,
  ConfigurableHttpLLMProvider,
  AnthropicClaudeProvider,
};
