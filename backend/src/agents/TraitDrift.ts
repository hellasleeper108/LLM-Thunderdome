/**
 * Trait Drift System
 * Dynamically adjusts agent personality traits based on experiences, relationships, and environment
 */

import { BaseAgent } from './BaseAgent';
import { SocialGraph } from './SocialGraph';
import { AgentStats, ActionResult, Tile } from '../schemas/types';

export interface DriftResult {
  agentId: string;
  agentName: string;
  changes: Partial<AgentStats>;
  reasons: string[];
  magnitude: number; // Total magnitude of change
}

export interface AgentExperience {
  agentId: string;
  recentActions: string[]; // Last 10 action types
  recentOutcomes: boolean[]; // Success/failure of last 10 actions
  attacksReceived: number; // Since last drift reset
  attacksGiven: number;
  tradesCompleted: number;
  alliancesFormed: number;
  betrayalsReceived: number;
  resourcesGained: number;
  resourcesLost: number;
  turnsSurvived: number;
  deathCount: number;
}

export class TraitDrift {
  private experiences: Map<string, AgentExperience>;
  private socialGraph: SocialGraph;
  private driftRate: number; // Base drift speed multiplier
  private minDrift: number; // Minimum change to apply
  private maxDriftPerTurn: number; // Maximum total drift per turn

  constructor(socialGraph: SocialGraph, driftRate: number = 1.0) {
    this.experiences = new Map();
    this.socialGraph = socialGraph;
    this.driftRate = driftRate;
    this.minDrift = 0.1; // Don't apply changes smaller than this
    this.maxDriftPerTurn = 5.0; // Cap total drift per turn
  }

  /**
   * Main drift method - called each turn for each agent
   */
  tick(
    agent: BaseAgent,
    worldTiles?: Tile[][],
    nearbyAgents?: string[]
  ): DriftResult {
    const state = agent.getState();
    const experience = this.getOrCreateExperience(state.id);

    const changes: Partial<AgentStats> = {};
    const reasons: string[] = [];

    // Apply individual stat drifts
    const aggressionDrift = this.driftAggression(agent, experience);
    const empathyDrift = this.driftEmpathy(agent, experience, nearbyAgents || []);
    const curiosityDrift = this.driftCuriosity(agent, experience);
    const riskToleranceDrift = this.driftRiskTolerance(agent, experience);
    const cooperationDrift = this.driftCooperation(agent, experience);
    const energyDrift = this.driftEnergy(agent, experience);

    // Aggregate changes
    if (Math.abs(aggressionDrift.delta) >= this.minDrift) {
      changes.aggression = this.clamp(state.stats.aggression + aggressionDrift.delta, 0, 100);
      reasons.push(aggressionDrift.reason);
    }

    if (Math.abs(empathyDrift.delta) >= this.minDrift) {
      changes.empathy = this.clamp(state.stats.empathy + empathyDrift.delta, 0, 100);
      reasons.push(empathyDrift.reason);
    }

    if (Math.abs(curiosityDrift.delta) >= this.minDrift) {
      changes.curiosity = this.clamp(state.stats.curiosity + curiosityDrift.delta, 0, 100);
      reasons.push(curiosityDrift.reason);
    }

    if (Math.abs(riskToleranceDrift.delta) >= this.minDrift) {
      changes.riskTolerance = this.clamp(state.stats.riskTolerance + riskToleranceDrift.delta, 0, 100);
      reasons.push(riskToleranceDrift.reason);
    }

    if (Math.abs(cooperationDrift.delta) >= this.minDrift) {
      changes.cooperation = this.clamp(state.stats.cooperation + cooperationDrift.delta, 0, 100);
      reasons.push(cooperationDrift.reason);
    }

    if (Math.abs(energyDrift.delta) >= this.minDrift) {
      changes.energy = this.clamp(state.stats.energy + energyDrift.delta, 0, 100);
      reasons.push(energyDrift.reason);
    }

    // Apply external modifiers (world state, relationships)
    const externalMods = this.applyExternalModifiers(agent, worldTiles, nearbyAgents || []);

    for (const [stat, mod] of Object.entries(externalMods.changes)) {
      if (Math.abs(mod) >= this.minDrift) {
        const currentValue = changes[stat as keyof AgentStats] ?? state.stats[stat as keyof AgentStats];
        changes[stat as keyof AgentStats] = this.clamp(currentValue + mod, 0, 100);
      }
    }
    reasons.push(...externalMods.reasons);

    // Calculate total magnitude
    const magnitude = Object.values(changes).reduce((sum, val) => {
      const original = state.stats[Object.keys(changes).find(k => changes[k as keyof AgentStats] === val) as keyof AgentStats];
      return sum + Math.abs((val as number) - original);
    }, 0);

    // Apply changes to agent if magnitude is significant
    if (magnitude > this.minDrift) {
      agent.updateStats(changes);
    }

    // Update turn counter
    experience.turnsSurvived++;

    return {
      agentId: state.id,
      agentName: state.name,
      changes,
      reasons,
      magnitude,
    };
  }

