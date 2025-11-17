/**
 * Belief System
 * Manages emergent religion-like structures built on factions, laws, and events
 */

import { v4 as uuidv4 } from 'uuid';
import { Faction } from './FactionManager';
import { BaseAgent } from '../agents/BaseAgent';
import { EventLog } from '../schemas/types';

/**
 * Trigger conditions for rituals
 */
export type RitualTriggerCondition =
  | 'RESOURCE_THRESHOLD'
  | 'DEATH_EVENT'
  | 'ALLIANCE_FORMED'
  | 'DISASTER'
  | 'CUSTOM';

/**
 * A belief system that can emerge from dramatic events
 */
export interface Belief {
  id: string;
  name: string;
  originEventId?: string;
  originTurn?: number;
  coreTenets: string[];
  tabooActions: string[]; // action types or symbolic labels
  favoredActions: string[];
  symbols: string[]; // short tags or keywords
  associatedFactions: string[]; // factionIds
  zeal: number; // 0-1: how strongly adherents act on it
  adherentCount: number; // Number of agents following this belief
  founded: number; // timestamp
}

/**
 * A ritual that can be performed by believers
 */
export interface Ritual {
  id: string;
  name: string;
  beliefId: string;
  triggerCondition: RitualTriggerCondition;
  triggerData?: Record<string, any>;
  actions: string[]; // symbolic descriptions of ritual steps
  mechanicalEffects?: {
    moraleBoost?: number;
    cohesionBoost?: number;
    aggressionDelta?: number;
    cooperationDelta?: number;
    energyBoost?: number;
  };
  timesPerformed: number;
  lastPerformed?: number; // turn number
}

/**
 * Belief System manager
 * Handles creation, tracking, and ritual execution for emergent religions
 */
export class BeliefSystem {
  private beliefs: Map<string, Belief> = new Map();
  private rituals: Map<string, Ritual> = new Map();
  private factionBeliefs: Map<string, Set<string>> = new Map(); // factionId -> beliefIds
  private eventThreshold: number; // How dramatic an event must be to spawn belief

  constructor(eventThreshold: number = 0.7) {
    this.eventThreshold = eventThreshold;
  }

  /**
   * Create a new belief from a dramatic event
   */
  createBeliefFromEvent(event: EventLog, factionsInvolved: Faction[]): Belief {
    const beliefId = uuidv4();

    // Generate belief attributes based on event type
    const { name, tenets, taboos, favored, symbols } = this.generateBeliefAttributes(
      event,
      factionsInvolved
    );

    const belief: Belief = {
      id: beliefId,
      name,
      originEventId: event.metadata?.eventId,
      originTurn: event.turn,
      coreTenets: tenets,
      tabooActions: taboos,
      favoredActions: favored,
      symbols,
      associatedFactions: factionsInvolved.map(f => f.id),
      zeal: this.calculateInitialZeal(event, factionsInvolved),
      adherentCount: factionsInvolved.reduce((sum, f) => sum + f.members.size, 0),
      founded: Date.now(),
    };

    this.beliefs.set(beliefId, belief);

    // Associate with factions
    factionsInvolved.forEach(faction => {
      this.attachBeliefToFaction(beliefId, faction.id);
    });

    console.log(`[BeliefSystem] New belief "${name}" emerged from ${event.type} event`);

    return belief;
  }

  /**
   * Generate belief attributes based on event characteristics
   */
  private generateBeliefAttributes(
    event: EventLog,
    factions: Faction[]
  ): {
    name: string;
    tenets: string[];
    taboos: string[];
    favored: string[];
    symbols: string[];
  } {
    const eventType = event.type.toLowerCase();

    // Determine belief theme based on event
    if (eventType.includes('death') || eventType.includes('kill')) {
      return {
        name: 'The Eternal Vigil',
        tenets: [
          'Death is a passage, not an end',
          'The fallen watch over the living',
          'Strength through remembrance',
        ],
        taboos: ['ATTACK', 'BETRAY'],
        favored: ['REST', 'COMMUNICATE', 'FORM_ALLIANCE'],
        symbols: ['☠️', '🕯️', '⚰️'],
      };
    } else if (eventType.includes('alliance') || eventType.includes('cooperation')) {
      return {
        name: 'The United Path',
        tenets: [
          'Unity is sacred',
          'The many are stronger than the one',
          'Trust begets prosperity',
        ],
        taboos: ['BREAK_ALLIANCE', 'ATTACK'],
        favored: ['FORM_ALLIANCE', 'SHARE', 'COMMUNICATE'],
        symbols: ['🤝', '🔗', '⭐'],
      };
    } else if (eventType.includes('disaster') || eventType.includes('storm')) {
      return {
        name: 'Cult of the Tempest',
        tenets: [
          'Chaos is the natural order',
          'Survival through adaptation',
          'The storm tests the worthy',
        ],
        taboos: ['REST', 'SHARE'],
        favored: ['EXPLORE', 'GATHER', 'MOVE'],
        symbols: ['⚡', '🌪️', '🔥'],
      };
    } else if (eventType.includes('resource') || eventType.includes('gather')) {
      return {
        name: 'The Keepers of Plenty',
        tenets: [
          'Resources are gifts from the world',
          'Waste is the greatest sin',
          'Share abundance, hoard necessity',
        ],
        taboos: ['ATTACK', 'STEAL'],
        favored: ['GATHER', 'SHARE', 'REST'],
        symbols: ['🌾', '💎', '🏺'],
      };
    } else if (eventType.includes('conflict') || eventType.includes('attack')) {
      return {
        name: 'The Way of Steel',
        tenets: [
          'Strength defines truth',
          'Honor in combat',
          'Victory through discipline',
        ],
        taboos: ['BETRAY', 'FLEE'],
        favored: ['ATTACK', 'REST', 'TRAIN'],
        symbols: ['⚔️', '🛡️', '🔱'],
      };
    }

    // Default/generic belief for unrecognized events
    return {
      name: 'The Observers',
      tenets: [
        'All events have meaning',
        'Patterns reveal truth',
        'Understanding precedes action',
      ],
      taboos: ['RUSH', 'IGNORE'],
      favored: ['OBSERVE', 'COMMUNICATE', 'REST'],
      symbols: ['👁️', '📜', '🔮'],
    };
  }

