/**
 * Simulation Engine
 * Turn-based scheduler that orchestrates the entire simulation
 */

import { BaseAgent } from '../agents/BaseAgent';
import { World } from '../world/World';
import { EventLogger } from '../logging/EventLogger';
import {
  Action,
  ActionType,
  ActionResult,
  Observation,
  Position,
  Message,
  TileType,
  AgentState,
} from '../schemas/types';
import { v4 as uuidv4 } from 'uuid';

export interface EngineConfig {
  turnDuration: number; // milliseconds per turn
  maxTurns: number;
  autoAdvance?: boolean; // Auto-advance turns
  visionRadius?: number; // How far agents can see
}

export type SimulationStatus = 'idle' | 'running' | 'paused' | 'completed';

export class SimulationEngine {
  private world: World;
  private agents: Map<string, BaseAgent>;
  private logger: EventLogger;
  private config: Required<EngineConfig>;
  private currentTurn: number;
  private status: SimulationStatus;
  private turnTimer: NodeJS.Timeout | null;
  private messages: Message[];
  private actionResults: ActionResult[];

  constructor(world: World, logger: EventLogger, config: EngineConfig) {
    this.world = world;
    this.agents = new Map();
    this.logger = logger;
    this.config = {
      turnDuration: config.turnDuration,
      maxTurns: config.maxTurns,
      autoAdvance: config.autoAdvance ?? false,
      visionRadius: config.visionRadius ?? 3,
    };
    this.currentTurn = 0;
    this.status = 'idle';
    this.turnTimer = null;
    this.messages = [];
    this.actionResults = [];
  }

  /**
   * Add agent to simulation
   */
  addAgent(agent: BaseAgent): void {
    const state = agent.getState();
    this.agents.set(state.id, agent);
    this.logger.logEvent({
      type: 'state_update',
      description: `Agent ${state.name} joined the simulation`,
      agentIds: [state.id],
      metadata: { position: state.position },
    });
  }

