/**
 * Memory Manager
 * Orchestrates episodic and semantic memory, handles consolidation and compression
 */

import { EpisodicMemory, Episode, EpisodeQuery } from './EpisodicMemory';
import { SemanticMemory, SemanticFact, FactCategory, FactQuery } from './SemanticMemory';

export interface MemoryConfig {
  maxEpisodes?: number;
  maxFacts?: number;
  episodeDecayRate?: number;
  consolidationInterval?: number; // How often to consolidate (in turns)
}

export interface MemorySummary {
  episodic: {
    total: number;
    averageStrength: number;
    recent: Episode[];
    important: Episode[];
  };
  semantic: {
    total: number;
    averageConfidence: number;
    confident: SemanticFact[];
    strategic: SemanticFact[];
  };
  consolidated: number; // Number of episodes converted to facts
}

export class MemoryManager {
  private episodicMemory: EpisodicMemory;
  private semanticMemory: SemanticMemory;
  private agentId: string;
  private consolidationInterval: number;
  private lastConsolidation: number;
  private consolidationCount: number;

  constructor(agentId: string, config: MemoryConfig = {}) {
    this.agentId = agentId;
    this.episodicMemory = new EpisodicMemory(
      config.maxEpisodes || 100,
      config.episodeDecayRate || 0.5
    );
    this.semanticMemory = new SemanticMemory(
      config.maxFacts || 50,
      20 // confidence threshold
    );
    this.consolidationInterval = config.consolidationInterval || 10;
    this.lastConsolidation = 0;
    this.consolidationCount = 0;
  }

  /**
   * Store a new episodic memory
   */
  rememberEpisode(
    turn: number,
    type: Episode['type'],
    event: string,
    description: string,
    options: {
      otherAgents?: string[];
      location?: { x: number; y: number };
      emotion?: Episode['emotion'];
      importance?: number;
      metadata?: Episode['metadata'];
    } = {}
  ): Episode {
    return this.episodicMemory.store({
      turn,
      type,
      event,
      description,
      agentId: this.agentId,
      otherAgents: options.otherAgents,
      location: options.location,
      emotion: options.emotion,
      importance: options.importance ?? 50,
      metadata: options.metadata,
    });
  }

  /**
   * Learn a new semantic fact
   */
  learnFact(
    category: FactCategory,
    subject: string,
    predicate: string,
    detail: string,
    importance: number = 50,
    metadata?: SemanticFact['metadata']
  ): SemanticFact {
    return this.semanticMemory.learn(
      category,
      subject,
      predicate,
      detail,
      importance,
      metadata
    );
  }

  /**
   * Recall episodic memories
   */
  recallEpisodes(query: EpisodeQuery = {}): Episode[] {
    return this.episodicMemory.recall(query);
  }

  /**
   * Recall semantic facts
   */
  recallFacts(query: FactQuery = {}): SemanticFact[] {
    return this.semanticMemory.recall(query);
  }

  /**
   * Get recent interactions with a specific agent
   */
  getHistoryWith(agentId: string, limit: number = 10): Episode[] {
    return this.episodicMemory.getEpisodesWithAgent(agentId, limit);
  }

  /**
   * Get beliefs about a specific agent
   */
  getBeliefsAbout(agentId: string): {
    traits: SemanticFact[];
    behaviors: SemanticFact[];
    relationships: SemanticFact[];
  } {
    return this.semanticMemory.getBeliefsAboutAgent(agentId);
  }

  /**
   * Check if we remember a specific type of event with an agent
   */
  hasMemoryOf(event: string, agentId: string): boolean {
    return this.episodicMemory.hasSimilarEpisode(event, [agentId], 20);
  }

