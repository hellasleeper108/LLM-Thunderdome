/**
 * Analytics Engine
 * Computes various analytics and visualizations for simulation data
 */

import { AgentState, Position, Message, ActionResult } from '../schemas/types';
import { SocialGraph } from '../agents/SocialGraph';
import { AllianceManager } from '../agents/AllianceManager';
import { Faction } from '../civilization/FactionManager';
import { Law, LawViolation } from '../civilization/LawSystem';

// Analytics data structures
export interface HeatmapCell {
  x: number;
  y: number;
  value: number;
  count: number;
}

export interface Heatmap {
  width: number;
  height: number;
  cells: HeatmapCell[][];
  min: number;
  max: number;
  average: number;
}

export interface ResourceFlowEdge {
  from: string;
  to: string;
  food: number;
  water: number;
  material: number;
  total: number;
}

export interface ResourceFlow {
  edges: ResourceFlowEdge[];
  totalTransferred: number;
  mostGenerousAgent: { id: string; name: string; total: number } | null;
  mostReceivingAgent: { id: string; name: string; total: number } | null;
}

export interface SurvivalRate {
  agentId: string;
  agentName: string;
  personality: string;
  survived: boolean;
  turnsAlive: number;
  deathTurn?: number;
  causeOfDeath?: string;
}

export interface SurvivalStatistics {
  totalAgents: number;
  survived: number;
  died: number;
  survivalRate: number;
  averageTurnsAlive: number;
  byPersonality: {
    [personality: string]: {
      total: number;
      survived: number;
      survivalRate: number;
    };
  };
}

export interface NegotiationMetrics {
  totalNegotiations: number;
  successfulNegotiations: number;
  failedNegotiations: number;
  successRate: number;
  byProtocol: {
    [protocol: string]: {
      total: number;
      successful: number;
      successRate: number;
    };
  };
  byAgent: {
    [agentId: string]: {
      name: string;
      initiated: number;
      successful: number;
      successRate: number;
    };
  };
}

export interface SocialGraphNode {
  id: string;
  name: string;
  personality: string;
  stats: {
    aggression: number;
    cooperation: number;
    empathy: number;
  };
  position: Position;
  health: number;
  isAlive: boolean;
}

export interface SocialGraphEdge {
  source: string;
  target: string;
  trust: number;
  fear: number;
  respect: number;
  rivalry: number;
  loyalty: number;
  strength: number; // Combined strength
  isAlliance: boolean;
}

export interface SocialGraphData {
  nodes: SocialGraphNode[];
  edges: SocialGraphEdge[];
  clusters: string[][]; // Groups of allied agents
}

export interface AnalyticsMetrics {
  simulation: {
    currentTurn: number;
    totalAgents: number;
    agentsAlive: number;
    totalResources: number;
    activeAlliances: number;
  };
  combat: {
    totalAttacks: number;
    successfulAttacks: number;
    totalDamage: number;
    kills: number;
  };
  cooperation: {
    totalTrades: number;
    totalResourcesShared: number;
    alliancesFormed: number;
    alliancesBroken: number;
  };
  exploration: {
    tilesExplored: number;
    resourcesGathered: number;
    averageMovement: number;
  };
}

export interface FactionStabilityMap {
  [factionId: string]: number;
}

export interface InterFactionConflictRates {
  [pairKey: string]: number; // key format: "FactionA|FactionB"
}

export interface LawComplianceData {
  [lawId: string]: {
    violations: number;
    totalRelevant: number; // Total actions that could violate this law
    complianceRate: number; // percentage
  };
}

export interface CivilizationAnalytics {
  factions: Array<Faction & { stability: number; memberCount: number }>;
  factionStability: FactionStabilityMap;
  conflictRates: InterFactionConflictRates;
  lawCompliance: LawComplianceData;
}