  /**
   * Remove agent from simulation
   */
  removeAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      const state = agent.getState();
      this.agents.delete(agentId);
      this.logger.logEvent({
        type: 'state_update',
        description: `Agent ${state.name} left the simulation`,
        agentIds: [agentId],
      });
    }
  }

  /**
   * Start simulation
   */
  start(): void {
    if (this.status === 'running') {
      return;
    }

    this.status = 'running';
    this.logger.logEvent({
      type: 'state_update',
      description: 'Simulation started',
      agentIds: [],
    });

    if (this.config.autoAdvance) {
      this.scheduleNextTurn();
    }
  }

  /**
   * Pause simulation
   */
  pause(): void {
    if (this.status !== 'running') {
      return;
    }

    this.status = 'paused';
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }

    this.logger.logEvent({
      type: 'state_update',
      description: 'Simulation paused',
      agentIds: [],
    });
  }

  /**
   * Resume simulation
   */
  resume(): void {
    if (this.status !== 'paused') {
      return;
    }

    this.status = 'running';
    this.logger.logEvent({
      type: 'state_update',
      description: 'Simulation resumed',
      agentIds: [],
    });

    if (this.config.autoAdvance) {
      this.scheduleNextTurn();
    }
  }

  /**
   * Reset simulation
   */
  reset(): void {
    this.pause();
    this.currentTurn = 0;
    this.messages = [];
    this.actionResults = [];
    this.world.reset();
    this.status = 'idle';

    // Reset all agents
    this.agents.clear();

    this.logger.logEvent({
      type: 'state_update',
      description: 'Simulation reset',
      agentIds: [],
    });
  }

  /**
   * Execute a single turn
   */
  async executeTurn(): Promise<void> {
    if (this.currentTurn >= this.config.maxTurns) {
      this.complete();
      return;
    }

    this.currentTurn++;
    this.logger.logEvent({
      type: 'state_update',
      description: `Turn ${this.currentTurn} started`,
      agentIds: [],
    });

    // Clear previous turn's action results
    this.actionResults = [];

    // Phase 1: All agents observe
    const observations = this.generateObservations();

    // Phase 2: All agents decide actions
    const actions = await this.collectActions(observations);

    // Phase 3: Resolve all actions
    await this.resolveActions(actions);

    // Phase 4: Update world state
    this.updateWorldState();

    // Phase 5: Process events
    this.processEvents();

    this.logger.logEvent({
      type: 'state_update',
      description: `Turn ${this.currentTurn} completed`,
      agentIds: [],
    });

    // Schedule next turn if auto-advancing
    if (this.config.autoAdvance && this.status === 'running') {
      this.scheduleNextTurn();
    }
  }

  /**
   * Generate observations for all agents
   */
  private generateObservations(): Map<string, Observation> {
    const observations = new Map<string, Observation>();

    for (const [agentId, agent] of this.agents.entries()) {
      const state = agent.getState();

      if (!state.isAlive) {
        continue;
      }

      const observation: Observation = {
        visibleTiles: this.world.getTilesInRadius(state.position, this.config.visionRadius),
        nearbyAgents: this.getNearbyAgents(agentId, this.config.visionRadius),
        recentMessages: this.getRecentMessages(agentId),
        currentStats: state.stats,
        inventory: state.inventory,
      };

      observations.set(agentId, observation);
      agent.observe(observation);
    }

    return observations;
  }

  /**
   * Collect actions from all agents
   */
  private async collectActions(observations: Map<string, Observation>): Promise<Action[]> {
    const actionPromises: Promise<Action>[] = [];

    for (const [agentId, agent] of this.agents.entries()) {
      const observation = observations.get(agentId);
      if (observation) {
        actionPromises.push(agent.decideAction(observation));
      }
    }

    return Promise.all(actionPromises);
  }

  /**
   * Resolve all actions
   */
  private async resolveActions(actions: Action[]): Promise<void> {
    // Sort actions by priority (some actions should resolve first)
    const priorityOrder = [
      ActionType.REST,
      ActionType.MOVE,
      ActionType.GATHER,
      ActionType.EXPLORE,
      ActionType.COMMUNICATE,
      ActionType.NEGOTIATE,
      ActionType.FORM_ALLIANCE,
      ActionType.BREAK_ALLIANCE,
      ActionType.SHARE,
      ActionType.ATTACK,
    ];

    const sortedActions = actions.sort((a, b) => {
      return priorityOrder.indexOf(a.type) - priorityOrder.indexOf(b.type);
    });

    for (const action of sortedActions) {
      const result = await this.executeAction(action);
      this.actionResults.push(result);
    }
  }

  /**
   * Execute a single action
   */
  private async executeAction(action: Action): Promise<ActionResult> {
    const agent = this.agents.get(action.agentId);

    if (!agent || !agent.getState().isAlive) {
      return {
        success: false,
        action,
        effects: ['Agent not found or dead'],
        timestamp: Date.now(),
      };
    }

    const state = agent.getState();
    const effects: string[] = [];
    let success = false;

    switch (action.type) {
      case ActionType.MOVE:
        success = this.handleMove(agent, action.target as Position, effects);
        break;

      case ActionType.GATHER:
        success = this.handleGather(agent, action.target as Position, effects);
        break;

      case ActionType.ATTACK:
        success = this.handleAttack(agent, action.target as string, effects);
        break;

      case ActionType.COMMUNICATE:
        success = this.handleCommunicate(agent, action.target as string, action.payload?.message, effects);
        break;

      case ActionType.REST:
        success = this.handleRest(agent, effects);
        break;

      case ActionType.SHARE:
        success = this.handleShare(agent, action.target as string, action.payload, effects);
        break;

      case ActionType.EXPLORE:
        success = this.handleMove(agent, action.target as Position, effects);
        break;

      case ActionType.NEGOTIATE:
        success = this.handleNegotiate(agent, action.target as string, action.payload, effects);
        break;

      case ActionType.FORM_ALLIANCE:
        success = this.handleFormAlliance(agent, action.target as string, action.payload, effects);
        break;

      case ActionType.BREAK_ALLIANCE:
        success = this.handleBreakAlliance(agent, action.target as string, effects);
        break;
    }

    // Log action
    this.logger.logEvent({
      type: 'action',
      description: `${state.name} performed ${action.type}${success ? ' successfully' : ' (failed)'}`,
      agentIds: [action.agentId],
      metadata: { action, effects },
    });

    return {
      success,
      action,
      effects,
      timestamp: Date.now(),
    };
  }

  /**
   * Handle move action
   */
  private handleMove(agent: BaseAgent, target: Position, effects: string[]): boolean {
    const state = agent.getState();

    if (!this.world.isValidPosition(target)) {
      effects.push('Invalid position');
      return false;
    }

    if (!this.world.isWalkable(target)) {
      effects.push('Position blocked by obstacle');
      return false;
    }

    // Check if position is occupied
    const occupant = this.getAgentAtPosition(target);
    if (occupant) {
      effects.push('Position occupied by another agent');
      return false;
    }

    agent.setPosition(target);
    agent.updateStats({ energy: state.stats.energy - 2 });
    effects.push(`Moved to (${target.x}, ${target.y})`);
    return true;
  }

  /**
   * Handle gather action
   */
  private handleGather(agent: BaseAgent, target: Position, effects: string[]): boolean {
    const state = agent.getState();
    const result = this.world.gatherResource(target, 1);

    if (!result) {
      effects.push('No resource at target position');
      return false;
    }

    const resourceMap: Record<TileType, keyof typeof state.inventory> = {
      [TileType.RESOURCE_FOOD]: 'food',
      [TileType.RESOURCE_WATER]: 'water',
      [TileType.RESOURCE_MATERIAL]: 'material',
    } as any;

    const resourceKey = resourceMap[result.type];
    if (resourceKey) {
      const inventoryUpdate = { [resourceKey]: state.inventory[resourceKey] + result.amount };
      agent.updateInventory(inventoryUpdate);
      effects.push(`Gathered ${result.amount} ${resourceKey}`);

      this.logger.logEvent({
        type: 'resource_change',
        description: `${state.name} gathered ${result.amount} ${resourceKey}`,
        agentIds: [state.id],
      });
    }

    agent.updateStats({ energy: state.stats.energy - 5 });
    return true;
  }

  /**
   * Handle attack action
   */
  private handleAttack(agent: BaseAgent, targetId: string, effects: string[]): boolean {
    const attacker = agent.getState();
    const target = this.agents.get(targetId);

    if (!target || !target.getState().isAlive) {
      effects.push('Target not found or already dead');
      return false;
    }

    const targetState = target.getState();

    // Calculate damage based on aggression
    const damage = Math.floor(attacker.stats.aggression / 5) + Math.floor(Math.random() * 10);
    target.takeDamage(damage);

    effects.push(`Dealt ${damage} damage to ${targetState.name}`);

    if (!target.getState().isAlive) {
      effects.push(`${targetState.name} was killed`);

      // Transfer inventory
      agent.updateInventory({
        food: attacker.inventory.food + Math.floor(targetState.inventory.food / 2),
        water: attacker.inventory.water + Math.floor(targetState.inventory.water / 2),
        material: attacker.inventory.material + Math.floor(targetState.inventory.material / 2),
      });

      this.logger.logEvent({
        type: 'interaction',
        description: `${attacker.name} killed ${targetState.name}`,
        agentIds: [attacker.id, targetId],
      });
    }

    agent.updateStats({ energy: attacker.stats.energy - 10 });

    this.logger.logEvent({
      type: 'interaction',
      description: `${attacker.name} attacked ${targetState.name} for ${damage} damage`,
      agentIds: [attacker.id, targetId],
    });

    return true;
  }

  /**
   * Handle communicate action
   */
  private handleCommunicate(agent: BaseAgent, targetId: string, message: string, effects: string[]): boolean {
    const sender = agent.getState();
    const target = this.agents.get(targetId);

    if (!target) {
      effects.push('Target not found');
      return false;
    }

    const msg: Message = {
      id: uuidv4(),
      from: sender.id,
      to: targetId,
      content: message || 'Hello!',
      type: 'info',
      timestamp: Date.now(),
    };

    this.messages.push(msg);
    target.receiveMessage(msg);

    effects.push(`Sent message to ${target.getState().name}`);

    this.logger.logEvent({
      type: 'dialogue',
      description: `${sender.name} → ${target.getState().name}: "${msg.content}"`,
      agentIds: [sender.id, targetId],
    });

    return true;
  }

  /**
   * Handle rest action
   */
  private handleRest(agent: BaseAgent, effects: string[]): boolean {
    const state = agent.getState();

    // Consume food to restore energy
    if (state.inventory.food > 0) {
      agent.updateInventory({ food: state.inventory.food - 1 });
      agent.updateStats({ energy: Math.min(100, state.stats.energy + 20) });
      agent.heal(10);
      effects.push('Rested and consumed food (+20 energy, +10 health)');
    } else {
      agent.updateStats({ energy: Math.min(100, state.stats.energy + 5) });
      effects.push('Rested without food (+5 energy)');
    }

    return true;
  }

  /**
   * Handle share action
   */
  private handleShare(agent: BaseAgent, targetId: string, payload: any, effects: string[]): boolean {
    const giver = agent.getState();
    const receiver = this.agents.get(targetId);

    if (!receiver) {
      effects.push('Target not found');
      return false;
    }

    const receiverState = receiver.getState();
    const resource = payload.resource as keyof typeof giver.inventory;
    const amount = payload.amount || 1;

    if (giver.inventory[resource] < amount) {
      effects.push(`Insufficient ${resource} to share`);
      return false;
    }

    agent.updateInventory({ [resource]: giver.inventory[resource] - amount });
    receiver.updateInventory({ [resource]: receiverState.inventory[resource] + amount });

    effects.push(`Shared ${amount} ${resource} with ${receiverState.name}`);

    this.logger.logEvent({
      type: 'interaction',
      description: `${giver.name} shared ${amount} ${resource} with ${receiverState.name}`,
      agentIds: [giver.id, targetId],
    });

    return true;
  }

  /**
   * Handle negotiate action
   */
  private handleNegotiate(agent: BaseAgent, targetId: string, payload: any, effects: string[]): boolean {
    const negotiator = agent.getState();
    const target = this.agents.get(targetId);

    if (!target) {
      effects.push('Target not found');
      return false;
    }

    const targetState = target.getState();

    const msg: Message = {
      id: uuidv4(),
      from: negotiator.id,
      to: targetId,
      content: payload.message || 'Let us negotiate.',
      type: 'bargain',
      timestamp: Date.now(),
    };

    this.messages.push(msg);
    target.receiveMessage(msg);

    effects.push(`Negotiating with ${targetState.name}`);

    this.logger.logEvent({
      type: 'dialogue',
      description: `${negotiator.name} negotiates with ${targetState.name}: "${msg.content}"`,
      agentIds: [negotiator.id, targetId],
      metadata: { offer: payload.offer },
    });

    return true;
  }

  /**
   * Handle form alliance action
   */
  private handleFormAlliance(agent: BaseAgent, targetId: string, payload: any, effects: string[]): boolean {
    const requester = agent.getState();
    const target = this.agents.get(targetId);

    if (!target) {
      effects.push('Target not found');
      return false;
    }

    const targetState = target.getState();

    // Simple alliance logic: if cooperation is high enough, accept
    const acceptChance = (targetState.stats.cooperation + requester.stats.cooperation) / 200;
    const accepted = Math.random() < acceptChance;

    if (accepted) {
      agent.formAlliance(targetId);
      target.formAlliance(requester.id);

      effects.push(`Formed alliance with ${targetState.name}`);

      this.logger.logEvent({
        type: 'interaction',
        description: `${requester.name} and ${targetState.name} formed an alliance`,
        agentIds: [requester.id, targetId],
      });
    } else {
      effects.push(`${targetState.name} rejected alliance`);

      const msg: Message = {
        id: uuidv4(),
        from: targetId,
        to: requester.id,
        content: 'I decline your proposal.',
        type: 'info',
        timestamp: Date.now(),
      };

      this.messages.push(msg);
      agent.receiveMessage(msg);
    }

    return accepted;
  }

  /**
   * Handle break alliance action
   */
  private handleBreakAlliance(agent: BaseAgent, targetId: string, effects: string[]): boolean {
    const breaker = agent.getState();
    const target = this.agents.get(targetId);

    if (!target) {
      effects.push('Target not found');
      return false;
    }

    const targetState = target.getState();

    agent.breakAlliance(targetId);
    target.breakAlliance(breaker.id);

    effects.push(`Broke alliance with ${targetState.name}`);

    this.logger.logEvent({
      type: 'interaction',
      description: `${breaker.name} broke alliance with ${targetState.name}`,
      agentIds: [breaker.id, targetId],
    });

    return true;
  }

  /**
   * Update world state (spawn events, regenerate resources)
   */
  private updateWorldState(): void {
    // Regenerate resources every 10 turns
    if (this.currentTurn % 10 === 0) {
      this.world.regenerateResources();
      this.logger.logEvent({
        type: 'state_update',
        description: 'Resources regenerated',
        agentIds: [],
      });
    }

    // Spawn random events
    if (Math.random() < 0.1) {
      const eventPos = this.world.spawnEvent();
      if (eventPos) {
        this.logger.logEvent({
          type: 'event',
          description: `Event spawned at (${eventPos.x}, ${eventPos.y})`,
          agentIds: [],
          metadata: { position: eventPos },
        });
      }
    }
  }

  /**
   * Process world events (storms, anomalies, boons)
   */
  private processEvents(): void {
    const allTiles = this.world.getAllTiles();

    for (const row of allTiles) {
      for (const tile of row) {
        if (!tile.type.startsWith('event') || !tile.metadata) {
          continue;
        }

        // Check if event has expired
        const turnsElapsed = this.currentTurn - (tile.metadata.spawnTurn || 0);
        if (turnsElapsed >= (tile.metadata.duration || 5)) {
          this.world.clearEvent(tile.position);
          continue;
        }

        // Apply event effects to nearby agents
        const affectedAgents = this.getAgentsInRadius(tile.position, 2);

        for (const agent of affectedAgents) {
          this.applyEventEffect(agent, tile.type);
        }
      }
    }
  }

  /**
   * Apply event effect to agent
   */
  private applyEventEffect(agent: BaseAgent, eventType: TileType): void {
    const state = agent.getState();

    switch (eventType) {
      case TileType.EVENT_STORM:
        agent.takeDamage(5);
        agent.updateStats({ energy: state.stats.energy - 10 });
        break;

      case TileType.EVENT_ANOMALY:
        // Random effect
        if (Math.random() > 0.5) {
          agent.heal(10);
        } else {
          agent.takeDamage(10);
        }
        break;

      case TileType.EVENT_BOON:
        agent.heal(10);
        agent.updateStats({ energy: Math.min(100, state.stats.energy + 15) });
        break;
    }
  }

  /**
   * Get nearby agents
   */
  private getNearbyAgents(agentId: string, radius: number): AgentState[] {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return [];
    }

    const position = agent.getState().position;
    const nearby: AgentState[] = [];

    for (const [id, otherAgent] of this.agents.entries()) {
      if (id === agentId) {
        continue;
      }

      const otherState = otherAgent.getState();
      const distance =
        Math.abs(position.x - otherState.position.x) +
        Math.abs(position.y - otherState.position.y);

      if (distance <= radius) {
        nearby.push(otherState);
      }
    }

    return nearby;
  }

  /**
   * Get agents in radius of position
   */
  private getAgentsInRadius(position: Position, radius: number): BaseAgent[] {
    const agents: BaseAgent[] = [];

    for (const agent of this.agents.values()) {
      const state = agent.getState();
      const distance =
        Math.abs(position.x - state.position.x) +
        Math.abs(position.y - state.position.y);

      if (distance <= radius && state.isAlive) {
        agents.push(agent);
      }
    }

    return agents;
  }

  /**
   * Get agent at specific position
   */
  private getAgentAtPosition(position: Position): BaseAgent | null {
    for (const agent of this.agents.values()) {
      const state = agent.getState();
      if (state.position.x === position.x && state.position.y === position.y && state.isAlive) {
        return agent;
      }
    }
    return null;
  }

  /**
   * Get recent messages for agent
   */
  private getRecentMessages(agentId: string): Message[] {
    return this.messages
      .filter(msg => msg.to === agentId || msg.from === agentId)
      .slice(-10);
  }

  /**
   * Schedule next turn
   */
  private scheduleNextTurn(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
    }

    this.turnTimer = setTimeout(() => {
      this.executeTurn();
    }, this.config.turnDuration);
  }

  /**
   * Complete simulation
   */
  private complete(): void {
    this.status = 'completed';
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }

    this.logger.logEvent({
      type: 'state_update',
      description: 'Simulation completed',
      agentIds: [],
    });
  }

  /**
   * Get current simulation state
   */
  getState(): {
    turn: number;
    status: SimulationStatus;
    agents: AgentState[];
    messages: Message[];
    actionResults: ActionResult[];
  } {
    return {
      turn: this.currentTurn,
      status: this.status,
      agents: Array.from(this.agents.values()).map(a => a.getState()),
      messages: this.messages,
      actionResults: this.actionResults,
    };
  }

  /**
   * Get current turn
   */
  getCurrentTurn(): number {
    return this.currentTurn;
  }

  /**
   * Get status
   */
  getStatus(): SimulationStatus {
    return this.status;
  }
}
