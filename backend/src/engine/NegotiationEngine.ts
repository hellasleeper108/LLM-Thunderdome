/**
 * Negotiation Engine
 * Handles all agent-to-agent negotiations, bargaining, threats, and resource trades
 */

import { v4 as uuidv4 } from 'uuid';
import {
  NegotiationOffer,
  NegotiationResponse,
  NegotiationContext,
  NegotiationOutcome,
  NegotiationProtocol,
  ResourceOffer,
  AgentState,
  Inventory,
} from '../schemas/types';
import { SocialGraph } from '../agents/SocialGraph';

export class NegotiationEngine {
  private negotiationHistory: Map<string, NegotiationOffer[]>;
  private relationshipScores: Map<string, number>; // key: "agentA:agentB" (legacy, still used for compatibility)
  private socialGraph: SocialGraph;

  constructor(socialGraph?: SocialGraph) {
    this.negotiationHistory = new Map();
    this.relationshipScores = new Map();
    this.socialGraph = socialGraph || new SocialGraph();
  }

  /**
   * Evaluate an offer and determine if the target agent should accept
   * Uses agent personality traits and current context
   */
  evaluateOffer(
    offer: NegotiationOffer,
    context: NegotiationContext
  ): { shouldAccept: boolean; reason: string; confidence: number } {
    const { initiator, target } = context;

    // Calculate value scores
    const offerValue = this.calculateResourceValue(offer.offering);
    const requestValue = this.calculateResourceValue(offer.requesting);
    const netValue = offerValue - requestValue;

    // Personality-based evaluation
    let acceptanceScore = 0;
    let reason = '';

    switch (offer.protocol) {
      case NegotiationProtocol.TRADE:
        acceptanceScore = this.evaluateTrade(offer, context, netValue);
        reason = netValue > 0
          ? 'The trade offers good value'
          : netValue < -10
          ? 'The trade is unfavorable'
          : 'The trade seems fair';
        break;

      case NegotiationProtocol.ALLIANCE:
        acceptanceScore = this.evaluateAlliance(offer, context);
        reason = target.stats.cooperation > 60
          ? 'Cooperation benefits both parties'
          : context.relationshipScore < -30
          ? 'Past conflicts make this alliance risky'
          : 'Alliance could be mutually beneficial';
        break;

      case NegotiationProtocol.THREAT:
        acceptanceScore = this.evaluateThreat(offer, context);
        reason = context.powerBalance < -0.3
          ? 'The threat seems credible, compliance advised'
          : target.stats.aggression > 70
          ? 'Refusing the threat as a show of strength'
          : 'Evaluating threat credibility';
        break;

      case NegotiationProtocol.REQUEST_AID:
        acceptanceScore = this.evaluateAidRequest(offer, context);
        reason = target.stats.empathy > 70
          ? 'Helping others aligns with core values'
          : target.inventory.food + target.inventory.water < 5
          ? 'Cannot spare resources at this time'
          : 'Considering the aid request';
        break;
    }

    // Relationship modifier
    const relationshipModifier = context.relationshipScore / 100;
    acceptanceScore += relationshipModifier * 30;

    // Check if target can actually fulfill the offer
    if (!this.canFulfillOffer(target, offer.requesting)) {
      return {
        shouldAccept: false,
        reason: 'Insufficient resources to fulfill this offer',
        confidence: 1.0,
      };
    }

    const shouldAccept = acceptanceScore > 50;
    const confidence = Math.abs(acceptanceScore - 50) / 50;

    return { shouldAccept, reason, confidence };
  }

