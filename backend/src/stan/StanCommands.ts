/**
 * STAN Commands - God-Mode Interventions
 * Allows STAN (or operators) to directly intervene in simulations
 */

import { v4 as uuidv4 } from 'uuid';
import { SimulationEngine } from '../engine/SimulationEngine';
import { World } from '../world/World';
import { FactionManager } from '../civilization/FactionManager';
import { LawSystem, LawType } from '../civilization/LawSystem';
import { BeliefSystem } from '../civilization/BeliefSystem';
import { EventLogger } from '../logging/EventLogger';

/**
 * Types of god-mode commands STAN can issue
 */
export type StanCommandType =
  | 'SMITE_AGENT'      // Kill or severely damage an agent
  | 'BLESS_AGENT'      // Buff an agent's stats temporarily
  | 'SPAWN_EVENT'      // Create a world event at a location
  | 'ALTER_FACTION'    // Modify faction properties
  | 'ADJUST_LAW'       // Add or remove laws from a faction
  | 'GLOBAL_MODIFIER'; // Apply temporary simulation-wide modifiers

/**
 * A command issued by STAN to intervene in the simulation
 */
export interface StanCommand {
  id: string;
  type: StanCommandType;
  targetAgentId?: string;
  targetFactionId?: string;
  worldId?: string;
  payload?: Record<string, any>;
  issuedAt: number;
  issuedBy: string; // typically 'STAN' or operator name
  executed?: boolean;
  executedAt?: number;
  result?: string;
}

/**
 * Context needed to execute commands
 */
export interface CommandExecutionContext {
  engine: SimulationEngine;
  world: World;
  factions?: FactionManager;
  laws?: LawSystem;
  beliefs?: BeliefSystem;
  logger: EventLogger;
}

/**
 * Result of command execution
 */
export interface CommandExecutionResult {
  success: boolean;
  message: string;
  effects?: string[];
}

/**
 * STAN Commands Manager
 * Handles execution of god-mode interventions
 */
export class StanCommandExecutor {
  private commandHistory: StanCommand[] = [];
  private pendingCommands: StanCommand[] = [];
  private maxHistorySize: number = 100;

  /**
   * Queue a command for execution
   */
  queueCommand(commandInput: Omit<StanCommand, 'id' | 'issuedAt'>): StanCommand {
    const command: StanCommand = {
      id: uuidv4(),
      issuedAt: Date.now(),
      executed: false,
      ...commandInput,
    };

    this.pendingCommands.push(command);
    console.log(`[StanCommands] Queued ${command.type} command from ${command.issuedBy}`);

    return command;
  }

  /**
   * Execute all pending commands
   */
  executePendingCommands(context: CommandExecutionContext): CommandExecutionResult[] {
    const results: CommandExecutionResult[] = [];

    while (this.pendingCommands.length > 0) {
      const command = this.pendingCommands.shift()!;
      const result = this.executeCommand(command, context);
      results.push(result);

      // Mark as executed
      command.executed = true;
      command.executedAt = Date.now();
      command.result = result.message;

      // Add to history
      this.commandHistory.push(command);

      // Trim history if needed
      if (this.commandHistory.length > this.maxHistorySize) {
        this.commandHistory.shift();
      }
    }

    return results;
  }

  /**
   * Execute a single command
   */
  private executeCommand(
    command: StanCommand,
    context: CommandExecutionContext
  ): CommandExecutionResult {
    try {
      console.log(`[StanCommands] Executing ${command.type} from ${command.issuedBy}`);

      switch (command.type) {
        case 'SMITE_AGENT':
          return this.executeSmiteAgent(command, context);

        case 'BLESS_AGENT':
          return this.executeBlessAgent(command, context);

        case 'SPAWN_EVENT':
          return this.executeSpawnEvent(command, context);

        case 'ALTER_FACTION':
          return this.executeAlterFaction(command, context);

        case 'ADJUST_LAW':
          return this.executeAdjustLaw(command, context);

        case 'GLOBAL_MODIFIER':
          return this.executeGlobalModifier(command, context);

        default:
          return {
            success: false,
            message: `Unknown command type: ${command.type}`,
          };
      }
    } catch (error: any) {
      console.error(`[StanCommands] Error executing command:`, error);
      return {
        success: false,
        message: `Execution failed: ${error.message}`,
      };
    }
  }

