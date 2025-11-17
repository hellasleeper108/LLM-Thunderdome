/**
 * Simulation Engine
 * Turn-based scheduler that orchestrates the entire simulation
 */

import { BaseAgent } from '../agents/BaseAgent';
import { AllianceManager } from '../agents/AllianceManager';
import { SocialGraph } from '../agents/SocialGraph';
import { TraitDrift } from '../agents/TraitDrift';
import { World } from '../world/World';
import { EventLogger } from '../logging/EventLogger';
import { NegotiationEngine } from './NegotiationEngine';
import { PlanningEngine } from '../agents/planning/PlanningEngine';
import { WorldEventsManager } from '../world/events/WorldEvents';
import { ReplayRecorder } from '../logging/ReplayRecorder';
import { getStanBridge } from '../stan';
import { BeliefSystem, Belief, Ritual } from '../civilization/BeliefSystem';
import { FactionManager } from '../civilization/FactionManager';
import { LanguageEngine } from '../language/LanguageEngine';
import {
  Action,
  ActionType,
  ActionResult,
  Observation,
  Position,
  Message,
  TileType,
  AgentState,
  NegotiationOffer,
  NegotiationProtocol,
  ResourceOffer,
  Alliance,
  PlanStatus,
  WorldEvent,
  AgentStats,
  Replay,
  Tile,
  EventLog,
} from '../schemas/types';
import { v4 as uuidv4 } from 'uuid';

export interface EngineConfig {
  turnDuration: number; // milliseconds per turn
  maxTurns: number;
  autoAdvance?: boolean; // Auto-advance turns
  visionRadius?: number; // How far agents can see
  eventFrequency?: number; // How often events spawn (0-1)
  eventSpawnInterval?: number; // Try to spawn event every N turns
}

export type SimulationStatus = 'idle' | 'running' | 'paused' | 'completed';

export class SimulationEngine {
  private world: World;
  private agents: Map<string, BaseAgent>;
  private logger: EventLogger;
  private socialGraph: SocialGraph;
  private negotiationEngine: NegotiationEngine;
  private allianceManager: AllianceManager;
  private traitDrift: TraitDrift;
  private planningEngine: PlanningEngine;
  private worldEventsManager: WorldEventsManager;
  private replayRecorder: ReplayRecorder;
  private beliefSystem: BeliefSystem;
  private factionManager: FactionManager | null;
  private languageEngine: LanguageEngine;
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

    // Create shared SocialGraph instance for negotiation and alliance systems
    this.socialGraph = new SocialGraph(0.5); // 0.5 decay rate per turn

    this.negotiationEngine = new NegotiationEngine(this.socialGraph);
    this.allianceManager = new AllianceManager(this.socialGraph);
    this.traitDrift = new TraitDrift(this.socialGraph, 1.0); // 1.0 = normal drift rate
    this.planningEngine = new PlanningEngine();

    // Initialize world events manager
    // Note: We'll get world dimensions from the world object later
    // For now, use reasonable defaults
    this.worldEventsManager = new WorldEventsManager(20, 20, {
      eventFrequency: config.eventFrequency ?? 0.15,
      maxActiveEvents: 3,
      allowCatastrophicEvents: true,
    });

    // Initialize belief system for emergent religions
    this.beliefSystem = new BeliefSystem(0.7); // 0.7 = event drama threshold
    this.factionManager = null; // Will be set externally if factions are enabled

    // Initialize language engine for dialect evolution
    this.languageEngine = new LanguageEngine({
      mutationRate: 0.1, // 10% chance of mutation per turn
      variantsPerConcept: 5,
      mergeBlendRate: 0.3,
    });

    this.config = {
      turnDuration: config.turnDuration,
      maxTurns: config.maxTurns,
      autoAdvance: config.autoAdvance ?? false,
      visionRadius: config.visionRadius ?? 3,
      eventFrequency: config.eventFrequency ?? 0.15,
      eventSpawnInterval: config.eventSpawnInterval ?? 5,
    };
    this.currentTurn = 0;
    this.status = 'idle';
    this.turnTimer = null;
    this.messages = [];
    this.actionResults = [];

    // Initialize replay recorder
    const worldDimensions = this.world.getDimensions();
    this.replayRecorder = new ReplayRecorder(
      `Simulation-${Date.now()}`, // simulationName
      worldDimensions.width,
      worldDimensions.height,
      0, // agentCount - will be updated as agents are added
      undefined, // presetUsed - can be set later
      {
        autoSave: false,
        compressionEnabled: false,
        maxFrames: config.maxTurns,
      }
    );
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
    this.replayRecorder.startRecording(); // Start recording replay

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
    this.negotiationEngine.reset();
    this.allianceManager.reset();
    this.traitDrift.reset();
    this.worldEventsManager.reset();
    this.status = 'idle';

    // Reset all agents
    this.agents.clear();

    // Reinitialize replay recorder
    const worldDimensions = this.world.getDimensions();
    this.replayRecorder = new ReplayRecorder(
      `Simulation-${Date.now()}`, // new simulationName
      worldDimensions.width,
      worldDimensions.height,
      0, // agentCount
      undefined, // presetUsed
      {
        autoSave: false,
        compressionEnabled: false,
        maxFrames: this.config.maxTurns,
      }
    );

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

    // Phase 4: Spawn and update world events
    this.updateWorldEvents();

    // Phase 5: Apply event effects to agents
    this.applyEventEffects();

    // Phase 6: Update world state
    this.updateWorldState();

    // Phase 7: Process events
    this.processEvents();

    // Phase 8: Update alliances
    this.updateAlliances();

    // Phase 9: Apply trait drift
    this.applyTraitDrift();

    // Phase 10: Evaluate beliefs and perform rituals
    this.evaluateBeliefsAndRituals();

    // Phase 11: Advance language drift
    this.languageEngine.advanceTurn(this.currentTurn);

    this.logger.logEvent({
      type: 'state_update',
      description: `Turn ${this.currentTurn} completed`,
      agentIds: [],
    });

