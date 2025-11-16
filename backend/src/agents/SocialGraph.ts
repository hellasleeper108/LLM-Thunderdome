/**
 * Social Graph
 * Maintains a weighted directed graph of social relationships between agents
 * Tracks: trust, fear, respect, rivalry, loyalty
 */

export interface RelationshipWeights {
  trust: number; // 0-100: confidence in another agent's reliability
  fear: number; // 0-100: how much one agent fears another
  respect: number; // 0-100: admiration or regard for another agent
  rivalry: number; // 0-100: competitive tension or antagonism
  loyalty: number; // 0-100: commitment and dedication to another agent
}

export interface SocialRelationship {
  from: string;
  to: string;
  weights: RelationshipWeights;
  lastUpdated: number;
  interactionCount: number;
}

export interface SocialSummary {
  agentId: string;
  outgoing: Map<string, RelationshipWeights>; // Relationships TO other agents
  incoming: Map<string, RelationshipWeights>; // Relationships FROM other agents
  strongestTrusted: string | null;
  mostFeared: string | null;
  mostRespected: string | null;
  biggestRival: string | null;
  mostLoyal: string | null;
}

export class SocialGraph {
  // Directed graph: key is "fromId:toId"
  private relationships: Map<string, SocialRelationship>;
  private decayRate: number; // Per turn decay rate for all relationships

  constructor(decayRate: number = 0.5) {
    this.relationships = new Map();
    this.decayRate = decayRate;
  }

  /**
   * Adjust trust between two agents
   */
  adjustTrust(fromId: string, toId: string, delta: number): void {
    this.adjustRelationship(fromId, toId, 'trust', delta);
  }

  /**
   * Adjust fear between two agents
   */
  adjustFear(fromId: string, toId: string, delta: number): void {
    this.adjustRelationship(fromId, toId, 'fear', delta);
  }

  /**
   * Adjust respect between two agents
   */
  adjustRespect(fromId: string, toId: string, delta: number): void {
    this.adjustRelationship(fromId, toId, 'respect', delta);
  }

  /**
   * Adjust rivalry between two agents
   */
  adjustRivalry(fromId: string, toId: string, delta: number): void {
    this.adjustRelationship(fromId, toId, 'rivalry', delta);
  }

  /**
   * Adjust loyalty between two agents
   */
  adjustLoyalty(fromId: string, toId: string, delta: number): void {
    this.adjustRelationship(fromId, toId, 'loyalty', delta);
  }

  /**
   * Get relationship from agent A to agent B
   */
  getRelationship(fromId: string, toId: string): RelationshipWeights | null {
    const key = this.getKey(fromId, toId);
    const relationship = this.relationships.get(key);
    return relationship ? { ...relationship.weights } : null;
  }

  /**
   * Get full social relationship details
   */
  getFullRelationship(fromId: string, toId: string): SocialRelationship | null {
    const key = this.getKey(fromId, toId);
    const relationship = this.relationships.get(key);
    return relationship ? { ...relationship } : null;
  }

  /**
   * Get all relationships for an agent (both outgoing and incoming)
   */
  getAllRelationships(agentId: string): {
    outgoing: SocialRelationship[];
    incoming: SocialRelationship[];
  } {
    const outgoing: SocialRelationship[] = [];
    const incoming: SocialRelationship[] = [];

    for (const relationship of this.relationships.values()) {
      if (relationship.from === agentId) {
        outgoing.push({ ...relationship });
      }
      if (relationship.to === agentId) {
        incoming.push({ ...relationship });
      }
    }

    return { outgoing, incoming };
  }

  /**
   * Get social summary for an agent
   */
  getSocialSummary(agentId: string): SocialSummary {
    const { outgoing, incoming } = this.getAllRelationships(agentId);

    const outgoingMap = new Map<string, RelationshipWeights>();
    const incomingMap = new Map<string, RelationshipWeights>();

    for (const rel of outgoing) {
      outgoingMap.set(rel.to, rel.weights);
    }

    for (const rel of incoming) {
      incomingMap.set(rel.from, rel.weights);
    }

    // Find strongest relationships
    let strongestTrusted: string | null = null;
    let mostFeared: string | null = null;
    let mostRespected: string | null = null;
    let biggestRival: string | null = null;
    let mostLoyal: string | null = null;

    let maxTrust = 0;
    let maxFear = 0;
    let maxRespect = 0;
    let maxRivalry = 0;
    let maxLoyalty = 0;

    for (const rel of outgoing) {
      if (rel.weights.trust > maxTrust) {
        maxTrust = rel.weights.trust;
        strongestTrusted = rel.to;
      }
      if (rel.weights.fear > maxFear) {
        maxFear = rel.weights.fear;
        mostFeared = rel.to;
      }
      if (rel.weights.respect > maxRespect) {
        maxRespect = rel.weights.respect;
        mostRespected = rel.to;
      }
      if (rel.weights.rivalry > maxRivalry) {
        maxRivalry = rel.weights.rivalry;
        biggestRival = rel.to;
      }
      if (rel.weights.loyalty > maxLoyalty) {
        maxLoyalty = rel.weights.loyalty;
        mostLoyal = rel.to;
      }
    }

    return {
      agentId,
      outgoing: outgoingMap,
      incoming: incomingMap,
      strongestTrusted,
      mostFeared,
      mostRespected,
      biggestRival,
      mostLoyal,
    };
  }

