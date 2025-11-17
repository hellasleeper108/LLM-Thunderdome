/**
 * Simulation Cluster
 * Manages running multiple simulations in parallel for comparison and analysis
 */

import { SimulationEngine, EngineConfig } from '../engine/SimulationEngine';
import { World } from '../world/World';
import { EventLogger } from '../logging/EventLogger';
import { BaseAgent } from '../agents/BaseAgent';
import { LLMAgent } from '../agents/LLMAgent';
import { ScriptedAgent, Strategy } from '../agents/ScriptedAgent';
import { PresetConfig } from '../simulations/presets';
import { v4 as uuidv4 } from 'uuid';
import { AgentState, Replay, FitnessCriteria, AgentGenome } from '../schemas/types';
import { EvolutionEngine, AgentStats as EvolutionAgentStats } from '../evolution/EvolutionEngine';
import { personalityFromGenome } from '../agents/personalities';
import { getStanBridge } from '../stan';
import { getMetaverseManager } from '../metaverse';

export interface ClusterConfig {
  simulationCount: number;
  preset: PresetConfig;
  randomizeSeed?: boolean; // Randomize agent positions and world generation
  autoAdvance?: boolean;
  createMetaverseWorlds?: boolean; // Create separate WorldInstance for each simulation
  enableCrossWorldEffects?: boolean; // Enable periodic cross-world effects
}

export interface SimulationInstance {
  id: string;
  name: string;
  engine: SimulationEngine;
  logger: EventLogger;
  world: World;
  agents: BaseAgent[];
  status: 'idle' | 'running' | 'paused' | 'completed';
  startTime?: number;
  endTime?: number;
  worldId?: string; // Link to metaverse WorldInstance
}

export interface SimulationOutcome {
  simulationId: string;
  simulationName: string;
  turns: number;
  winner?: {
    agentId: string;
    agentName: string;
    reason: string;
  };
  survivors: number;
  totalDamageDealt: number;
  totalResourcesGathered: number;
  alliancesFormed: number;
  alliancesBroken: number;
  avgCooperation: number;
  avgAggression: number;
  duration: number; // ms
  finalAgentStates: AgentState[];
}

export interface AggregatedResults {
  totalSimulations: number;
  completedSimulations: number;
  avgTurns: number;
  avgSurvivors: number;
  avgDamage: number;
  avgResourcesGathered: number;
  avgAlliancesFormed: number;
  avgCooperation: number;
  avgAggression: number;
  winnerDistribution: { [agentName: string]: number };
  personalityPerformance: {
    [personalityName: string]: {
      wins: number;
      avgSurvivalRate: number;
      avgResourcesGathered: number;
    };
  };
  outcomes: SimulationOutcome[];
}

export class SimulationCluster {
  private config: ClusterConfig;
  private instances: Map<string, SimulationInstance>;
  private outcomes: SimulationOutcome[];
  private clusterId: string;

  constructor(config: ClusterConfig) {
    this.config = config;
    this.instances = new Map();
    this.outcomes = [];
    this.clusterId = uuidv4();
  }