  /**
   * Calculate initial zeal based on event drama and faction involvement
   */
  private calculateInitialZeal(event: EventLog, factions: Faction[]): number {
    let zeal = 0.5; // Base zeal

    // More dramatic events = higher zeal
    if (event.agentIds.length > 3) zeal += 0.1;
    if (event.type.includes('DEATH')) zeal += 0.2;
    if (event.type.includes('DISASTER')) zeal += 0.15;

    // More factions involved = higher zeal
    zeal += Math.min(0.2, factions.length * 0.05);

    // High cohesion factions = more receptive to beliefs
    const avgCohesion =
      factions.reduce((sum, f) => sum + f.cohesion, 0) / factions.length;
    zeal += avgCohesion * 0.1;

    return Math.min(1.0, zeal);
  }

  /**
   * Attach a belief to a faction
   */
  attachBeliefToFaction(beliefId: string, factionId: string): boolean {
    const belief = this.beliefs.get(beliefId);
    if (!belief) {
      console.warn(`[BeliefSystem] Belief ${beliefId} not found`);
      return false;
    }

    // Add to faction's beliefs
    if (!this.factionBeliefs.has(factionId)) {
      this.factionBeliefs.set(factionId, new Set());
    }
    this.factionBeliefs.get(factionId)!.add(beliefId);

    // Add faction to belief's associated factions if not already present
    if (!belief.associatedFactions.includes(factionId)) {
      belief.associatedFactions.push(factionId);
    }

    return true;
  }

  /**
   * Register a ritual for a belief
   */
  registerRitual(beliefId: string, ritual: Omit<Ritual, 'id' | 'timesPerformed'>): Ritual {
    const belief = this.beliefs.get(beliefId);
    if (!belief) {
      throw new Error(`[BeliefSystem] Cannot register ritual: Belief ${beliefId} not found`);
    }

    const ritualId = uuidv4();
    const fullRitual: Ritual = {
      id: ritualId,
      timesPerformed: 0,
      ...ritual,
    };

    this.rituals.set(ritualId, fullRitual);

    console.log(`[BeliefSystem] Ritual "${ritual.name}" registered for belief "${belief.name}"`);

    return fullRitual;
  }

  /**
   * Get all beliefs for a faction
   */
  getBeliefsForFaction(factionId: string): Belief[] {
    const beliefIds = this.factionBeliefs.get(factionId);
    if (!beliefIds) return [];

    return Array.from(beliefIds)
      .map(id => this.beliefs.get(id))
      .filter((b): b is Belief => b !== undefined);
  }

  /**
   * Get all rituals for a faction (through its beliefs)
   */
  getRitualsForFaction(factionId: string): Ritual[] {
    const beliefs = this.getBeliefsForFaction(factionId);
    const beliefIds = new Set(beliefs.map(b => b.id));

    return Array.from(this.rituals.values()).filter(r => beliefIds.has(r.beliefId));
  }

