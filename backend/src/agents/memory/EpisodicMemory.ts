/**
 * Episodic Memory
 * Stores specific experiences and events that happened to the agent
 */

export interface Episode {
  id: string;
  turn: number;
  timestamp: number;
  type: 'action' | 'interaction' | 'observation' | 'internal';

  // What happened
  event: string;
  description: string;

  // Who was involved
  agentId: string; // This agent
  otherAgents?: string[]; // Other agents involved

  // Context
  location?: { x: number; y: number };
  emotion?: 'positive' | 'negative' | 'neutral';
  importance: number; // 0-100

  // Details
  metadata?: {
    actionType?: string;
    outcome?: 'success' | 'failure';
    resourcesGained?: number;
    resourcesLost?: number;
    healthChange?: number;
    relationshipChanges?: Record<string, number>;
    [key: string]: any;
  };

  // Memory strength (decays over time)
  strength: number; // 0-100
  lastAccessed: number;
  accessCount: number;
}

export interface EpisodeQuery {
  type?: Episode['type'];
  event?: string;
  otherAgents?: string[];
  minImportance?: number;
  minStrength?: number;
  turnRange?: { start: number; end: number };
  emotion?: Episode['emotion'];
  limit?: number;
}

export class EpisodicMemory {
  private episodes: Map<string, Episode>;
  private maxEpisodes: number;
  private decayRate: number; // Strength decay per turn
  private currentTurn: number;

  constructor(maxEpisodes: number = 100, decayRate: number = 0.5) {
    this.episodes = new Map();
    this.maxEpisodes = maxEpisodes;
    this.decayRate = decayRate;
    this.currentTurn = 0;
  }

  /**
   * Store a new episode
   */
  store(episode: Omit<Episode, 'id' | 'timestamp' | 'strength' | 'lastAccessed' | 'accessCount'>): Episode {
    const newEpisode: Episode = {
      ...episode,
      id: this.generateId(),
      timestamp: Date.now(),
      strength: 100, // Fresh memories start at full strength
      lastAccessed: Date.now(),
      accessCount: 0,
    };

    this.episodes.set(newEpisode.id, newEpisode);

    // Enforce max episodes limit by removing weakest memories
    this.enforceMemoryLimit();

    return newEpisode;
  }