  /**
   * Generate a counter-offer based on the original offer and context
   */
  generateCounterOffer(
    agentA: AgentState,
    agentB: AgentState,
    originalOffer: NegotiationOffer,
    context: NegotiationContext
  ): NegotiationOffer | null {
    // Don't counter-offer if relationship is too poor
    if (context.relationshipScore < -70) {
      return null;
    }

    const counterOffer: NegotiationOffer = {
      id: uuidv4(),
      protocol: originalOffer.protocol,
      initiatorId: agentB.id,
      targetId: agentA.id,
      offering: {},
      requesting: {},
      timestamp: Date.now(),
    };

    switch (originalOffer.protocol) {
      case NegotiationProtocol.TRADE:
        // Adjust the trade to be more favorable
        counterOffer.offering = this.adjustResourceOffer(
          originalOffer.requesting,
          0.7
        );
        counterOffer.requesting = this.adjustResourceOffer(
          originalOffer.offering,
          1.3
        );
        counterOffer.terms = 'Counter-offer: adjusted trade terms for better balance';
        break;

      case NegotiationProtocol.ALLIANCE:
        // Propose alliance with different conditions
        counterOffer.offering = { food: 1, water: 1 };
        counterOffer.requesting = { food: 1, water: 1 };
        counterOffer.conditions = {
          duration: Math.floor((originalOffer.conditions?.duration || 10) * 0.7),
          exclusivity: false,
          protection: agentB.stats.cooperation > 70,
        };
        counterOffer.terms = 'Counter-offer: alliance with modified duration';
        break;

      case NegotiationProtocol.THREAT:
        // Counter-threat with demands
        if (agentB.stats.aggression > 60) {
          counterOffer.protocol = NegotiationProtocol.THREAT;
          counterOffer.offering = {};
          counterOffer.requesting = { food: 2, water: 2 };
          counterOffer.terms = 'Counter-threat: back down or face consequences';
        } else {
          // Try to negotiate peace
          counterOffer.protocol = NegotiationProtocol.TRADE;
          counterOffer.offering = { food: 1 };
          counterOffer.requesting = {};
          counterOffer.terms = 'Peace offering to avoid conflict';
        }
        break;

      case NegotiationProtocol.REQUEST_AID:
        // Offer partial aid
        counterOffer.offering = this.adjustResourceOffer(
          originalOffer.requesting,
          0.5
        );
        counterOffer.requesting = {};
        counterOffer.terms = 'Can provide partial assistance';
        break;
    }

    return counterOffer;
  }

  /**
   * Compute the final outcome of a negotiation
   */
  computeOutcome(
    initiator: AgentState,
    target: AgentState,
    offer: NegotiationOffer,
    response: NegotiationResponse
  ): NegotiationOutcome {
    const outcome: NegotiationOutcome = {
      success: response.accepted,
      offer,
      response,
      effects: {},
      consequences: [],
    };

    if (!response.accepted) {
      // Update relationship score negatively
      this.updateRelationship(initiator.id, target.id, -5);

      // Update social graph for rejection
      this.socialGraph.adjustTrust(initiator.id, target.id, -5);
      this.socialGraph.adjustRespect(initiator.id, target.id, -3);

      outcome.consequences.push(`${target.name} rejected ${initiator.name}'s offer`);

      // Check for threat consequences
      if (offer.protocol === NegotiationProtocol.THREAT) {
        outcome.consequences.push('Threat rejected - potential for future conflict');
        this.updateRelationship(initiator.id, target.id, -10);

        // Rejecting a threat increases rivalry and reduces fear
        this.socialGraph.adjustRivalry(target.id, initiator.id, 15);
        this.socialGraph.adjustFear(target.id, initiator.id, -5);
        this.socialGraph.adjustRespect(initiator.id, target.id, 10); // Respects bravery
      }

      return outcome;
    }

    // Process accepted offer
    switch (offer.protocol) {
      case NegotiationProtocol.TRADE:
        outcome.effects.resourceTransfers = [
          {
            from: initiator.id,
            to: target.id,
            resources: offer.offering,
          },
          {
            from: target.id,
            to: initiator.id,
            resources: offer.requesting,
          },
        ];
        outcome.consequences.push(
          `Trade completed: ${this.describeResources(offer.offering)} ↔ ${this.describeResources(offer.requesting)}`
        );
        this.updateRelationship(initiator.id, target.id, 10);

        // Update social graph for successful trade (mutual)
        this.socialGraph.adjustTrust(initiator.id, target.id, 8);
        this.socialGraph.adjustTrust(target.id, initiator.id, 8);
        this.socialGraph.adjustRespect(initiator.id, target.id, 3);
        this.socialGraph.adjustRespect(target.id, initiator.id, 3);
        break;

      case NegotiationProtocol.ALLIANCE:
        outcome.effects.allianceFormed = true;
        outcome.consequences.push(
          `${initiator.name} and ${target.name} formed an alliance${
            offer.conditions?.duration ? ` for ${offer.conditions.duration} turns` : ''
          }`
        );
        this.updateRelationship(initiator.id, target.id, 25);

        // Update social graph for alliance formation (strong mutual bond)
        this.socialGraph.adjustTrust(initiator.id, target.id, 15);
        this.socialGraph.adjustTrust(target.id, initiator.id, 15);
        this.socialGraph.adjustLoyalty(initiator.id, target.id, 20);
        this.socialGraph.adjustLoyalty(target.id, initiator.id, 20);
        this.socialGraph.adjustRespect(initiator.id, target.id, 10);
        this.socialGraph.adjustRespect(target.id, initiator.id, 10);
        break;

      case NegotiationProtocol.THREAT:
        outcome.effects.threatIssued = true;
        if (offer.requesting && Object.keys(offer.requesting).length > 0) {
          outcome.effects.resourceTransfers = [
            {
              from: target.id,
              to: initiator.id,
              resources: offer.requesting,
            },
          ];
          outcome.consequences.push(
            `${target.name} complied with ${initiator.name}'s threat, surrendering ${this.describeResources(
              offer.requesting
            )}`
          );
        } else {
          outcome.consequences.push(`${target.name} backed down from ${initiator.name}'s threat`);
        }
        this.updateRelationship(initiator.id, target.id, -15);

        // Update social graph for threat (creates fear and rivalry)
        this.socialGraph.adjustFear(target.id, initiator.id, 20);
        this.socialGraph.adjustRivalry(target.id, initiator.id, 10);
        this.socialGraph.adjustTrust(target.id, initiator.id, -15);
        this.socialGraph.adjustLoyalty(target.id, initiator.id, -20);
        // Initiator may gain respect for being powerful, but loses trust
        this.socialGraph.adjustRespect(target.id, initiator.id, 5);
        break;

      case NegotiationProtocol.REQUEST_AID:
        outcome.effects.aidProvided = true;
        outcome.effects.resourceTransfers = [
          {
            from: target.id,
            to: initiator.id,
            resources: offer.requesting,
          },
        ];
        outcome.consequences.push(
          `${target.name} provided aid to ${initiator.name}: ${this.describeResources(offer.requesting)}`
        );
        this.updateRelationship(initiator.id, target.id, 15);

        // Update social graph for aid (creates trust and loyalty)
        this.socialGraph.adjustTrust(initiator.id, target.id, 12);
        this.socialGraph.adjustLoyalty(initiator.id, target.id, 15);
        this.socialGraph.adjustRespect(initiator.id, target.id, 8);
        // Target feels good about helping
        this.socialGraph.adjustRespect(target.id, initiator.id, 3);
        break;
    }

    // Record in history
    this.recordNegotiation(offer);

    return outcome;
  }

