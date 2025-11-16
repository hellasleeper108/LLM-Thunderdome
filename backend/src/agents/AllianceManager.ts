/**
 * Alliance Manager
 * Manages alliances between agents, tracks strength, and handles alliance lifecycle
 */

import { v4 as uuidv4 } from 'uuid';
import { Alliance, AllianceStrength, AllianceRequest, AgentState } from '../schemas/types';
import { SocialGraph } from './SocialGraph';

export class AllianceManager {
  private alliances: Map<string, Alliance>; // allianceId -> Alliance
  private agentAlliances: Map<string, Set<string>>; // agentId -> Set<allianceId>
  private allianceRequests: Map<string, AllianceRequest>; // requestId -> Request
  private cooperationHistory: Map<string, number[]>; // allianceId -> cooperation scores
  private currentTurn: number;
  private socialGraph: SocialGraph;

  constructor(socialGraph?: SocialGraph) {
    this.alliances = new Map();
    this.agentAlliances = new Map();
    this.allianceRequests = new Map();
    this.cooperationHistory = new Map();
    this.currentTurn = 0;
    this.socialGraph = socialGraph || new SocialGraph();
  }

  /**
   * Form an alliance between two agents
   */
  formAlliance(
    agentA: AgentState,
    agentB: AgentState,
    conditions: Alliance['conditions'] = {
      protection: true,
      resourceSharing: true,
      exclusivity: true,
    },
    duration?: number
  ): Alliance {
    // Check if alliance already exists
    const existingAlliance = this.findAllianceBetween(agentA.id, agentB.id);
    if (existingAlliance) {
      return existingAlliance;
    }

    // Calculate initial strength based on agent compatibility and social relationships
    const baseStrength = this.calculateInitialStrength(agentA, agentB, conditions);

    // Get social relationship bonus
    const socialBonus = this.getSocialRelationshipBonus(agentA.id, agentB.id);

    const finalStrength = Math.max(0, Math.min(100, baseStrength + socialBonus));

    const alliance: Alliance = {
      id: uuidv4(),
      memberIds: [agentA.id, agentB.id],
      formedAt: this.currentTurn,
      duration,
      strength: finalStrength,
      conditions,
      metadata: {
        formationReason: 'negotiation',
        agentACooperation: agentA.stats.cooperation,
        agentBCooperation: agentB.stats.cooperation,
        socialBonus,
      },
    };

    // Store alliance
    this.alliances.set(alliance.id, alliance);

    // Update agent-alliance mappings
    if (!this.agentAlliances.has(agentA.id)) {
      this.agentAlliances.set(agentA.id, new Set());
    }
    if (!this.agentAlliances.has(agentB.id)) {
      this.agentAlliances.set(agentB.id, new Set());
    }

    this.agentAlliances.get(agentA.id)!.add(alliance.id);
    this.agentAlliances.get(agentB.id)!.add(alliance.id);

    // Initialize cooperation history
    this.cooperationHistory.set(alliance.id, [finalStrength]);

    // Update social graph for alliance formation
    this.socialGraph.adjustLoyalty(agentA.id, agentB.id, 15);
    this.socialGraph.adjustLoyalty(agentB.id, agentA.id, 15);
    this.socialGraph.adjustTrust(agentA.id, agentB.id, 10);
    this.socialGraph.adjustTrust(agentB.id, agentA.id, 10);

    return alliance;
  }

  /**
   * Break an alliance between two agents
   */
  breakAlliance(agentA: string, agentB: string): boolean {
    const alliance = this.findAllianceBetween(agentA, agentB);

    if (!alliance) {
      return false;
    }

    // Remove from agent-alliance mappings
    this.agentAlliances.get(agentA)?.delete(alliance.id);
    this.agentAlliances.get(agentB)?.delete(alliance.id);

    // Remove alliance
    this.alliances.delete(alliance.id);
    this.cooperationHistory.delete(alliance.id);

    // Update social graph for alliance breaking
    this.socialGraph.adjustLoyalty(agentA, agentB, -20);
    this.socialGraph.adjustLoyalty(agentB, agentA, -20);
    this.socialGraph.adjustTrust(agentA, agentB, -10);
    this.socialGraph.adjustTrust(agentB, agentA, -10);
    this.socialGraph.adjustRivalry(agentA, agentB, 5);
    this.socialGraph.adjustRivalry(agentB, agentA, 5);

    return true;
  }

  /**
   * Get all alliances for an agent
   */
  getAlliances(agentId: string): Alliance[] {
    const allianceIds = this.agentAlliances.get(agentId);

    if (!allianceIds) {
      return [];
    }

    const alliances: Alliance[] = [];
    for (const allianceId of allianceIds) {
      const alliance = this.alliances.get(allianceId);
      if (alliance) {
        alliances.push(alliance);
      }
    }

    return alliances;
  }