  /**
   * SMITE_AGENT: Severely damage or kill an agent
   */
  private executeSmiteAgent(
    command: StanCommand,
    context: CommandExecutionContext
  ): CommandExecutionResult {
    if (!command.targetAgentId) {
      return { success: false, message: 'No target agent specified' };
    }

    const agent = (context.engine as any).agents.get(command.targetAgentId);
    if (!agent) {
      return { success: false, message: `Agent ${command.targetAgentId} not found` };
    }

    const damage = command.payload?.damage ?? 100; // Default: instant death
    const reason = command.payload?.reason ?? 'divine wrath';

    const agentState = agent.getState();
    const newHealth = Math.max(0, agentState.health - damage);

    // Apply damage
    (agent as any).state.health = newHealth;

    // Log divine intervention
    context.logger.logEvent({
      type: 'event',
      agentIds: [command.targetAgentId!],
      description: `⚡ DIVINE INTERVENTION: ${agentState.name} was smitten by ${command.issuedBy}! (${reason})`,
      metadata: {
        commandType: 'SMITE_AGENT',
        damage,
        newHealth,
        reason,
        issuedBy: command.issuedBy,
      },
    });

    const outcome = newHealth === 0 ? 'killed' : `damaged (${newHealth} HP remaining)`;

    return {
      success: true,
      message: `Agent ${agentState.name} ${outcome}`,
      effects: [`Health: ${agentState.health} → ${newHealth}`, `Reason: ${reason}`],
    };
  }

  /**
   * BLESS_AGENT: Buff an agent's stats temporarily
   */
  private executeBlessAgent(
    command: StanCommand,
    context: CommandExecutionContext
  ): CommandExecutionResult {
    if (!command.targetAgentId) {
      return { success: false, message: 'No target agent specified' };
    }

    const agent = (context.engine as any).agents.get(command.targetAgentId);
    if (!agent) {
      return { success: false, message: `Agent ${command.targetAgentId} not found` };
    }

    const agentState = agent.getState();
    const effects: string[] = [];

    // Apply stat buffs
    const statBuffs = command.payload?.statBuffs || {
      energy: 20,
      cooperation: 10,
      empathy: 10,
    };

    for (const [stat, buff] of Object.entries(statBuffs)) {
      if (stat in agentState.stats) {
        const oldValue = (agentState.stats as any)[stat];
        const newValue = Math.min(100, oldValue + (buff as number));
        (agent as any).state.stats[stat] = newValue;
        effects.push(`${stat}: ${oldValue} → ${newValue}`);
      }
    }

    // Apply health buff if specified
    if (command.payload?.healthBuff) {
      const oldHealth = agentState.health;
      const newHealth = Math.min(100, oldHealth + command.payload.healthBuff);
      (agent as any).state.health = newHealth;
      effects.push(`health: ${oldHealth} → ${newHealth}`);
    }

    // Apply inventory bonus if specified
    if (command.payload?.resources) {
      for (const [resource, amount] of Object.entries(command.payload.resources)) {
        if (agentState.inventory && resource in agentState.inventory) {
          (agentState.inventory as any)[resource] += amount;
          effects.push(`${resource}: +${amount}`);
        }
      }
    }

    const reason = command.payload?.reason ?? 'divine favor';

    // Log divine blessing
    context.logger.logEvent({
      type: 'event',
      agentIds: [command.targetAgentId!],
      description: `✨ DIVINE BLESSING: ${agentState.name} received blessings from ${command.issuedBy}! (${reason})`,
      metadata: {
        commandType: 'BLESS_AGENT',
        buffs: statBuffs,
        reason,
        issuedBy: command.issuedBy,
      },
    });

    return {
      success: true,
      message: `Agent ${agentState.name} blessed with divine favor`,
      effects,
    };
  }

  /**
   * SPAWN_EVENT: Create a world event at a specific location
   */
  private executeSpawnEvent(
    command: StanCommand,
    context: CommandExecutionContext
  ): CommandExecutionResult {
    const eventType = command.payload?.eventType ?? 'anomaly';
    const position = command.payload?.position ?? {
      x: Math.floor(Math.random() * (context.world as any).width),
      y: Math.floor(Math.random() * (context.world as any).height),
    };

    const validEventTypes = ['storm', 'anomaly', 'boon'];
    if (!validEventTypes.includes(eventType)) {
      return {
        success: false,
        message: `Invalid event type. Must be one of: ${validEventTypes.join(', ')}`,
      };
    }

    // Get the tile
    const tile = context.world.getTile(position);
    if (!tile) {
      return { success: false, message: `Invalid position: (${position.x}, ${position.y})` };
    }

    // Spawn the event
    const eventKey = `event_${eventType}`;
    tile.type = eventKey as any;
    tile.value = command.payload?.intensity ?? 10;

    const reason = command.payload?.reason ?? 'divine will';

    // Log the spawned event
    context.logger.logEvent({
      type: 'event',
      agentIds: [],
      description: `🌟 DIVINE EVENT: ${command.issuedBy} spawned a ${eventType} at (${position.x}, ${position.y})! (${reason})`,
      metadata: {
        commandType: 'SPAWN_EVENT',
        eventType,
        position,
        intensity: tile.value,
        reason,
        issuedBy: command.issuedBy,
      },
    });

    return {
      success: true,
      message: `Spawned ${eventType} at (${position.x}, ${position.y})`,
      effects: [`Event type: ${eventType}`, `Intensity: ${tile.value}`, `Reason: ${reason}`],
    };
  }

