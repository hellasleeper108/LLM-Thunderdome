/**
 * Law System
 * Defines and enforces laws within factions
 */

import { BaseAgent } from '../agents/BaseAgent';
import { Action, ActionType } from '../schemas/types';
import { Faction, FactionManager } from './FactionManager';
import { v4 as uuidv4 } from 'uuid';

export enum LawType {
  COOPERATION = 'COOPERATION',
  RESOURCE_SHARING = 'RESOURCE_SHARING',
  NO_ATTACK = 'NO_ATTACK',
  TRIBUTE = 'TRIBUTE',
  CUSTOM = 'CUSTOM',
}

export interface Law {
  id: string;
  description: string;
  type: LawType;
  enforcementStrength: number; // 0-1, how strictly the law is enforced
  penalties?: {
    cohesionPenalty?: number; // -cohesion when violated
    trustPenalty?: number; // -trust in social graph
    expulsion?: boolean; // kick from faction
  };
  metadata?: Record<string, any>;
}

export interface LawViolation {
  violated: boolean;
  law?: Law;
  penalties?: {
    cohesionPenalty?: number;
    trustPenalty?: number;
    expulsion?: boolean;
    description?: string;
  };
}

export class LawSystem {
  private laws: Map<string, Law>;

  constructor() {
    this.laws = new Map();
    this.initializeDefaultLaws();
  }

  /**
   * Initialize common law templates
   */
  private initializeDefaultLaws(): void {
    // Cooperation Law
    this.laws.set('law-cooperation', {
      id: 'law-cooperation',
      description: 'Members must cooperate with fellow faction members',
      type: LawType.COOPERATION,
      enforcementStrength: 0.7,
      penalties: {
        cohesionPenalty: 0.05,
        trustPenalty: 10,
      },
    });

    // Resource Sharing Law
    this.laws.set('law-resource-sharing', {
      id: 'law-resource-sharing',
      description: 'Members must share resources when asked by faction members',
      type: LawType.RESOURCE_SHARING,
      enforcementStrength: 0.6,
      penalties: {
        cohesionPenalty: 0.03,
        trustPenalty: 5,
      },
    });

    // No Attack Law
    this.laws.set('law-no-attack', {
      id: 'law-no-attack',
      description: 'Members must not attack fellow faction members',
      type: LawType.NO_ATTACK,
      enforcementStrength: 1.0,
      penalties: {
        cohesionPenalty: 0.15,
        trustPenalty: 30,
        expulsion: true,
      },
    });

    // Tribute Law
    this.laws.set('law-tribute', {
      id: 'law-tribute',
      description: 'Members must contribute a portion of gathered resources to the faction',
      type: LawType.TRIBUTE,
      enforcementStrength: 0.5,
      penalties: {
        cohesionPenalty: 0.02,
        trustPenalty: 3,
      },
    });
  }

  /**
   * Create a custom law
   */
  createLaw(
    description: string,
    type: LawType,
    enforcementStrength: number,
    penalties?: Law['penalties']
  ): Law {
    const law: Law = {
      id: uuidv4(),
      description,
      type,
      enforcementStrength: Math.max(0, Math.min(1, enforcementStrength)),
      penalties: penalties || {
        cohesionPenalty: 0.05,
        trustPenalty: 10,
      },
    };

    this.laws.set(law.id, law);

    console.log(`[LawSystem] Created law: "${description}" (enforcement: ${law.enforcementStrength})`);

    return law;
  }

  /**
   * Get a law by ID
   */
  getLaw(lawId: string): Law | null {
    return this.laws.get(lawId) || null;
  }

  /**
   * List all laws
   */
  listLaws(): Law[] {
    return Array.from(this.laws.values());
  }

  /**
   * Attach a law to a faction
   */
  attachLawToFaction(factionId: string, law: Law, factionManager: FactionManager): boolean {
    return factionManager.addLaw(factionId, law.id);
  }

  /**
   * Evaluate if an action violates faction laws
   */
  evaluateLawCompliance(
    agent: BaseAgent,
    action: Action,
    factionManager: FactionManager,
    targetAgent?: BaseAgent
  ): LawViolation {
    const agentId = agent.getState().id;
    const faction = factionManager.getFactionByAgent(agentId);

    // No faction = no laws to violate
    if (!faction) {
      return { violated: false };
    }

    // Check each law in the faction
    for (const lawId of faction.laws) {
      const law = this.laws.get(lawId);
      if (!law) continue;

      const violation = this.checkLawViolation(agent, action, law, faction, factionManager, targetAgent);
      if (violation.violated) {
        return violation;
      }
    }

    return { violated: false };
  }

  /**
   * Check if a specific law is violated
   */
  private checkLawViolation(
    agent: BaseAgent,
    action: Action,
    law: Law,
    faction: Faction,
    factionManager: FactionManager,
    targetAgent?: BaseAgent
  ): LawViolation {
    switch (law.type) {
      case LawType.NO_ATTACK:
        return this.checkNoAttackLaw(agent, action, law, faction, factionManager, targetAgent);

      case LawType.RESOURCE_SHARING:
        return this.checkResourceSharingLaw(agent, action, law, faction, factionManager, targetAgent);

      case LawType.COOPERATION:
        return this.checkCooperationLaw(agent, action, law, faction, factionManager, targetAgent);

      case LawType.TRIBUTE:
        return this.checkTributeLaw(agent, action, law, faction, factionManager);

      default:
        return { violated: false };
    }
  }

