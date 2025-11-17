/**
 * Predictive Analytics Engine
 * Forecasts simulation outcomes based on early-turn data
 */

import { AgentState } from '../schemas/types';

/**
 * Snapshot of simulation state at an early turn
 */
export interface EarlyStateSnapshot {
  turn: number;
  agentStates: AgentState[];
  worldSummary: {
    totalResources: number;
    resourceDistribution: Record<string, number>;
    activeEvents: number;
  };
  socialSummary: {
    alliances: number;
    conflicts: number;
    avgTrust: number;
    avgFear: number;
  };
}

/**
 * Predicted outcome of a simulation
 */
export interface OutcomePrediction {
  predictedDominantPersonality?: string;
  predictedSurvivorCountRange: [number, number];
  predictedAverageTurnsRange: [number, number];
  confidence: number; // 0-1
  rationale?: string;
}

/**
 * Replay data from completed simulations (for training)
 */
export interface Replay {
  id: string;
  initialState: EarlyStateSnapshot;
  finalOutcome: {
    totalTurns: number;
    survivorCount: number;
    dominantPersonality?: string;
    winnerPersonality?: string;
  };
}

/**
 * Prediction Engine for forecasting simulation outcomes
 *
 * Currently uses heuristic-based prediction. Can be extended
 * with ML models trained on historical replay data.
 */
export class PredictionEngine {
  private replays: Replay[] = [];
  private trained: boolean = false;

  /**
   * Train the prediction engine from historical replays
   * Currently stores replays for basic statistical analysis
   */
  trainFromHistory(replays: Replay[]): void {
    this.replays = replays;
    this.trained = replays.length > 0;
    console.log(`PredictionEngine trained with ${replays.length} replays`);
  }

  /**
   * Predict simulation outcome based on early state snapshot
   * Uses heuristic-based analysis if no training data available
   */
  predictOutcome(snapshot: EarlyStateSnapshot): OutcomePrediction {
    if (this.trained && this.replays.length > 0) {
      return this.predictFromTrainingData(snapshot);
    } else {
      return this.predictHeuristic(snapshot);
    }
  }

  /**
   * Heuristic-based prediction (used when no training data)
   */
  private predictHeuristic(snapshot: EarlyStateSnapshot): OutcomePrediction {
    const { agentStates, worldSummary, socialSummary } = snapshot;
    const totalAgents = agentStates.length;
    const aliveAgents = agentStates.filter(a => a.health > 0).length;

    // Calculate aggregate statistics
    const stats = this.calculateAggregateStats(agentStates);
    const resourcesPerAgent = aliveAgents > 0
      ? worldSummary.totalResources / aliveAgents
      : 0;

    // Build rationale parts
    const rationale: string[] = [];

    // 1. Predict dominant personality
    const dominantPersonality = this.predictDominantPersonality(
      agentStates,
      stats,
      socialSummary,
      rationale
    );

    // 2. Predict survivor count
    const survivorCountRange = this.predictSurvivorCount(
      aliveAgents,
      stats,
      resourcesPerAgent,
      socialSummary,
      rationale
    );

    // 3. Predict simulation length
    const turnsRange = this.predictSimulationLength(
      aliveAgents,
      stats,
      resourcesPerAgent,
      socialSummary,
      rationale
    );

    // 4. Calculate confidence
    const confidence = this.calculateConfidence(
      snapshot.turn,
      aliveAgents,
      socialSummary,
      stats
    );

    return {
      predictedDominantPersonality: dominantPersonality,
      predictedSurvivorCountRange: survivorCountRange,
      predictedAverageTurnsRange: turnsRange,
      confidence,
      rationale: rationale.join(' '),
    };
  }