  /**
   * ALTER_FACTION: Modify faction properties
   */
  private executeAlterFaction(
    command: StanCommand,
    context: CommandExecutionContext
  ): CommandExecutionResult {
    if (!context.factions) {
      return { success: false, message: 'Faction system not initialized' };
    }

    if (!command.targetFactionId) {
      return { success: false, message: 'No target faction specified' };
    }

    const faction = context.factions.getFaction(command.targetFactionId);
    if (!faction) {
      return { success: false, message: `Faction ${command.targetFactionId} not found` };
    }

    const effects: string[] = [];

    // Apply property modifications
    if (command.payload?.cohesion !== undefined) {
      const oldCohesion = faction.cohesion;
      faction.cohesion = Math.max(0, Math.min(100, command.payload.cohesion));
      effects.push(`cohesion: ${oldCohesion} → ${faction.cohesion}`);
    }

    if (command.payload?.aggression !== undefined) {
      const oldAggression = faction.aggression;
      faction.aggression = Math.max(0, Math.min(100, command.payload.aggression));
      effects.push(`aggression: ${oldAggression} → ${faction.aggression}`);
    }

    if (command.payload?.diplomacy !== undefined) {
      const oldDiplomacy = faction.diplomacy;
      faction.diplomacy = Math.max(0, Math.min(100, command.payload.diplomacy));
      effects.push(`diplomacy: ${oldDiplomacy} → ${faction.diplomacy}`);
    }

    if (command.payload?.description) {
      faction.description = command.payload.description;
      effects.push(`description: updated`);
    }

    const reason = command.payload?.reason ?? 'divine decree';

    // Log faction alteration
    context.logger.logEvent({
      type: 'event',
      agentIds: [],
      description: `🏛️ DIVINE DECREE: Faction "${faction.name}" altered by ${command.issuedBy}! (${reason})`,
      metadata: {
        commandType: 'ALTER_FACTION',
        factionId: command.targetFactionId,
        changes: command.payload,
        reason,
        issuedBy: command.issuedBy,
      },
    });

    return {
      success: true,
      message: `Faction "${faction.name}" altered`,
      effects,
    };
  }

  /**
   * ADJUST_LAW: Add or remove laws from a faction
   */
  private executeAdjustLaw(
    command: StanCommand,
    context: CommandExecutionContext
  ): CommandExecutionResult {
    if (!context.laws) {
      return { success: false, message: 'Law system not initialized' };
    }

    if (!context.factions) {
      return { success: false, message: 'Faction system not initialized' };
    }

    if (!command.targetFactionId) {
      return { success: false, message: 'No target faction specified' };
    }

    const faction = context.factions.getFaction(command.targetFactionId);
    if (!faction) {
      return { success: false, message: `Faction ${command.targetFactionId} not found` };
    }

    const action = command.payload?.action; // 'add' or 'remove'
    const lawType = command.payload?.lawType as LawType;

    if (action !== 'add' && action !== 'remove') {
      return { success: false, message: 'Action must be "add" or "remove"' };
    }

    const effects: string[] = [];
    let result: string;

    if (action === 'add') {
      if (!lawType) {
        return { success: false, message: 'lawType required for add action' };
      }

      const enforcementStrength = command.payload?.enforcementStrength ?? 0.7;
      const description = command.payload?.description ?? `Divine law of ${lawType}`;
      const penalties = command.payload?.penalties;

      const law = context.laws.createLaw(
        description,
        lawType as LawType,
        enforcementStrength,
        penalties
      );

      effects.push(`Created law: ${law.type}`);
      effects.push(`Enforcement: ${law.enforcementStrength}`);
      result = `Law "${law.type}" added to faction "${faction.name}"`;
    } else {
      // Remove
      const lawId = command.payload?.lawId;
      if (!lawId) {
        return { success: false, message: 'lawId required for remove action' };
      }

      const removedLaw = context.laws.getLaw(lawId);
      if (!removedLaw) {
        return { success: false, message: `Law ${lawId} not found` };
      }

      // Remove law from faction's law array
      const lawIndex = faction.laws.indexOf(lawId);
      if (lawIndex > -1) {
        faction.laws.splice(lawIndex, 1);
      }

      effects.push(`Removed law: ${removedLaw.type}`);
      result = `Law "${removedLaw.type}" removed from faction "${faction.name}"`;
    }

    const reason = command.payload?.reason ?? 'divine mandate';

    // Log law adjustment
    context.logger.logEvent({
      type: 'event',
      agentIds: [],
      description: `⚖️ DIVINE MANDATE: ${command.issuedBy} ${action}ed law for faction "${faction.name}"! (${reason})`,
      metadata: {
        commandType: 'ADJUST_LAW',
        factionId: command.targetFactionId,
        action,
        lawType,
        reason,
        issuedBy: command.issuedBy,
      },
    });

    return {
      success: true,
      message: result,
      effects,
    };
  }