  /**
   * Drift aggression based on combat experiences and threats
   */
  driftAggression(agent: BaseAgent, experience: AgentExperience): { delta: number; reason: string } {
    const state = agent.getState();
    let delta = 0;
    let reason = '';

    // Being attacked increases aggression
    if (experience.attacksReceived > 0) {
      delta += experience.attacksReceived * 0.5 * this.driftRate;
      reason = `Attacked ${experience.attacksReceived} times, becoming more aggressive`;
    }

    // Successful attacks reinforce aggression
    if (experience.attacksGiven > 2) {
      delta += experience.attacksGiven * 0.3 * this.driftRate;
      reason = `${experience.attacksGiven} attacks launched, aggression reinforced`;
    }

    // Betrayals increase aggression
    if (experience.betrayalsReceived > 0) {
      delta += experience.betrayalsReceived * 1.0 * this.driftRate;
      reason = `Betrayed ${experience.betrayalsReceived} times, trust shattered`;
    }

    // Peaceful success reduces aggression
    if (experience.tradesCompleted > 3 && experience.attacksGiven === 0) {
      delta -= 0.4 * this.driftRate;
      reason = 'Peaceful trade success, aggression mellowing';
    }

    // Low health increases defensive aggression
    if (state.health < 30) {
      delta += 0.5 * this.driftRate;
      reason = 'Low health, becoming more defensive/aggressive';
    }

    // Fear in relationships increases aggression (fight response)
    const avgFearReceived = this.getAverageFearFromOthers(state.id);
    if (avgFearReceived > 40) {
      delta += 0.3 * this.driftRate;
      reason = 'Others fear me, power reinforces aggression';
    }

    return { delta, reason };
  }

  /**
   * Drift empathy based on social interactions and relationships
   */
  driftEmpathy(agent: BaseAgent, experience: AgentExperience, nearbyAgents: string[]): { delta: number; reason: string } {
    const state = agent.getState();
    let delta = 0;
    let reason = '';

    // Isolation reduces empathy
    if (nearbyAgents.length === 0) {
      delta -= 0.2 * this.driftRate;
      reason = 'Isolated, empathy fading';
    }

    // Social interaction maintains empathy
    if (nearbyAgents.length > 2) {
      delta += 0.1 * this.driftRate;
      reason = 'Social connections maintained';
    }

    // Successful alliances increase empathy
    if (experience.alliancesFormed > 0) {
      delta += experience.alliancesFormed * 0.5 * this.driftRate;
      reason = `Formed ${experience.alliancesFormed} alliances, empathy growing`;
    }

    // Betrayals reduce empathy
    if (experience.betrayalsReceived > 0) {
      delta -= experience.betrayalsReceived * 0.8 * this.driftRate;
      reason = 'Betrayed, becoming more cynical';
    }

    // Being attacked reduces empathy
    if (experience.attacksReceived > 1) {
      delta -= experience.attacksReceived * 0.3 * this.driftRate;
      reason = 'Attacked repeatedly, empathy hardening';
    }

    // Successful trades increase empathy
    if (experience.tradesCompleted > 2) {
      delta += 0.3 * this.driftRate;
      reason = 'Positive trade experiences';
    }

    // High trust relationships increase empathy
    const avgTrust = this.getAverageTrust(state.id);
    if (avgTrust > 60) {
      delta += 0.2 * this.driftRate;
      reason = 'Strong trust bonds reinforcing empathy';
    }

    return { delta, reason };
  }