  /**
   * Predict dominant personality based on stats and social dynamics
   */
  private predictDominantPersonality(
    agentStates: AgentState[],
    stats: AggregateStats,
    socialSummary: EarlyStateSnapshot['socialSummary'],
    rationale: string[]
  ): string | undefined {
    const aliveAgents = agentStates.filter(a => a.health > 0);
    if (aliveAgents.length === 0) return undefined;

    // Count personality types
    const personalityCounts = new Map<string, number>();
    aliveAgents.forEach(agent => {
      const pName = agent.personality.name;
      personalityCounts.set(pName, (personalityCounts.get(pName) || 0) + 1);
    });

    // Determine which personality type is most likely to dominate
    let dominantPersonality: string | undefined;

    // High cooperation + high alliances → Cooperative personalities dominate
    if (stats.avgCooperation > 60 && socialSummary.alliances > aliveAgents.length * 0.3) {
      const cooperativeTypes = aliveAgents
        .filter(a => a.stats.cooperation > 60)
        .map(a => a.personality.name);

      if (cooperativeTypes.length > 0) {
        dominantPersonality = this.getMostCommon(cooperativeTypes);
        rationale.push(
          `High cooperation (${stats.avgCooperation.toFixed(1)}) and strong alliance formation suggest cooperative personalities will dominate.`
        );
      }
    }

    // High aggression + low cooperation → Aggressive personalities dominate
    else if (stats.avgAggression > 60 && stats.avgCooperation < 40) {
      const aggressiveTypes = aliveAgents
        .filter(a => a.stats.aggression > 60)
        .map(a => a.personality.name);

      if (aggressiveTypes.length > 0) {
        dominantPersonality = this.getMostCommon(aggressiveTypes);
        rationale.push(
          `High aggression (${stats.avgAggression.toFixed(1)}) and low cooperation suggest aggressive personalities will dominate through combat.`
        );
      }
    }

    // Balanced stats → Most numerous personality type
    else {
      const [mostCommonPersonality, count] = Array.from(personalityCounts.entries())
        .sort((a, b) => b[1] - a[1])[0] || [undefined, 0];

      if (mostCommonPersonality && count >= aliveAgents.length * 0.3) {
        dominantPersonality = mostCommonPersonality;
        rationale.push(
          `${mostCommonPersonality} is the most common personality type (${count}/${aliveAgents.length} agents).`
        );
      }
    }

    return dominantPersonality;
  }

  /**
   * Predict survivor count range
   */
  private predictSurvivorCount(
    aliveAgents: number,
    stats: AggregateStats,
    resourcesPerAgent: number,
    socialSummary: EarlyStateSnapshot['socialSummary'],
    rationale: string[]
  ): [number, number] {
    let baselineSurvivors = aliveAgents * 0.3; // Default: 30% survive
    let variance = aliveAgents * 0.2;

    // High cooperation + high resources → more survivors
    if (stats.avgCooperation > 60 && resourcesPerAgent > 10) {
      baselineSurvivors = aliveAgents * 0.6;
      variance = aliveAgents * 0.15;
      rationale.push(
        `High cooperation and abundant resources (${resourcesPerAgent.toFixed(1)}/agent) suggest high survival rate.`
      );
    }

    // High aggression + low resources → fewer survivors
    else if (stats.avgAggression > 70 && resourcesPerAgent < 5) {
      baselineSurvivors = aliveAgents * 0.15;
      variance = aliveAgents * 0.1;
      rationale.push(
        `High aggression combined with resource scarcity indicates intense conflict and low survival.`
      );
    }

    // High alliances → more survivors
    else if (socialSummary.alliances > aliveAgents * 0.4) {
      baselineSurvivors = aliveAgents * 0.5;
      variance = aliveAgents * 0.2;
      rationale.push(
        `Strong alliance formation (${socialSummary.alliances} alliances) suggests cooperative survival.`
      );
    }

    // High conflicts → fewer survivors
    else if (socialSummary.conflicts > aliveAgents * 0.5) {
      baselineSurvivors = aliveAgents * 0.2;
      variance = aliveAgents * 0.15;
      rationale.push(
        `High early conflict rate indicates violent competition with few survivors.`
      );
    }

    const min = Math.max(1, Math.floor(baselineSurvivors - variance));
    const max = Math.min(aliveAgents, Math.ceil(baselineSurvivors + variance));

    return [min, max];
  }

