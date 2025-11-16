/**
 * Semantic Memory
 * Stores learned facts, beliefs, and generalizations
 */

export type FactCategory =
  | 'agent_trait' // "Agent X is aggressive"
  | 'agent_behavior' // "Agent X usually attacks when low on health"
  | 'relationship' // "Agent X trusts Agent Y"
  | 'world_knowledge' // "Resources spawn in the north"
  | 'strategy' // "Defensive play works better in scarcity"
  | 'causality' // "Attacking allies leads to betrayal"
  | 'prediction'; // "Agent X will likely attack next turn"

export interface SemanticFact {
  id: string;
  category: FactCategory;
  subject: string; // What/who the fact is about
  predicate: string; // The fact itself (short description)
  detail: string; // Longer explanation
  confidence: number; // 0-100 (how sure are we)
  supportingEvidenceCount: number; // How many episodes support this
  contradictingEvidenceCount: number; // How many episodes contradict this
  createdAt: number;
  lastReinforced: number;
  lastChallenged: number;
  importance: number; // 0-100
  metadata?: {
    relatedAgents?: string[];
    relatedFacts?: string[]; // IDs of related facts
    strength?: number; // For quantitative facts
    [key: string]: any;
  };
}

export interface FactQuery {
  category?: FactCategory;
  subject?: string;
  relatedAgent?: string;
  minConfidence?: number;
  minImportance?: number;
  limit?: number;
}

export class SemanticMemory {
  private facts: Map<string, SemanticFact>;
  private maxFacts: number;
  private confidenceThreshold: number; // Minimum confidence to keep fact

  constructor(maxFacts: number = 50, confidenceThreshold: number = 20) {
    this.facts = new Map();
    this.maxFacts = maxFacts;
    this.confidenceThreshold = confidenceThreshold;
  }

  /**
   * Learn a new fact or reinforce existing one
   */
  learn(
    category: FactCategory,
    subject: string,
    predicate: string,
    detail: string,
    importance: number = 50,
    metadata?: SemanticFact['metadata']
  ): SemanticFact {
    // Check if similar fact exists
    const existing = this.findSimilarFact(category, subject, predicate);

    if (existing) {
      // Reinforce existing fact
      existing.supportingEvidenceCount++;
      existing.lastReinforced = Date.now();
      existing.confidence = Math.min(100, existing.confidence + 5);
      existing.importance = Math.max(existing.importance, importance);

      if (metadata) {
        existing.metadata = { ...existing.metadata, ...metadata };
      }

      return existing;
    }

    // Create new fact
    const fact: SemanticFact = {
      id: this.generateId(),
      category,
      subject,
      predicate,
      detail,
      confidence: 60, // New facts start at moderate confidence
      supportingEvidenceCount: 1,
      contradictingEvidenceCount: 0,
      createdAt: Date.now(),
      lastReinforced: Date.now(),
      lastChallenged: 0,
      importance,
      metadata,
    };

    this.facts.set(fact.id, fact);
    this.enforceMemoryLimit();

    return fact;
  }

  /**
   * Challenge a fact (reduce confidence when contradicting evidence appears)
   */
  challenge(factId: string): void {
    const fact = this.facts.get(factId);
    if (!fact) return;

    fact.contradictingEvidenceCount++;
    fact.lastChallenged = Date.now();
    fact.confidence = Math.max(0, fact.confidence - 10);

    // Remove facts with very low confidence
    if (fact.confidence < this.confidenceThreshold) {
      this.facts.delete(factId);
    }
  }

  /**
   * Challenge facts about a subject
   */
  challengeFactsAbout(subject: string): void {
    for (const fact of this.facts.values()) {
      if (fact.subject === subject) {
        this.challenge(fact.id);
      }
    }
  }