  /**
   * Get decision modifiers based on memory
   * Returns numeric modifiers for different decision types
   */
  getDecisionModifiers(targetAgentId?: string): {
    trustModifier: number; // -1 to +1
    aggressionModifier: number;
    cooperationModifier: number;
    riskModifier: number;
    reasoning: string[];
  } {
    const modifiers = {
      trustModifier: 0,
      aggressionModifier: 0,
      cooperationModifier: 0,
      riskModifier: 0,
      reasoning: [] as string[],
    };

    if (!targetAgentId) {
      // General modifiers based on overall experience
      const recentEpisodes = this.episodicMemory.getRecent(20);
      const negativeEvents = recentEpisodes.filter(e => e.emotion === 'negative').length;
      const positiveEvents = recentEpisodes.filter(e => e.emotion === 'positive').length;

      if (negativeEvents > positiveEvents * 2) {
        modifiers.trustModifier -= 0.3;
        modifiers.aggressionModifier += 0.2;
        modifiers.cooperationModifier -= 0.2;
        modifiers.reasoning.push('Recent negative experiences increasing caution');
      }

      if (positiveEvents > negativeEvents * 2) {
        modifiers.trustModifier += 0.2;
        modifiers.cooperationModifier += 0.2;
        modifiers.reasoning.push('Recent positive experiences encouraging cooperation');
      }

      return modifiers;
    }

    // Specific modifiers for interaction with target agent
    const history = this.getHistoryWith(targetAgentId, 20);
    const beliefs = this.getBeliefsAbout(targetAgentId);

    // Check for betrayals
    const betrayals = history.filter(e =>
      e.event.includes('betray') || e.event.includes('attack') && e.otherAgents?.includes(targetAgentId)
    );

    if (betrayals.length > 0) {
      modifiers.trustModifier -= 0.5 * betrayals.length;
      modifiers.aggressionModifier += 0.3 * betrayals.length;
      modifiers.cooperationModifier -= 0.4 * betrayals.length;
      modifiers.reasoning.push(`Remembers ${betrayals.length} betrayal(s) from ${targetAgentId}`);
    }

    // Check for successful trades
    const trades = history.filter(e => e.event.includes('trade') && e.metadata?.outcome === 'success');

    if (trades.length > 2) {
      modifiers.trustModifier += 0.2;
      modifiers.cooperationModifier += 0.3;
      modifiers.reasoning.push(`${trades.length} successful trades build trust`);
    }

    // Check for alliances
    const alliances = history.filter(e => e.event.includes('alliance'));

    if (alliances.length > 0) {
      modifiers.trustModifier += 0.4;
      modifiers.cooperationModifier += 0.5;
      modifiers.reasoning.push('Alliance history promotes cooperation');
    }

    // Check semantic beliefs about aggression
    const aggressiveBehaviors = beliefs.behaviors.filter(f =>
      f.predicate.toLowerCase().includes('aggress') || f.predicate.toLowerCase().includes('attack')
    );

    if (aggressiveBehaviors.length > 0 && aggressiveBehaviors[0].confidence > 60) {
      modifiers.aggressionModifier -= 0.2; // Be less aggressive to avoid provoking
      modifiers.riskModifier -= 0.3; // Be more cautious
      modifiers.reasoning.push('Remembers target is aggressive - staying cautious');
    }

    // Check beliefs about cooperation
    const cooperativeTraits = beliefs.traits.filter(f =>
      f.predicate.toLowerCase().includes('cooperat') || f.predicate.toLowerCase().includes('friendly')
    );

    if (cooperativeTraits.length > 0 && cooperativeTraits[0].confidence > 60) {
      modifiers.cooperationModifier += 0.3;
      modifiers.trustModifier += 0.2;
      modifiers.reasoning.push('Believes target is cooperative');
    }

    return modifiers;
  }

  /**
   * Update turn and process memory consolidation
   */
  tick(turn: number): void {
    // Decay episodic memories
    this.episodicMemory.tick(turn);

    // Consolidate if it's time
    if (turn - this.lastConsolidation >= this.consolidationInterval) {
      this.consolidate(turn);
      this.lastConsolidation = turn;
    }
  }

  /**
   * Consolidate episodic memories into semantic knowledge
   * Converts frequently accessed or important episodes into general facts
   */
  consolidate(turn: number): number {
    const consolidatable = this.episodicMemory.consolidate();
    let consolidated = 0;

    for (const episode of consolidatable) {
      const fact = this.episodeToFact(episode, turn);
      if (fact) {
        this.semanticMemory.learn(
          fact.category,
          fact.subject,
          fact.predicate,
          fact.detail,
          fact.importance,
          fact.metadata
        );
        consolidated++;
      }
    }

    // Merge similar semantic facts
    this.semanticMemory.mergeSimilarFacts();

    this.consolidationCount += consolidated;
    return consolidated;
  }