  /**
   * Get agents sorted by a specific relationship type
   */
  getStrongestRelationships(
    fromId: string,
    type: keyof RelationshipWeights,
    limit: number = 5
  ): Array<{ agentId: string; value: number }> {
    const { outgoing } = this.getAllRelationships(fromId);

    return outgoing
      .map((rel) => ({
        agentId: rel.to,
        value: rel.weights[type],
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  }

  /**
   * Decay all relationships by the decay rate
   * Call this each turn to make relationships fade over time
   */
  decayAllRelationships(): void {
    for (const relationship of this.relationships.values()) {
      relationship.weights.trust = Math.max(
        0,
        relationship.weights.trust - this.decayRate
      );
      relationship.weights.fear = Math.max(
        0,
        relationship.weights.fear - this.decayRate
      );
      relationship.weights.respect = Math.max(
        0,
        relationship.weights.respect - this.decayRate
      );
      relationship.weights.rivalry = Math.max(
        0,
        relationship.weights.rivalry - this.decayRate
      );
      relationship.weights.loyalty = Math.max(
        0,
        relationship.weights.loyalty - this.decayRate
      );

      // Remove relationships that have decayed to near-zero
      if (this.isNearZero(relationship.weights)) {
        this.relationships.delete(this.getKey(relationship.from, relationship.to));
      }
    }
  }

  /**
   * Get overall relationship sentiment (-100 to 100)
   * Positive relationships (trust, respect, loyalty) vs negative (fear, rivalry)
   */
  getRelationshipSentiment(fromId: string, toId: string): number {
    const weights = this.getRelationship(fromId, toId);
    if (!weights) {
      return 0;
    }

    const positive = weights.trust + weights.respect + weights.loyalty;
    const negative = weights.fear + weights.rivalry;

    // Normalize to -100 to 100 range
    return Math.max(-100, Math.min(100, (positive - negative) / 3));
  }

  /**
   * Check if two agents have a strong positive relationship
   */
  hasStrongBond(fromId: string, toId: string, threshold: number = 60): boolean {
    const weights = this.getRelationship(fromId, toId);
    if (!weights) {
      return false;
    }

    return (
      (weights.trust > threshold && weights.loyalty > threshold) ||
      (weights.trust > threshold && weights.respect > threshold)
    );
  }

  /**
   * Check if two agents are rivals
   */
  areRivals(fromId: string, toId: string, threshold: number = 60): boolean {
    const weights = this.getRelationship(fromId, toId);
    if (!weights) {
      return false;
    }

    return weights.rivalry > threshold;
  }

  /**
   * Reset all relationships
   */
  reset(): void {
    this.relationships.clear();
  }

  /**
   * Get all relationships (for debugging or export)
   */
  getAllRelationshipData(): SocialRelationship[] {
    return Array.from(this.relationships.values()).map((rel) => ({ ...rel }));
  }

  /**
   * Private helper methods
   */

  private adjustRelationship(
    fromId: string,
    toId: string,
    type: keyof RelationshipWeights,
    delta: number
  ): void {
    if (fromId === toId) {
      return; // Agents cannot have relationships with themselves
    }

    const key = this.getKey(fromId, toId);
    let relationship = this.relationships.get(key);

    if (!relationship) {
      relationship = {
        from: fromId,
        to: toId,
        weights: {
          trust: 0,
          fear: 0,
          respect: 0,
          rivalry: 0,
          loyalty: 0,
        },
        lastUpdated: Date.now(),
        interactionCount: 0,
      };
      this.relationships.set(key, relationship);
    }

    // Update the specific weight
    relationship.weights[type] = Math.max(
      0,
      Math.min(100, relationship.weights[type] + delta)
    );

    relationship.lastUpdated = Date.now();
    relationship.interactionCount++;

    // Apply emotional dynamics
    this.applyEmotionalDynamics(relationship, type, delta);
  }

  /**
   * Apply emotional dynamics - certain relationships affect others
   * E.g., high trust reduces fear, high rivalry reduces trust
   */
  private applyEmotionalDynamics(
    relationship: SocialRelationship,
    changedType: keyof RelationshipWeights,
    delta: number
  ): void {
    const weights = relationship.weights;

    switch (changedType) {
      case 'trust':
        // High trust reduces fear and rivalry
        if (delta > 0) {
          weights.fear = Math.max(0, weights.fear - delta * 0.3);
          weights.rivalry = Math.max(0, weights.rivalry - delta * 0.2);
        }
        break;

      case 'fear':
        // High fear reduces trust and loyalty
        if (delta > 0) {
          weights.trust = Math.max(0, weights.trust - delta * 0.4);
          weights.loyalty = Math.max(0, weights.loyalty - delta * 0.3);
        }
        break;

      case 'respect':
        // Respect slightly increases trust
        if (delta > 0) {
          weights.trust = Math.min(100, weights.trust + delta * 0.2);
        }
        break;

      case 'rivalry':
        // Rivalry reduces trust and loyalty
        if (delta > 0) {
          weights.trust = Math.max(0, weights.trust - delta * 0.3);
          weights.loyalty = Math.max(0, weights.loyalty - delta * 0.4);
        }
        break;

      case 'loyalty':
        // Loyalty increases trust
        if (delta > 0) {
          weights.trust = Math.min(100, weights.trust + delta * 0.3);
        }
        break;
    }
  }

  private getKey(fromId: string, toId: string): string {
    return `${fromId}:${toId}`;
  }

  private isNearZero(weights: RelationshipWeights): boolean {
    return (
      weights.trust < 1 &&
      weights.fear < 1 &&
      weights.respect < 1 &&
      weights.rivalry < 1 &&
      weights.loyalty < 1
    );
  }
}
