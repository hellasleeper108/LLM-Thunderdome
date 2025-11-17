/**
 * Evolution Engine
 * Implements genetic algorithms for evolving agent personalities across generations
 */

import { AgentState } from '../schemas/types';
import { BaseAgent } from '../agents/BaseAgent';

export interface FitnessCriteria {
  survivalWeight: number;
  resourceWeight: number;
  cooperationWeight: number;
  aggressionWeight: number; // can be positive or negative depending on experiment
  goalCompletionWeight: number;
}

export interface AgentGenome {
  id: string;
  basePersonalityId?: string;
  generation: number;
  parentIds?: string[];
  traits: {
    aggression: number;
    cooperation: number;
    empathy: number;
    curiosity: number;
    riskTolerance: number;
    cunning: number;
    loyalty: number;
  };
  meta?: Record<string, any>;
}

export interface GenerationResult {
  generationIndex: number;
  genomes: AgentGenome[];
  fitnessScores: Record<string, number>;
  topGenomes: AgentGenome[];
  averageFitness: number;
  maxFitness: number;
  minFitness: number;
}

export interface AgentStats {
  resourcesCollected: number;
  turnsSurvived: number;
  alliancesFormed: number;
  goalsCompleted: number;
  conflictsInitiated: number;
}

export class EvolutionEngine {
  private fitnessCriteria: FitnessCriteria;
  private currentGeneration: number;

  constructor(fitnessCriteria: FitnessCriteria) {
    this.fitnessCriteria = fitnessCriteria;
    this.currentGeneration = 0;
  }

  /**
   * Compute fitness score for an agent based on its performance
   */
  computeFitness(agentState: AgentState, stats: AgentStats): number {
    const {
      survivalWeight,
      resourceWeight,
      cooperationWeight,
      aggressionWeight,
      goalCompletionWeight,
    } = this.fitnessCriteria;

    // Normalize survival (0-1 based on health and alive status)
    const survivalScore = agentState.isAlive ? (agentState.health / 100) : 0;

    // Normalize resources (0-1, capped at 100 total resources)
    const totalResources = stats.resourcesCollected;
    const resourceScore = Math.min(totalResources / 100, 1);

    // Normalize cooperation (0-1 based on alliances and cooperation stat)
    const cooperationScore = (
      (stats.alliancesFormed * 0.5) +
      (agentState.stats.cooperation / 100) * 0.5
    );

    // Normalize aggression (0-1 based on conflicts and aggression stat)
    const aggressionScore = (
      (stats.conflictsInitiated * 0.1) +
      (agentState.stats.aggression / 100) * 0.9
    );

    // Normalize goal completion (0-1 based on completed goals)
    const completedGoals = agentState.goals.filter(g => g.completed).length;
    const totalGoals = agentState.goals.length;
    const goalScore = totalGoals > 0 ? completedGoals / totalGoals : 0;

    // Compute weighted fitness
    const fitness =
      (survivalScore * survivalWeight) +
      (resourceScore * resourceWeight) +
      (cooperationScore * cooperationWeight) +
      (aggressionScore * aggressionWeight) +
      (goalScore * goalCompletionWeight);

    // Normalize by total weight to get 0-1 range
    const totalWeight = Math.abs(survivalWeight) +
                        Math.abs(resourceWeight) +
                        Math.abs(cooperationWeight) +
                        Math.abs(aggressionWeight) +
                        Math.abs(goalCompletionWeight);

    return totalWeight > 0 ? fitness / totalWeight : 0;
  }

  /**
   * Build a genome from an agent's current state
   */
  buildGenomeFromAgent(agent: BaseAgent, generation: number = 0): AgentGenome {
    const state = agent.getState();

    return {
      id: state.id,
      basePersonalityId: state.personality.name,
      generation,
      traits: {
        aggression: state.stats.aggression,
        cooperation: state.stats.cooperation,
        empathy: state.stats.empathy,
        curiosity: state.stats.curiosity,
        riskTolerance: state.stats.riskTolerance,
        cunning: 50, // Default cunning trait (not in base stats)
        loyalty: 50,  // Default loyalty trait (not in base stats)
      },
      meta: {
        originalPersonality: state.personality.name,
        createdAt: Date.now(),
      },
    };
  }

  /**
   * Mutate a genome with a given mutation rate
   * @param genome The genome to mutate
   * @param mutationRate Probability of mutation per trait (0-1)
   */
  mutateGenome(genome: AgentGenome, mutationRate: number): AgentGenome {
    const mutated: AgentGenome = {
      ...genome,
      id: `${genome.id}-mutated-${Date.now()}`,
      generation: genome.generation + 1,
      parentIds: [genome.id],
      traits: { ...genome.traits },
      meta: {
        ...genome.meta,
        mutatedFrom: genome.id,
        mutationRate,
      },
    };

    // Mutate each trait with probability = mutationRate
    Object.keys(mutated.traits).forEach((traitKey) => {
      if (Math.random() < mutationRate) {
        const key = traitKey as keyof typeof mutated.traits;
        const currentValue = mutated.traits[key];

        // Apply random mutation: +/- 5-15 points
        const mutation = (Math.random() * 10 + 5) * (Math.random() < 0.5 ? 1 : -1);
        mutated.traits[key] = Math.max(0, Math.min(100, currentValue + mutation));
      }
    });

    return mutated;
  }