  /**
   * Check NO_ATTACK law: don't attack faction members
   */
  private checkNoAttackLaw(
    agent: BaseAgent,
    action: Action,
    law: Law,
    faction: Faction,
    factionManager: FactionManager,
    targetAgent?: BaseAgent
  ): LawViolation {
    if (action.type !== ActionType.ATTACK) {
      return { violated: false };
    }

    // Check if target is a faction member
    if (targetAgent && typeof action.target === 'string') {
      const targetInFaction = faction.members.has(action.target);

      if (targetInFaction) {
        return {
          violated: true,
          law,
          penalties: {
            ...law.penalties,
            description: `Attacked fellow faction member ${targetAgent.getState().name}`,
          },
        };
      }
    }

    return { violated: false };
  }

  /**
   * Check RESOURCE_SHARING law: must share when asked by faction members
   */
  private checkResourceSharingLaw(
    agent: BaseAgent,
    action: Action,
    law: Law,
    faction: Faction,
    factionManager: FactionManager,
    targetAgent?: BaseAgent
  ): LawViolation {
    // This is typically checked when refusing a NEGOTIATE or COMMUNICATE request
    // For now, we'll check if the agent has resources but refuses to share

    // If action is COMMUNICATE with a refusal message to a faction member
    if (action.type === ActionType.COMMUNICATE && action.payload?.message) {
      const message = action.payload.message.toLowerCase();
      const isRefusal = message.includes('no') || message.includes('refuse') || message.includes('cannot');

      if (isRefusal && targetAgent && typeof action.target === 'string') {
        const targetInFaction = faction.members.has(action.target);
        const hasResources = agent.getState().inventory.food > 5 ||
                            agent.getState().inventory.water > 5 ||
                            agent.getState().inventory.material > 5;

        if (targetInFaction && hasResources) {
          return {
            violated: true,
            law,
            penalties: {
              ...law.penalties,
              description: `Refused to share resources with faction member despite having surplus`,
            },
          };
        }
      }
    }

    return { violated: false };
  }

  /**
   * Check COOPERATION law: must cooperate with faction members
   */
  private checkCooperationLaw(
    agent: BaseAgent,
    action: Action,
    law: Law,
    faction: Faction,
    factionManager: FactionManager,
    targetAgent?: BaseAgent
  ): LawViolation {
    // Breaking alliance with faction member
    if (action.type === ActionType.BREAK_ALLIANCE && targetAgent && typeof action.target === 'string') {
      const targetInFaction = faction.members.has(action.target);

      if (targetInFaction) {
        return {
          violated: true,
          law,
          penalties: {
            cohesionPenalty: law.penalties?.cohesionPenalty || 0.05,
            trustPenalty: law.penalties?.trustPenalty || 10,
            description: `Broke alliance with faction member ${targetAgent.getState().name}`,
          },
        };
      }
    }

    return { violated: false };
  }

  /**
   * Check TRIBUTE law: must contribute resources
   */
  private checkTributeLaw(
    agent: BaseAgent,
    action: Action,
    law: Law,
    faction: Faction,
    factionManager: FactionManager
  ): LawViolation {
    // This law is typically enforced periodically (e.g., every N turns)
    // For action-based checking, we could track if agent gathers but doesn't contribute

    // If agent gathers resources, they should contribute a portion
    if (action.type === ActionType.GATHER && action.payload?.amount) {
      const gathered = action.payload.amount;

      // Check if agent has metadata indicating they should pay tribute this turn
      // This would be set by the engine during periodic tribute checks
      if (action.payload.tributeDue) {
        return {
          violated: true,
          law,
          penalties: {
            cohesionPenalty: law.penalties?.cohesionPenalty || 0.02,
            trustPenalty: law.penalties?.trustPenalty || 3,
            description: `Failed to pay tribute to faction despite gathering resources`,
          },
        };
      }
    }

    return { violated: false };
  }

  /**
   * Compute faction stability based on cohesion, member count, and law enforcement
   */
  computeFactionStability(faction: Faction): number {
    // Base stability from cohesion (0-1)
    let stability = faction.cohesion;

    // Member count factor (too few or too many reduces stability)
    const memberCount = faction.members.size;
    if (memberCount === 0) {
      return 0;
    }

    // Optimal size is 3-7 members
    if (memberCount < 3) {
      stability *= 0.8; // Small factions are fragile
    } else if (memberCount > 10) {
      stability *= 0.9; // Large factions are harder to manage
    }

    // Law count factor (more laws = more structure but also more rigidity)
    const lawCount = faction.laws.length;
    if (lawCount === 0) {
      stability *= 0.9; // No laws = less structure
    } else if (lawCount > 5) {
      stability *= 0.95; // Too many laws = inflexibility
    }

    // Resource factor (low resources = instability)
    const totalResources = faction.resources.food + faction.resources.water + faction.resources.materials;
    const resourcesPerMember = totalResources / memberCount;

    if (resourcesPerMember < 5) {
      stability *= 0.7; // Scarcity breeds discontent
    } else if (resourcesPerMember > 20) {
      stability *= 1.1; // Abundance increases stability
      stability = Math.min(1, stability); // Cap at 1
    }

    return Math.max(0, Math.min(1, stability));
  }

  /**
   * Get all laws for a faction
   */
  getFactionLaws(faction: Faction): Law[] {
    return faction.laws.map(lawId => this.laws.get(lawId)).filter(Boolean) as Law[];
  }

  /**
   * Get law system state for serialization
   */
  getState(): any {
    return {
      laws: Array.from(this.laws.values()),
    };
  }

  /**
   * Restore law system state
   */
  setState(state: any): void {
    if (state.laws) {
      this.laws.clear();
      state.laws.forEach((law: Law) => {
        this.laws.set(law.id, law);
      });
    }
  }
}