export class AnalyticsEngine {
  /**
   * Generate aggression heatmap showing aggressive behavior across the world
   */
  generateAggressionHeatmap(
    agents: AgentState[],
    worldWidth: number,
    worldHeight: number
  ): Heatmap {
    // Initialize grid
    const cells: HeatmapCell[][] = [];
    for (let y = 0; y < worldHeight; y++) {
      cells[y] = [];
      for (let x = 0; x < worldWidth; x++) {
        cells[y][x] = { x, y, value: 0, count: 0 };
      }
    }

    let totalValue = 0;
    let totalCount = 0;
    let min = Infinity;
    let max = -Infinity;

    // Aggregate aggression values at each position
    agents.forEach((agent) => {
      const { x, y } = agent.position;
      if (x >= 0 && x < worldWidth && y >= 0 && y < worldHeight) {
        const aggression = agent.stats.aggression;
        cells[y][x].value += aggression;
        cells[y][x].count += 1;
        totalValue += aggression;
        totalCount += 1;

        if (aggression < min) min = aggression;
        if (aggression > max) max = aggression;
      }
    });

    // Average values per cell
    for (let y = 0; y < worldHeight; y++) {
      for (let x = 0; x < worldWidth; x++) {
        if (cells[y][x].count > 0) {
          cells[y][x].value = cells[y][x].value / cells[y][x].count;
        }
      }
    }

    return {
      width: worldWidth,
      height: worldHeight,
      cells,
      min: min === Infinity ? 0 : min,
      max: max === -Infinity ? 100 : max,
      average: totalCount > 0 ? totalValue / totalCount : 0,
    };
  }

  /**
   * Generate cooperation heatmap showing cooperative behavior across the world
   */
  generateCooperationHeatmap(
    agents: AgentState[],
    worldWidth: number,
    worldHeight: number
  ): Heatmap {
    // Initialize grid
    const cells: HeatmapCell[][] = [];
    for (let y = 0; y < worldHeight; y++) {
      cells[y] = [];
      for (let x = 0; x < worldWidth; x++) {
        cells[y][x] = { x, y, value: 0, count: 0 };
      }
    }

    let totalValue = 0;
    let totalCount = 0;
    let min = Infinity;
    let max = -Infinity;

    // Aggregate cooperation values at each position
    agents.forEach((agent) => {
      const { x, y } = agent.position;
      if (x >= 0 && x < worldWidth && y >= 0 && y < worldHeight) {
        const cooperation = agent.stats.cooperation;
        cells[y][x].value += cooperation;
        cells[y][x].count += 1;
        totalValue += cooperation;
        totalCount += 1;

        if (cooperation < min) min = cooperation;
        if (cooperation > max) max = cooperation;
      }
    });

    // Average values per cell
    for (let y = 0; y < worldHeight; y++) {
      for (let x = 0; x < worldWidth; x++) {
        if (cells[y][x].count > 0) {
          cells[y][x].value = cells[y][x].value / cells[y][x].count;
        }
      }
    }

    return {
      width: worldWidth,
      height: worldHeight,
      cells,
      min: min === Infinity ? 0 : min,
      max: max === -Infinity ? 100 : max,
      average: totalCount > 0 ? totalValue / totalCount : 0,
    };
  }

