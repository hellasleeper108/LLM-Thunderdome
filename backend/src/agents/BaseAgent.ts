/**
 * Base Agent Class
 * All agents inherit from this class and implement the decideAction method
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AgentState,
  AgentStats,
  Personality,
  Goal,
  Memory,
  MemoryEntry,
  Observation,
  Action,
  ActionType,
  Position,
  Inventory,
  Message,
} from '../schemas/types';
import { MemoryManager } from './memory/MemoryManager';

export abstract class BaseAgent {
  protected state: AgentState;
  protected memoryManager: MemoryManager;

  constructor(
    name: string,
    personality: Personality,
    position: Position,
    goals: Goal[]
  ) {
    const id = uuidv4();

    this.state = {
      id,
      name,
      position,
      personality,
      stats: { ...personality.traits },
      goals,
      memory: {
        shortTerm: [],
        longTerm: [],
      },
      inventory: {
        food: 0,
        water: 0,
        material: 0,
      },
      health: 100,
      isAlive: true,
      allegiances: [],
      activePlan: undefined,
      planHistory: {
        completedPlans: [],
        failedPlans: [],
        abandonedPlans: [],
        totalPlansCreated: 0,
        averageSuccessRate: 0,
        preferredPlanLength: 3,
      },
    };

    // Initialize advanced memory system
    this.memoryManager = new MemoryManager(id, {
      maxEpisodes: 100,
      maxFacts: 50,
      episodeDecayRate: 0.5,
      consolidationInterval: 10,
    });
  }

  /**
   * Abstract method that each agent type must implement
   * This is where the agent's decision-making logic lives
   */
  abstract decideAction(observation: Observation): Promise<Action>;

  /**
   * Observe the world and update short-term memory
   */
  observe(observation: Observation): void {
    const memoryEntry: MemoryEntry = {
      timestamp: Date.now(),
      type: 'observation',
      content: `Observed ${observation.nearbyAgents.length} agents, ${observation.visibleTiles.length} tiles`,
      metadata: {
        nearbyAgentCount: observation.nearbyAgents.length,
        visibleTileCount: observation.visibleTiles.length,
      },
    };

    this.addToMemory(memoryEntry, 'short');
  }

  /**
   * Add an entry to agent's memory
   */
  addToMemory(entry: MemoryEntry, term: 'short' | 'long' = 'short'): void {
    if (term === 'short') {
      this.state.memory.shortTerm.push(entry);
      // Keep only last 20 short-term memories
      if (this.state.memory.shortTerm.length > 20) {
        const archived = this.state.memory.shortTerm.shift()!;
        // Important memories get promoted to long-term
        if (archived.type === 'interaction' || archived.type === 'dialogue') {
          this.state.memory.longTerm.push(archived);
        }
      }
    } else {
      this.state.memory.longTerm.push(entry);
      // Keep only last 100 long-term memories
      if (this.state.memory.longTerm.length > 100) {
        this.state.memory.longTerm.shift();
      }
    }
  }

  /**
   * Send a message to another agent
   */
  sendMessage(to: string, content: string, type: Message['type'] = 'other'): Message {
    const message: Message = {
      id: uuidv4(),
      from: this.state.id,
      to,
      content,
      type,
      timestamp: Date.now(),
    };

    this.addToMemory({
      timestamp: Date.now(),
      type: 'dialogue',
      content: `Sent message to ${to}: ${content}`,
      metadata: { messageType: type },
    });

    return message;
  }

  /**
   * Receive a message and add to memory
   */
  receiveMessage(message: Message): void {
    this.addToMemory({
      timestamp: Date.now(),
      type: 'dialogue',
      content: `Received from ${message.from}: ${message.content}`,
      metadata: { messageType: message.type },
    });
  }

  /**
   * Update agent stats
   */
  updateStats(changes: Partial<AgentStats>): void {
    this.state.stats = { ...this.state.stats, ...changes };

    // Clamp stats between 0 and 100
    Object.keys(this.state.stats).forEach((key) => {
      const statKey = key as keyof AgentStats;
      this.state.stats[statKey] = Math.max(0, Math.min(100, this.state.stats[statKey]));
    });
  }

  /**
   * Update inventory
   */
  updateInventory(changes: Partial<Inventory>): void {
    this.state.inventory = { ...this.state.inventory, ...changes };

    // Prevent negative inventory
    Object.keys(this.state.inventory).forEach((key) => {
      const invKey = key as keyof Inventory;
      this.state.inventory[invKey] = Math.max(0, this.state.inventory[invKey]);
    });
  }

  /**
   * Take damage
   */
  takeDamage(amount: number): void {
    this.state.health = Math.max(0, this.state.health - amount);
    if (this.state.health === 0) {
      this.state.isAlive = false;
    }
  }

  /**
   * Heal
   */
  heal(amount: number): void {
    this.state.health = Math.min(100, this.state.health + amount);
  }

  /**
   * Form alliance with another agent
   */
  formAlliance(agentId: string): void {
    if (!this.state.allegiances.includes(agentId)) {
      this.state.allegiances.push(agentId);
      this.addToMemory({
        timestamp: Date.now(),
        type: 'interaction',
        content: `Formed alliance with ${agentId}`,
      });
    }
  }

  /**
   * Break alliance with another agent
   */
  breakAlliance(agentId: string): void {
    this.state.allegiances = this.state.allegiances.filter(id => id !== agentId);
    this.addToMemory({
      timestamp: Date.now(),
      type: 'interaction',
      content: `Broke alliance with ${agentId}`,
    });
  }

  /**
   * Check if allied with another agent
   */
  isAlliedWith(agentId: string): boolean {
    return this.state.allegiances.includes(agentId);
  }

  /**
   * Get all current allies
   */
  getAllies(): string[] {
    return [...this.state.allegiances];
  }

  /**
   * Get count of current alliances
   */
  getAllianceCount(): number {
    return this.state.allegiances.length;
  }

  /**
   * Request alliance with another agent
   * Returns a message indicating willingness to ally
   */
  requestAlliance(targetId: string, reason?: string): Message {
    const message = this.sendMessage(
      targetId,
      reason || `I propose we form an alliance for mutual benefit.`,
      'alliance'
    );

    this.addToMemory({
      timestamp: Date.now(),
      type: 'interaction',
      content: `Requested alliance with ${targetId}`,
    });

    return message;
  }

  /**
   * Evaluate alliance worthiness based on personality and memory
   * Returns score 0-100 indicating willingness to ally
   */
  evaluateAllianceProposal(proposerId: string, proposerStats: AgentStats): number {
    let score = 50; // Base willingness

    // High cooperation = more willing to ally
    score += (this.state.stats.cooperation - 50) * 0.5;

    // High empathy = more willing to ally
    score += (this.state.stats.empathy - 50) * 0.3;

    // Similar cooperation levels = better match
    const cooperationDiff = Math.abs(this.state.stats.cooperation - proposerStats.cooperation);
    score -= cooperationDiff * 0.2;

    // Very aggressive agents are suspicious
    if (proposerStats.aggression > 80) {
      score -= 20;
    }

    // Already have many allies? Less eager
    score -= this.state.allegiances.length * 5;

    // Low health? More eager for protection
    if (this.state.health < 50) {
      score += 15;
    }

    // Memory-based modifiers
    const memoryModifiers = this.memoryManager.getDecisionModifiers(proposerId);
    score += memoryModifiers.trustModifier * 30; // Trust heavily influences alliance
    score += memoryModifiers.cooperationModifier * 20;

    // Check if we remember betrayals
    if (this.memoryManager.hasMemoryOf('betray', proposerId)) {
      score -= 40; // Strong penalty for past betrayals
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Decide whether to help an ally
   */
  shouldHelpAlly(allyId: string, cost: number): boolean {
    if (!this.isAlliedWith(allyId)) {
      return false;
    }

    // High cooperation = more likely to help
    const willingnessScore = this.state.stats.cooperation + this.state.stats.empathy;

    // Can we afford it?
    const canAfford = this.state.stats.energy > cost * 2;

    return willingnessScore > 100 && canAfford;
  }

  /**
   * Get current state (immutable copy)
   */
  getState(): Readonly<AgentState> {
    return { ...this.state };
  }

  /**
   * Update position
   */
  setPosition(position: Position): void {
    this.state.position = position;
  }

  /**
   * Get distance to a position
   */
  protected getDistance(pos: Position): number {
    return Math.abs(this.state.position.x - pos.x) + Math.abs(this.state.position.y - pos.y);
  }

  /**
   * Get personality trait value
   */
  protected getTrait(trait: keyof AgentStats): number {
    return this.state.stats[trait];
  }

  /**
   * Get memory manager (for external access)
   */
  getMemoryManager(): MemoryManager {
    return this.memoryManager;
  }

  /**
   * Set active plan
   */
  setActivePlan(plan: any): void {
    this.state.activePlan = plan;
  }

  /**
   * Get active plan
   */
  getActivePlan(): any {
    return this.state.activePlan;
  }

  /**
   * Clear active plan
   */
  clearActivePlan(): void {
    this.state.activePlan = undefined;
  }

  /**
   * Get plan history
   */
  getPlanHistory(): any {
    return this.state.planHistory;
  }

  /**
   * Update memory system each turn
   */
  updateMemory(turn: number): void {
    this.memoryManager.tick(turn);
  }

  /**
   * Record an action to memory
   */
  recordAction(
    turn: number,
    actionType: string,
    success: boolean,
    targetAgent?: string,
    metadata?: any
  ): void {
    this.memoryManager.rememberEpisode(
      turn,
      'action',
      actionType,
      `Performed ${actionType} ${success ? 'successfully' : 'unsuccessfully'}`,
      {
        otherAgents: targetAgent ? [targetAgent] : undefined,
        location: this.state.position,
        emotion: success ? 'positive' : 'negative',
        importance: 40,
        metadata: {
          outcome: success ? 'success' : 'failure',
          ...metadata,
        },
      }
    );
  }

  /**
   * Record an interaction to memory
   */
  recordInteraction(
    turn: number,
    event: string,
    description: string,
    otherAgentIds: string[],
    emotion: 'positive' | 'negative' | 'neutral',
    importance: number = 50,
    metadata?: any
  ): void {
    this.memoryManager.rememberEpisode(
      turn,
      'interaction',
      event,
      description,
      {
        otherAgents: otherAgentIds,
        location: this.state.position,
        emotion,
        importance,
        metadata,
      }
    );
  }

  /**
   * Learn a fact about another agent
   */
  learnAboutAgent(
    agentId: string,
    category: 'agent_trait' | 'agent_behavior' | 'relationship',
    predicate: string,
    detail: string,
    importance: number = 50
  ): void {
    this.memoryManager.learnFact(
      category,
      agentId,
      predicate,
      detail,
      importance,
      { relatedAgents: [agentId] }
    );
  }

  /**
   * Get decision modifiers based on memory of target agent
   */
  getMemoryBasedModifiers(targetAgentId?: string): {
    trustModifier: number;
    aggressionModifier: number;
    cooperationModifier: number;
    riskModifier: number;
    reasoning: string[];
  } {
    return this.memoryManager.getDecisionModifiers(targetAgentId);
  }
}
