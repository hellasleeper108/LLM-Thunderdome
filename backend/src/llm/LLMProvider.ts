/**
 * LLM Provider System
 * Pluggable LLM integration for agent decision-making and negotiation
 */

export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  raw?: any;
}

export interface LLMProvider {
  complete(request: LLMRequest): Promise<LLMResponse>;
}

/**
 * Basic Local Mock Provider
 * Returns deterministic mock decisions suitable for development
 */
export class BasicLocalMockProvider implements LLMProvider {
  async complete(request: LLMRequest): Promise<LLMResponse> {
    // Parse the user prompt to determine context
    const prompt = request.userPrompt.toLowerCase();

    let content: string;

    // Detect action selection vs negotiation
    if (prompt.includes('what action') || prompt.includes('decide') || prompt.includes('next move')) {
      content = this.generateMockAction(request.userPrompt);
    } else if (prompt.includes('negotiate') || prompt.includes('propose') || prompt.includes('alliance')) {
      content = this.generateMockNegotiation(request.userPrompt);
    } else if (prompt.includes('message') || prompt.includes('communicate')) {
      content = this.generateMockMessage(request.userPrompt);
    } else {
      // Default intelligent response
      content = this.generateDefaultResponse(request.userPrompt);
    }

    return {
      content,
      raw: { provider: 'BasicLocalMockProvider', mode: 'mock' },
    };
  }

  private generateMockAction(prompt: string): string {
    // Extract context clues
    const hasResources = prompt.includes('resource') || prompt.includes('food') || prompt.includes('water');
    const hasEnemies = prompt.includes('enemy') || prompt.includes('threat') || prompt.includes('hostile');
    const hasAllies = prompt.includes('ally') || prompt.includes('friend') || prompt.includes('alliance');
    const lowEnergy = prompt.includes('low energy') || prompt.includes('tired');

    // Deterministic decision logic
    if (lowEnergy) {
      return JSON.stringify({
        action: 'REST',
        reasoning: 'Energy is low, resting to recover before taking further action.',
      });
    }

    if (hasResources) {
      return JSON.stringify({
        action: 'GATHER',
        reasoning: 'Resources are nearby and valuable for survival.',
      });
    }

    if (hasEnemies) {
      return JSON.stringify({
        action: 'MOVE',
        direction: 'away',
        reasoning: 'Avoiding hostile agents to preserve health and resources.',
      });
    }

    if (hasAllies) {
      return JSON.stringify({
        action: 'COMMUNICATE',
        target: 'ally',
        message: 'Coordinating with allies for mutual benefit.',
      });
    }

    // Default exploration
    return JSON.stringify({
      action: 'EXPLORE',
      reasoning: 'No immediate threats or opportunities, exploring to gather information.',
    });
  }

  private generateMockNegotiation(prompt: string): string {
    const isAlliance = prompt.includes('alliance');
    const isTrade = prompt.includes('trade') || prompt.includes('exchange');
    const isThreat = prompt.includes('threat') || prompt.includes('demand');

    if (isAlliance) {
      return JSON.stringify({
        protocol: 'ALLIANCE',
        message: 'I propose we form an alliance for mutual protection and resource sharing.',
        offer: {
          mutualProtection: true,
          resourceSharing: true,
        },
      });
    }

    if (isTrade) {
      return JSON.stringify({
        protocol: 'TRADE',
        message: 'I have excess food and need water. Shall we trade?',
        offer: {
          give: { food: 5 },
          receive: { water: 5 },
        },
      });
    }

    if (isThreat) {
      return JSON.stringify({
        protocol: 'THREAT',
        message: 'Leave this area or face consequences.',
      });
    }

    return JSON.stringify({
      protocol: 'REQUEST_AID',
      message: 'I am in need of assistance. Can you help?',
    });
  }

  private generateMockMessage(prompt: string): string {
    const isFriendly = prompt.includes('friend') || prompt.includes('cooperate');
    const isHostile = prompt.includes('hostile') || prompt.includes('enemy');

    if (isFriendly) {
      return 'Greetings! I come in peace and seek cooperation.';
    }

    if (isHostile) {
      return 'Stay away! I will defend myself if necessary.';
    }

    return 'Hello. What are your intentions?';
  }

  private generateDefaultResponse(prompt: string): string {
    // Generic intelligent response
    return JSON.stringify({
      response: 'Analyzing situation and considering options.',
      confidence: 0.7,
    });
  }
}

/**
 * Configurable HTTP LLM Provider
 * Generic OpenAI-style API integration
 */
export class ConfigurableHttpLLMProvider implements LLMProvider {
  private apiUrl: string;
  private apiKey: string;
  private model: string;

  constructor(config?: { apiUrl?: string; apiKey?: string; model?: string }) {
    this.apiUrl = config?.apiUrl || process.env.LLM_API_URL || 'https://api.openai.com/v1/chat/completions';
    this.apiKey = config?.apiKey || process.env.LLM_API_KEY || '';
    this.model = config?.model || process.env.LLM_MODEL || 'gpt-3.5-turbo';

    if (!this.apiKey) {
      console.warn('[ConfigurableHttpLLMProvider] No API key provided. Calls will likely fail.');
    }
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error('LLM_API_KEY is required for HTTP LLM provider');
    }

    try {
      // Build OpenAI-style request payload
      const payload = {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: request.systemPrompt,
          },
          {
            role: 'user',
            content: request.userPrompt,
          },
        ],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 500,
      };

      console.log(`[LLM] Calling ${this.apiUrl} with model ${this.model}`);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API error (${response.status}): ${errorText}`);
      }

      const data = await response.json() as any;

      // Extract assistant message content
      const content = data.choices?.[0]?.message?.content || '';

      if (!content) {
        throw new Error('No content in LLM response');
      }

      console.log(`[LLM] Response received (${content.length} chars)`);

      return {
        content,
        raw: data,
      };
    } catch (error: any) {
      console.error('[LLM] Error calling HTTP provider:', error);
      throw new Error(`LLM provider error: ${error.message}`);
    }
  }
}

/**
 * Anthropic Claude Provider
 * Specialized provider for Anthropic's Claude API
 */
export class AnthropicClaudeProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private apiUrl: string;

  constructor(config?: { apiKey?: string; model?: string }) {
    this.apiKey = config?.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.model = config?.model || process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307';
    this.apiUrl = 'https://api.anthropic.com/v1/messages';

    if (!this.apiKey) {
      console.warn('[AnthropicClaudeProvider] No API key provided.');
    }
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for Anthropic provider');
    }

    try {
      // Build Anthropic-style request payload
      const payload = {
        model: this.model,
        max_tokens: request.maxTokens ?? 500,
        temperature: request.temperature ?? 0.7,
        system: request.systemPrompt,
        messages: [
          {
            role: 'user',
            content: request.userPrompt,
          },
        ],
      };

      console.log(`[LLM] Calling Anthropic API with model ${this.model}`);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
      }

      const data = await response.json() as any;

      // Extract content from Anthropic response
      const content = data.content?.[0]?.text || '';

      if (!content) {
        throw new Error('No content in Anthropic response');
      }

      console.log(`[LLM] Response received (${content.length} chars)`);

      return {
        content,
        raw: data,
      };
    } catch (error: any) {
      console.error('[LLM] Error calling Anthropic provider:', error);
      throw new Error(`Anthropic provider error: ${error.message}`);
    }
  }
}