    // Send STAN turn summary event
    this.sendStanTurnSummary();

    // Record turn for replay
    this.recordTurnToReplay();

    // Schedule next turn if auto-advancing
    if (this.config.autoAdvance && this.status === 'running') {
      this.scheduleNextTurn();
    }
  }

  /**
   * Generate observations for all agents
   * Allied agents share partial observations
   */
  private generateObservations(): Map<string, Observation> {
    const observations = new Map<string, Observation>();

    // First pass: generate base observations
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
    }

    // Second pass: enhance observations with ally information
    for (const [agentId, observation] of observations.entries()) {
      const agent = this.agents.get(agentId);
      if (!agent) continue;

      const state = agent.getState();
      const allyIds = this.allianceManager.getAllyIds(agentId);

      // Share ally observations (partial information sharing)
      for (const allyId of allyIds) {
        const allyObservation = observations.get(allyId);
        if (!allyObservation) continue;

        const alliance = this.allianceManager.getAlliances(agentId).find((a) =>
          a.memberIds.includes(allyId)
        );

        // Only share if alliance has resourceSharing enabled
        if (alliance?.conditions.resourceSharing) {
          // Add ally's visible agents (that this agent can't see)
          const currentVisibleIds = new Set(observation.nearbyAgents.map((a) => a.id));
          for (const allyVisibleAgent of allyObservation.nearbyAgents) {
            if (!currentVisibleIds.has(allyVisibleAgent.id) && allyVisibleAgent.id !== agentId) {
              // Add with reduced information (they heard about it from ally)
              observation.nearbyAgents.push({
                ...allyVisibleAgent,
                position: { x: -1, y: -1 }, // Unknown exact position
              });
            }
          }

          // Share information about resources (rumors from ally)
          const allyResourceTiles = allyObservation.visibleTiles.filter((t) =>
            t.type.startsWith('resource')
          );
          const currentTilePositions = new Set(
            observation.visibleTiles.map((t) => `${t.position.x},${t.position.y}`)
          );

          for (const resourceTile of allyResourceTiles) {
            const key = `${resourceTile.position.x},${resourceTile.position.y}`;
            if (!currentTilePositions.has(key)) {
              // Add rumored resource (with some uncertainty)
              observation.visibleTiles.push({
                ...resourceTile,
                value: resourceTile.value ? Math.floor(resourceTile.value * 0.7) : undefined,
                metadata: { ...resourceTile.metadata, rumored: true, source: allyId },
              });
            }
          }
        }
      }

      agent.observe(observation);
    }

    return observations;
  }

  /**
   * Collect actions from all agents
   * Uses planning system: if agent has active plan, execute next step
   * Otherwise, generate new plan
   */
  private async collectActions(observations: Map<string, Observation>): Promise<Action[]> {
    const actionPromises: Promise<Action>[] = [];

    for (const [agentId, agent] of this.agents.entries()) {
      const observation = observations.get(agentId);
      if (!observation) continue;

      const state = agent.getState();
      if (!state.isAlive) continue;

      // Planning system integration
      const activePlan = agent.getActivePlan();
      if (activePlan && activePlan.status === PlanStatus.ACTIVE) {
        // Agent has active plan - execute next step
        const planAction = this.planningEngine.executePlanStep(state);

        if (planAction) {
          // Log plan step execution
          this.logger.logEvent({
            type: 'action',
            description: `${state.name} executing plan step ${activePlan.currentStepIndex + 1}/${activePlan.steps.length}: ${planAction.type}`,
            agentIds: [agentId],
            metadata: {
              planId: activePlan.id,
              stepNumber: activePlan.currentStepIndex + 1,
              actionType: planAction.type,
            },
          });

          actionPromises.push(Promise.resolve(planAction));
        } else {
          // Plan is complete or invalid - fall back to normal decision
          actionPromises.push(agent.decideAction(observation));
        }
      } else {
        // No active plan - generate new plan
        const newPlan = this.planningEngine.generatePlan(
          state,
          state.goals,
          this.world,
          this.currentTurn
        );

        if (newPlan) {
          // Set the new plan
          agent.setActivePlan(newPlan);

          // Log plan creation
          this.logger.logEvent({
            type: 'state_update',
            description: `${state.name} created new plan: ${newPlan.steps.length} steps to achieve "${state.goals.find(g => g.id === newPlan.goalId)?.description || 'goal'}"`,
            agentIds: [agentId],
            metadata: {
              planId: newPlan.id,
              goalId: newPlan.goalId,
              steps: newPlan.steps.map(s => ({
                stepNumber: s.stepNumber,
                action: s.action.type,
                reasoning: s.reasoning,
              })),
              priority: newPlan.metadata?.priority,
              riskLevel: newPlan.metadata?.riskLevel,
            },
          });

          // Execute first step
          const firstAction = this.planningEngine.executePlanStep(state);
          if (firstAction) {
            actionPromises.push(Promise.resolve(firstAction));
          } else {
            // Fallback to normal decision
            actionPromises.push(agent.decideAction(observation));
          }
        } else {
          // Could not generate plan - use normal decision making
          actionPromises.push(agent.decideAction(observation));
        }
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

    // Record action for trait drift
    this.traitDrift.recordAction(action.agentId, action.type, success);

    // Record action in agent's episodic memory
    agent.recordAction(
      this.currentTurn,
      action.type,
      success,
      typeof action.target === 'string' ? action.target : undefined,
      { effects }
    );

    // Advance plan if agent has active plan
    const activePlan = agent.getActivePlan();
    if (activePlan && activePlan.status === PlanStatus.ACTIVE) {
      // Get mutable state for plan advancement
      const mutableState = agent.getState();
      this.planningEngine.advancePlan(mutableState, success);

      // Update agent's plan after advancement
      agent.setActivePlan(mutableState.activePlan);

      // Log plan completion if finished
      const updatedPlan = agent.getActivePlan();
      if (updatedPlan && updatedPlan.status === PlanStatus.COMPLETED) {
        this.logger.logEvent({
          type: 'state_update',
          description: `${state.name} completed plan: ${updatedPlan.steps.length} steps with ${updatedPlan.successRate.toFixed(1)}% success rate`,
          agentIds: [action.agentId],
          metadata: {
            planId: updatedPlan.id,
            successRate: updatedPlan.successRate,
            actualDuration: updatedPlan.actualDuration,
          },
        });
      }
    }

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

      // Record resource gain for trait drift
      this.traitDrift.recordResourceGained(state.id, result.amount);

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
   * Allied agents with exclusivity cannot attack each other
   */
  private handleAttack(agent: BaseAgent, targetId: string, effects: string[]): boolean {
    const attacker = agent.getState();
    const target = this.agents.get(targetId);

    if (!target || !target.getState().isAlive) {
      effects.push('Target not found or already dead');
      return false;
    }

    const targetState = target.getState();

    // Check if they are allies with exclusivity
    const alliance = this.allianceManager
      .getAlliances(attacker.id)
      .find((a) => a.memberIds.includes(targetId));

    if (alliance && alliance.conditions.exclusivity) {
      effects.push(`Cannot attack ally ${targetState.name} (alliance exclusivity)`);

      // Record betrayal attempt (weakens alliance)
      this.allianceManager.recordBetrayal(attacker.id, targetId, 20);

      // Record betrayal for trait drift
      this.traitDrift.recordBetrayalReceived(targetId);

      // Record betrayal in memory (VERY important memory)
      target.recordInteraction(
        this.currentTurn,
        'betray',
        `${attacker.name} attempted to attack me despite our alliance!`,
        [attacker.id],
        'negative',
        100, // Maximum importance
        { allianceId: alliance.id, betrayalType: 'attack_attempt' }
      );

      // Learn that this agent cannot be trusted
      target.learnAboutAgent(
        attacker.id,
        'relationship',
        'cannot be trusted',
        `Attempted to betray alliance`,
        100
      );

      this.logger.logEvent({
        type: 'interaction',
        description: `${attacker.name} attempted to attack ally ${targetState.name} but was prevented by alliance`,
        agentIds: [attacker.id, targetId],
        metadata: { allianceId: alliance.id },
      });

      return false;
    }

    // Calculate damage based on aggression
    const damage = Math.floor(attacker.stats.aggression / 5) + Math.floor(Math.random() * 10);
    target.takeDamage(damage);

    effects.push(`Dealt ${damage} damage to ${targetState.name}`);

    // Record attack for trait drift
    this.traitDrift.recordAttackGiven(attacker.id);
    this.traitDrift.recordAttackReceived(targetId);

    // Record attack in memory
    agent.recordInteraction(
      this.currentTurn,
      'attack',
      `Attacked ${targetState.name} for ${damage} damage`,
      [targetId],
      'negative',
      50,
      { damage }
    );

    target.recordInteraction(
      this.currentTurn,
      'attack',
      `Was attacked by ${attacker.name} for ${damage} damage`,
      [attacker.id],
      'negative',
      70, // Being attacked is more important
      { damage, healthRemaining: target.getState().health }
    );

    // Learn that this agent is aggressive
    target.learnAboutAgent(
      attacker.id,
      'agent_behavior',
      'tends to attack',
      `Has attacked me in combat`,
      60
    );

    if (!target.getState().isAlive) {
      effects.push(`${targetState.name} was killed`);

      // Transfer inventory
      const lootedResources = Math.floor(targetState.inventory.food / 2) +
        Math.floor(targetState.inventory.water / 2) +
        Math.floor(targetState.inventory.material / 2);

      agent.updateInventory({
        food: attacker.inventory.food + Math.floor(targetState.inventory.food / 2),
        water: attacker.inventory.water + Math.floor(targetState.inventory.water / 2),
        material: attacker.inventory.material + Math.floor(targetState.inventory.material / 2),
      });

      // Record death and resource gain
      this.traitDrift.recordDeath(targetId);
      this.traitDrift.recordResourceGained(attacker.id, lootedResources);

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
   * Uses the NegotiationEngine for sophisticated offer evaluation and outcome computation
   */
  private handleNegotiate(agent: BaseAgent, targetId: string, payload: any, effects: string[]): boolean {
    const negotiator = agent.getState();
    const target = this.agents.get(targetId);

    if (!target) {
      effects.push('Target not found');
      return false;
    }

    const targetState = target.getState();

    // Create negotiation offer from payload
    const offer: NegotiationOffer = {
      id: uuidv4(),
      protocol: payload.protocol || NegotiationProtocol.TRADE,
      initiatorId: negotiator.id,
      targetId: targetState.id,
      offering: payload.offering || {},
      requesting: payload.requesting || {},
      terms: payload.terms || payload.message || 'Let us negotiate.',
      conditions: payload.conditions,
      timestamp: Date.now(),
    };

    // Build negotiation context
    const context = this.negotiationEngine.buildContext(
      negotiator,
      targetState,
      this.currentTurn
    );

    // Evaluate the offer
    const evaluation = this.negotiationEngine.evaluateOffer(offer, context);

    // Create response
    const response = {
      offerId: offer.id,
      accepted: evaluation.shouldAccept,
      reason: evaluation.reason,
      timestamp: Date.now(),
    };

    // Generate counter-offer if rejected and conditions allow
    if (!evaluation.shouldAccept && evaluation.confidence < 0.8) {
      const counterOffer = this.negotiationEngine.generateCounterOffer(
        negotiator,
        targetState,
        offer,
        context
      );
      if (counterOffer) {
        response.counterOffer = counterOffer;
      }
    }

    // Compute outcome
    const outcome = this.negotiationEngine.computeOutcome(
      negotiator,
      targetState,
      offer,
      response
    );

    // Apply effects based on outcome
    if (outcome.success) {
      this.applyNegotiationOutcome(outcome, agent, target, effects);

      // Record trade completion for trait drift
      if (offer.protocol === NegotiationProtocol.TRADE) {
        this.traitDrift.recordTradeCompleted(negotiator.id);
        this.traitDrift.recordTradeCompleted(targetState.id);

        // Record successful trade in memory
        agent.recordInteraction(
          this.currentTurn,
          'trade',
          `Successful trade with ${targetState.name}`,
          [targetState.id],
          'positive',
          60,
          { protocol: offer.protocol, resources: offer.offering }
        );

        target.recordInteraction(
          this.currentTurn,
          'trade',
          `Successful trade with ${negotiator.name}`,
          [negotiator.id],
          'positive',
          60,
          { protocol: offer.protocol, resources: offer.requesting }
        );

        // Learn that this agent is willing to trade
        agent.learnAboutAgent(
          targetState.id,
          'agent_behavior',
          'willing to trade',
          `Has successfully traded with me`,
          50
        );
      }
    } else {
      effects.push(`Negotiation rejected: ${response.reason}`);

      // Log counter-offer if present
      if (response.counterOffer) {
        effects.push(`Counter-offer proposed by ${targetState.name}`);

        // Send counter-offer message
        const counterMsg: Message = {
          id: uuidv4(),
          from: targetState.id,
          to: negotiator.id,
          content: `Counter-offer: ${response.counterOffer.terms}`,
          type: 'bargain',
          timestamp: Date.now(),
        };
        this.messages.push(counterMsg);
        agent.receiveMessage(counterMsg);
      }
    }

    // Send STAN negotiation event
    this.negotiationEngine.sendStanNegotiationEvent(offer, outcome, negotiator, targetState);

    // Log negotiation event
    this.logger.logEvent({
      type: 'interaction',
      description: `${negotiator.name} ${outcome.success ? 'successfully ' : ''}negotiated with ${
        targetState.name
      } [${offer.protocol}]`,
      agentIds: [negotiator.id, targetId],
      metadata: {
        protocol: offer.protocol,
        offer: offer,
        response: response,
        outcome: outcome,
        relationshipScore: context.relationshipScore,
      },
    });

    // Log consequences
    outcome.consequences.forEach((consequence) => {
      this.logger.logEvent({
        type: 'interaction',
        description: consequence,
        agentIds: [negotiator.id, targetId],
      });
    });

    return outcome.success;
  }

  /**
   * Apply the effects of a successful negotiation
   */
  private applyNegotiationOutcome(
    outcome: any,
    initiator: BaseAgent,
    target: BaseAgent,
    effects: string[]
  ): void {
    const initiatorState = initiator.getState();
    const targetState = target.getState();

    // Handle resource transfers
    if (outcome.effects.resourceTransfers) {
      for (const transfer of outcome.effects.resourceTransfers) {
        const fromAgent = this.agents.get(transfer.from);
        const toAgent = this.agents.get(transfer.to);

        if (fromAgent && toAgent) {
          const fromState = fromAgent.getState();
          const toState = toAgent.getState();

          // Deduct from sender
          if (transfer.resources.food) {
            fromAgent.updateInventory({ food: fromState.inventory.food - transfer.resources.food });
          }
          if (transfer.resources.water) {
            fromAgent.updateInventory({ water: fromState.inventory.water - transfer.resources.water });
          }
          if (transfer.resources.material) {
            fromAgent.updateInventory({
              material: fromState.inventory.material - transfer.resources.material,
            });
          }

          // Add to receiver
          if (transfer.resources.food) {
            toAgent.updateInventory({ food: toState.inventory.food + transfer.resources.food });
          }
          if (transfer.resources.water) {
            toAgent.updateInventory({ water: toState.inventory.water + transfer.resources.water });
          }
          if (transfer.resources.material) {
            toAgent.updateInventory({ material: toState.inventory.material + transfer.resources.material });
          }

          const fromAgentState = fromAgent.getState();
          const toAgentState = toAgent.getState();

          this.logger.logEvent({
            type: 'resource_change',
            description: `Resources transferred from ${fromAgentState.name} to ${toAgentState.name}`,
            agentIds: [transfer.from, transfer.to],
            metadata: { resources: transfer.resources },
          });
        }
      }
    }

    // Handle alliance formation
    if (outcome.effects.allianceFormed) {
      initiator.formAlliance(targetState.id);
      target.formAlliance(initiatorState.id);
      effects.push(`Alliance formed with ${targetState.name}`);
    }

    // Handle alliance breaking
    if (outcome.effects.allianceBroken) {
      initiator.breakAlliance(targetState.id);
      target.breakAlliance(initiatorState.id);
      effects.push(`Alliance broken with ${targetState.name}`);
    }

    // Add all consequences as effects
    effects.push(...outcome.consequences);
  }

  /**
   * Handle form alliance action
   * Uses AllianceManager for sophisticated alliance management
   */
  private handleFormAlliance(agent: BaseAgent, targetId: string, payload: any, effects: string[]): boolean {
    const requester = agent.getState();
    const target = this.agents.get(targetId);

    if (!target) {
      effects.push('Target not found');
      return false;
    }

    const targetState = target.getState();

    // Check if already allied
    if (this.allianceManager.areAllied(requester.id, targetId)) {
      effects.push(`Already allied with ${targetState.name}`);
      return false;
    }

    // Use agent's evaluation method for acceptance
    const acceptanceScore = target.evaluateAllianceProposal(requester.id, requester.stats);
    const accepted = acceptanceScore > 60; // Need 60+ score to accept

    if (accepted) {
      // Define alliance conditions
      const conditions = payload.conditions || {
        protection: requester.stats.cooperation > 70 || targetState.stats.cooperation > 70,
        resourceSharing: requester.stats.cooperation > 60 || targetState.stats.cooperation > 60,
        exclusivity: requester.stats.empathy > 70 && targetState.stats.empathy > 70,
      };

      // Form alliance through AllianceManager
      const alliance = this.allianceManager.formAlliance(
        requester,
        targetState,
        conditions,
        payload.duration
      );

      // Update agent allegiances
      agent.formAlliance(targetId);
      target.formAlliance(requester.id);

      effects.push(`Formed alliance with ${targetState.name} (Strength: ${alliance.strength})`);

      // Record alliance formation for trait drift
      this.traitDrift.recordAllianceFormed(requester.id);
      this.traitDrift.recordAllianceFormed(targetId);

      // Record alliance in memory
      agent.recordInteraction(
        this.currentTurn,
        'alliance',
        `Formed alliance with ${targetState.name}`,
        [targetId],
        'positive',
        80,
        { allianceId: alliance.id, strength: alliance.strength }
      );

      target.recordInteraction(
        this.currentTurn,
        'alliance',
        `Formed alliance with ${requester.name}`,
        [requester.id],
        'positive',
        80,
        { allianceId: alliance.id, strength: alliance.strength }
      );

      // Learn that this agent is trustworthy
      agent.learnAboutAgent(
        targetId,
        'relationship',
        'is a trusted ally',
        `Formed alliance together`,
        80
      );

      target.learnAboutAgent(
        requester.id,
        'relationship',
        'is a trusted ally',
        `Formed alliance together`,
        80
      );

      this.logger.logEvent({
        type: 'interaction',
        description: `${requester.name} and ${targetState.name} formed an alliance (Strength: ${alliance.strength})`,
        agentIds: [requester.id, targetId],
        metadata: {
          allianceId: alliance.id,
          conditions: alliance.conditions,
          strength: alliance.strength,
        },
      });
    } else {
      effects.push(`${targetState.name} rejected alliance (Acceptance score: ${acceptanceScore})`);

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
   * Uses AllianceManager to properly remove alliance
   */
  private handleBreakAlliance(agent: BaseAgent, targetId: string, effects: string[]): boolean {
    const breaker = agent.getState();
    const target = this.agents.get(targetId);

    if (!target) {
      effects.push('Target not found');
      return false;
    }

    const targetState = target.getState();

    // Get alliance info before breaking
    const alliance = this.allianceManager
      .getAlliances(breaker.id)
      .find((a) => a.memberIds.includes(targetId));

    // Break alliance through AllianceManager
    const broken = this.allianceManager.breakAlliance(breaker.id, targetId);

    if (!broken) {
      effects.push(`No alliance exists with ${targetState.name}`);
      return false;
    }

    // Update agent allegiances
    agent.breakAlliance(targetId);
    target.breakAlliance(breaker.id);

    effects.push(`Broke alliance with ${targetState.name}`);

    this.logger.logEvent({
      type: 'interaction',
      description: `${breaker.name} broke alliance with ${targetState.name}`,
      agentIds: [breaker.id, targetId],
      metadata: {
        allianceId: alliance?.id,
        previousStrength: alliance?.strength,
      },
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
   * Update world events (spawn new events, expire old ones)
   */
  private updateWorldEvents(): void {
    // Update active events (expire old ones)
    this.worldEventsManager.updateEvents(this.currentTurn);

    // Try to spawn new event every N turns
    if (this.currentTurn % this.config.eventSpawnInterval === 0) {
      const newEvent = this.worldEventsManager.trySpawnEvent(this.currentTurn);

      if (newEvent) {
        // Log event creation
        this.logger.logEvent({
          type: 'event',
          description: `${newEvent.severity.toUpperCase()} ${newEvent.type.replace('_', ' ').toUpperCase()} spawned at (${newEvent.epicenter.x}, ${newEvent.epicenter.y}) with radius ${newEvent.radius}`,
          agentIds: [],
          metadata: {
            eventId: newEvent.id,
            eventType: newEvent.type,
            severity: newEvent.severity,
            epicenter: newEvent.epicenter,
            radius: newEvent.radius,
            duration: newEvent.duration,
            expiresAtTurn: newEvent.expiresAtTurn,
            effects: newEvent.effects,
          },
        });
      }
    }
  }

  /**
   * Apply effects from active world events to agents
   */
  private applyEventEffects(): void {
    const activeEvents = this.worldEventsManager.getActiveEvents();

    if (activeEvents.length === 0) {
      return;
    }

    // Track which agents are affected by which events
    const affectedAgents = new Map<string, WorldEvent[]>();

    // Check each agent's position against active events
    for (const [agentId, agent] of this.agents.entries()) {
      const state = agent.getState();
      if (!state.isAlive) continue;

      const eventsAffectingAgent = this.worldEventsManager.getEventsAffectingPosition(state.position);

      if (eventsAffectingAgent.length > 0) {
        affectedAgents.set(agentId, eventsAffectingAgent);

        for (const event of eventsAffectingAgent) {
          this.applyEventEffectToAgent(agent, event);
        }
      }
    }

    // Apply global event rules
    for (const event of activeEvents) {
      if (event.effects.worldRules?.globalAggressionIncrease) {
        for (const agent of this.agents.values()) {
          const state = agent.getState();
          if (state.isAlive) {
            agent.updateStats({
              aggression: state.stats.aggression + event.effects.worldRules.globalAggressionIncrease,
            });
          }
        }
      }

      if (event.effects.worldRules?.globalFearIncrease) {
        // Fear isn't a direct stat, but we can increase risk-aversion
        for (const agent of this.agents.values()) {
          const state = agent.getState();
          if (state.isAlive) {
            agent.updateStats({
              riskTolerance: Math.max(0, state.stats.riskTolerance - event.effects.worldRules.globalFearIncrease),
            });
          }
        }
      }
    }

    // Log event impacts
    for (const [agentId, events] of affectedAgents.entries()) {
      const agent = this.agents.get(agentId);
      if (!agent) continue;

      const state = agent.getState();
      const eventDescriptions = events.map(e => `${e.type} (${e.severity})`).join(', ');

      this.logger.logEvent({
        type: 'event',
        description: `${state.name} affected by: ${eventDescriptions}`,
        agentIds: [agentId],
        metadata: {
          events: events.map(e => ({
            eventId: e.id,
            type: e.type,
            severity: e.severity,
          })),
          position: state.position,
          health: state.health,
          energy: state.stats.energy,
        },
      });
    }
  }

  /**
   * Apply specific event effects to an agent
   */
  private applyEventEffectToAgent(agent: BaseAgent, event: WorldEvent): void {
    const state = agent.getState();
    const effects = event.effects;

    // Apply agent effects
    if (effects.agentEffects) {
      // Health damage
      if (effects.agentEffects.healthDamage) {
        agent.takeDamage(effects.agentEffects.healthDamage);
      }

      // Energy drain
      if (effects.agentEffects.energyDrain) {
        agent.updateStats({
          energy: Math.max(0, state.stats.energy - effects.agentEffects.energyDrain),
        });
      }

      // Stat modifiers
      if (effects.agentEffects.statModifiers) {
        const currentStats = state.stats;
        const modifiers: Partial<AgentStats> = {};

        for (const [stat, value] of Object.entries(effects.agentEffects.statModifiers)) {
          if (value !== undefined) {
            const statKey = stat as keyof AgentStats;
            modifiers[statKey] = currentStats[statKey] + value;
          }
        }

        agent.updateStats(modifiers);
      }
    }

    // Update event metadata
    if (event.metadata) {
      event.metadata.affectedAgentCount = (event.metadata.affectedAgentCount || 0) + 1;
      event.metadata.totalDamageDealt =
        (event.metadata.totalDamageDealt || 0) + (effects.agentEffects?.healthDamage || 0);
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
   * Update alliances (expiration, strengthening, cooperation tracking)
   * Also decay social relationships over time
   */
  private updateAlliances(): void {
    const { expired, strengthened } = this.allianceManager.updateTurn(this.currentTurn);

    // Decay all social relationships
    this.socialGraph.decayAllRelationships();

    // Log expired alliances
    for (const alliance of expired) {
      const memberNames = alliance.memberIds
        .map((id) => this.agents.get(id)?.getState().name)
        .filter(Boolean)
        .join(' and ');

      this.logger.logEvent({
        type: 'interaction',
        description: `Alliance between ${memberNames} has expired after ${
          this.currentTurn - alliance.formedAt
        } turns`,
        agentIds: alliance.memberIds,
        metadata: { allianceId: alliance.id, finalStrength: alliance.strength },
      });

      // Remove from agents' allegiances
      for (const memberId of alliance.memberIds) {
        const agent = this.agents.get(memberId);
        if (agent) {
          for (const otherId of alliance.memberIds) {
            if (otherId !== memberId) {
              agent.breakAlliance(otherId);
            }
          }
        }
      }
    }

    // Log strengthened alliances (every 5th turn some alliances strengthen)
    if (strengthened.length > 0 && this.currentTurn % 5 === 0) {
      for (const alliance of strengthened) {
        const memberNames = alliance.memberIds
          .map((id) => this.agents.get(id)?.getState().name)
          .filter(Boolean)
          .join(' and ');

        this.logger.logEvent({
          type: 'interaction',
          description: `Alliance between ${memberNames} grew stronger (Strength: ${alliance.strength})`,
          agentIds: alliance.memberIds,
          metadata: { allianceId: alliance.id, strength: alliance.strength },
        });
      }
    }
  }

  /**
   * Apply trait drift to all agents
   * Called each turn to evolve agent personalities based on experiences
   * Also updates agent memory systems
   */
  private applyTraitDrift(): void {
    const worldTiles = this.world.getAllTiles();

    for (const [agentId, agent] of this.agents.entries()) {
      const state = agent.getState();

      if (!state.isAlive) {
        continue;
      }

      // Get nearby agent IDs for social context
      const nearbyAgentIds = this.getNearbyAgents(agentId, this.config.visionRadius)
        .map(a => a.id);

      // Apply drift
      const driftResult = this.traitDrift.tick(agent, worldTiles, nearbyAgentIds);

      // Update agent memory system
      agent.updateMemory(this.currentTurn);

      // Log significant drift (magnitude > 1.0)
      if (driftResult.magnitude > 1.0) {
        const changeDescriptions = Object.entries(driftResult.changes)
          .map(([stat, newValue]) => {
            const oldValue = state.stats[stat as keyof typeof state.stats];
            const delta = (newValue as number) - oldValue;
            const sign = delta > 0 ? '+' : '';
            return `${stat}: ${oldValue.toFixed(1)} → ${(newValue as number).toFixed(1)} (${sign}${delta.toFixed(1)})`;
          });

        this.logger.logEvent({
          type: 'state_update',
          description: `${state.name}'s personality shifting: ${driftResult.reasons.join('; ')}`,
          agentIds: [agentId],
          metadata: {
            changes: driftResult.changes,
            reasons: driftResult.reasons,
            magnitude: driftResult.magnitude,
            changeDescriptions,
          },
        });
      }
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
    this.replayRecorder.stopRecording(); // Stop recording replay

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
   * Record current turn state to replay
   */
  private recordTurnToReplay(): void {
    const tiles = this.world.getAllTiles();
    const agents = Array.from(this.agents.values()).map(a => a.getState());
    const activeEvents = this.worldEventsManager.getActiveEvents();

    this.replayRecorder.recordTurn(
      this.currentTurn,
      tiles,
      agents,
      activeEvents,
      this.actionResults,
      this.messages
    );
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

  /**
   * Get negotiation engine (for SocialGraph integration and advanced queries)
   */
  getNegotiationEngine(): NegotiationEngine {
    return this.negotiationEngine;
  }

  /**
   * Get alliance manager (for alliance queries and social network analysis)
   */
  getAllianceManager(): AllianceManager {
    return this.allianceManager;
  }

  /**
   * Get social graph (for relationship queries and social network analysis)
   */
  getSocialGraph(): SocialGraph {
    return this.socialGraph;
  }

  /**
   * Get trait drift (for personality evolution queries)
   */
  getTraitDrift(): TraitDrift {
    return this.traitDrift;
  }

  /**
   * Send STAN turn summary event
   * Sends a summary of the turn to the external STAN overseer system
   */
  private sendStanTurnSummary(): void {
    try {
      const stan = getStanBridge();
      const state = this.getState();

      // Calculate key metrics for the turn
      const aliveAgents = state.agents.filter(a => a.isAlive);
      const deadAgents = state.agents.filter(a => !a.isAlive);

      // Get recent key events from action results
      const attacks = this.actionResults.filter(r => r.action.type === ActionType.ATTACK);
      const negotiations = this.actionResults.filter(
        r => r.action.type === ActionType.NEGOTIATE
      );
      const allianceChanges = this.actionResults.filter(
        r => r.action.type === ActionType.FORM_ALLIANCE || r.action.type === ActionType.BREAK_ALLIANCE
      );

      // Build turn summary payload
      const event = stan.createEvent('TURN_SUMMARY', {
        turn: this.currentTurn,
        status: this.status,
        agentCount: {
          total: state.agents.length,
          alive: aliveAgents.length,
          dead: deadAgents.length,
        },
        turnEvents: {
          totalActions: this.actionResults.length,
          attacks: attacks.length,
          negotiations: negotiations.length,
          allianceChanges: allianceChanges.length,
          messagesExchanged: state.messages.length,
        },
        worldState: {
          totalResources: this.calculateTotalWorldResources(),
          activeEvents: this.worldEventsManager?.getActiveEvents().length || 0,
        },
        socialMetrics: {
          activeAlliances: this.allianceManager.getAlliances().length,
          avgTrust: this.calculateAverageTrust(),
          avgFear: this.calculateAverageFear(),
        },
        topAgents: aliveAgents
          .sort((a, b) => b.health - a.health)
          .slice(0, 3)
          .map(a => ({
            id: a.id,
            name: a.name,
            health: a.health,
            personality: a.personality.name,
          })),
      });

      stan.sendEvent(event);
    } catch (error) {
      // Don't let STAN errors break the simulation
      console.error('[SimulationEngine] Failed to send STAN turn summary:', error);
    }
  }

  /**
   * Calculate total resources in the world
   */
  private calculateTotalWorldResources(): number {
    const allTiles = this.world.getAllTiles();
    let total = 0;

    for (const row of allTiles) {
      for (const tile of row) {
        if (tile.type.startsWith('resource_') && tile.value) {
          total += tile.value;
        }
      }
    }

    return total;
  }

  /**
   * Calculate average trust across all agents
   */
  private calculateAverageTrust(): number {
    const relationships = this.socialGraph.getAllRelationshipData();
    if (relationships.length === 0) return 0;

    const totalTrust = relationships.reduce((sum, rel) => sum + rel.weights.trust, 0);
    return totalTrust / relationships.length;
  }

  /**
   * Calculate average fear across all agents
   */
  private calculateAverageFear(): number {
    const relationships = this.socialGraph.getAllRelationshipData();
    if (relationships.length === 0) return 0;

    const totalFear = relationships.reduce((sum, rel) => sum + rel.weights.fear, 0);
    return totalFear / relationships.length;
  }

  /**
   * Get replay data
   */
  getReplay(): Replay {
    return this.replayRecorder.getReplay();
  }

  /**
   * Export replay as JSON string
   */
  exportReplay(): string {
    return this.replayRecorder.exportReplay();
  }

  /**
   * Get replay recorder (for advanced queries)
   */
  getReplayRecorder(): ReplayRecorder {
    return this.replayRecorder;
  }

  /**
   * Set faction manager (for belief system and language integration)
   */
  setFactionManager(factionManager: FactionManager): void {
    this.factionManager = factionManager;

    // Initialize dialects for all existing factions
    const factions = factionManager.listFactions();
    factions.forEach(faction => {
      this.languageEngine.initializeFactionDialect(faction.id);
    });

    console.log(`[SimulationEngine] Initialized dialects for ${factions.length} faction(s)`);
  }

  /**
   * Get belief system
   */
  getBeliefSystem(): BeliefSystem {
    return this.beliefSystem;
  }

  /**
   * Get language engine
   */
  getLanguageEngine(): LanguageEngine {
    return this.languageEngine;
  }

  /**
   * Translate message content using faction dialects
   * Replaces semantic concepts with faction-specific variants
   */
  private translateMessage(content: string, factionId: string | null): string {
    if (!factionId) return content;

    // Simple replacement of known concepts
    // In practice, you might want more sophisticated parsing
    let translated = content;

    // Common concepts that might appear in messages
    const concepts = [
      'food', 'water', 'material', 'ally', 'enemy', 'attack', 'defend',
      'trade', 'alliance', 'faction', 'leader', 'territory', 'danger',
      'peace', 'war', 'trust', 'betrayal', 'honor', 'survival', 'victory'
    ];

    concepts.forEach(concept => {
      const phrase = this.languageEngine.getPhrase(factionId, concept);
      // Case-insensitive replacement
      const regex = new RegExp(`\\b${concept}\\b`, 'gi');
      translated = translated.replace(regex, phrase);
    });

    return translated;
  }

  /**
   * Phase 10: Evaluate beliefs and perform rituals
   * Checks for dramatic events that could spawn new beliefs
   * Evaluates ritual triggers and applies effects
   */
  private evaluateBeliefsAndRituals(): void {
    // Skip if no factions (beliefs require faction context)
    if (!this.factionManager) {
      return;
    }

    // Check for dramatic events that could spawn beliefs
    this.checkForBeliefSpawningEvents();

    // Evaluate and perform rituals
    this.evaluateRitualTriggers();
  }

  /**
   * Check recent events for belief-spawning drama
   */
  private checkForBeliefSpawningEvents(): void {
    if (!this.factionManager) return;

    const recentLogs = this.logger.getLogsForTurn(this.currentTurn);
    const factions = this.factionManager.listFactions();

    // Check for dramatic events
    for (const log of recentLogs) {
      const isDramatic = this.isEventDramatic(log);

      if (isDramatic) {
        // Find factions involved in the event
        const involvedFactions = factions.filter(faction =>
          log.agentIds.some(agentId => faction.members.has(agentId))
        );

        if (involvedFactions.length > 0) {
          // Spawn a new belief!
          const belief = this.beliefSystem.createBeliefFromEvent(
            log,
            involvedFactions
          );

          // Log the religious event
          this.logger.logEvent({
            type: 'religion_born',
            description: `A new belief "${belief.name}" has emerged among ${involvedFactions.length} faction(s)`,
            agentIds: log.agentIds,
            metadata: {
              beliefId: belief.id,
              beliefName: belief.name,
              factionIds: involvedFactions.map(f => f.id),
              originEvent: log.type,
              zeal: belief.zeal,
            },
          });

          // Create default rituals for the new belief
          this.createDefaultRituals(belief);
        }
      }
    }
  }

  /**
   * Determine if an event is dramatic enough to spawn a belief
   */
  private isEventDramatic(log: EventLog): boolean {
    // Multiple agents involved = more dramatic
    if (log.agentIds.length >= 3) return true;

    // Specific event types are dramatic
    const dramaticTypes = ['death', 'disaster', 'alliance', 'conflict', 'catastrophe'];
    if (dramaticTypes.some(type => log.type.toLowerCase().includes(type))) {
      return true;
    }

    // Check metadata for dramatic indicators
    if (log.metadata) {
      if (log.metadata.severity === 'high' || log.metadata.severity === 'critical') {
        return true;
      }
      if (log.metadata.casualties && log.metadata.casualties > 1) {
        return true;
      }
    }

    return false;
  }

  /**
   * Create default rituals for a new belief
   */
  private createDefaultRituals(belief: Belief): void {
    // Death ritual (if belief has death-related tenets)
    if (belief.name.toLowerCase().includes('vigil') || belief.name.toLowerCase().includes('death')) {
      this.beliefSystem.registerRitual(belief.id, {
        name: 'Remembrance Ceremony',
        beliefId: belief.id,
        triggerCondition: 'DEATH_EVENT',
        actions: ['Gather in circle', 'Share memories', 'Offer resources to the fallen'],
        mechanicalEffects: {
          moraleBoost: 5,
          cohesionBoost: 0.05,
        },
        triggerData: { cooldown: 3 },
      });
    }

    // Alliance ritual
    if (belief.name.toLowerCase().includes('united') || belief.name.toLowerCase().includes('path')) {
      this.beliefSystem.registerRitual(belief.id, {
        name: 'Unity Oath',
        beliefId: belief.id,
        triggerCondition: 'ALLIANCE_FORMED',
        actions: ['Exchange symbols', 'Vow cooperation', 'Celebrate together'],
        mechanicalEffects: {
          cooperationDelta: 5,
          cohesionBoost: 0.1,
        },
        triggerData: { cooldown: 5 },
      });
    }

    // Disaster ritual
    if (belief.name.toLowerCase().includes('tempest') || belief.name.toLowerCase().includes('storm')) {
      this.beliefSystem.registerRitual(belief.id, {
        name: 'Storm Dance',
        beliefId: belief.id,
        triggerCondition: 'DISASTER',
        actions: ['Dance wildly', 'Embrace chaos', 'Scatter resources'],
        mechanicalEffects: {
          energyBoost: 10,
          aggressionDelta: -5,
        },
        triggerData: { cooldown: 4 },
      });
    }
  }

  /**
   * Evaluate ritual triggers and perform rituals
   */
  private evaluateRitualTriggers(): void {
    if (!this.factionManager) return;

    const factions = this.factionManager.listFactions();
    const recentLogs = this.logger.getLogsForTurn(this.currentTurn);

    // Count recent dramatic events
    const recentDeaths = recentLogs.filter(l =>
      l.type === 'action' && l.description.toLowerCase().includes('death')
    ).length;

    const alliancesFormed = recentLogs.filter(l =>
      l.type === 'interaction' && l.description.toLowerCase().includes('alliance')
    ).length;

    const disasters = recentLogs.filter(l => l.type === 'event').length;

    // Build world state summary
    const worldState = {
      turn: this.currentTurn,
      totalResources: this.calculateTotalWorldResources(),
      recentDeaths,
      alliancesFormed,
      disasters,
    };

    // Check each faction for triggered rituals
    for (const faction of factions) {
      const rituals = this.beliefSystem.getRitualsForFaction(faction.id);
      const triggeredRituals = this.beliefSystem.evaluateRitualTriggers(
        worldState,
        recentLogs
      );

      // Perform triggered rituals
      for (const ritual of triggeredRituals) {
        // Only perform if ritual belongs to this faction
        if (rituals.some(r => r.id === ritual.id)) {
          this.performRitual(ritual, faction);
        }
      }
    }
  }

  /**
   * Perform a ritual for a faction
   */
  private performRitual(ritual: Ritual, faction: any): void {
    const agents = Array.from(this.agents.values());

    // Apply ritual effects
    this.beliefSystem.applyRitualEffects(ritual, faction, agents);

    // Log the ritual performance
    const participantIds = Array.from(faction.members);

    this.logger.logEvent({
      type: 'ritual_performed',
      description: `Faction ${faction.name} performed the "${ritual.name}" ritual`,
      agentIds: participantIds,
      metadata: {
        ritualId: ritual.id,
        ritualName: ritual.name,
        factionId: faction.id,
        effects: ritual.mechanicalEffects,
        actions: ritual.actions,
      },
    });

    console.log(`[SimulationEngine] Ritual "${ritual.name}" performed by faction ${faction.name}`);
  }
}