  /**
   * Convert an episode to a semantic fact
   */
  private episodeToFact(
    episode: Episode,
    currentTurn: number
  ): {
    category: FactCategory;
    subject: string;
    predicate: string;
    detail: string;
    importance: number;
    metadata?: any;
  } | null {
    // Determine category and extract fact based on episode type and content

    // Attack episodes -> agent behavior/traits
    if (episode.event.includes('attack') && episode.otherAgents && episode.otherAgents.length > 0) {
      const attacker = episode.otherAgents[0];
      return {
        category: 'agent_behavior',
        subject: attacker,
        predicate: 'tends to attack',
        detail: `Has attacked multiple times, showing aggressive tendencies`,
        importance: episode.importance,
        metadata: { episodeCount: 1, lastOccurred: episode.turn },
      };
    }

    // Trade episodes -> agent behavior
    if (episode.event.includes('trade') && episode.otherAgents && episode.otherAgents.length > 0) {
      const trader = episode.otherAgents[0];
      return {
        category: 'agent_behavior',
        subject: trader,
        predicate: 'willing to trade',
        detail: `Has engaged in trades, showing cooperative behavior`,
        importance: episode.importance,
        metadata: { episodeCount: 1, lastOccurred: episode.turn },
      };
    }

    // Alliance episodes -> relationship facts
    if (episode.event.includes('alliance') && episode.otherAgents && episode.otherAgents.length > 0) {
      const ally = episode.otherAgents[0];
      return {
        category: 'relationship',
        subject: ally,
        predicate: 'is a trusted ally',
        detail: `Formed alliance, established mutual trust`,
        importance: Math.min(100, episode.importance + 20),
        metadata: { allianceFormed: episode.turn },
      };
    }

    // Betrayal episodes -> important relationship facts
    if (episode.event.includes('betray') && episode.otherAgents && episode.otherAgents.length > 0) {
      const betrayer = episode.otherAgents[0];
      return {
        category: 'relationship',
        subject: betrayer,
        predicate: 'cannot be trusted',
        detail: `Betrayed trust, proven unreliable`,
        importance: 90,
        metadata: { betrayalOccurred: episode.turn },
      };
    }

    // Resource gathering -> world knowledge
    if (episode.event.includes('gather') && episode.location) {
      return {
        category: 'world_knowledge',
        subject: 'resources',
        predicate: `found near (${episode.location.x}, ${episode.location.y})`,
        detail: `Resources have been found in this area`,
        importance: 40,
        metadata: { location: episode.location },
      };
    }

    return null;
  }

  /**
   * Get comprehensive memory summary
   */
  getSummary(): MemorySummary {
    const episodicStats = this.episodicMemory.getStats();
    const semanticStats = this.semanticMemory.getStats();

    return {
      episodic: {
        total: episodicStats.totalEpisodes,
        averageStrength: episodicStats.averageStrength,
        recent: this.episodicMemory.getRecent(5),
        important: this.episodicMemory.getMostImportant(5),
      },
      semantic: {
        total: semanticStats.totalFacts,
        averageConfidence: semanticStats.averageConfidence,
        confident: this.semanticMemory.getMostConfident(5),
        strategic: this.semanticMemory.getStrategicKnowledge(),
      },
      consolidated: this.consolidationCount,
    };
  }

  /**
   * Export all memory data
   */
  export(): {
    agentId: string;
    episodes: Episode[];
    facts: SemanticFact[];
    stats: {
      episodic: ReturnType<EpisodicMemory['getStats']>;
      semantic: ReturnType<SemanticMemory['getStats']>;
    };
  } {
    return {
      agentId: this.agentId,
      episodes: this.episodicMemory.getAllEpisodes(),
      facts: this.semanticMemory.getAllFacts(),
      stats: {
        episodic: this.episodicMemory.getStats(),
        semantic: this.semanticMemory.getStats(),
      },
    };
  }

  /**
   * Clear all memories
   */
  clear(): void {
    this.episodicMemory.clear();
    this.semanticMemory.clear();
    this.consolidationCount = 0;
    this.lastConsolidation = 0;
  }

  /**
   * Get episodic memory (for advanced queries)
   */
  getEpisodicMemory(): EpisodicMemory {
    return this.episodicMemory;
  }

  /**
   * Get semantic memory (for advanced queries)
   */
  getSemanticMemory(): SemanticMemory {
    return this.semanticMemory;
  }
}