  /**
   * Get alliance strength between two agents
   */
  getAllianceStrength(agentA: string, agentB: string): AllianceStrength | null {
    const alliance = this.findAllianceBetween(agentA, agentB);

    if (!alliance) {
      return null;
    }

    return this.calculateAllianceStrength(alliance);
  }

  /**
   * Check if two agents are allied
   */
  areAllied(agentA: string, agentB: string): boolean {
    return this.findAllianceBetween(agentA, agentB) !== null;
  }

  /**
   * Get all members of an agent's alliances
   */
  getAllyIds(agentId: string): string[] {
    const alliances = this.getAlliances(agentId);
    const allyIds = new Set<string>();

    for (const alliance of alliances) {
      for (const memberId of alliance.memberIds) {
        if (memberId !== agentId) {
          allyIds.add(memberId);
        }
      }
    }

    return Array.from(allyIds);
  }

  /**
   * Record cooperation between allies (strengthens alliance)
   */
  recordCooperation(allianceId: string, cooperationScore: number): void {
    const alliance = this.alliances.get(allianceId);
    if (!alliance) {
      return;
    }

    // Add to history
    const history = this.cooperationHistory.get(allianceId) || [];
    history.push(cooperationScore);

    // Keep only last 20 cooperation events
    if (history.length > 20) {
      history.shift();
    }

    this.cooperationHistory.set(allianceId, history);

    // Update alliance strength
    const strength = this.calculateAllianceStrength(alliance);
    alliance.strength = strength.total;
  }

  /**
   * Record betrayal (weakens or breaks alliance)
   */
  recordBetrayal(agentA: string, agentB: string, severity: number = 50): boolean {
    const alliance = this.findAllianceBetween(agentA, agentB);

    if (!alliance) {
      return false;
    }

    // Reduce alliance strength
    alliance.strength = Math.max(0, alliance.strength - severity);

    // Update social graph for betrayal
    this.socialGraph.adjustTrust(agentB, agentA, -severity * 0.8);
    this.socialGraph.adjustLoyalty(agentB, agentA, -severity * 1.0);
    this.socialGraph.adjustRivalry(agentB, agentA, severity * 0.6);
    this.socialGraph.adjustRespect(agentB, agentA, -severity * 0.4);

    // Break alliance if strength drops to 0
    if (alliance.strength <= 0) {
      this.breakAlliance(agentA, agentB);
      return true;
    }

    return false;
  }

  /**
   * Update turn counter and process alliance expirations
   */
  updateTurn(turn: number): { expired: Alliance[]; strengthened: Alliance[] } {
    this.currentTurn = turn;
    const expired: Alliance[] = [];
    const strengthened: Alliance[] = [];

    for (const alliance of this.alliances.values()) {
      // Check for expiration
      if (alliance.duration !== undefined) {
        const age = turn - alliance.formedAt;
        if (age >= alliance.duration) {
          expired.push(alliance);
          continue;
        }
      }

      // Strengthen over time (slowly)
      if (turn % 5 === 0) {
        // Every 5 turns
        const oldStrength = alliance.strength;
        alliance.strength = Math.min(100, alliance.strength + 1);
        if (alliance.strength > oldStrength) {
          strengthened.push(alliance);
        }
      }
    }

    // Remove expired alliances
    for (const alliance of expired) {
      for (const memberId of alliance.memberIds) {
        this.agentAlliances.get(memberId)?.delete(alliance.id);
      }
      this.alliances.delete(alliance.id);
      this.cooperationHistory.delete(alliance.id);
    }

    return { expired, strengthened };
  }

  /**
   * Get alliance by ID
   */
  getAlliance(allianceId: string): Alliance | null {
    return this.alliances.get(allianceId) || null;
  }

  /**
   * Get all active alliances
   */
  getAllActiveAlliances(): Alliance[] {
    return Array.from(this.alliances.values());
  }

  /**
   * Reset all alliances
   */
  reset(): void {
    this.alliances.clear();
    this.agentAlliances.clear();
    this.allianceRequests.clear();
    this.cooperationHistory.clear();
    this.currentTurn = 0;
  }

  /**
   * Private helper methods
   */

  /**
   * Find alliance between two agents
   */
  private findAllianceBetween(agentA: string, agentB: string): Alliance | null {
    const alliancesA = this.agentAlliances.get(agentA);
    const alliancesB = this.agentAlliances.get(agentB);

    if (!alliancesA || !alliancesB) {
      return null;
    }

    // Find common alliance
    for (const allianceId of alliancesA) {
      if (alliancesB.has(allianceId)) {
        return this.alliances.get(allianceId) || null;
      }
    }

    return null;
  }