  /**
   * Initialize all simulation instances
   */
  initialize(): void {
    console.log(
      `[Cluster ${this.clusterId}] Initializing ${this.config.simulationCount} simulations...`
    );

    for (let i = 0; i < this.config.simulationCount; i++) {
      const simId = uuidv4();
      const simName = `Simulation-${i + 1}`;

      // Create isolated world
      const world = new World({
        width: this.config.preset.worldWidth,
        height: this.config.preset.worldHeight,
        resourceDensity: this.config.preset.resourceDensity,
        obstacleDensity: this.config.preset.obstacleDensity,
      });

      // Create isolated logger
      const logger = new EventLogger();

      // Create isolated engine
      const engineConfig: EngineConfig = {
        turnDuration: this.config.preset.turnDuration,
        maxTurns: this.config.preset.maxTurns,
        autoAdvance: this.config.autoAdvance ?? false,
        visionRadius: 3,
        eventFrequency: 0.15,
        eventSpawnInterval: 5,
      };

      const engine = new SimulationEngine(world, logger, engineConfig);

      // Create isolated agents (from genomes or personalities)
      const agents: BaseAgent[] = [];

      if (this.config.preset.initialGenomes && this.config.preset.initialGenomes.length > 0) {
        // Use evolved genomes
        this.config.preset.initialGenomes.forEach((genome, idx) => {
          const agentId = uuidv4();
          const personality = personalityFromGenome(genome);
          const agentName = `${personality.name}-${i + 1}-${idx + 1}`;

          // Randomize position if configured
          let position = { x: idx * 2, y: idx * 2 };
          if (this.config.randomizeSeed) {
            position = {
              x: Math.floor(Math.random() * this.config.preset.worldWidth),
              y: Math.floor(Math.random() * this.config.preset.worldHeight),
            };
          }

          // Create agent (use ScriptedAgent for deterministic results)
          const agent = new ScriptedAgent(
            agentName,
            personality,
            position,
            this.config.preset.globalGoals || [],
            { strategy: 'social' }
          );

          agents.push(agent);
          engine.addAgent(agent);
        });
      } else {
        // Use traditional personality templates
        this.config.preset.agentPersonalities.forEach((personality, idx) => {
          const agentId = uuidv4();
          const agentName = `${personality.name}-${i + 1}-${idx + 1}`;

          // Randomize position if configured
          let position = { x: idx * 2, y: idx * 2 };
          if (this.config.randomizeSeed) {
            position = {
              x: Math.floor(Math.random() * this.config.preset.worldWidth),
              y: Math.floor(Math.random() * this.config.preset.worldHeight),
            };
          }

          // Create agent (use ScriptedAgent for deterministic results)
          const agent = new ScriptedAgent(
            agentName,
            personality,
            position,
            this.config.preset.globalGoals || [],
            { strategy: 'social' }
          );

          agents.push(agent);
          engine.addAgent(agent);
        });
      }

      // Create metaverse world if configured
      let worldId: string | undefined;
      if (this.config.createMetaverseWorlds) {
        const metaverseManager = getMetaverseManager();
        const worldInstance = metaverseManager.createWorldInstance(simName, i);
        worldId = worldInstance.id;

        // Initialize world metadata based on simulation setup
        metaverseManager.updateWorld(worldId, {
          meta: {
            ...worldInstance.meta,
            totalAgents: agents.length,
            activeSessions: 1,
          },
        });

        console.log(`[Cluster] Linked ${simName} to metaverse world ${worldId}`);
      }

      // Store instance
      const instance: SimulationInstance = {
        id: simId,
        name: simName,
        engine,
        logger,
        world,
        agents,
        status: 'idle',
        worldId,
      };

      this.instances.set(simId, instance);
    }

    console.log(`[Cluster ${this.clusterId}] Initialized ${this.instances.size} simulations`);
  }

