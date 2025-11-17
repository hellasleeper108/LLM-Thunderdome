/**
 * LLM Agent
 * Uses a language model to make decisions based on observations
 * Now integrates with the pluggable LLMProvider system
 */

import { BaseAgent } from './BaseAgent';
import {
  Action,
  ActionType,
  Observation,
  Position,
  Goal,
  Personality,
  TileType,
} from '../schemas/types';
import { LLMProvider, LLMRequest, LLMResponse } from '../llm/LLMProvider';
import { getLLMProvider } from '../llm';

export interface LLMConfig {
  provider?: LLMProvider; // Explicit provider instance
  useMock?: boolean; // Force mock mode (overrides env)
}

/**
 * Expected JSON response format from LLM
 */
interface LLMActionResponse {
  actionType: 'MOVE' | 'GATHER' | 'NEGOTIATE' | 'REST' | 'ATTACK' | 'FORM_ALLIANCE' | 'BREAK_ALLIANCE' | 'COMMUNICATE' | 'SHARE' | 'EXPLORE';
  target?: string | { x: number; y: number }; // Agent name or coordinate
  reason: string;
  negotiationProposal?: {
    type: 'TRADE' | 'ALLIANCE' | 'REQUEST_AID' | 'THREAT' | null;
    terms?: string;
  };
}

export class LLMAgent extends BaseAgent {
  private llmProvider: LLMProvider;

  constructor(
    name: string,
    personality: Personality,
    position: Position,
    goals: Goal[],
    llmConfig: LLMConfig = {}
  ) {
    super(name, personality, position, goals);

    // Use provided provider, or get from environment
    if (llmConfig.provider) {
      this.llmProvider = llmConfig.provider;
    } else if (llmConfig.useMock) {
      this.llmProvider = getLLMProvider('mock');
    } else {
      this.llmProvider = getLLMProvider(); // Auto-detect from env
    }
  }

  /**
   * Use LLM to decide on next action
   */
  async decideAction(observation: Observation): Promise<Action> {
    this.observe(observation);

    try {
      return await this.callLLMForAction(observation);
    } catch (error) {
      console.error(`[LLMAgent ${this.state.name}] LLM decision failed:`, error);
      // Fallback to safe action
      return this.fallbackAction(observation);
    }
  }

  /**
   * Call LLM provider for action decision
   */
  private async callLLMForAction(observation: Observation): Promise<Action> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(observation);

    const request: LLMRequest = {
      systemPrompt,
      userPrompt,
      temperature: 0.7,
      maxTokens: 500,
    };

    const response: LLMResponse = await this.llmProvider.complete(request);