  /**
   * Compute resource flow between agents based on messages and actions
   */
  computeResourceFlow(
    messages: Message[],
    actionResults: ActionResult[]
  ): ResourceFlow {
    const flowMap = new Map<string, ResourceFlowEdge>();

    // Track resource transfers from share actions
    actionResults.forEach((result) => {
      if (result.action.type === 'share') {
        // Extract from and to from result metadata or action
        const from = result.action.payload?.fromAgent || '';
        const to = result.action.target as string;

        if (!from || !to || typeof to !== 'string') return;

        const key = `${from}->${to}`;
        let edge = flowMap.get(key);

        if (!edge) {
          edge = { from, to, food: 0, water: 0, material: 0, total: 0 };
          flowMap.set(key, edge);
        }

        // Extract resource amounts from payload
        const payload = result.action.payload;
        if (payload) {
          edge.food += payload.food || 0;
          edge.water += payload.water || 0;
          edge.material += payload.material || 0;
          edge.total = edge.food + edge.water + edge.material;
        }
      }
    });

    const edges = Array.from(flowMap.values());
    const totalTransferred = edges.reduce((sum, edge) => sum + edge.total, 0);

    // Find most generous and most receiving agents
    const givenByAgent = new Map<string, number>();
    const receivedByAgent = new Map<string, number>();

    edges.forEach((edge) => {
      givenByAgent.set(edge.from, (givenByAgent.get(edge.from) || 0) + edge.total);
      receivedByAgent.set(edge.to, (receivedByAgent.get(edge.to) || 0) + edge.total);
    });

    let mostGenerousAgent = null;
    let maxGiven = 0;
    givenByAgent.forEach((total, id) => {
      if (total > maxGiven) {
        maxGiven = total;
        mostGenerousAgent = { id, name: id, total };
      }
    });

    let mostReceivingAgent = null;
    let maxReceived = 0;
    receivedByAgent.forEach((total, id) => {
      if (total > maxReceived) {
        maxReceived = total;
        mostReceivingAgent = { id, name: id, total };
      }
    });

    return {
      edges,
      totalTransferred,
      mostGenerousAgent,
      mostReceivingAgent,
    };
  }

  /**
   * Compute survival rates by personality and overall
   */
  computeSurvivalRates(
    agents: AgentState[],
    currentTurn: number,
    deathRecords: Array<{ agentId: string; turn: number; cause: string }>
  ): SurvivalStatistics {
    const rates: SurvivalRate[] = agents.map((agent) => {
      const deathRecord = deathRecords.find((d) => d.agentId === agent.id);
      const survived = agent.isAlive;
      const turnsAlive = deathRecord ? deathRecord.turn : currentTurn;

      return {
        agentId: agent.id,
        agentName: agent.name,
        personality: agent.personality.name,
        survived,
        turnsAlive,
        deathTurn: deathRecord?.turn,
        causeOfDeath: deathRecord?.cause,
      };
    });

    const totalAgents = agents.length;
    const survived = rates.filter((r) => r.survived).length;
    const died = totalAgents - survived;
    const survivalRate = totalAgents > 0 ? (survived / totalAgents) * 100 : 0;
    const averageTurnsAlive =
      rates.reduce((sum, r) => sum + r.turnsAlive, 0) / totalAgents;

    // Group by personality
    const byPersonality: {
      [personality: string]: {
        total: number;
        survived: number;
        survivalRate: number;
      };
    } = {};

    rates.forEach((rate) => {
      if (!byPersonality[rate.personality]) {
        byPersonality[rate.personality] = {
          total: 0,
          survived: 0,
          survivalRate: 0,
        };
      }

      byPersonality[rate.personality].total += 1;
      if (rate.survived) {
        byPersonality[rate.personality].survived += 1;
      }
    });

    // Calculate survival rates per personality
    Object.keys(byPersonality).forEach((personality) => {
      const data = byPersonality[personality];
      data.survivalRate = data.total > 0 ? (data.survived / data.total) * 100 : 0;
    });

    return {
      totalAgents,
      survived,
      died,
      survivalRate,
      averageTurnsAlive,
      byPersonality,
    };
  }