  /**
   * Drift curiosity based on exploration and discovery
   */
  driftCuriosity(agent: BaseAgent, experience: AgentExperience): { delta: number; reason: string } {
    const state = agent.getState();
    let delta = 0;
    let reason = '';

    // Routine reduces curiosity
    const recentActions = experience.recentActions.slice(-5);
    const uniqueActions = new Set(recentActions).size;

    if (uniqueActions <= 2) {
      delta -= 0.3 * this.driftRate;
      reason = 'Repetitive behavior, curiosity waning';
    }

    // Variety increases curiosity
    if (uniqueActions >= 4) {
      delta += 0.2 * this.driftRate;
      reason = 'Diverse experiences maintaining curiosity';
    }

    // Resource discovery increases curiosity
    if (experience.resourcesGained > 10) {
      delta += 0.3 * this.driftRate;
      reason = 'Resource discoveries sparking curiosity';
    }

    // Survival pressure reduces curiosity (focus on essentials)
    if (state.health < 30 || state.stats.energy < 30) {
      delta -= 0.4 * this.driftRate;
      reason = 'Survival pressure reducing exploration drive';
    }

    // Successful outcomes encourage curiosity
    const recentSuccessRate = experience.recentOutcomes.slice(-5).filter(s => s).length / 5;
    if (recentSuccessRate > 0.7) {
      delta += 0.2 * this.driftRate;
      reason = 'Success encouraging exploration';
    }

    return { delta, reason };
  }

  /**
   * Drift risk tolerance based on outcomes of risky actions
   */
  driftRiskTolerance(agent: BaseAgent, experience: AgentExperience): { delta: number; reason: string } {
    const state = agent.getState();
    let delta = 0;
    let reason = '';

    // Calculate recent success rate
    const recentOutcomes = experience.recentOutcomes.slice(-10);
    const successRate = recentOutcomes.filter(s => s).length / recentOutcomes.length;

    // Consistent success increases risk tolerance
    if (successRate > 0.7) {
      delta += 0.4 * this.driftRate;
      reason = 'Success streak emboldening';
    }

    // Consistent failure reduces risk tolerance
    if (successRate < 0.3) {
      delta -= 0.4 * this.driftRate;
      reason = 'Failures making agent more cautious';
    }

    // Deaths drastically reduce risk tolerance
    if (experience.deathCount > 0) {
      delta -= experience.deathCount * 2.0 * this.driftRate;
      reason = 'Death trauma increasing caution';
    }

    // Attacks received reduce risk tolerance
    if (experience.attacksReceived > 0) {
      delta -= experience.attacksReceived * 0.3 * this.driftRate;
      reason = 'Threat awareness increasing caution';
    }

    // Resource abundance increases risk tolerance
    if (state.inventory.food > 20 && state.inventory.water > 20) {
      delta += 0.2 * this.driftRate;
      reason = 'Resource security enabling risk-taking';
    }

    // Scarcity reduces risk tolerance
    if (state.inventory.food < 3 || state.inventory.water < 3) {
      delta -= 0.3 * this.driftRate;
      reason = 'Scarcity forcing conservative approach';
    }

    return { delta, reason };
  }

  /**
   * Drift cooperation based on alliance and trade experiences
   */
  driftCooperation(agent: BaseAgent, experience: AgentExperience): { delta: number; reason: string } {
    const state = agent.getState();
    let delta = 0;
    let reason = '';

    // Successful trades increase cooperation
    if (experience.tradesCompleted > 2) {
      delta += experience.tradesCompleted * 0.3 * this.driftRate;
      reason = `${experience.tradesCompleted} successful trades`;
    }

    // Alliances increase cooperation
    if (experience.alliancesFormed > 0) {
      delta += experience.alliancesFormed * 0.6 * this.driftRate;
      reason = 'Alliance experience fostering cooperation';
    }

    // Betrayals reduce cooperation
    if (experience.betrayalsReceived > 0) {
      delta -= experience.betrayalsReceived * 1.2 * this.driftRate;
      reason = 'Betrayal breeding distrust';
    }

    // Being attacked reduces cooperation
    if (experience.attacksReceived > 1) {
      delta -= experience.attacksReceived * 0.4 * this.driftRate;
      reason = 'Hostility reducing cooperative instincts';
    }

    // High loyalty relationships increase cooperation
    const avgLoyalty = this.getAverageLoyalty(state.id);
    if (avgLoyalty > 50) {
      delta += 0.3 * this.driftRate;
      reason = 'Loyal relationships reinforcing cooperation';
    }

    // High rivalry reduces cooperation
    const avgRivalry = this.getAverageRivalry(state.id);
    if (avgRivalry > 40) {
      delta -= 0.3 * this.driftRate;
      reason = 'Rivalries reducing cooperative tendencies';
    }

    return { delta, reason };
  }