    // Parse the LLM response
    return this.parseActionFromLLM(response.content, observation);
  }

  /**
   * Build system prompt with agent personality and context
   */
  private buildSystemPrompt(): string {
    return `You are ${this.state.name}, an intelligent agent in a simulation world.

Personality: ${this.state.personality.description}

Your personality traits:
- Aggression: ${this.state.stats.aggression}/100 (higher = more confrontational)
- Cooperation: ${this.state.stats.cooperation}/100 (higher = more collaborative)
- Empathy: ${this.state.stats.empathy}/100 (higher = more caring)
- Curiosity: ${this.state.stats.curiosity}/100 (higher = more exploratory)
- Risk Tolerance: ${this.state.stats.riskTolerance}/100 (higher = more daring)

You must make strategic decisions to survive, gather resources, form alliances, and achieve your goals.

Always respond with ONLY a valid JSON object in this exact format:
{
  "actionType": "MOVE" | "GATHER" | "NEGOTIATE" | "REST" | "ATTACK" | "FORM_ALLIANCE" | "BREAK_ALLIANCE" | "COMMUNICATE" | "SHARE" | "EXPLORE",
  "target": "agentName or {x: number, y: number}",
  "reason": "brief explanation of your reasoning",
  "negotiationProposal": {
    "type": "TRADE" | "ALLIANCE" | "REQUEST_AID" | "THREAT" | null,
    "terms": "what you propose"
  }
}

The negotiationProposal field is optional and only needed when actionType is "NEGOTIATE".`;
  }

  /**
   * Build user prompt with current observation and context
   */
  private buildUserPrompt(observation: Observation): string {
    const goals = this.state.goals
      .filter(g => !g.completed)
      .map(g => `- ${g.description} (${g.priority})`)
      .join('\n');

    // Get recent memories (from MemoryManager if available)
    const recentMemories = this.getRecentMemorySnippets();

    // Analyze observation
    const resourceTiles = observation.visibleTiles.filter(
      t => t.type === TileType.RESOURCE_FOOD ||
           t.type === TileType.RESOURCE_WATER ||
           t.type === TileType.RESOURCE_MATERIAL
    );

    const eventTiles = observation.visibleTiles.filter(
      t => t.type === TileType.EVENT_STORM ||
           t.type === TileType.EVENT_ANOMALY ||
           t.type === TileType.EVENT_BOON
    );

    const nearbyAgents = observation.nearbyAgents.map(a => ({
      name: a.name,
      health: a.health,
      isAlly: this.state.allegiances.includes(a.id),
      position: a.position,
      stats: a.stats,
    }));

    const prompt = `## Current Situation

**Your Status:**
- Position: (${this.state.position.x}, ${this.state.position.y})
- Health: ${this.state.health}/100
- Energy: ${this.state.stats.energy}/100
- Inventory: Food=${this.state.inventory.food}, Water=${this.state.inventory.water}, Materials=${this.state.inventory.material}

**Your Goals:**
${goals || '- No active goals'}

**Recent Memories:**
${recentMemories || '- No recent memories'}

**Observation:**
- Nearby Resources: ${resourceTiles.length > 0 ? resourceTiles.map(t => `${t.type} at (${t.position.x},${t.position.y}) [value: ${t.value}]`).join(', ') : 'None visible'}
- Nearby Agents: ${nearbyAgents.length > 0 ? nearbyAgents.map(a => `${a.name} at (${a.position.x},${a.position.y}) [health: ${a.health}, ally: ${a.isAlly}]`).join(', ') : 'None nearby'}
- World Events: ${eventTiles.length > 0 ? eventTiles.map(e => `${e.type} at (${e.position.x},${e.position.y})`).join(', ') : 'None visible'}
- Recent Messages: ${observation.recentMessages.length} message(s) received

${observation.recentMessages.length > 0 ? `**Messages:**\n${observation.recentMessages.map(m => `- From ${m.from}: "${m.content}" [type: ${m.type}]`).join('\n')}` : ''}

**Available Actions:**
- MOVE: Move to an adjacent tile
- GATHER: Collect resources from current position
- REST: Restore energy (cost: 1 turn)
- ATTACK: Attack another agent (requires proximity)
- FORM_ALLIANCE: Propose alliance with another agent
- BREAK_ALLIANCE: End an existing alliance
- COMMUNICATE: Send a message to nearby agents
- SHARE: Give resources to an ally
- EXPLORE: Move towards unexplored areas
- NEGOTIATE: Initiate formal negotiation (trade, alliance, aid, threat)

Based on your personality, goals, and the current situation, what action do you take?
Remember to respond ONLY with the JSON object specified in the system prompt.`;

    return prompt;
  }

  /**
   * Get recent memory snippets from MemoryManager
   */
  private getRecentMemorySnippets(): string {
    // Get last 5 short-term memories
    const shortTerm = this.state.memory.shortTerm
      .slice(-5)
      .map(m => `- [${m.type}] ${m.content}`)
      .join('\n');

    // Get important long-term memories (if any have high importance in metadata)
    const important = this.state.memory.longTerm
      .filter(m => m.metadata?.importance && m.metadata.importance > 70)
      .slice(-3)
      .map(m => `- [IMPORTANT] ${m.content}`)
      .join('\n');

    const combined = [shortTerm, important].filter(Boolean).join('\n');
    return combined || 'None';
  }

  /**
   * Parse LLM response into an Action
   */
  private parseActionFromLLM(response: string, observation: Observation): Action {
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonText = response.trim();

      // Remove markdown code fences if present
      if (jsonText.startsWith('```')) {
        const lines = jsonText.split('\n');
        jsonText = lines.slice(1, -1).join('\n');
        if (jsonText.startsWith('json')) {
          jsonText = jsonText.substring(4);
        }
      }

      const parsed: LLMActionResponse = JSON.parse(jsonText);

      // Validate required fields
      if (!parsed.actionType || !parsed.reason) {
        throw new Error('Missing required fields: actionType or reason');
      }

      // Map LLM action type to internal ActionType
      const actionType = this.mapActionType(parsed.actionType);

      // Parse target
      let target: Position | string | undefined;
      if (parsed.target) {
        if (typeof parsed.target === 'string') {
          // Agent name - find agent ID
          const targetAgent = observation.nearbyAgents.find(
            a => a.name.toLowerCase().includes((parsed.target as string).toLowerCase())
          );
          target = targetAgent ? targetAgent.id : parsed.target;
        } else if (typeof parsed.target === 'object' && 'x' in parsed.target && 'y' in parsed.target) {
          // Position object
          target = { x: parsed.target.x, y: parsed.target.y };
        }
      }

      // Build payload with LLM metadata
      const payload: Record<string, any> = {
        llm_decision: true,
        reason: parsed.reason,
      };

      // Handle negotiation proposals
      if (parsed.negotiationProposal && parsed.negotiationProposal.type) {
        payload.negotiationProposal = {
          protocol: parsed.negotiationProposal.type,
          terms: parsed.negotiationProposal.terms || '',
          message: parsed.negotiationProposal.terms || parsed.reason,
        };

        // If negotiation proposal exists but action isn't NEGOTIATE, change it
        if (actionType !== ActionType.NEGOTIATE) {
          console.log(`[LLMAgent ${this.state.name}] Correcting action to NEGOTIATE due to negotiationProposal`);
          return {
            type: ActionType.NEGOTIATE,
            agentId: this.state.id,
            target,
            payload,
          };
        }
      }

      // Construct action
      const action: Action = {
        type: actionType,
        agentId: this.state.id,
        target,
        payload,
      };

      console.log(`[LLMAgent ${this.state.name}] Decided: ${actionType} - ${parsed.reason}`);

      return action;
    } catch (error) {
      console.error(`[LLMAgent ${this.state.name}] Failed to parse LLM response:`, error);
      console.error('Raw response:', response);

      // Fallback to safe action
      return this.fallbackAction(observation);
    }
  }

  /**
   * Map LLM action type string to ActionType enum
   */
  private mapActionType(actionType: string): ActionType {
    const normalized = actionType.toUpperCase().replace(/\s+/g, '_');

    switch (normalized) {
      case 'MOVE':
        return ActionType.MOVE;
      case 'GATHER':
        return ActionType.GATHER;
      case 'REST':
        return ActionType.REST;
      case 'ATTACK':
        return ActionType.ATTACK;
      case 'FORM_ALLIANCE':
      case 'ALLY':
        return ActionType.FORM_ALLIANCE;
      case 'BREAK_ALLIANCE':
        return ActionType.BREAK_ALLIANCE;
      case 'COMMUNICATE':
        return ActionType.COMMUNICATE;
      case 'SHARE':
        return ActionType.SHARE;
      case 'EXPLORE':
        return ActionType.EXPLORE;
      case 'NEGOTIATE':
        return ActionType.NEGOTIATE;
      default:
        console.warn(`[LLMAgent ${this.state.name}] Unknown action type: ${actionType}, defaulting to MOVE`);
        return ActionType.MOVE;
    }
  }

  /**
   * Fallback action when LLM fails or returns invalid response
   */
  private fallbackAction(observation: Observation): Action {
    // Simple priority-based fallback logic

    // Low energy? Rest
    if (this.state.stats.energy < 30) {
      return {
        type: ActionType.REST,
        agentId: this.state.id,
        payload: { reason: 'Low energy, resting to recover', llm_decision: false },
      };
    }

    // Low health and nearby ally? Seek help
    if (this.state.health < 50) {
      const ally = observation.nearbyAgents.find(a =>
        a.isAlive && this.state.allegiances.includes(a.id)
      );
      if (ally && this.state.inventory.food > 0) {
        return {
          type: ActionType.COMMUNICATE,
          agentId: this.state.id,
          target: ally.id,
          payload: {
            message: 'I need assistance, I am injured.',
            reason: 'Low health, seeking help from ally',
            llm_decision: false,
          },
        };
      }
    }

    // Nearby resources? Gather
    const nearestResource = observation.visibleTiles.find(t =>
      (t.type === TileType.RESOURCE_FOOD ||
       t.type === TileType.RESOURCE_WATER ||
       t.type === TileType.RESOURCE_MATERIAL) &&
      t.value && t.value > 0
    );

    if (nearestResource) {
      return {
        type: ActionType.GATHER,
        agentId: this.state.id,
        target: nearestResource.position,
        payload: { reason: 'Gathering nearby resources', llm_decision: false },
      };
    }

    // Default: Move randomly
    const randomMove = this.getRandomAdjacentPosition();
    return {
      type: ActionType.MOVE,
      agentId: this.state.id,
      target: randomMove,
      payload: { reason: 'Exploring randomly', llm_decision: false },
    };
  }

  /**
   * Get random adjacent position
   */
  private getRandomAdjacentPosition(): Position {
    const current = this.state.position;
    const directions = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ];

    return directions[Math.floor(Math.random() * directions.length)];
  }
}