  /**
   * Compute negotiation success rates
   */
  computeNegotiationSuccessRates(
    messages: Message[],
    actionResults: ActionResult[]
  ): NegotiationMetrics {
    const negotiations = actionResults.filter(
      (result) =>
        result.action.type === 'negotiate' ||
        result.action.type === 'form_alliance'
    );

    const totalNegotiations = negotiations.length;
    const successfulNegotiations = negotiations.filter((n) => n.success).length;
    const failedNegotiations = totalNegotiations - successfulNegotiations;
    const successRate =
      totalNegotiations > 0 ? (successfulNegotiations / totalNegotiations) * 100 : 0;

    // By protocol
    const byProtocol: {
      [protocol: string]: {
        total: number;
        successful: number;
        successRate: number;
      };
    } = {};

    negotiations.forEach((neg) => {
      const protocol = neg.action.type;
      if (!byProtocol[protocol]) {
        byProtocol[protocol] = { total: 0, successful: 0, successRate: 0 };
      }

      byProtocol[protocol].total += 1;
      if (neg.success) {
        byProtocol[protocol].successful += 1;
      }
    });

    Object.keys(byProtocol).forEach((protocol) => {
      const data = byProtocol[protocol];
      data.successRate = data.total > 0 ? (data.successful / data.total) * 100 : 0;
    });

    // By agent - use payload to get agent ID
    const byAgent: {
      [agentId: string]: {
        name: string;
        initiated: number;
        successful: number;
        successRate: number;
      };
    } = {};

    negotiations.forEach((neg) => {
      const agentId = neg.action.payload?.initiator || 'unknown';
      if (!byAgent[agentId]) {
        byAgent[agentId] = {
          name: agentId,
          initiated: 0,
          successful: 0,
          successRate: 0,
        };
      }

      byAgent[agentId].initiated += 1;
      if (neg.success) {
        byAgent[agentId].successful += 1;
      }
    });

    Object.keys(byAgent).forEach((agentId) => {
      const data = byAgent[agentId];
      data.successRate = data.initiated > 0 ? (data.successful / data.initiated) * 100 : 0;
    });

    return {
      totalNegotiations,
      successfulNegotiations,
      failedNegotiations,
      successRate,
      byProtocol,
      byAgent,
    };
  }