  /**
   * Build negotiation context from current game state
   */
  buildContext(
    initiator: AgentState,
    target: AgentState,
    turn: number
  ): NegotiationContext {
    const relationshipKey = this.getRelationshipKey(initiator.id, target.id);
    const relationshipScore = this.relationshipScores.get(relationshipKey) || 0;

    // Calculate power balance
    const initiatorPower = this.calculatePowerScore(initiator);
    const targetPower = this.calculatePowerScore(target);
    const powerBalance = (initiatorPower - targetPower) / Math.max(initiatorPower, targetPower, 1);

    // Get recent negotiation history
    const recentHistory = this.negotiationHistory.get(relationshipKey) || [];

    return {
      initiator,
      target,
      turn,
      recentHistory,
      relationshipScore,
      powerBalance,
    };
  }

  /**
   * Private helper methods
   */

  private evaluateTrade(
    offer: NegotiationOffer,
    context: NegotiationContext,
    netValue: number
  ): number {
    let score = 50 + netValue * 2;

    // Cooperative agents are more willing to trade even if slightly unfavorable
    if (context.target.stats.cooperation > 70) {
      score += 10;
    }

    // Agents low on resources are more desperate
    const totalResources =
      context.target.inventory.food +
      context.target.inventory.water +
      context.target.inventory.material;
    if (totalResources < 5) {
      score += 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  private evaluateAlliance(offer: NegotiationOffer, context: NegotiationContext): number {
    let score = 50;

    // High cooperation agents love alliances
    score += (context.target.stats.cooperation - 50) * 0.6;

    // Low empathy agents are suspicious
    score -= (50 - context.target.stats.empathy) * 0.3;

    // Power balance affects willingness
    if (context.powerBalance < -0.2) {
      // Target is stronger, less need for alliance
      score -= 15;
    } else if (context.powerBalance > 0.2) {
      // Initiator is stronger, might be beneficial
      score += 10;
    }

    // Existing alliances matter
    if (context.target.allegiances.length > 3) {
      score -= 10; // Too many alliances already
    }

    return Math.max(0, Math.min(100, score));
  }

  private evaluateThreat(offer: NegotiationOffer, context: NegotiationContext): number {
    let score = 50;

    // Power balance is crucial for threats
    score += context.powerBalance * 50;

    // High aggression agents resist threats
    score -= (context.target.stats.aggression - 50) * 0.5;

    // Risk-averse agents are more likely to comply
    score += (50 - context.target.stats.riskTolerance) * 0.4;

    // Health status affects decision
    if (context.target.health < 40) {
      score += 20; // More likely to comply when weak
    }

    return Math.max(0, Math.min(100, score));
  }

  private evaluateAidRequest(offer: NegotiationOffer, context: NegotiationContext): number {
    let score = 50;

    // Empathy is the primary factor
    score += (context.target.stats.empathy - 50) * 0.8;

    // Cooperation also matters
    score += (context.target.stats.cooperation - 50) * 0.4;

    // Resource availability
    const canSpare =
      context.target.inventory.food > 5 || context.target.inventory.water > 5;
    if (!canSpare) {
      score -= 30;
    }

    // Existing relationship
    if (context.relationshipScore > 30) {
      score += 15;
    }

    // Allied agents are more likely to help
    if (context.target.allegiances.includes(context.initiator.id)) {
      score += 25;
    }

    return Math.max(0, Math.min(100, score));
  }

  private calculateResourceValue(resources: ResourceOffer): number {
    return (resources.food || 0) * 3 + (resources.water || 0) * 3 + (resources.material || 0) * 2;
  }

  private calculatePowerScore(agent: AgentState): number {
    return (
      agent.health * 0.4 +
      agent.stats.aggression * 0.3 +
      agent.stats.energy * 0.2 +
      (agent.inventory.food + agent.inventory.water) * 2
    );
  }

  private adjustResourceOffer(original: ResourceOffer, multiplier: number): ResourceOffer {
    return {
      food: original.food ? Math.ceil(original.food * multiplier) : undefined,
      water: original.water ? Math.ceil(original.water * multiplier) : undefined,
      material: original.material ? Math.ceil(original.material * multiplier) : undefined,
    };
  }

  private canFulfillOffer(agent: AgentState, resources: ResourceOffer): boolean {
    return (
      agent.inventory.food >= (resources.food || 0) &&
      agent.inventory.water >= (resources.water || 0) &&
      agent.inventory.material >= (resources.material || 0)
    );
  }

  private describeResources(resources: ResourceOffer): string {
    const parts: string[] = [];
    if (resources.food) parts.push(`${resources.food} food`);
    if (resources.water) parts.push(`${resources.water} water`);
    if (resources.material) parts.push(`${resources.material} material`);
    return parts.length > 0 ? parts.join(', ') : 'nothing';
  }

  private getRelationshipKey(agentA: string, agentB: string): string {
    return [agentA, agentB].sort().join(':');
  }

  private updateRelationship(agentA: string, agentB: string, delta: number): void {
    const key = this.getRelationshipKey(agentA, agentB);
    const current = this.relationshipScores.get(key) || 0;
    const newScore = Math.max(-100, Math.min(100, current + delta));
    this.relationshipScores.set(key, newScore);
  }

  private recordNegotiation(offer: NegotiationOffer): void {
    const key = this.getRelationshipKey(offer.initiatorId, offer.targetId);
    const history = this.negotiationHistory.get(key) || [];
    history.push(offer);

    // Keep only last 20 negotiations
    if (history.length > 20) {
      history.shift();
    }

    this.negotiationHistory.set(key, history);
  }

  /**
   * Public utility methods
   */

  getRelationshipScore(agentA: string, agentB: string): number {
    const key = this.getRelationshipKey(agentA, agentB);
    return this.relationshipScores.get(key) || 0;
  }

  getNegotiationHistory(agentA: string, agentB: string): NegotiationOffer[] {
    const key = this.getRelationshipKey(agentA, agentB);
    return this.negotiationHistory.get(key) || [];
  }

  resetRelationship(agentA: string, agentB: string): void {
    const key = this.getRelationshipKey(agentA, agentB);
    this.relationshipScores.delete(key);
    this.negotiationHistory.delete(key);
  }

  reset(): void {
    this.negotiationHistory.clear();
    this.relationshipScores.clear();
    this.socialGraph.reset();
  }

  /**
   * Get the social graph for external access
   */
  getSocialGraph(): SocialGraph {
    return this.socialGraph;
  }
}