  /**
   * Calculate initial alliance strength
   */
  private calculateInitialStrength(
    agentA: AgentState,
    agentB: AgentState,
    conditions: Alliance['conditions']
  ): number {
    let strength = 50; // Base strength

    // Higher cooperation = stronger alliance
    const avgCooperation = (agentA.stats.cooperation + agentB.stats.cooperation) / 2;
    strength += (avgCooperation - 50) * 0.3;

    // Higher empathy = stronger alliance
    const avgEmpathy = (agentA.stats.empathy + agentB.stats.empathy) / 2;
    strength += (avgEmpathy - 50) * 0.2;

    // Conditions affect strength
    if (conditions.protection) strength += 10;
    if (conditions.resourceSharing) strength += 10;
    if (conditions.exclusivity) strength += 5;

    // Similar aggression levels = more stable
    const aggressionDiff = Math.abs(agentA.stats.aggression - agentB.stats.aggression);
    strength -= aggressionDiff * 0.1;

    return Math.max(0, Math.min(100, strength));
  }

  /**
   * Calculate detailed alliance strength
   */
  private calculateAllianceStrength(alliance: Alliance): AllianceStrength {
    const baseStrength = alliance.strength;

    // Cooperation bonus from history
    const history = this.cooperationHistory.get(alliance.id) || [];
    const avgCooperation = history.length > 0 ? history.reduce((a, b) => a + b, 0) / history.length : 0;
    const cooperationBonus = Math.min(20, (avgCooperation / 100) * 20);

    // Trust bonus (no betrayals = higher trust)
    const trustBonus = history.length > 5 ? 10 : 0;

    // Time bonus (longer alliances are stronger)
    const age = this.currentTurn - alliance.formedAt;
    const timeBonus = Math.min(15, age * 0.5);

    const total = Math.min(100, baseStrength + cooperationBonus + trustBonus + timeBonus);

    return {
      baseStrength,
      cooperationBonus,
      trustBonus,
      timeBonus,
      total,
    };
  }

  /**
   * Get social relationship bonus for alliance strength
   */
  private getSocialRelationshipBonus(agentA: string, agentB: string): number {
    const relationshipA = this.socialGraph.getRelationship(agentA, agentB);
    const relationshipB = this.socialGraph.getRelationship(agentB, agentA);

    if (!relationshipA && !relationshipB) {
      return 0;
    }

    // Calculate mutual trust and loyalty bonus
    const trustA = relationshipA?.trust || 0;
    const trustB = relationshipB?.trust || 0;
    const loyaltyA = relationshipA?.loyalty || 0;
    const loyaltyB = relationshipB?.loyalty || 0;

    const avgTrust = (trustA + trustB) / 2;
    const avgLoyalty = (loyaltyA + loyaltyB) / 2;

    // Trust and loyalty increase base strength
    const bonus = (avgTrust * 0.15 + avgLoyalty * 0.15);

    // Fear and rivalry reduce it
    const fearA = relationshipA?.fear || 0;
    const fearB = relationshipB?.fear || 0;
    const rivalryA = relationshipA?.rivalry || 0;
    const rivalryB = relationshipB?.rivalry || 0;

    const avgFear = (fearA + fearB) / 2;
    const avgRivalry = (rivalryA + rivalryB) / 2;

    const penalty = (avgFear * 0.1 + avgRivalry * 0.2);

    return bonus - penalty;
  }

  /**
   * Get the social graph for external access
   */
  getSocialGraph(): SocialGraph {
    return this.socialGraph;
  }

  /**
   * Create alliance request
   */
  createAllianceRequest(
    from: string,
    to: string,
    conditions: Alliance['conditions'],
    duration?: number
  ): AllianceRequest {
    const request: AllianceRequest = {
      id: uuidv4(),
      from,
      to,
      timestamp: Date.now(),
      conditions,
      duration,
    };

    this.allianceRequests.set(request.id, request);

    return request;
  }

  /**
   * Accept alliance request
   */
  acceptAllianceRequest(requestId: string, agentA: AgentState, agentB: AgentState): Alliance | null {
    const request = this.allianceRequests.get(requestId);

    if (!request) {
      return null;
    }

    const alliance = this.formAlliance(agentA, agentB, request.conditions, request.duration);

    // Remove request
    this.allianceRequests.delete(requestId);

    return alliance;
  }

  /**
   * Reject alliance request
   */
  rejectAllianceRequest(requestId: string): boolean {
    return this.allianceRequests.delete(requestId);
  }
}