  /**
   * Retrieve facts matching query
   */
  recall(query: FactQuery = {}): SemanticFact[] {
    let results = Array.from(this.facts.values());

    if (query.category) {
      results = results.filter(f => f.category === query.category);
    }

    if (query.subject) {
      results = results.filter(f => f.subject === query.subject);
    }

    if (query.relatedAgent) {
      results = results.filter(f =>
        f.metadata?.relatedAgents?.includes(query.relatedAgent!)
      );
    }

    if (query.minConfidence !== undefined) {
      results = results.filter(f => f.confidence >= query.minConfidence!);
    }

    if (query.minImportance !== undefined) {
      results = results.filter(f => f.importance >= query.minImportance!);
    }

    // Sort by confidence and importance
    results.sort((a, b) => {
      const scoreA = a.confidence * 0.6 + a.importance * 0.4;
      const scoreB = b.confidence * 0.6 + b.importance * 0.4;
      return scoreB - scoreA;
    });

    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Get facts about a specific agent
   */
  getFactsAbout(agentId: string, limit: number = 10): SemanticFact[] {
    return this.recall({
      subject: agentId,
      limit,
    });
  }

  /**
   * Get facts by category
   */
  getFactsByCategory(category: FactCategory, limit: number = 10): SemanticFact[] {
    return this.recall({
      category,
      limit,
    });
  }

  /**
   * Get most confident facts
   */
  getMostConfident(limit: number = 10): SemanticFact[] {
    return Array.from(this.facts.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  /**
   * Get beliefs about agent behavior
   */
  getBeliefsAboutAgent(agentId: string): {
    traits: SemanticFact[];
    behaviors: SemanticFact[];
    relationships: SemanticFact[];
  } {
    const allFacts = this.getFactsAbout(agentId, 50);

    return {
      traits: allFacts.filter(f => f.category === 'agent_trait'),
      behaviors: allFacts.filter(f => f.category === 'agent_behavior'),
      relationships: allFacts.filter(f => f.category === 'relationship'),
    };
  }

  /**
   * Get strategic knowledge
   */
  getStrategicKnowledge(): SemanticFact[] {
    return this.recall({
      category: 'strategy',
      minConfidence: 50,
    });
  }

  /**
   * Get predictions
   */
  getPredictions(minConfidence: number = 40): SemanticFact[] {
    return this.recall({
      category: 'prediction',
      minConfidence,
    });
  }

  /**
   * Update confidence based on outcome
   */
  updateConfidence(factId: string, wasCorrect: boolean): void {
    const fact = this.facts.get(factId);
    if (!fact) return;

    if (wasCorrect) {
      fact.supportingEvidenceCount++;
      fact.confidence = Math.min(100, fact.confidence + 8);
      fact.lastReinforced = Date.now();
    } else {
      fact.contradictingEvidenceCount++;
      fact.confidence = Math.max(0, fact.confidence - 12);
      fact.lastChallenged = Date.now();
    }

    // Remove very low confidence facts
    if (fact.confidence < this.confidenceThreshold) {
      this.facts.delete(factId);
    }
  }

  /**
   * Merge similar facts
   */
  mergeSimilarFacts(): number {
    let mergeCount = 0;
    const factsList = Array.from(this.facts.values());

    for (let i = 0; i < factsList.length; i++) {
      for (let j = i + 1; j < factsList.length; j++) {
        const factA = factsList[i];
        const factB = factsList[j];

        if (
          factA.category === factB.category &&
          factA.subject === factB.subject &&
          this.areSimilarPredicates(factA.predicate, factB.predicate)
        ) {
          // Merge B into A
          factA.supportingEvidenceCount += factB.supportingEvidenceCount;
          factA.contradictingEvidenceCount += factB.contradictingEvidenceCount;
          factA.confidence = Math.min(
            100,
            (factA.confidence + factB.confidence) / 2 + 10
          );
          factA.importance = Math.max(factA.importance, factB.importance);

          this.facts.delete(factB.id);
          mergeCount++;
        }
      }
    }

    return mergeCount;
  }

  /**
   * Get memory statistics
   */
  getStats(): {
    totalFacts: number;
    averageConfidence: number;
    categoryDistribution: Record<string, number>;
    highConfidenceFacts: number;
    lowConfidenceFacts: number;
  } {
    const facts = Array.from(this.facts.values());

    const avgConfidence = facts.length > 0
      ? facts.reduce((sum, f) => sum + f.confidence, 0) / facts.length
      : 0;

    const categoryDistribution: Record<string, number> = {};
    for (const fact of facts) {
      categoryDistribution[fact.category] = (categoryDistribution[fact.category] || 0) + 1;
    }

    const highConfidence = facts.filter(f => f.confidence >= 80).length;
    const lowConfidence = facts.filter(f => f.confidence < 40).length;

    return {
      totalFacts: facts.length,
      averageConfidence: avgConfidence,
      categoryDistribution,
      highConfidenceFacts: highConfidence,
      lowConfidenceFacts: lowConfidence,
    };
  }

  /**
   * Clear all facts
   */
  clear(): void {
    this.facts.clear();
  }

  /**
   * Get all facts (for export/debugging)
   */
  getAllFacts(): SemanticFact[] {
    return Array.from(this.facts.values());
  }

  /**
   * Private helpers
   */

  private generateId(): string {
    return `fact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private findSimilarFact(
    category: FactCategory,
    subject: string,
    predicate: string
  ): SemanticFact | undefined {
    for (const fact of this.facts.values()) {
      if (
        fact.category === category &&
        fact.subject === subject &&
        this.areSimilarPredicates(fact.predicate, predicate)
      ) {
        return fact;
      }
    }
    return undefined;
  }

  private areSimilarPredicates(a: string, b: string): boolean {
    // Simple similarity check - can be made more sophisticated
    const aNorm = a.toLowerCase().trim();
    const bNorm = b.toLowerCase().trim();

    // Exact match
    if (aNorm === bNorm) return true;

    // Contains check (one contains the other)
    if (aNorm.includes(bNorm) || bNorm.includes(aNorm)) return true;

    // Word overlap check
    const wordsA = new Set(aNorm.split(/\s+/));
    const wordsB = new Set(bNorm.split(/\s+/));
    const overlap = [...wordsA].filter(w => wordsB.has(w)).length;
    const minWords = Math.min(wordsA.size, wordsB.size);

    return overlap / minWords > 0.6; // 60% word overlap
  }

  private enforceMemoryLimit(): void {
    if (this.facts.size <= this.maxFacts) {
      return;
    }

    // Remove facts with lowest confidence and importance
    const facts = Array.from(this.facts.values());
    facts.sort((a, b) => {
      const scoreA = a.confidence * 0.6 + a.importance * 0.4;
      const scoreB = b.confidence * 0.6 + b.importance * 0.4;
      return scoreA - scoreB;
    });

    const toRemove = facts.slice(0, this.facts.size - this.maxFacts);
    for (const fact of toRemove) {
      this.facts.delete(fact.id);
    }
  }
}