  /**
   * Build social graph matrix with nodes and edges
   */
  buildSocialGraphMatrix(
    agents: AgentState[],
    socialGraph: SocialGraph,
    allianceManager: AllianceManager
  ): SocialGraphData {
    // Build nodes
    const nodes: SocialGraphNode[] = agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      personality: agent.personality.name,
      stats: {
        aggression: agent.stats.aggression,
        cooperation: agent.stats.cooperation,
        empathy: agent.stats.empathy,
      },
      position: agent.position,
      health: agent.health,
      isAlive: agent.isAlive,
    }));

    // Build edges from social relationships
    const edges: SocialGraphEdge[] = [];
    const clusters: string[][] = [];

    agents.forEach((agentA) => {
      agents.forEach((agentB) => {
        if (agentA.id === agentB.id) return;

        // Get relationship from social graph
        const relationship = socialGraph.getRelationship(agentA.id, agentB.id);

        if (!relationship) return;

        // Only include edges with meaningful relationships
        const totalStrength =
          relationship.trust +
          relationship.fear +
          relationship.respect +
          relationship.rivalry +
          relationship.loyalty;

        if (totalStrength > 50) {
          // Threshold for inclusion
          const isAlliance = allianceManager.areAllied(agentA.id, agentB.id);

          edges.push({
            source: agentA.id,
            target: agentB.id,
            trust: relationship.trust,
            fear: relationship.fear,
            respect: relationship.respect,
            rivalry: relationship.rivalry,
            loyalty: relationship.loyalty,
            strength: totalStrength / 5, // Average strength
            isAlliance,
          });
        }
      });
    });

    // Identify clusters (groups of allied agents)
    const visited = new Set<string>();

    agents.forEach((agent) => {
      if (visited.has(agent.id)) return;

      const cluster: string[] = [agent.id];
      visited.add(agent.id);

      // BFS to find all allies
      const queue = [agent.id];
      while (queue.length > 0) {
        const currentId = queue.shift()!;
        const alliances = allianceManager.getAlliances(currentId);

        // Extract ally IDs from alliances
        alliances.forEach((alliance) => {
          alliance.memberIds.forEach((allyId: string) => {
            if (allyId !== currentId && !visited.has(allyId)) {
              visited.add(allyId);
              cluster.push(allyId);
              queue.push(allyId);
            }
          });
        });
      }

      if (cluster.length > 1) {
        clusters.push(cluster);
      }
    });

    return {
      nodes,
      edges,
      clusters,
    };
  }

  /**
   * Compute comprehensive analytics metrics
   */
  computeMetrics(
    agents: AgentState[],
    actionResults: ActionResult[],
    currentTurn: number
  ): AnalyticsMetrics {
    const agentsAlive = agents.filter((a) => a.isAlive).length;
    const totalResources = agents.reduce(
      (sum, a) => sum + a.inventory.food + a.inventory.water + a.inventory.material,
      0
    );

    // Count active alliances
    const activeAlliances = new Set<string>();
    agents.forEach((agent) => {
      agent.allegiances.forEach((allyId) => {
        const pair = [agent.id, allyId].sort().join('-');
        activeAlliances.add(pair);
      });
    });

    // Combat metrics
    const attacks = actionResults.filter((r) => r.action.type === 'attack');
    const successfulAttacks = attacks.filter((a) => a.success).length;
    const totalDamage = attacks.reduce((sum, a) => {
      const damage = a.action.payload?.damage || 0;
      return sum + damage;
    }, 0);
    const kills = attacks.filter((a) => a.action.payload?.killed === true).length;

    // Cooperation metrics
    const shares = actionResults.filter((r) => r.action.type === 'share');
    const totalResourcesShared = shares.reduce((sum, s) => {
      const payload = s.action.payload;
      return sum + (payload?.food || 0) + (payload?.water || 0) + (payload?.material || 0);
    }, 0);

    const alliancesFormed = actionResults.filter(
      (r) => r.action.type === 'form_alliance' && r.success
    ).length;
    const alliancesBroken = actionResults.filter(
      (r) => r.action.type === 'break_alliance'
    ).length;

    // Exploration metrics
    const moves = actionResults.filter((r) => r.action.type === 'move');
    const gathers = actionResults.filter((r) => r.action.type === 'gather');
    const resourcesGathered = gathers.reduce((sum, g) => {
      const payload = g.action.payload;
      return sum + (payload?.amount || 0);
    }, 0);

    return {
      simulation: {
        currentTurn,
        totalAgents: agents.length,
        agentsAlive,
        totalResources,
        activeAlliances: activeAlliances.size,
      },
      combat: {
        totalAttacks: attacks.length,
        successfulAttacks,
        totalDamage,
        kills,
      },
      cooperation: {
        totalTrades: shares.length, // Share actions count as trades
        totalResourcesShared,
        alliancesFormed,
        alliancesBroken,
      },
      exploration: {
        tilesExplored: moves.length,
        resourcesGathered,
        averageMovement: agents.length > 0 ? moves.length / agents.length : 0,
      },
    };
  }

  /**
   * Compute faction stability scores
   */
  computeFactionStability(factions: Faction[]): FactionStabilityMap {
    const stabilityMap: FactionStabilityMap = {};

    factions.forEach((faction) => {
      // Base stability from cohesion (0-1)
      let stability = faction.cohesion;

      // Member count factor (optimal: 3-7 members)
      const memberCount = faction.members.size;
      if (memberCount === 0) {
        stability = 0;
      } else if (memberCount < 3) {
        stability *= 0.8; // Small factions are fragile
      } else if (memberCount > 10) {
        stability *= 0.9; // Large factions are harder to manage
      }

      // Law count factor (sweet spot: 1-5 laws)
      const lawCount = faction.laws.length;
      if (lawCount === 0) {
        stability *= 0.9; // No laws = less structure
      } else if (lawCount > 5) {
        stability *= 0.95; // Too many laws = inflexibility
      }

      // Resource factor (resources per member)
      const totalResources =
        faction.resources.food + faction.resources.water + faction.resources.materials;
      const resourcesPerMember = memberCount > 0 ? totalResources / memberCount : 0;

      if (resourcesPerMember < 5) {
        stability *= 0.7; // Scarcity breeds discontent
      } else if (resourcesPerMember > 20) {
        stability *= 1.1; // Abundance increases stability
        stability = Math.min(1, stability); // Cap at 1
      }

      stabilityMap[faction.id] = Math.max(0, Math.min(1, stability));
    });

    return stabilityMap;
  }

  /**
   * Compute inter-faction conflict rates
   * Analyzes attack actions between members of different factions
   */
  computeInterFactionConflictRates(
    factions: Faction[],
    actionResults: ActionResult[],
    agents: AgentState[]
  ): InterFactionConflictRates {
    const conflictRates: InterFactionConflictRates = {};

    // Build agent-to-faction map
    const agentToFaction = new Map<string, string>();
    factions.forEach((faction) => {
      faction.members.forEach((agentId) => {
        agentToFaction.set(agentId, faction.id);
      });
    });

    // Count attacks between factions
    const attackCounts = new Map<string, number>();
    const interactionCounts = new Map<string, number>(); // Total interactions for context

    actionResults.forEach((result) => {
      const agentId = result.action.agentId;
      const targetId = typeof result.action.target === 'string' ? result.action.target : null;

      if (!targetId || !agentId) return;

      const agentFaction = agentToFaction.get(agentId);
      const targetFaction = agentToFaction.get(targetId);

      // Only count inter-faction interactions
      if (!agentFaction || !targetFaction || agentFaction === targetFaction) return;

      // Create consistent pair key (alphabetically sorted)
      const pairKey = [agentFaction, targetFaction].sort().join('|');

      // Count total interactions
      interactionCounts.set(pairKey, (interactionCounts.get(pairKey) || 0) + 1);

      // Count attacks
      if (result.action.type === 'attack') {
        attackCounts.set(pairKey, (attackCounts.get(pairKey) || 0) + 1);
      }
    });

    // Calculate conflict rates (attacks / total interactions)
    interactionCounts.forEach((totalInteractions, pairKey) => {
      const attacks = attackCounts.get(pairKey) || 0;
      conflictRates[pairKey] = totalInteractions > 0 ? attacks / totalInteractions : 0;
    });

    // Initialize zero rates for faction pairs with no interactions
    factions.forEach((factionA, i) => {
      factions.slice(i + 1).forEach((factionB) => {
        const pairKey = [factionA.id, factionB.id].sort().join('|');
        if (!(pairKey in conflictRates)) {
          conflictRates[pairKey] = 0;
        }
      });
    });

    return conflictRates;
  }

  /**
   * Compute law compliance rates
   * Tracks violations and compliance for each law
   */
  computeLawComplianceRates(
    laws: Law[],
    factions: Faction[],
    actionResults: ActionResult[],
    lawViolations: Array<{ lawId: string; agentId: string; turn: number }>
  ): LawComplianceData {
    const complianceData: LawComplianceData = {};

    // Build agent-to-faction map to know which laws apply
    const agentToFaction = new Map<string, Faction>();
    factions.forEach((faction) => {
      faction.members.forEach((agentId) => {
        agentToFaction.set(agentId, faction);
      });
    });

    laws.forEach((law) => {
      // Count violations for this law
      const violations = lawViolations.filter((v) => v.lawId === law.id).length;

      // Count total relevant actions (actions that could violate this law)
      let totalRelevant = 0;

      actionResults.forEach((result) => {
        const agentId = result.action.agentId;
        const faction = agentToFaction.get(agentId);

        // Only count actions by agents in factions that have this law
        if (!faction || !faction.laws.includes(law.id)) return;

        // Count actions relevant to this law type
        switch (law.type) {
          case 'NO_ATTACK':
            if (result.action.type === 'attack') {
              totalRelevant++;
            }
            break;

          case 'RESOURCE_SHARING':
            if (
              result.action.type === 'communicate' ||
              result.action.type === 'share' ||
              result.action.type === 'negotiate'
            ) {
              totalRelevant++;
            }
            break;

          case 'COOPERATION':
            if (
              result.action.type === 'form_alliance' ||
              result.action.type === 'break_alliance'
            ) {
              totalRelevant++;
            }
            break;

          case 'TRIBUTE':
            if (result.action.type === 'gather') {
              totalRelevant++;
            }
            break;

          case 'CUSTOM':
            // For custom laws, count all actions
            totalRelevant++;
            break;
        }
      });

      const complianceRate =
        totalRelevant > 0 ? ((totalRelevant - violations) / totalRelevant) * 100 : 100;

      complianceData[law.id] = {
        violations,
        totalRelevant,
        complianceRate,
      };
    });

    return complianceData;
  }
}
