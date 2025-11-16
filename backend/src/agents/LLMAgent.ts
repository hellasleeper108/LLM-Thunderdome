/**
 * LLM Agent
 * Uses a language model to make decisions based on observations
 */

import { BaseAgent } from './BaseAgent';
import {
  Action,
  ActionType,
  Observation,
  Position,
  Goal,
  Personality,
} from '../schemas/types';

export interface LLMConfig {
  endpoint?: string; // OpenAI-style endpoint
  apiKey?: string;
  model?: string;
  mock?: boolean; // Use mock mode for testing
}

export class LLMAgent extends BaseAgent {
  private llmConfig: LLMConfig;

  constructor(
    name: string,
    personality: Personality,
    position: Position,
    goals: Goal[],
    llmConfig: LLMConfig = { mock: true }
  ) {
    super(name, personality, position, goals);
    this.llmConfig = llmConfig;
  }

  /**
   * Use LLM to decide on next action
   */
  async decideAction(observation: Observation): Promise<Action> {
    this.observe(observation);

    if (this.llmConfig.mock) {
      return this.mockLLMDecision(observation);
    }

    return this.callLLM(observation);
  }

  /**
   * Call actual LLM endpoint (OpenAI-compatible)
   */
  private async callLLM(observation: Observation): Promise<Action> {
    const prompt = this.buildPrompt(observation);

    try {
      const response = await fetch(`${this.llmConfig.endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.llmConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: this.llmConfig.model || 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `You are ${this.state.name}, a simulation agent. ${this.state.personality.description}`,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
        }),
      });

      const data = await response.json();
      const actionText = data.choices[0].message.content;

      return this.parseActionFromLLM(actionText, observation);
    } catch (error) {
      console.error('LLM call failed, falling back to mock:', error);
      return this.mockLLMDecision(observation);
    }
  }

  /**
   * Build prompt for LLM
   */
  private buildPrompt(observation: Observation): string {
    const goals = this.state.goals.filter(g => !g.completed).map(g => g.description).join(', ');
    const stats = JSON.stringify(observation.currentStats, null, 2);
    const inventory = JSON.stringify(observation.inventory, null, 2);
    const recentMemory = this.state.memory.shortTerm.slice(-5).map(m => m.content).join('\n');

    return `
Current Status:
- Position: (${this.state.position.x}, ${this.state.position.y})
- Health: ${this.state.health}
- Stats: ${stats}
- Inventory: ${inventory}
- Goals: ${goals}

Recent Memory:
${recentMemory}

Observation:
- Nearby agents: ${observation.nearbyAgents.length}
- Visible resources: ${observation.visibleTiles.filter(t => t.type.startsWith('resource')).length}
- Recent messages: ${observation.recentMessages.length}

Available Actions: MOVE, GATHER, ATTACK, COMMUNICATE, REST, SHARE, EXPLORE, NEGOTIATE, FORM_ALLIANCE, BREAK_ALLIANCE

Based on your personality (${this.state.personality.description}) and current goals, what action do you take?
Respond with a JSON object: {"action": "ACTION_TYPE", "target": {"x": 0, "y": 0}, "message": "optional message"}
    `.trim();
  }

  /**
   * Parse LLM response into an Action
   */
  private parseActionFromLLM(response: string, observation: Observation): Action {
    try {
      const parsed = JSON.parse(response);
      const actionType = parsed.action as ActionType;

      return {
        type: actionType,
        agentId: this.state.id,
        target: parsed.target || parsed.targetAgent,
        payload: { message: parsed.message },
      };
    } catch {
      // If parsing fails, default to a safe action
      return this.mockLLMDecision(observation);
    }
  }

  /**
   * Mock LLM decision-making (rule-based AI)
   * This provides intelligent behavior without requiring an actual LLM
   */
  private mockLLMDecision(observation: Observation): Action {
    const state = this.state;

    // Low energy? Rest or gather food
    if (state.stats.energy < 30) {
      if (state.inventory.food > 0) {
        return {
          type: ActionType.REST,
          agentId: state.id,
        };
      } else {
        const foodTile = observation.visibleTiles.find(t => t.type === 'resource_food');
        if (foodTile) {
          return {
            type: ActionType.GATHER,
            agentId: state.id,
            target: foodTile.position,
          };
        }
      }
    }

    // Low health and high empathy? Seek alliance
    if (state.health < 50 && state.stats.empathy > 60) {
      const nearbyAgent = observation.nearbyAgents.find(a => a.isAlive && !state.allegiances.includes(a.id));
      if (nearbyAgent) {
        return {
          type: ActionType.FORM_ALLIANCE,
          agentId: state.id,
          target: nearbyAgent.id,
          payload: { message: 'Let us work together for mutual benefit.' },
        };
      }
    }

    // High aggression and nearby enemy? Attack
    if (state.stats.aggression > 70) {
      const enemy = observation.nearbyAgents.find(
        a => a.isAlive && !state.allegiances.includes(a.id) && a.inventory.food + a.inventory.water > 5
      );
      if (enemy) {
        return {
          type: ActionType.ATTACK,
          agentId: state.id,
          target: enemy.id,
        };
      }
    }

    // High cooperation and ally needs help? Share
    if (state.stats.cooperation > 70) {
      const needyAlly = observation.nearbyAgents.find(
        a => a.isAlive && state.allegiances.includes(a.id) && a.stats.energy < 40
      );
      if (needyAlly && state.inventory.food > 2) {
        return {
          type: ActionType.SHARE,
          agentId: state.id,
          target: needyAlly.id,
          payload: { resource: 'food', amount: 1 },
        };
      }
    }

    // High curiosity? Explore
    if (state.stats.curiosity > 60) {
      const unexplored = this.findUnexploredPosition(observation);
      if (unexplored) {
        return {
          type: ActionType.EXPLORE,
          agentId: state.id,
          target: unexplored,
        };
      }
    }

    // Default: gather nearest resource
    const nearestResource = observation.visibleTiles.find(t =>
      t.type.startsWith('resource') && t.value && t.value > 0
    );

    if (nearestResource) {
      return {
        type: ActionType.GATHER,
        agentId: state.id,
        target: nearestResource.position,
      };
    }

    // Nothing to do? Move randomly
    const randomMove = this.getRandomAdjacentPosition();
    return {
      type: ActionType.MOVE,
      agentId: state.id,
      target: randomMove,
    };
  }

  /**
   * Find an unexplored position
   */
  private findUnexploredPosition(observation: Observation): Position | null {
    const visited = new Set(this.state.memory.longTerm
      .filter(m => m.type === 'observation')
      .map(m => m.metadata?.position)
      .filter(Boolean)
      .map(p => `${p.x},${p.y}`)
    );

    const current = this.state.position;
    const candidates: Position[] = [
      { x: current.x + 2, y: current.y },
      { x: current.x - 2, y: current.y },
      { x: current.x, y: current.y + 2 },
      { x: current.x, y: current.y - 2 },
    ];

    const unvisited = candidates.find(p => !visited.has(`${p.x},${p.y}`));
    return unvisited || null;
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