  /**
   * Create offspring genome from two parent genomes via crossover
   */
  crossoverGenomes(parentA: AgentGenome, parentB: AgentGenome): AgentGenome {
    const offspring: AgentGenome = {
      id: `offspring-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      generation: Math.max(parentA.generation, parentB.generation) + 1,
      parentIds: [parentA.id, parentB.id],
      traits: {
        aggression: 0,
        cooperation: 0,
        empathy: 0,
        curiosity: 0,
        riskTolerance: 0,
        cunning: 0,
        loyalty: 0,
      },
      meta: {
        crossoverFrom: [parentA.id, parentB.id],
        parentAPersonality: parentA.basePersonalityId,
        parentBPersonality: parentB.basePersonalityId,
        createdAt: Date.now(),
      },
    };

    // Randomly inherit each trait from either parent (uniform crossover)
    Object.keys(offspring.traits).forEach((traitKey) => {
      const key = traitKey as keyof typeof offspring.traits;

      // 50/50 chance to inherit from either parent
      if (Math.random() < 0.5) {
        offspring.traits[key] = parentA.traits[key];
      } else {
        offspring.traits[key] = parentB.traits[key];
      }

      // Add small random variation (blend genes slightly)
      const variation = (Math.random() - 0.5) * 4; // +/- 2 points
      offspring.traits[key] = Math.max(0, Math.min(100, offspring.traits[key] + variation));
    });

    return offspring;
  }

  /**
   * Select top K genomes based on fitness scores
   */
  selectTopGenomes(
    genomes: AgentGenome[],
    scores: Record<string, number>,
    topK: number
  ): GenerationResult {
    // Sort genomes by fitness score (descending)
    const sortedGenomes = [...genomes].sort((a, b) => {
      const scoreA = scores[a.id] || 0;
      const scoreB = scores[b.id] || 0;
      return scoreB - scoreA;
    });

    // Select top K
    const topGenomes = sortedGenomes.slice(0, Math.min(topK, sortedGenomes.length));

    // Calculate statistics
    const fitnessValues = Object.values(scores);
    const averageFitness = fitnessValues.reduce((sum, v) => sum + v, 0) / fitnessValues.length;
    const maxFitness = Math.max(...fitnessValues);
    const minFitness = Math.min(...fitnessValues);

    return {
      generationIndex: this.currentGeneration,
      genomes: sortedGenomes,
      fitnessScores: scores,
      topGenomes,
      averageFitness,
      maxFitness,
      minFitness,
    };
  }

  /**
   * Evolve a new generation from parent genomes
   * @param parentGenomes Parent genomes to evolve from
   * @param parentScores Fitness scores of parents
   * @param populationSize Target population size for next generation
   * @param mutationRate Mutation rate (0-1)
   * @param eliteCount Number of top performers to preserve unchanged
   */
  evolveNextGeneration(
    parentGenomes: AgentGenome[],
    parentScores: Record<string, number>,
    populationSize: number,
    mutationRate: number = 0.1,
    eliteCount: number = 2
  ): AgentGenome[] {
    const nextGeneration: AgentGenome[] = [];
    this.currentGeneration++;

    // Sort parents by fitness
    const sortedParents = [...parentGenomes].sort((a, b) => {
      return (parentScores[b.id] || 0) - (parentScores[a.id] || 0);
    });

    // Elitism: Preserve top performers unchanged
    const elites = sortedParents.slice(0, Math.min(eliteCount, sortedParents.length));
    nextGeneration.push(...elites.map(e => ({
      ...e,
      id: `${e.id}-elite-gen${this.currentGeneration}`,
      generation: this.currentGeneration,
      meta: { ...e.meta, elite: true },
    })));

    // Fill remaining population with crossover + mutation
    while (nextGeneration.length < populationSize) {
      // Select two parents using tournament selection
      const parentA = this.tournamentSelection(sortedParents, parentScores, 3);
      const parentB = this.tournamentSelection(sortedParents, parentScores, 3);

      if (parentA && parentB) {
        // Crossover
        let offspring = this.crossoverGenomes(parentA, parentB);

        // Mutation
        if (Math.random() < mutationRate) {
          offspring = this.mutateGenome(offspring, mutationRate);
        }

        nextGeneration.push(offspring);
      } else {
        // Fallback: mutate a random parent if selection fails
        const randomParent = sortedParents[Math.floor(Math.random() * sortedParents.length)];
        if (randomParent) {
          nextGeneration.push(this.mutateGenome(randomParent, mutationRate));
        }
      }
    }

    return nextGeneration.slice(0, populationSize);
  }

  /**
   * Tournament selection: randomly select K individuals and return the fittest
   */
  private tournamentSelection(
    population: AgentGenome[],
    scores: Record<string, number>,
    tournamentSize: number
  ): AgentGenome | null {
    if (population.length === 0) return null;

    const tournament: AgentGenome[] = [];
    for (let i = 0; i < tournamentSize; i++) {
      const randomIndex = Math.floor(Math.random() * population.length);
      tournament.push(population[randomIndex]);
    }

    // Return the fittest from tournament
    tournament.sort((a, b) => {
      return (scores[b.id] || 0) - (scores[a.id] || 0);
    });

    return tournament[0];
  }

  /**
   * Get current generation index
   */
  getCurrentGeneration(): number {
    return this.currentGeneration;
  }

  /**
   * Reset generation counter
   */
  resetGeneration(): void {
    this.currentGeneration = 0;
  }
}
