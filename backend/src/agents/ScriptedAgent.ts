/**
 * Scripted Agent
 * Uses predefined rules and strategies to make decisions
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

export type Strategy = 'aggressive' | 'defensive' | 'gatherer' | 'explorer' | 'social';

export interface ScriptedAgentConfig {
  strategy: Strategy;
  priorityActions?: ActionType[];
}

export class ScriptedAgent extends BaseAgent {
  private config: ScriptedAgentConfig;

  constructor(
    name: string,
    personality: Personality,
    position: Position,
    goals: Goal[],
    config: ScriptedAgentConfig
  ) {
    super(name, personality, position, goals);
    this.config = config;
  }

  /**
   * Decide action based on strategy
   */
  async decideAction(observation: Observation): Promise<Action> {
    this.observe(observation);

    // Always prioritize survival
    if (this.state.health < 20) {
      return this.survivalAction(observation);
    }

    // Execute strategy-specific behavior
    switch (this.config.strategy) {
      case 'aggressive':
        return this.aggressiveStrategy(observation);
      case 'defensive':
        return this.defensiveStrategy(observation);
      case 'gatherer':
        return this.gathererStrategy(observation);
      case 'explorer':
        return this.explorerStrategy(observation);
      case 'social':
        return this.socialStrategy(observation);
      default:
        return this.defaultAction();
    }
  }

  /**
   * Survival action when health is critical
   */
  private survivalAction(observation: Observation): Action {
    // Try to rest if we have food
    if (this.state.inventory.food > 0) {
      return {
        type: ActionType.REST,
        agentId: this.state.id,
      };
    }

    // Flee from danger
    const threat = observation.nearbyAgents.find(a =>
      a.isAlive && !this.state.allegiances.includes(a.id) && a.stats.aggression > 60
    );

    if (threat) {
      const fleePosition = this.getFleePosition(threat.position);
      return {
        type: ActionType.MOVE,
        agentId: this.state.id,
        target: fleePosition,
      };
    }

    // Try to gather food
    const food = observation.visibleTiles.find(t => t.type === 'resource_food');
    if (food) {
      return {
        type: ActionType.GATHER,
        agentId: this.state.id,
        target: food.position,
      };
    }

    return this.defaultAction();
  }

  /**
   * Aggressive strategy: Attack and dominate
   */
  private aggressiveStrategy(observation: Observation): Action {
    // Look for targets to attack
    const targets = observation.nearbyAgents
      .filter(a => a.isAlive && !this.state.allegiances.includes(a.id))
      .sort((a, b) => {
        // Prioritize weak targets with resources
        const scoreA = (100 - a.health) + (a.inventory.food + a.inventory.water) * 10;
        const scoreB = (100 - b.health) + (b.inventory.food + b.inventory.water) * 10;
        return scoreB - scoreA;
      });

    if (targets.length > 0) {
      return {
        type: ActionType.ATTACK,
        agentId: this.state.id,
        target: targets[0].id,
      };
    }

    // No targets? Gather resources to sustain aggression
    const resource = observation.visibleTiles.find(t =>
      t.type.startsWith('resource') && t.value && t.value > 0
    );

    if (resource) {
      return {
        type: ActionType.GATHER,
        agentId: this.state.id,
        target: resource.position,
      };
    }

    // Move toward center of map (where agents congregate)
    return {
      type: ActionType.MOVE,
      agentId: this.state.id,
      target: this.getRandomAdjacentPosition(),
    };
  }

  /**
   * Defensive strategy: Avoid conflict, build alliances
   */
  private defensiveStrategy(observation: Observation): Action {
    // If threatened, flee
    const threat = observation.nearbyAgents.find(a =>
      a.isAlive && !this.state.allegiances.includes(a.id) && a.stats.aggression > 50
    );

    if (threat) {
      const fleePosition = this.getFleePosition(threat.position);
      return {
        type: ActionType.MOVE,
        agentId: this.state.id,
        target: fleePosition,
      };
    }

    // Build alliances with peaceful agents
    const potential_ally = observation.nearbyAgents.find(a =>
      a.isAlive &&
      !this.state.allegiances.includes(a.id) &&
      a.stats.aggression < 50 &&
      a.stats.cooperation > 50
    );

    if (potential_ally) {
      return {
        type: ActionType.FORM_ALLIANCE,
        agentId: this.state.id,
        target: potential_ally.id,
        payload: { message: 'Safety in numbers. Let us cooperate.' },
      };
    }

    // Gather resources safely
    const resource = observation.visibleTiles.find(t =>
      t.type.startsWith('resource') && t.value && t.value > 0
    );

    if (resource) {
      // Check if resource is safe (no aggressive agents nearby)
      const dangerNearResource = observation.nearbyAgents.some(a =>
        a.isAlive &&
        !this.state.allegiances.includes(a.id) &&
        a.stats.aggression > 60 &&
        this.getDistance(a.position) < 3
      );

      if (!dangerNearResource) {
        return {
          type: ActionType.GATHER,
          agentId: this.state.id,
          target: resource.position,
        };
      }
    }

    return this.defaultAction();
  }

  /**
   * Gatherer strategy: Focus on collecting resources
   */
  private gathererStrategy(observation: Observation): Action {
    // Find the most valuable resource
    const resources = observation.visibleTiles
      .filter(t => t.type.startsWith('resource') && t.value && t.value > 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    if (resources.length > 0) {
      return {
        type: ActionType.GATHER,
        agentId: this.state.id,
        target: resources[0].position,
      };
    }

    // If inventory is full and allies exist, share with them
    const totalInventory = this.state.inventory.food + this.state.inventory.water + this.state.inventory.material;
    if (totalInventory > 10 && this.state.allegiances.length > 0) {
      const ally = observation.nearbyAgents.find(a =>
        a.isAlive && this.state.allegiances.includes(a.id)
      );

      if (ally) {
        const resource = this.state.inventory.food > 0 ? 'food' :
                        this.state.inventory.water > 0 ? 'water' : 'material';
        return {
          type: ActionType.SHARE,
          agentId: this.state.id,
          target: ally.id,
          payload: { resource, amount: 2 },
        };
      }
    }

    // Explore to find more resources
    return {
      type: ActionType.EXPLORE,
      agentId: this.state.id,
      target: this.getRandomAdjacentPosition(),
    };
  }

  /**
   * Explorer strategy: Discover new areas
   */
  private explorerStrategy(observation: Observation): Action {
    // Move to unvisited areas
    const unexplored = this.findUnexploredDirection();

    return {
      type: ActionType.EXPLORE,
      agentId: this.state.id,
      target: unexplored,
    };
  }

  /**
   * Social strategy: Communicate and negotiate
   */
  private socialStrategy(observation: Observation): Action {
    // Try to form alliances
    const potential_ally = observation.nearbyAgents.find(a =>
      a.isAlive && !this.state.allegiances.includes(a.id)
    );

    if (potential_ally && this.state.allegiances.length < 3) {
      return {
        type: ActionType.NEGOTIATE,
        agentId: this.state.id,
        target: potential_ally.id,
        payload: {
          message: 'I propose we work together. What do you need?',
          offer: { food: 1 }
        },
      };
    }

    // Communicate with allies
    if (this.state.allegiances.length > 0) {
      const ally = observation.nearbyAgents.find(a =>
        a.isAlive && this.state.allegiances.includes(a.id)
      );

      if (ally && Math.random() > 0.7) {
        return {
          type: ActionType.COMMUNICATE,
          agentId: this.state.id,
          target: ally.id,
          payload: {
            message: this.generateSocialMessage(observation)
          },
        };
      }
    }

    // Gather resources to have something to trade
    const resource = observation.visibleTiles.find(t =>
      t.type.startsWith('resource') && t.value && t.value > 0
    );

    if (resource) {
      return {
        type: ActionType.GATHER,
        agentId: this.state.id,
        target: resource.position,
      };
    }

    return this.defaultAction();
  }

  /**
   * Generate contextual social message
   */
  private generateSocialMessage(observation: Observation): string {
    const messages = [
      'How are you holding up?',
      'I found some resources nearby if you need them.',
      'Stay safe out there.',
      'Let me know if you need anything.',
      'We should coordinate our efforts.',
    ];

    return messages[Math.floor(Math.random() * messages.length)];
  }

  /**
   * Find unexplored direction
   */
  private findUnexploredDirection(): Position {
    const current = this.state.position;
    const visited = new Set(
      this.state.memory.longTerm
        .filter(m => m.metadata?.position)
        .map(m => `${m.metadata.position.x},${m.metadata.position.y}`)
    );

    const directions = [
      { x: current.x + 2, y: current.y },
      { x: current.x - 2, y: current.y },
      { x: current.x, y: current.y + 2 },
      { x: current.x, y: current.y - 2 },
    ];

    const unvisited = directions.find(d => !visited.has(`${d.x},${d.y}`));
    return unvisited || this.getRandomAdjacentPosition();
  }

  /**
   * Get flee position (away from threat)
   */
  private getFleePosition(threatPos: Position): Position {
    const current = this.state.position;
    const dx = current.x - threatPos.x;
    const dy = current.y - threatPos.y;

    // Move in opposite direction of threat
    return {
      x: current.x + (dx > 0 ? 1 : -1),
      y: current.y + (dy > 0 ? 1 : -1),
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

  /**
   * Default action when nothing else applies
   */
  private defaultAction(): Action {
    return {
      type: ActionType.REST,
      agentId: this.state.id,
    };
  }

  /**
   * Get distance helper
   */
  private getDistance(pos: Position): number {
    return Math.abs(this.state.position.x - pos.x) + Math.abs(this.state.position.y - pos.y);
  }
}