  /**
   * Retrieve episodes matching query
   */
  recall(query: EpisodeQuery = {}): Episode[] {
    let results = Array.from(this.episodes.values());

    // Apply filters
    if (query.type) {
      results = results.filter(e => e.type === query.type);
    }

    if (query.event) {
      results = results.filter(e => e.event === query.event);
    }

    if (query.otherAgents && query.otherAgents.length > 0) {
      results = results.filter(e =>
        e.otherAgents?.some(agent => query.otherAgents!.includes(agent))
      );
    }

    if (query.minImportance !== undefined) {
      results = results.filter(e => e.importance >= query.minImportance!);
    }

    if (query.minStrength !== undefined) {
      results = results.filter(e => e.strength >= query.minStrength!);
    }

    if (query.turnRange) {
      results = results.filter(e =>
        e.turn >= query.turnRange!.start && e.turn <= query.turnRange!.end
      );
    }

    if (query.emotion) {
      results = results.filter(e => e.emotion === query.emotion);
    }

    // Sort by importance and strength
    results.sort((a, b) => {
      const scoreA = a.importance * 0.6 + a.strength * 0.4;
      const scoreB = b.importance * 0.6 + b.strength * 0.4;
      return scoreB - scoreA;
    });

    // Update access metadata for recalled memories (reinforcement)
    results.forEach(episode => {
      episode.lastAccessed = Date.now();
      episode.accessCount++;
      // Reinforcement: accessing a memory slightly strengthens it
      episode.strength = Math.min(100, episode.strength + 2);
    });

    // Apply limit
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Get most recent episodes
   */
  getRecent(count: number = 10): Episode[] {
    return Array.from(this.episodes.values())
      .sort((a, b) => b.turn - a.turn)
      .slice(0, count);
  }

  /**
   * Get most important episodes
   */
  getMostImportant(count: number = 10): Episode[] {
    return Array.from(this.episodes.values())
      .sort((a, b) => b.importance - a.importance)
      .slice(0, count);
  }

  /**
   * Get episodes involving a specific agent
   */
  getEpisodesWithAgent(agentId: string, limit: number = 20): Episode[] {
    return this.recall({
      otherAgents: [agentId],
      limit,
    });
  }

  /**
   * Get episodes of a specific type
   */
  getEpisodesByType(type: Episode['type'], limit: number = 20): Episode[] {
    return this.recall({
      type,
      limit,
    });
  }

  /**
   * Count episodes matching criteria
   */
  count(query: EpisodeQuery = {}): number {
    return this.recall(query).length;
  }

  /**
   * Check if similar episode exists (for duplicate detection)
   */
  hasSimilarEpisode(event: string, otherAgents?: string[], turnWindow: number = 5): boolean {
    const similar = this.recall({
      event,
      otherAgents,
      turnRange: {
        start: Math.max(0, this.currentTurn - turnWindow),
        end: this.currentTurn,
      },
    });

    return similar.length > 0;
  }

  /**
   * Update turn counter and decay memories
   */
  tick(turn: number): void {
    this.currentTurn = turn;

    // Decay all memory strengths
    for (const episode of this.episodes.values()) {
      // Decay strength
      episode.strength = Math.max(0, episode.strength - this.decayRate);

      // Frequently accessed memories decay slower
      const accessBonus = Math.min(10, episode.accessCount * 0.5);
      episode.strength = Math.min(100, episode.strength + accessBonus * 0.1);
    }

    // Remove completely faded memories
    for (const [id, episode] of this.episodes.entries()) {
      if (episode.strength <= 0) {
        this.episodes.delete(id);
      }
    }
  }

  /**
   * Consolidate memories (compress similar episodes into semantic knowledge)
   * Returns episodes that should be converted to semantic facts
   */
  consolidate(): Episode[] {
    const consolidatable: Episode[] = [];

    // Find episodes that are frequently accessed but aging
    for (const episode of this.episodes.values()) {
      if (
        episode.accessCount > 3 &&
        episode.strength < 60 &&
        episode.importance > 40
      ) {
        consolidatable.push(episode);
      }
    }

    return consolidatable;
  }

  /**
   * Get memory statistics
   */
  getStats(): {
    totalEpisodes: number;
    averageStrength: number;
    averageImportance: number;
    oldestEpisode: number | null;
    newestEpisode: number | null;
    typeDistribution: Record<string, number>;
  } {
    const episodes = Array.from(this.episodes.values());

    const avgStrength = episodes.length > 0
      ? episodes.reduce((sum, e) => sum + e.strength, 0) / episodes.length
      : 0;

    const avgImportance = episodes.length > 0
      ? episodes.reduce((sum, e) => sum + e.importance, 0) / episodes.length
      : 0;

    const turns = episodes.map(e => e.turn).sort((a, b) => a - b);
    const oldestTurn = turns.length > 0 ? turns[0] : null;
    const newestTurn = turns.length > 0 ? turns[turns.length - 1] : null;

    const typeDistribution: Record<string, number> = {};
    for (const episode of episodes) {
      typeDistribution[episode.type] = (typeDistribution[episode.type] || 0) + 1;
    }

    return {
      totalEpisodes: episodes.length,
      averageStrength: avgStrength,
      averageImportance: avgImportance,
      oldestEpisode: oldestTurn,
      newestEpisode: newestTurn,
      typeDistribution,
    };
  }

  /**
   * Clear all episodes
   */
  clear(): void {
    this.episodes.clear();
  }

  /**
   * Get all episodes (for export/debugging)
   */
  getAllEpisodes(): Episode[] {
    return Array.from(this.episodes.values());
  }

  /**
   * Private helpers
   */

  private generateId(): string {
    return `ep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private enforceMemoryLimit(): void {
    if (this.episodes.size <= this.maxEpisodes) {
      return;
    }

    // Remove episodes with lowest combined importance + strength
    const episodes = Array.from(this.episodes.values());
    episodes.sort((a, b) => {
      const scoreA = a.importance * 0.6 + a.strength * 0.4;
      const scoreB = b.importance * 0.6 + b.strength * 0.4;
      return scoreA - scoreB; // Ascending order
    });

    // Remove the weakest episodes
    const toRemove = episodes.slice(0, this.episodes.size - this.maxEpisodes);
    for (const episode of toRemove) {
      this.episodes.delete(episode.id);
    }
  }
}