  /**
   * Drift energy (baseline vitality) based on survival and success
   */
  driftEnergy(agent: BaseAgent, experience: AgentExperience): { delta: number; reason: string } {
    const state = agent.getState();
    let delta = 0;
    let reason = '';

    // Long survival increases baseline energy
    if (experience.turnsSurvived > 50) {
      delta += 0.1 * this.driftRate;
      reason = 'Long-term survival building resilience';
    }

    // Resource abundance increases energy
    const totalResources = state.inventory.food + state.inventory.water + state.inventory.material;
    if (totalResources > 30) {
      delta += 0.2 * this.driftRate;
      reason = 'Resource abundance boosting vitality';
    }

    // Scarcity reduces energy
    if (totalResources < 5) {
      delta -= 0.3 * this.driftRate;
      reason = 'Resource scarcity draining vitality';
    }

    // Low health reduces energy
    if (state.health < 40) {
      delta -= 0.2 * this.driftRate;
      reason = 'Poor health reducing baseline energy';
    }

    return { delta, reason };
  }

  /**
   * Apply external modifiers from world state and relationships
   */
  applyExternalModifiers(
    agent: BaseAgent,
    worldTiles?: Tile[][],
    nearbyAgents?: string[]
  ): { changes: Partial<AgentStats>; reasons: string[] } {
    const state = agent.getState();
    const changes: Partial<AgentStats> = {};
    const reasons: string[] = [];

    // Scarcity effects (if world provided)
    if (worldTiles) {
      const nearbyResources = this.countNearbyResources(worldTiles, state.position, 5);

      if (nearbyResources < 3) {
        changes.aggression = (changes.aggression || 0) + 0.3 * this.driftRate;
        changes.cooperation = (changes.cooperation || 0) - 0.2 * this.driftRate;
        reasons.push('Resource scarcity increasing competition');
      }

      if (nearbyResources > 10) {
        changes.aggression = (changes.aggression || 0) - 0.2 * this.driftRate;
        changes.cooperation = (changes.cooperation || 0) + 0.2 * this.driftRate;
        reasons.push('Resource abundance reducing tension');
      }
    }

    // Social pressure from nearby agents
    if (nearbyAgents && nearbyAgents.length > 4) {
      changes.empathy = (changes.empathy || 0) + 0.1 * this.driftRate;
      reasons.push('Crowded environment heightening social awareness');
    }

    // Relationship-based modifiers
    const avgFear = this.getAverageFearTowards(state.id);
    if (avgFear > 50) {
      changes.riskTolerance = (changes.riskTolerance || 0) - 0.3 * this.driftRate;
      changes.aggression = (changes.aggression || 0) - 0.2 * this.driftRate;
      reasons.push('Widespread fear inducing caution');
    }

    const avgRespect = this.getAverageRespect(state.id);
    if (avgRespect > 60) {
      changes.cooperation = (changes.cooperation || 0) + 0.2 * this.driftRate;
      reasons.push('High respect enabling cooperation');
    }

    return { changes, reasons };
  }

  /**
   * Record action and outcome for drift calculation
   */
  recordAction(agentId: string, actionType: string, success: boolean): void {
    const experience = this.getOrCreateExperience(agentId);

    experience.recentActions.push(actionType);
    if (experience.recentActions.length > 10) {
      experience.recentActions.shift();
    }

    experience.recentOutcomes.push(success);
    if (experience.recentOutcomes.length > 10) {
      experience.recentOutcomes.shift();
    }
  }

  /**
   * Record specific events
   */
  recordAttackReceived(agentId: string): void {
    const experience = this.getOrCreateExperience(agentId);
    experience.attacksReceived++;
  }

  recordAttackGiven(agentId: string): void {
    const experience = this.getOrCreateExperience(agentId);
    experience.attacksGiven++;
  }

  recordTradeCompleted(agentId: string): void {
    const experience = this.getOrCreateExperience(agentId);
    experience.tradesCompleted++;
  }