  /**
   * Evaluate which rituals should trigger based on current world state
   */
  evaluateRitualTriggers(
    worldState: {
      turn: number;
      totalResources: number;
      recentDeaths: number;
      alliancesFormed: number;
      disasters: number;
    },
    eventsThisTurn: EventLog[]
  ): Ritual[] {
    const triggeredRituals: Ritual[] = [];

    for (const ritual of this.rituals.values()) {
      let shouldTrigger = false;

      switch (ritual.triggerCondition) {
        case 'RESOURCE_THRESHOLD':
          const threshold = ritual.triggerData?.threshold || 100;
          shouldTrigger = worldState.totalResources < threshold;
          break;

        case 'DEATH_EVENT':
          shouldTrigger = worldState.recentDeaths > 0;
          break;

        case 'ALLIANCE_FORMED':
          shouldTrigger = worldState.alliancesFormed > 0;
          break;

        case 'DISASTER':
          shouldTrigger = worldState.disasters > 0;
          break;

        case 'CUSTOM':
          shouldTrigger = this.evaluateCustomTrigger(ritual, worldState, eventsThisTurn);
          break;
      }

      // Cooldown: don't perform same ritual every turn
      const cooldown = ritual.triggerData?.cooldown || 5;
      if (ritual.lastPerformed && worldState.turn - ritual.lastPerformed < cooldown) {
        shouldTrigger = false;
      }

      if (shouldTrigger) {
        triggeredRituals.push(ritual);
      }
    }

    return triggeredRituals;
  }

  /**
   * Evaluate custom trigger conditions
   */
  private evaluateCustomTrigger(
    ritual: Ritual,
    worldState: any,
    events: EventLog[]
  ): boolean {
    // Custom logic based on triggerData
    if (ritual.triggerData?.eventType) {
      return events.some(e => e.type === ritual.triggerData!.eventType);
    }
    return false;
  }

  /**
   * Apply ritual effects to faction and agents
   */
  applyRitualEffects(ritual: Ritual, faction: Faction, agents: BaseAgent[]): void {
    if (!ritual.mechanicalEffects) return;

    const effects = ritual.mechanicalEffects;

    // Apply cohesion boost to faction
    if (effects.cohesionBoost) {
      faction.cohesion = Math.min(1.0, faction.cohesion + effects.cohesionBoost);
    }

    // Apply effects to all agents in the faction
    const factionAgents = agents.filter(a => faction.members.has(a.getState().id));

    factionAgents.forEach(agent => {
      const state = agent.getState();
      const updates: any = {};

      if (effects.moraleBoost) {
        updates.energy = Math.min(100, state.stats.energy + effects.moraleBoost);
      }

      if (effects.aggressionDelta) {
        updates.aggression = Math.max(
          0,
          Math.min(100, state.stats.aggression + effects.aggressionDelta)
        );
      }

      if (effects.cooperationDelta) {
        updates.cooperation = Math.max(
          0,
          Math.min(100, state.stats.cooperation + effects.cooperationDelta)
        );
      }

      if (effects.energyBoost) {
        updates.energy = Math.min(100, state.stats.energy + effects.energyBoost);
      }

      if (Object.keys(updates).length > 0) {
        agent.updateStats(updates);
      }
    });

    // Update ritual statistics
    ritual.timesPerformed++;
    ritual.lastPerformed = Date.now();

    console.log(
      `[BeliefSystem] Ritual "${ritual.name}" performed by faction ${faction.name} (${factionAgents.length} agents affected)`
    );
  }

  /**
   * Get all beliefs
   */
  getAllBeliefs(): Belief[] {
    return Array.from(this.beliefs.values());
  }

  /**
   * Get all rituals
   */
  getAllRituals(): Ritual[] {
    return Array.from(this.rituals.values());
  }

  /**
   * Get belief by ID
   */
  getBelief(beliefId: string): Belief | undefined {
    return this.beliefs.get(beliefId);
  }

  /**
   * Get ritual by ID
   */
  getRitual(ritualId: string): Ritual | undefined {
    return this.rituals.get(ritualId);
  }

  /**
   * Get statistics about beliefs and rituals
   */
  getStats() {
    return {
      totalBeliefs: this.beliefs.size,
      totalRituals: this.rituals.size,
      totalAdherents: Array.from(this.beliefs.values()).reduce(
        (sum, b) => sum + b.adherentCount,
        0
      ),
      averageZeal:
        this.beliefs.size > 0
          ? Array.from(this.beliefs.values()).reduce((sum, b) => sum + b.zeal, 0) /
            this.beliefs.size
          : 0,
      ritualsByBelief: Array.from(this.beliefs.values()).reduce((acc, belief) => {
        acc[belief.name] = Array.from(this.rituals.values()).filter(
          r => r.beliefId === belief.id
        ).length;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  /**
   * Reset all beliefs and rituals
   */
  reset(): void {
    this.beliefs.clear();
    this.rituals.clear();
    this.factionBeliefs.clear();
  }
}

/**
 * Global belief system instance
 */
let globalBeliefSystem: BeliefSystem | null = null;

/**
 * Get the global belief system
 */
export function getBeliefSystem(): BeliefSystem {
  if (!globalBeliefSystem) {
    globalBeliefSystem = new BeliefSystem();
  }
  return globalBeliefSystem;
}

/**
 * Set the global belief system (for testing)
 */
export function setBeliefSystem(system: BeliefSystem): void {
  globalBeliefSystem = system;
}
