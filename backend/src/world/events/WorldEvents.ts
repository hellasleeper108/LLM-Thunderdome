/**
 * World Events System
 * Manages dynamic world events that affect tiles, agents, and world rules
 */

import { v4 as uuidv4 } from 'uuid';
import {
  WorldEvent,
  WorldEventType,
  EventSeverity,
  EventEffects,
  Position,
  TileType,
  AgentStats,
  ActiveEventEffect,
} from '../../schemas/types';

export interface WorldEventsConfig {
  eventFrequency: number; // Chance of event spawning per turn (0-1)
  maxActiveEvents: number; // Maximum concurrent events
  allowCatastrophicEvents: boolean; // Whether to spawn catastrophic events
}

export class WorldEventsManager {
  private activeEvents: Map<string, WorldEvent>;
  private eventHistory: WorldEvent[];
  private config: Required<WorldEventsConfig>;
  private worldWidth: number;
  private worldHeight: number;

  constructor(worldWidth: number, worldHeight: number, config?: Partial<WorldEventsConfig>) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.config = {
      eventFrequency: config?.eventFrequency ?? 0.15,
      maxActiveEvents: config?.maxActiveEvents ?? 3,
      allowCatastrophicEvents: config?.allowCatastrophicEvents ?? true,
    };
    this.activeEvents = new Map();
    this.eventHistory = [];
  }

  /**
   * Try to spawn a new event this turn
   */
  trySpawnEvent(currentTurn: number): WorldEvent | null {
    // Check if we should spawn an event
    if (Math.random() > this.config.eventFrequency) {
      return null;
    }

    // Check if we've reached max active events
    if (this.activeEvents.size >= this.config.maxActiveEvents) {
      return null;
    }

    // Randomly select event type
    const eventType = this.selectEventType();
    const severity = this.selectSeverity();

    // Don't spawn catastrophic events if disabled
    if (severity === EventSeverity.CATASTROPHIC && !this.config.allowCatastrophicEvents) {
      return this.trySpawnEvent(currentTurn); // Try again with different severity
    }

    // Create event
    const event = this.createEvent(eventType, severity, currentTurn);

    // Add to active events
    this.activeEvents.set(event.id, event);
    this.eventHistory.push(event);

    return event;
  }

  /**
   * Create a specific event
   */
  private createEvent(type: WorldEventType, severity: EventSeverity, currentTurn: number): WorldEvent {
    const epicenter = this.getRandomPosition();
    const radius = this.getEventRadius(severity);
    const duration = this.getEventDuration(severity);

    let effects: EventEffects = {};

    switch (type) {
      case WorldEventType.STORM:
        effects = this.createStormEffects(severity);
        break;
      case WorldEventType.ANOMALY:
        effects = this.createAnomalyEffects(severity);
        break;
      case WorldEventType.RADIATION_ZONE:
        effects = this.createRadiationEffects(severity);
        break;
      case WorldEventType.RESOURCE_BOON:
        effects = this.createResourceBoonEffects(severity);
        break;
      case WorldEventType.CHAOS_SPIKE:
        effects = this.createChaosSpikeEffects(severity);
        break;
      case WorldEventType.SCARCITY_CYCLE:
        effects = this.createScarcityCycleEffects(severity);
        break;
    }

    return {
      id: uuidv4(),
      type,
      severity,
      epicenter,
      radius,
      duration,
      createdAt: Date.now(),
      createdAtTurn: currentTurn,
      expiresAtTurn: currentTurn + duration,
      active: true,
      effects,
      metadata: {
        affectedAgentCount: 0,
        totalDamageDealt: 0,
      },
    };
  }

  /**
   * Create storm effects
   * Storms reduce visibility, drain energy, and make movement difficult
   */
  private createStormEffects(severity: EventSeverity): EventEffects {
    const effects: EventEffects = {
      tileChanges: {
        movementCost: 0,
        damageMultiplier: 1.0,
      },
      agentEffects: {
        energyDrain: 0,
        visionReduction: 0,
      },
    };

    switch (severity) {
      case EventSeverity.MINOR:
        effects.tileChanges!.movementCost = 5;
        effects.agentEffects!.energyDrain = 3;
        effects.agentEffects!.visionReduction = 1;
        break;
      case EventSeverity.MODERATE:
        effects.tileChanges!.movementCost = 10;
        effects.agentEffects!.energyDrain = 7;
        effects.agentEffects!.visionReduction = 2;
        effects.agentEffects!.statModifiers = {
          curiosity: -10,
        };
        break;
      case EventSeverity.SEVERE:
        effects.tileChanges!.movementCost = 15;
        effects.agentEffects!.energyDrain = 12;
        effects.agentEffects!.visionReduction = 3;
        effects.agentEffects!.statModifiers = {
          curiosity: -20,
          riskTolerance: -15,
        };
        break;
      case EventSeverity.CATASTROPHIC:
        effects.tileChanges!.movementCost = 25;
        effects.agentEffects!.energyDrain = 20;
        effects.agentEffects!.visionReduction = 4;
        effects.agentEffects!.healthDamage = 5;
        effects.agentEffects!.statModifiers = {
          curiosity: -30,
          riskTolerance: -25,
          aggression: -10,
        };
        break;
    }

    return effects;
  }

  /**
   * Create anomaly effects
   * Anomalies have unpredictable effects, can confuse agents
   */
  private createAnomalyEffects(severity: EventSeverity): EventEffects {
    const effects: EventEffects = {
      tileChanges: {
        damageMultiplier: 1.0,
      },
      agentEffects: {
        confused: false,
        statModifiers: {},
      },
    };

    switch (severity) {
      case EventSeverity.MINOR:
        effects.agentEffects!.statModifiers = {
          curiosity: 15, // Anomalies attract curious agents
        };
        break;
      case EventSeverity.MODERATE:
        effects.agentEffects!.confused = true;
        effects.agentEffects!.statModifiers = {
          curiosity: 20,
          riskTolerance: -10,
        };
        break;
      case EventSeverity.SEVERE:
        effects.agentEffects!.confused = true;
        effects.agentEffects!.healthDamage = 8;
        effects.agentEffects!.statModifiers = {
          curiosity: 25,
          riskTolerance: -20,
          empathy: -15,
        };
        break;
      case EventSeverity.CATASTROPHIC:
        effects.agentEffects!.confused = true;
        effects.agentEffects!.healthDamage = 15;
        effects.agentEffects!.energyDrain = 10;
        effects.tileChanges!.convertToType = TileType.EVENT_ANOMALY;
        effects.agentEffects!.statModifiers = {
          curiosity: 30,
          riskTolerance: -30,
          empathy: -25,
          cooperation: -20,
        };
        effects.worldRules = {
          disableCommunication: true,
        };
        break;
    }

    return effects;
  }

  /**
   * Create radiation zone effects
   * Radiation damages health over time and reduces stats
   */
  private createRadiationEffects(severity: EventSeverity): EventEffects {
    const effects: EventEffects = {
      tileChanges: {
        damageMultiplier: 1.5,
      },
      agentEffects: {
        healthDamage: 0,
        energyDrain: 0,
        statModifiers: {},
      },
    };

    switch (severity) {
      case EventSeverity.MINOR:
        effects.agentEffects!.healthDamage = 4;
        effects.agentEffects!.energyDrain = 5;
        effects.agentEffects!.statModifiers = {
          energy: -5,
        };
        break;
      case EventSeverity.MODERATE:
        effects.agentEffects!.healthDamage = 8;
        effects.agentEffects!.energyDrain = 10;
        effects.agentEffects!.statModifiers = {
          energy: -10,
          aggression: 10, // Radiation makes agents more aggressive
        };
        break;
      case EventSeverity.SEVERE:
        effects.agentEffects!.healthDamage = 15;
        effects.agentEffects!.energyDrain = 15;
        effects.agentEffects!.statModifiers = {
          energy: -20,
          aggression: 20,
          empathy: -15,
        };
        effects.worldRules = {
          disableGathering: true, // Radiation contaminates resources
        };
        break;
      case EventSeverity.CATASTROPHIC:
        effects.agentEffects!.healthDamage = 25;
        effects.agentEffects!.energyDrain = 20;
        effects.agentEffects!.statModifiers = {
          energy: -30,
          aggression: 30,
          empathy: -25,
          cooperation: -20,
        };
        effects.worldRules = {
          disableGathering: true,
          disableAlliances: true, // Extreme radiation breaks down social bonds
        };
        break;
    }

    return effects;
  }

  /**
   * Create resource boon effects
   * Boons are positive events that increase resources and buff agents
   */
  private createResourceBoonEffects(severity: EventSeverity): EventEffects {
    const effects: EventEffects = {
      tileChanges: {
        resourceMultiplier: 1.0,
      },
      agentEffects: {
        buffed: true,
        statModifiers: {},
      },
    };

    switch (severity) {
      case EventSeverity.MINOR:
        effects.tileChanges!.resourceMultiplier = 1.5;
        effects.agentEffects!.statModifiers = {
          energy: 5,
          cooperation: 5,
        };
        break;
      case EventSeverity.MODERATE:
        effects.tileChanges!.resourceMultiplier = 2.0;
        effects.agentEffects!.statModifiers = {
          energy: 10,
          cooperation: 10,
          empathy: 5,
        };
        break;
      case EventSeverity.SEVERE:
        effects.tileChanges!.resourceMultiplier = 3.0;
        effects.agentEffects!.statModifiers = {
          energy: 15,
          cooperation: 15,
          empathy: 10,
          curiosity: 10,
        };
        break;
      case EventSeverity.CATASTROPHIC:
        effects.tileChanges!.resourceMultiplier = 5.0;
        effects.tileChanges!.convertToType = TileType.EVENT_BOON;
        effects.agentEffects!.statModifiers = {
          energy: 25,
          cooperation: 20,
          empathy: 15,
          curiosity: 15,
        };
        break;
    }

    return effects;
  }

  /**
   * Create chaos spike effects
   * Chaos increases aggression, reduces cooperation, and creates conflict
   */
  private createChaosSpikeEffects(severity: EventSeverity): EventEffects {
    const effects: EventEffects = {
      agentEffects: {
        statModifiers: {},
      },
      worldRules: {
        globalAggressionIncrease: 0,
        globalFearIncrease: 0,
      },
    };

    switch (severity) {
      case EventSeverity.MINOR:
        effects.agentEffects!.statModifiers = {
          aggression: 10,
          cooperation: -10,
        };
        effects.worldRules!.globalAggressionIncrease = 5;
        break;
      case EventSeverity.MODERATE:
        effects.agentEffects!.statModifiers = {
          aggression: 20,
          cooperation: -20,
          empathy: -10,
        };
        effects.worldRules!.globalAggressionIncrease = 10;
        effects.worldRules!.globalFearIncrease = 5;
        break;
      case EventSeverity.SEVERE:
        effects.agentEffects!.statModifiers = {
          aggression: 30,
          cooperation: -30,
          empathy: -20,
          riskTolerance: 15,
        };
        effects.worldRules!.globalAggressionIncrease = 15;
        effects.worldRules!.globalFearIncrease = 10;
        effects.worldRules!.disableAlliances = true;
        break;
      case EventSeverity.CATASTROPHIC:
        effects.agentEffects!.statModifiers = {
          aggression: 40,
          cooperation: -40,
          empathy: -30,
          riskTolerance: 25,
        };
        effects.worldRules!.globalAggressionIncrease = 25;
        effects.worldRules!.globalFearIncrease = 20;
        effects.worldRules!.disableAlliances = true;
        effects.worldRules!.doubleResourceCost = true;
        break;
    }

    return effects;
  }

  /**
   * Create scarcity cycle effects
   * Scarcity reduces available resources globally
   */
  private createScarcityCycleEffects(severity: EventSeverity): EventEffects {
    const effects: EventEffects = {
      tileChanges: {
        resourceMultiplier: 1.0,
      },
      agentEffects: {
        statModifiers: {},
      },
      worldRules: {},
    };

    switch (severity) {
      case EventSeverity.MINOR:
        effects.tileChanges!.resourceMultiplier = 0.7;
        effects.agentEffects!.statModifiers = {
          cooperation: -5,
          aggression: 5,
        };
        break;
      case EventSeverity.MODERATE:
        effects.tileChanges!.resourceMultiplier = 0.5;
        effects.agentEffects!.statModifiers = {
          cooperation: -10,
          aggression: 10,
          empathy: -5,
        };
        effects.worldRules!.globalFearIncrease = 5;
        break;
      case EventSeverity.SEVERE:
        effects.tileChanges!.resourceMultiplier = 0.3;
        effects.agentEffects!.statModifiers = {
          cooperation: -20,
          aggression: 20,
          empathy: -15,
        };
        effects.worldRules!.globalFearIncrease = 10;
        effects.worldRules!.doubleResourceCost = true;
        break;
      case EventSeverity.CATASTROPHIC:
        effects.tileChanges!.resourceMultiplier = 0.1;
        effects.agentEffects!.statModifiers = {
          cooperation: -30,
          aggression: 30,
          empathy: -25,
        };
        effects.worldRules!.globalFearIncrease = 20;
        effects.worldRules!.doubleResourceCost = true;
        effects.worldRules!.disableGathering = true;
        break;
    }

    return effects;
  }

  /**
   * Update active events (expire old ones)
   */
  updateEvents(currentTurn: number): void {
    const expiredEventIds: string[] = [];

    for (const [eventId, event] of this.activeEvents.entries()) {
      if (currentTurn >= event.expiresAtTurn) {
        event.active = false;
        expiredEventIds.push(eventId);
      }
    }

    // Remove expired events
    for (const eventId of expiredEventIds) {
      this.activeEvents.delete(eventId);
    }
  }

  /**
   * Check if a position is affected by any active event
   */
  getEventsAffectingPosition(position: Position): WorldEvent[] {
    const affectedBy: WorldEvent[] = [];

    for (const event of this.activeEvents.values()) {
      if (this.isPositionInEventRadius(position, event)) {
        affectedBy.push(event);
      }
    }

    return affectedBy;
  }

  /**
   * Check if position is within event radius
   */
  private isPositionInEventRadius(position: Position, event: WorldEvent): boolean {
    const distance = Math.abs(position.x - event.epicenter.x) + Math.abs(position.y - event.epicenter.y);
    return distance <= event.radius;
  }

  /**
   * Get all active events
   */
  getActiveEvents(): WorldEvent[] {
    return Array.from(this.activeEvents.values());
  }

  /**
   * Get event by ID
   */
  getEvent(eventId: string): WorldEvent | undefined {
    return this.activeEvents.get(eventId);
  }

  /**
   * Get event history
   */
  getEventHistory(): WorldEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Get random position in world
   */
  private getRandomPosition(): Position {
    return {
      x: Math.floor(Math.random() * this.worldWidth),
      y: Math.floor(Math.random() * this.worldHeight),
    };
  }

  /**
   * Determine event radius based on severity
   */
  private getEventRadius(severity: EventSeverity): number {
    switch (severity) {
      case EventSeverity.MINOR:
        return 2;
      case EventSeverity.MODERATE:
        return 4;
      case EventSeverity.SEVERE:
        return 6;
      case EventSeverity.CATASTROPHIC:
        return 10;
    }
  }

  /**
   * Determine event duration based on severity
   */
  private getEventDuration(severity: EventSeverity): number {
    switch (severity) {
      case EventSeverity.MINOR:
        return 3; // 3 turns
      case EventSeverity.MODERATE:
        return 5; // 5 turns
      case EventSeverity.SEVERE:
        return 8; // 8 turns
      case EventSeverity.CATASTROPHIC:
        return 12; // 12 turns
    }
  }

  /**
   * Randomly select event type
   */
  private selectEventType(): WorldEventType {
    const types = [
      WorldEventType.STORM,
      WorldEventType.ANOMALY,
      WorldEventType.RADIATION_ZONE,
      WorldEventType.RESOURCE_BOON,
      WorldEventType.CHAOS_SPIKE,
      WorldEventType.SCARCITY_CYCLE,
    ];

    return types[Math.floor(Math.random() * types.length)];
  }

  /**
   * Randomly select severity with weighted probability
   */
  private selectSeverity(): EventSeverity {
    const rand = Math.random();

    if (rand < 0.5) {
      return EventSeverity.MINOR; // 50% chance
    } else if (rand < 0.8) {
      return EventSeverity.MODERATE; // 30% chance
    } else if (rand < 0.95) {
      return EventSeverity.SEVERE; // 15% chance
    } else {
      return EventSeverity.CATASTROPHIC; // 5% chance
    }
  }

  /**
   * Reset event system
   */
  reset(): void {
    this.activeEvents.clear();
    this.eventHistory = [];
  }

  /**
   * Get statistics about events
   */
  getStatistics(): {
    totalEventsSpawned: number;
    activeEventsCount: number;
    eventTypeBreakdown: Record<WorldEventType, number>;
    severityBreakdown: Record<EventSeverity, number>;
  } {
    const eventTypeBreakdown: Record<WorldEventType, number> = {
      [WorldEventType.STORM]: 0,
      [WorldEventType.ANOMALY]: 0,
      [WorldEventType.RADIATION_ZONE]: 0,
      [WorldEventType.RESOURCE_BOON]: 0,
      [WorldEventType.CHAOS_SPIKE]: 0,
      [WorldEventType.SCARCITY_CYCLE]: 0,
    };

    const severityBreakdown: Record<EventSeverity, number> = {
      [EventSeverity.MINOR]: 0,
      [EventSeverity.MODERATE]: 0,
      [EventSeverity.SEVERE]: 0,
      [EventSeverity.CATASTROPHIC]: 0,
    };

    for (const event of this.eventHistory) {
      eventTypeBreakdown[event.type]++;
      severityBreakdown[event.severity]++;
    }

    return {
      totalEventsSpawned: this.eventHistory.length,
      activeEventsCount: this.activeEvents.size,
      eventTypeBreakdown,
      severityBreakdown,
    };
  }
}