  /**
   * Predict simulation length (total turns)
   */
  private predictSimulationLength(
    aliveAgents: number,
    stats: AggregateStats,
    resourcesPerAgent: number,
    socialSummary: EarlyStateSnapshot['socialSummary'],
    rationale: string[]
  ): [number, number] {
    let baselineTurns = 100;
    let variance = 30;

    // High aggression + early conflicts → shorter simulation
    if (stats.avgAggression > 70 && socialSummary.conflicts > aliveAgents * 0.3) {
      baselineTurns = 60;
      variance = 20;
      rationale.push('Early intense combat will likely lead to rapid elimination.');
    }

    // High cooperation + abundant resources → longer simulation
    else if (stats.avgCooperation > 60 && resourcesPerAgent > 10) {
      baselineTurns = 150;
      variance = 50;
      rationale.push('Cooperative dynamics and resource abundance suggest extended simulation.');
    }

    // Balanced → medium length
    else {
      baselineTurns = 100;
      variance = 40;
      rationale.push('Balanced agent dynamics suggest moderate simulation length.');
    }

    const min = Math.max(20, baselineTurns - variance);
    const max = baselineTurns + variance;

    return [min, max];
  }

  /**
   * Calculate confidence in prediction
   */
  private calculateConfidence(
    turn: number,
    aliveAgents: number,
    socialSummary: EarlyStateSnapshot['socialSummary'],
    stats: AggregateStats
  ): number {
    let confidence = 0.5; // Base confidence

    // More turns observed → higher confidence
    if (turn >= 20) confidence += 0.2;
    else if (turn >= 10) confidence += 0.1;

    // Clear social patterns → higher confidence
    const totalSocialInteractions = socialSummary.alliances + socialSummary.conflicts;
    if (totalSocialInteractions > aliveAgents * 0.5) {
      confidence += 0.15;
    }

    // Clear personality trends → higher confidence
    const statSpread = Math.max(
      Math.abs(stats.avgAggression - 50),
      Math.abs(stats.avgCooperation - 50)
    );
    if (statSpread > 20) confidence += 0.1;

    // Strong trust or fear signals → higher confidence
    if (socialSummary.avgTrust > 60 || socialSummary.avgFear > 60) {
      confidence += 0.05;
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Predict outcome using training data (similarity-based)
   */
  private predictFromTrainingData(snapshot: EarlyStateSnapshot): OutcomePrediction {
    // Find similar replays based on early state
    const similarities = this.replays.map(replay => ({
      replay,
      similarity: this.calculateSimilarity(snapshot, replay.initialState),
    }));

    // Sort by similarity and take top 5
    const topMatches = similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, Math.min(5, similarities.length));

    if (topMatches.length === 0 || topMatches[0].similarity < 0.3) {
      // Not enough similar data, fall back to heuristics
      return this.predictHeuristic(snapshot);
    }

    // Aggregate predictions from top matches
    const survivorCounts = topMatches.map(m => m.replay.finalOutcome.survivorCount);
    const turns = topMatches.map(m => m.replay.finalOutcome.totalTurns);
    const personalities = topMatches
      .map(m => m.replay.finalOutcome.dominantPersonality)
      .filter(p => p !== undefined) as string[];

    const avgSurvivors = survivorCounts.reduce((a, b) => a + b, 0) / survivorCounts.length;
    const avgTurns = turns.reduce((a, b) => a + b, 0) / turns.length;

    const survivorMin = Math.floor(Math.min(...survivorCounts));
    const survivorMax = Math.ceil(Math.max(...survivorCounts));
    const turnsMin = Math.floor(Math.min(...turns));
    const turnsMax = Math.ceil(Math.max(...turns));

    const dominantPersonality = this.getMostCommon(personalities);
    const avgSimilarity = topMatches.reduce((sum, m) => sum + m.similarity, 0) / topMatches.length;

    return {
      predictedDominantPersonality: dominantPersonality,
      predictedSurvivorCountRange: [survivorMin, survivorMax],
      predictedAverageTurnsRange: [turnsMin, turnsMax],
      confidence: avgSimilarity * 0.9, // Scale down confidence slightly
      rationale: `Prediction based on ${topMatches.length} similar historical simulations (avg similarity: ${(avgSimilarity * 100).toFixed(1)}%). Expected ${avgSurvivors.toFixed(1)} survivors over ${avgTurns.toFixed(0)} turns.`,
    };
  }

  /**
   * Calculate similarity between two snapshots (0-1)
   */
  private calculateSimilarity(
    snapshot1: EarlyStateSnapshot,
    snapshot2: EarlyStateSnapshot
  ): number {
    const s1Stats = this.calculateAggregateStats(snapshot1.agentStates);
    const s2Stats = this.calculateAggregateStats(snapshot2.agentStates);

    // Compare aggregate stats (normalized differences)
    const aggressionSim = 1 - Math.abs(s1Stats.avgAggression - s2Stats.avgAggression) / 100;
    const cooperationSim = 1 - Math.abs(s1Stats.avgCooperation - s2Stats.avgCooperation) / 100;
    const empathySim = 1 - Math.abs(s1Stats.avgEmpathy - s2Stats.avgEmpathy) / 100;

    // Compare social dynamics
    const allianceRatio1 = snapshot1.agentStates.length > 0
      ? snapshot1.socialSummary.alliances / snapshot1.agentStates.length
      : 0;
    const allianceRatio2 = snapshot2.agentStates.length > 0
      ? snapshot2.socialSummary.alliances / snapshot2.agentStates.length
      : 0;
    const allianceSim = 1 - Math.abs(allianceRatio1 - allianceRatio2);

    const conflictRatio1 = snapshot1.agentStates.length > 0
      ? snapshot1.socialSummary.conflicts / snapshot1.agentStates.length
      : 0;
    const conflictRatio2 = snapshot2.agentStates.length > 0
      ? snapshot2.socialSummary.conflicts / snapshot2.agentStates.length
      : 0;
    const conflictSim = 1 - Math.abs(conflictRatio1 - conflictRatio2);

    // Weighted average
    const similarity =
      aggressionSim * 0.25 +
      cooperationSim * 0.25 +
      empathySim * 0.15 +
      allianceSim * 0.2 +
      conflictSim * 0.15;

    return Math.max(0, Math.min(1, similarity));
  }

  /**
   * Calculate aggregate statistics for agent states
   */
  private calculateAggregateStats(agentStates: AgentState[]): AggregateStats {
    const aliveAgents = agentStates.filter(a => a.health > 0);

    if (aliveAgents.length === 0) {
      return {
        avgAggression: 0,
        avgCooperation: 0,
        avgEmpathy: 0,
        avgEnergy: 0,
        avgHealth: 0,
      };
    }

    const sum = aliveAgents.reduce(
      (acc, agent) => ({
        aggression: acc.aggression + agent.stats.aggression,
        cooperation: acc.cooperation + agent.stats.cooperation,
        empathy: acc.empathy + agent.stats.empathy,
        energy: acc.energy + agent.stats.energy,
        health: acc.health + agent.health,
      }),
      { aggression: 0, cooperation: 0, empathy: 0, energy: 0, health: 0 }
    );

    const count = aliveAgents.length;

    return {
      avgAggression: sum.aggression / count,
      avgCooperation: sum.cooperation / count,
      avgEmpathy: sum.empathy / count,
      avgEnergy: sum.energy / count,
      avgHealth: sum.health / count,
    };
  }

  /**
   * Get most common element in array
   */
  private getMostCommon<T>(arr: T[]): T | undefined {
    if (arr.length === 0) return undefined;

    const counts = new Map<T, number>();
    arr.forEach(item => {
      counts.set(item, (counts.get(item) || 0) + 1);
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0];
  }
}

/**
 * Internal aggregate statistics
 */
interface AggregateStats {
  avgAggression: number;
  avgCooperation: number;
  avgEmpathy: number;
  avgEnergy: number;
  avgHealth: number;
}