  /**
   * Run multiple simulations in parallel
   */
  async runMultipleSimulationsInParallel(): Promise<void> {
    console.log(
      `[Cluster ${this.clusterId}] Starting ${this.instances.size} simulations in parallel...`
    );

    const promises: Promise<void>[] = [];

    // Start all simulations
    this.instances.forEach((instance) => {
      instance.startTime = Date.now();
      instance.status = 'running';
      instance.engine.start();

      // Create a promise that resolves when the simulation completes
      const promise = new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          const engineStatus = (instance.engine as any).status;

          if (engineStatus === 'completed' || engineStatus === 'paused') {
            clearInterval(checkInterval);
            instance.endTime = Date.now();
            instance.status = 'completed';
            instance.engine.pause();
            resolve();
          }
        }, 100);
      });

      promises.push(promise);
    });

    // Wait for all simulations to complete
    await Promise.all(promises);

    console.log(`[Cluster ${this.clusterId}] All simulations completed`);

    // Extract outcomes
    this.extractOutcomes();
  }

  /**
   * Extract outcomes from completed simulations
   */
  private extractOutcomes(): void {
    this.outcomes = [];

    this.instances.forEach((instance) => {
      const engineState = (instance.engine as any);
      const currentTurn = engineState.currentTurn;
      const actionResults = engineState.actionResults || [];

      // Get final agent states
      const finalAgentStates: AgentState[] = [];
      let survivors = 0;
      let totalCooperation = 0;
      let totalAggression = 0;

      instance.agents.forEach((agent) => {
        const state = agent.getState();
        finalAgentStates.push(state);

        if (state.isAlive) {
          survivors++;
        }

        totalCooperation += state.stats.cooperation;
        totalAggression += state.stats.aggression;
      });

      // Calculate metrics
      const attacks = actionResults.filter((r: any) => r.action.type === 'attack');
      const totalDamageDealt = attacks.reduce((sum: number, a: any) => {
        return sum + (a.action.payload?.damage || 0);
      }, 0);

      const gathers = actionResults.filter((r: any) => r.action.type === 'gather');
      const totalResourcesGathered = gathers.reduce((sum: number, g: any) => {
        return sum + (g.action.payload?.amount || 0);
      }, 0);

      const alliancesFormed = actionResults.filter(
        (r: any) => r.action.type === 'form_alliance' && r.success
      ).length;

      const alliancesBroken = actionResults.filter(
        (r: any) => r.action.type === 'break_alliance'
      ).length;

      // Determine winner (highest health + resources)
      let winner: { agentId: string; agentName: string; reason: string } | undefined;
      if (survivors > 0) {
        const winningAgent = finalAgentStates
          .filter((a) => a.isAlive)
          .sort((a, b) => {
            const scoreA = a.health + a.inventory.food + a.inventory.water;
            const scoreB = b.health + b.inventory.food + b.inventory.water;
            return scoreB - scoreA;
          })[0];

        if (winningAgent) {
          winner = {
            agentId: winningAgent.id,
            agentName: winningAgent.name,
            reason: `Survived with ${winningAgent.health} health and ${
              winningAgent.inventory.food + winningAgent.inventory.water
            } resources`,
          };
        }
      }

      const outcome: SimulationOutcome = {
        simulationId: instance.id,
        simulationName: instance.name,
        turns: currentTurn,
        winner,
        survivors,
        totalDamageDealt,
        totalResourcesGathered,
        alliancesFormed,
        alliancesBroken,
        avgCooperation: instance.agents.length > 0 ? totalCooperation / instance.agents.length : 0,
        avgAggression: instance.agents.length > 0 ? totalAggression / instance.agents.length : 0,
        duration: (instance.endTime || 0) - (instance.startTime || 0),
        finalAgentStates,
      };

      this.outcomes.push(outcome);
    });
  }

  /**
   * Aggregate results across all simulations
   */
  aggregateResults(): AggregatedResults {
    const completedSimulations = this.outcomes.length;

    if (completedSimulations === 0) {
      return {
        totalSimulations: this.config.simulationCount,
        completedSimulations: 0,
        avgTurns: 0,
        avgSurvivors: 0,
        avgDamage: 0,
        avgResourcesGathered: 0,
        avgAlliancesFormed: 0,
        avgCooperation: 0,
        avgAggression: 0,
        winnerDistribution: {},
        personalityPerformance: {},
        outcomes: [],
      };
    }

    // Calculate averages
    const avgTurns =
      this.outcomes.reduce((sum, o) => sum + o.turns, 0) / completedSimulations;
    const avgSurvivors =
      this.outcomes.reduce((sum, o) => sum + o.survivors, 0) / completedSimulations;
    const avgDamage =
      this.outcomes.reduce((sum, o) => sum + o.totalDamageDealt, 0) / completedSimulations;
    const avgResourcesGathered =
      this.outcomes.reduce((sum, o) => sum + o.totalResourcesGathered, 0) /
      completedSimulations;
    const avgAlliancesFormed =
      this.outcomes.reduce((sum, o) => sum + o.alliancesFormed, 0) / completedSimulations;
    const avgCooperation =
      this.outcomes.reduce((sum, o) => sum + o.avgCooperation, 0) / completedSimulations;
    const avgAggression =
      this.outcomes.reduce((sum, o) => sum + o.avgAggression, 0) / completedSimulations;

    // Winner distribution
    const winnerDistribution: { [agentName: string]: number } = {};
    this.outcomes.forEach((outcome) => {
      if (outcome.winner) {
        const name = outcome.winner.agentName.split('-')[0]; // Get personality name
        winnerDistribution[name] = (winnerDistribution[name] || 0) + 1;
      }
    });

    // Personality performance
    const personalityPerformance: {
      [personalityName: string]: {
        wins: number;
        avgSurvivalRate: number;
        avgResourcesGathered: number;
      };
    } = {};

    this.config.preset.agentPersonalities.forEach((personality) => {
      const personalityName = personality.name;
      let wins = 0;
      let totalSurvivalRate = 0;
      let totalResources = 0;
      let count = 0;

      this.outcomes.forEach((outcome) => {
        // Check if this personality won
        if (outcome.winner && outcome.winner.agentName.startsWith(personalityName)) {
          wins++;
        }

        // Calculate survival rate and resources for this personality
        const agentsOfType = outcome.finalAgentStates.filter((a) =>
          a.name.startsWith(personalityName)
        );

        agentsOfType.forEach((agent) => {
          count++;
          totalSurvivalRate += agent.isAlive ? 1 : 0;
          totalResources += agent.inventory.food + agent.inventory.water + agent.inventory.material;
        });
      });

      personalityPerformance[personalityName] = {
        wins,
        avgSurvivalRate: count > 0 ? (totalSurvivalRate / count) * 100 : 0,
        avgResourcesGathered: count > 0 ? totalResources / count : 0,
      };
    });

    return {
      totalSimulations: this.config.simulationCount,
      completedSimulations,
      avgTurns,
      avgSurvivors,
      avgDamage,
      avgResourcesGathered,
      avgAlliancesFormed,
      avgCooperation,
      avgAggression,
      winnerDistribution,
      personalityPerformance,
      outcomes: this.outcomes,
    };
  }

  /**
   * Compare simulation outcomes
   */
  compareSimOutcomes(): {
    mostAggressive: SimulationOutcome;
    mostCooperative: SimulationOutcome;
    longestRunning: SimulationOutcome;
    mostSurvivors: SimulationOutcome;
    mostResources: SimulationOutcome;
  } | null {
    if (this.outcomes.length === 0) {
      return null;
    }

    const mostAggressive = [...this.outcomes].sort(
      (a, b) => b.avgAggression - a.avgAggression
    )[0];

    const mostCooperative = [...this.outcomes].sort(
      (a, b) => b.avgCooperation - a.avgCooperation
    )[0];

    const longestRunning = [...this.outcomes].sort((a, b) => b.turns - a.turns)[0];

    const mostSurvivors = [...this.outcomes].sort((a, b) => b.survivors - a.survivors)[0];

    const mostResources = [...this.outcomes].sort(
      (a, b) => b.totalResourcesGathered - a.totalResourcesGathered
    )[0];

    return {
      mostAggressive,
      mostCooperative,
      longestRunning,
      mostSurvivors,
      mostResources,
    };
  }

  /**
   * Get cluster status
   */
  getStatus(): {
    clusterId: string;
    totalSimulations: number;
    running: number;
    completed: number;
    idle: number;
  } {
    let running = 0;
    let completed = 0;
    let idle = 0;

    this.instances.forEach((instance) => {
      switch (instance.status) {
        case 'running':
          running++;
          break;
        case 'completed':
          completed++;
          break;
        case 'idle':
          idle++;
          break;
      }
    });

    return {
      clusterId: this.clusterId,
      totalSimulations: this.instances.size,
      running,
      completed,
      idle,
    };
  }

  /**
   * Pause all running simulations
   */
  pauseAll(): void {
    this.instances.forEach((instance) => {
      if (instance.status === 'running') {
        instance.engine.pause();
        instance.status = 'paused';
      }
    });
  }

  /**
   * Reset all simulations
   */
  resetAll(): void {
    this.instances.forEach((instance) => {
      instance.engine.reset();
      instance.status = 'idle';
      instance.startTime = undefined;
      instance.endTime = undefined;
    });
    this.outcomes = [];
  }

  /**
   * Get cluster ID
   */
  getClusterId(): string {
    return this.clusterId;
  }

  /**
   * Get all outcomes
   */
  getOutcomes(): SimulationOutcome[] {
    return this.outcomes;
  }

  /**
   * Generate next generation configurations using evolutionary algorithms
   * @param fitnessCriteria Criteria for evaluating agent fitness
   * @param topK Number of top genomes to select
   * @param mutationRate Mutation rate for evolution (0-1)
   * @param populationSize Target population size for next generation
   * @returns Array of evolved agent genomes for next cluster run
   */
  generateNextGenerationConfigs(
    fitnessCriteria: FitnessCriteria,
    topK: number = 5,
    mutationRate: number = 0.1,
    populationSize?: number
  ): AgentGenome[] {
    if (this.outcomes.length === 0) {
      throw new Error('No completed simulations found. Run a cluster first.');
    }

    // Use population size from config if not specified
    const targetPopulation = populationSize || this.config.preset.agentPersonalities.length;

    // Initialize evolution engine
    const evolutionEngine = new EvolutionEngine(fitnessCriteria);

    // Collect all agent genomes and compute fitness scores
    const allGenomes: AgentGenome[] = [];
    const fitnessScores: Record<string, number> = {};

    this.outcomes.forEach((outcome) => {
      outcome.finalAgentStates.forEach((agentState) => {
        // Build genome from agent state
        const genome: AgentGenome = {
          id: agentState.id,
          basePersonalityId: agentState.personality.name,
          generation: 0, // Initial generation
          traits: {
            aggression: agentState.stats.aggression,
            cooperation: agentState.stats.cooperation,
            empathy: agentState.stats.empathy,
            curiosity: agentState.stats.curiosity,
            riskTolerance: agentState.stats.riskTolerance,
            cunning: 50, // Default value (not in base stats)
            loyalty: 50,  // Default value (not in base stats)
          },
          meta: {
            originalPersonality: agentState.personality.name,
            simulationId: outcome.simulationId,
            simulationName: outcome.simulationName,
          },
        };

        allGenomes.push(genome);

        // Compute fitness based on agent's performance
        const stats: EvolutionAgentStats = {
          resourcesCollected: agentState.inventory.food +
                              agentState.inventory.water +
                              agentState.inventory.material,
          turnsSurvived: outcome.turns,
          alliancesFormed: outcome.alliancesFormed, // Approximation
          goalsCompleted: agentState.goals.filter(g => g.completed).length,
          conflictsInitiated: Math.floor(outcome.totalDamageDealt / (outcome.survivors + 1)), // Approximation
        };

        const fitness = evolutionEngine.computeFitness(agentState, stats);
        fitnessScores[genome.id] = fitness;
      });
    });

    console.log(`[Evolution] Computed fitness for ${allGenomes.length} agents`);
    console.log(`[Evolution] Fitness range: ${Math.min(...Object.values(fitnessScores)).toFixed(3)} - ${Math.max(...Object.values(fitnessScores)).toFixed(3)}`);

    // Select top performers
    const generationResult = evolutionEngine.selectTopGenomes(allGenomes, fitnessScores, topK);

    console.log(`[Evolution] Selected top ${generationResult.topGenomes.length} genomes`);
    console.log(`[Evolution] Average fitness: ${generationResult.averageFitness.toFixed(3)}`);

    // Evolve next generation
    const nextGeneration = evolutionEngine.evolveNextGeneration(
      generationResult.topGenomes,
      fitnessScores,
      targetPopulation,
      mutationRate,
      Math.min(2, topK) // Preserve top 2 as elites
    );

    console.log(`[Evolution] Generated ${nextGeneration.length} genomes for next generation`);

    // Send STAN cluster summary event
    try {
      const stan = getStanBridge();
      const event = stan.createEvent('CLUSTER_SUMMARY', {
        simulationCount: this.instances.size,
        completedSimulations: this.outcomes.length,
        evolutionGeneration: 1, // This could be tracked if needed
        fitnessStatistics: {
          count: Object.keys(fitnessScores).length,
          min: Math.min(...Object.values(fitnessScores)),
          max: Math.max(...Object.values(fitnessScores)),
          average: generationResult.averageFitness,
        },
        topGenomes: {
          count: generationResult.topGenomes.length,
          selected: topK,
        },
        nextGeneration: {
          populationSize: nextGeneration.length,
          mutationRate: mutationRate,
          eliteCount: Math.min(2, topK),
        },
        criteria: fitnessCriteria,
      });

      stan.sendEvent(event);
    } catch (error) {
      console.error('[SimulationCluster] Failed to send STAN cluster summary:', error);
    }

    return nextGeneration;
  }

  /**
   * Start periodic cross-world effects application
   * Should be called when running simulations with metaverse integration
   */
  startCrossWorldEffects(intervalMs: number = 5000): NodeJS.Timer | null {
    if (!this.config.enableCrossWorldEffects) {
      console.log('[Cluster] Cross-world effects not enabled');
      return null;
    }

    // Check if any instances have worldId
    const linkedInstances = Array.from(this.instances.values()).filter(inst => inst.worldId);
    if (linkedInstances.length === 0) {
      console.log('[Cluster] No simulations linked to metaverse worlds');
      return null;
    }

    console.log(
      `[Cluster] Starting cross-world effects (every ${intervalMs}ms for ${linkedInstances.length} worlds)`
    );

    const interval = setInterval(() => {
      try {
        // Update world metadata from simulation states
        linkedInstances.forEach(instance => {
          if (instance.worldId) {
            const metaverseManager = getMetaverseManager();
            const aliveAgents = instance.agents.filter(a => a.getState().health > 0);

            // Aggregate resource totals
            let totalFood = 0;
            let totalWater = 0;
            let totalMaterial = 0;
            let totalCulturalInfluence = 0;
            const beliefs = new Set<string>();

            aliveAgents.forEach(agent => {
              const state = agent.getState();
              totalFood += state.inventory?.food || 0;
              totalWater += state.inventory?.water || 0;
              totalMaterial += state.inventory?.material || 0;

              // Cultural influence from empathy and cooperation
              totalCulturalInfluence += (state.stats.empathy + state.stats.cooperation) / 2;

              // Collect beliefs from agent goals
              state.goals.forEach(goal => {
                if (goal.description) {
                  beliefs.add(goal.description);
                }
              });
            });

            // Update world metadata
            const avgCulturalInfluence = aliveAgents.length > 0
              ? totalCulturalInfluence / aliveAgents.length
              : 50;

            metaverseManager.updateWorldResources(instance.worldId, {
              food: Math.min(200, (totalFood / Math.max(1, aliveAgents.length)) * 10),
              water: Math.min(200, (totalWater / Math.max(1, aliveAgents.length)) * 10),
              material: Math.min(200, (totalMaterial / Math.max(1, aliveAgents.length)) * 10),
            });

            metaverseManager.updateWorld(instance.worldId, {
              meta: {
                totalAgents: instance.agents.length,
                activeSessions: instance.status === 'running' ? 1 : 0,
                resourceAbundance: metaverseManager.getWorld(instance.worldId)?.meta.resourceAbundance,
                dominantBeliefs: Array.from(beliefs).slice(0, 5),
                culturalInfluence: avgCulturalInfluence,
              },
            });
          }
        });

        // Apply cross-world effects
        const metaverseManager = getMetaverseManager();
        metaverseManager.applyCrossWorldEffects();
      } catch (error) {
        console.error('[Cluster] Error applying cross-world effects:', error);
      }
    }, intervalMs);

    return interval;
  }

  /**
   * Get all simulation instances
   */
  getInstances(): SimulationInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * Get instances linked to metaverse
   */
  getMetaverseLinkedInstances(): SimulationInstance[] {
    return Array.from(this.instances.values()).filter(inst => inst.worldId !== undefined);
  }
}