  recordAllianceFormed(agentId: string): void {
    const experience = this.getOrCreateExperience(agentId);
    experience.alliancesFormed++;
  }

  recordBetrayalReceived(agentId: string): void {
    const experience = this.getOrCreateExperience(agentId);
    experience.betrayalsReceived++;
  }

  recordResourceGained(agentId: string, amount: number): void {
    const experience = this.getOrCreateExperience(agentId);
    experience.resourcesGained += amount;
  }

  recordResourceLost(agentId: string, amount: number): void {
    const experience = this.getOrCreateExperience(agentId);
    experience.resourcesLost += amount;
  }

  recordDeath(agentId: string): void {
    const experience = this.getOrCreateExperience(agentId);
    experience.deathCount++;
  }

  /**
   * Reset experience tracking for an agent (e.g., after major event)
   */
  resetExperience(agentId: string): void {
    const experience = this.getOrCreateExperience(agentId);
    experience.attacksReceived = 0;
    experience.attacksGiven = 0;
    experience.tradesCompleted = 0;
    experience.alliancesFormed = 0;
    experience.betrayalsReceived = 0;
    experience.resourcesGained = 0;
    experience.resourcesLost = 0;
  }

  /**
   * Private helper methods
   */

  private getOrCreateExperience(agentId: string): AgentExperience {
    if (!this.experiences.has(agentId)) {
      this.experiences.set(agentId, {
        agentId,
        recentActions: [],
        recentOutcomes: [],
        attacksReceived: 0,
        attacksGiven: 0,
        tradesCompleted: 0,
        alliancesFormed: 0,
        betrayalsReceived: 0,
        resourcesGained: 0,
        resourcesLost: 0,
        turnsSurvived: 0,
        deathCount: 0,
      });
    }
    return this.experiences.get(agentId)!;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private countNearbyResources(tiles: Tile[][], position: { x: number; y: number }, radius: number): number {
    let count = 0;
    for (let y = Math.max(0, position.y - radius); y < Math.min(tiles.length, position.y + radius); y++) {
      for (let x = Math.max(0, position.x - radius); x < Math.min(tiles[0].length, position.x + radius); x++) {
        if (tiles[y][x].type.startsWith('resource')) {
          count++;
        }
      }
    }
    return count;
  }

  // Social graph query helpers

  private getAverageTrust(agentId: string): number {
    const { outgoing } = this.socialGraph.getAllRelationships(agentId);
    if (outgoing.length === 0) return 0;
    const total = outgoing.reduce((sum, rel) => sum + rel.weights.trust, 0);
    return total / outgoing.length;
  }

  private getAverageFearTowards(agentId: string): number {
    const { outgoing } = this.socialGraph.getAllRelationships(agentId);
    if (outgoing.length === 0) return 0;
    const total = outgoing.reduce((sum, rel) => sum + rel.weights.fear, 0);
    return total / outgoing.length;
  }

  private getAverageFearFromOthers(agentId: string): number {
    const { incoming } = this.socialGraph.getAllRelationships(agentId);
    if (incoming.length === 0) return 0;
    const total = incoming.reduce((sum, rel) => sum + rel.weights.fear, 0);
    return total / incoming.length;
  }

  private getAverageLoyalty(agentId: string): number {
    const { outgoing } = this.socialGraph.getAllRelationships(agentId);
    if (outgoing.length === 0) return 0;
    const total = outgoing.reduce((sum, rel) => sum + rel.weights.loyalty, 0);
    return total / outgoing.length;
  }

  private getAverageRivalry(agentId: string): number {
    const { outgoing } = this.socialGraph.getAllRelationships(agentId);
    if (outgoing.length === 0) return 0;
    const total = outgoing.reduce((sum, rel) => sum + rel.weights.rivalry, 0);
    return total / outgoing.length;
  }

  private getAverageRespect(agentId: string): number {
    const { incoming } = this.socialGraph.getAllRelationships(agentId);
    if (incoming.length === 0) return 0;
    const total = incoming.reduce((sum, rel) => sum + rel.weights.respect, 0);
    return total / incoming.length;
  }

  /**
   * Get experience data for external use
   */
  getExperience(agentId: string): AgentExperience | null {
    return this.experiences.get(agentId) || null;
  }

  /**
   * Reset all experiences
   */
  reset(): void {
    this.experiences.clear();
  }
}