  /**
   * GLOBAL_MODIFIER: Apply temporary simulation-wide modifiers
   */
  private executeGlobalModifier(
    command: StanCommand,
    context: CommandExecutionContext
  ): CommandExecutionResult {
    const modifierType = command.payload?.modifierType;
    const duration = command.payload?.duration ?? 10; // turns
    const intensity = command.payload?.intensity ?? 1.0;

    if (!modifierType) {
      return { success: false, message: 'modifierType required' };
    }

    const effects: string[] = [];
    let description: string;

    switch (modifierType) {
      case 'aggression_boost':
        description = `Global aggression increased by ${(intensity * 100)}% for ${duration} turns`;
        effects.push(`All agents more aggressive`);
        effects.push(`Duration: ${duration} turns`);
        break;

      case 'cooperation_boost':
        description = `Global cooperation increased by ${(intensity * 100)}% for ${duration} turns`;
        effects.push(`All agents more cooperative`);
        effects.push(`Duration: ${duration} turns`);
        break;

      case 'resource_abundance':
        description = `Resource generation increased by ${(intensity * 100)}% for ${duration} turns`;
        effects.push(`Resources more abundant`);
        effects.push(`Duration: ${duration} turns`);
        break;

      case 'chaos':
        description = `Chaos increases trait drift by ${(intensity * 100)}% for ${duration} turns`;
        effects.push(`Personality drift accelerated`);
        effects.push(`Duration: ${duration} turns`);
        break;

      case 'calm':
        description = `Calm reduces conflicts and trait drift for ${duration} turns`;
        effects.push(`Conflicts reduced`);
        effects.push(`Duration: ${duration} turns`);
        break;

      default:
        return { success: false, message: `Unknown modifier type: ${modifierType}` };
    }

    const reason = command.payload?.reason ?? 'divine influence';

    // Log global modifier
    context.logger.logEvent({
      type: 'event',
      agentIds: [],
      description: `🌍 DIVINE INFLUENCE: ${command.issuedBy} applied global ${modifierType}! (${reason})`,
      metadata: {
        commandType: 'GLOBAL_MODIFIER',
        modifierType,
        intensity,
        duration,
        reason,
        issuedBy: command.issuedBy,
      },
    });

    // Note: Global modifiers are logged but not currently stored in engine state
    // TODO: Implement global modifier storage and application in SimulationEngine
    // The effects are recorded in the event log for tracking purposes

    return {
      success: true,
      message: description,
      effects,
    };
  }

  /**
   * Get command history
   */
  getHistory(limit?: number): StanCommand[] {
    const history = [...this.commandHistory].reverse(); // Most recent first
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get pending commands
   */
  getPending(): StanCommand[] {
    return [...this.pendingCommands];
  }

  /**
   * Clear all pending commands
   */
  clearPending(): void {
    this.pendingCommands = [];
    console.log('[StanCommands] Cleared all pending commands');
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalExecuted: number;
    pending: number;
    byType: Record<StanCommandType, number>;
    byIssuer: Record<string, number>;
  } {
    const byType: Record<string, number> = {};
    const byIssuer: Record<string, number> = {};

    this.commandHistory.forEach(cmd => {
      byType[cmd.type] = (byType[cmd.type] || 0) + 1;
      byIssuer[cmd.issuedBy] = (byIssuer[cmd.issuedBy] || 0) + 1;
    });

    return {
      totalExecuted: this.commandHistory.length,
      pending: this.pendingCommands.length,
      byType: byType as any,
      byIssuer,
    };
  }
}

/**
 * Global command executor instance
 */
let globalCommandExecutor: StanCommandExecutor | null = null;

/**
 * Get the global command executor
 */
export function getStanCommandExecutor(): StanCommandExecutor {
  if (!globalCommandExecutor) {
    globalCommandExecutor = new StanCommandExecutor();
  }
  return globalCommandExecutor;
}

/**
 * Set the global command executor (for testing)
 */
export function setStanCommandExecutor(executor: StanCommandExecutor): void {
  globalCommandExecutor = executor;
}
