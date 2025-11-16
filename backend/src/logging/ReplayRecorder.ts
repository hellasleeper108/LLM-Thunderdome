/**
 * Replay Recorder
 * Records simulation turns for later playback
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Replay,
  ReplayFrame,
  ReplayMetadata,
  Tile,
  AgentState,
  ActionResult,
  Message,
  WorldEvent,
} from '../schemas/types';

export interface ReplayRecorderConfig {
  autoSave?: boolean; // Auto-save replay to disk/storage
  compressionEnabled?: boolean; // Enable compression for large replays
  maxFrames?: number; // Maximum frames to keep in memory
}

export class ReplayRecorder {
  private replay: Replay;
  private config: ReplayRecorderConfig;
  private isRecording: boolean;
  private startTime: number;

  constructor(
    simulationName: string,
    worldWidth: number,
    worldHeight: number,
    agentCount: number,
    presetUsed?: string,
    config?: ReplayRecorderConfig
  ) {
    this.config = {
      autoSave: config?.autoSave ?? false,
      compressionEnabled: config?.compressionEnabled ?? false,
      maxFrames: config?.maxFrames ?? 1000,
    };

    this.replay = {
      metadata: {
        id: uuidv4(),
        simulationName,
        createdAt: Date.now(),
        totalTurns: 0,
        totalDuration: 0,
        agentCount,
        worldDimensions: { width: worldWidth, height: worldHeight },
        presetUsed,
      },
      frames: [],
      version: '1.0.0',
    };

    this.isRecording = false;
    this.startTime = Date.now();
  }

  /**
   * Start recording
   */
  startRecording(): void {
    this.isRecording = true;
    this.startTime = Date.now();
  }

  /**
   * Stop recording
   */
  stopRecording(): void {
    this.isRecording = false;
    this.replay.metadata.totalDuration = Date.now() - this.startTime;
  }

  /**
   * Record a turn frame
   */
  recordTurn(
    turn: number,
    tiles: Tile[][],
    agents: AgentState[],
    activeEvents: WorldEvent[],
    actions: ActionResult[],
    messages: Message[]
  ): void {
    if (!this.isRecording) {
      return;
    }

    // Check frame limit
    if (this.replay.frames.length >= (this.config.maxFrames || 1000)) {
      console.warn(`Replay frame limit reached (${this.config.maxFrames}). Skipping frame.`);
      return;
    }

    // Calculate metadata
    const totalAgentsAlive = agents.filter(a => a.isAlive).length;
    const totalResourcesGathered = agents.reduce((sum, agent) => {
      return sum + agent.inventory.food + agent.inventory.water + agent.inventory.material;
    }, 0);
    const alliancesActive = this.countActiveAlliances(agents);

    const frame: ReplayFrame = {
      turn,
      timestamp: Date.now(),
      worldState: {
        tiles: this.cloneTiles(tiles),
        agents: this.cloneAgents(agents),
        activeEvents: this.cloneEvents(activeEvents),
      },
      actions: [...actions],
      messages: [...messages],
      metadata: {
        totalAgentsAlive,
        totalResourcesGathered,
        alliancesActive,
      },
    };

    this.replay.frames.push(frame);
    this.replay.metadata.totalTurns = turn;
  }

  /**
   * Get the current replay
   */
  getReplay(): Replay {
    return { ...this.replay };
  }

  /**
   * Export replay as JSON
   */
  exportReplay(): string {
    // Update final stats
    this.updateFinalStats();

    if (this.config.compressionEnabled) {
      // In a real implementation, you might use compression here
      return JSON.stringify(this.replay);
    }

    return JSON.stringify(this.replay, null, 2);
  }

  /**
   * Export replay with ID for storage
   */
  exportReplayWithId(id?: string): { id: string; data: string } {
    const replayId = id || this.replay.metadata.id;
    return {
      id: replayId,
      data: this.exportReplay(),
    };
  }

  /**
   * Load replay from JSON
   */
  static loadReplay(jsonData: string): Replay {
    try {
      const replay: Replay = JSON.parse(jsonData);

      // Validate replay structure
      if (!replay.metadata || !replay.frames || !replay.version) {
        throw new Error('Invalid replay format');
      }

      return replay;
    } catch (error) {
      throw new Error(`Failed to load replay: ${error}`);
    }
  }

  /**
   * Get replay metadata
   */
  getMetadata(): ReplayMetadata {
    return { ...this.replay.metadata };
  }

  /**
   * Get frame count
   */
  getFrameCount(): number {
    return this.replay.frames.length;
  }

  /**
   * Get specific frame
   */
  getFrame(turn: number): ReplayFrame | undefined {
    return this.replay.frames.find(f => f.turn === turn);
  }

  /**
   * Get frame by index
   */
  getFrameByIndex(index: number): ReplayFrame | undefined {
    return this.replay.frames[index];
  }

  /**
   * Clear all recorded frames
   */
  clear(): void {
    this.replay.frames = [];
    this.replay.metadata.totalTurns = 0;
    this.startTime = Date.now();
  }

  /**
   * Update final statistics
   */
  private updateFinalStats(): void {
    if (this.replay.frames.length === 0) {
      return;
    }

    const lastFrame = this.replay.frames[this.replay.frames.length - 1];
    const allFrames = this.replay.frames;

    // Count total actions
    const totalActions = allFrames.reduce((sum, frame) => sum + frame.actions.length, 0);

    // Count total negotiations (from actions)
    const totalNegotiations = allFrames.reduce((sum, frame) => {
      return sum + frame.actions.filter(a => a.action.type === 'negotiate').length;
    }, 0);

    // Count total combats
    const totalCombats = allFrames.reduce((sum, frame) => {
      return sum + frame.actions.filter(a => a.action.type === 'attack').length;
    }, 0);

    // Determine winner (last agent alive)
    const aliveAgents = lastFrame.worldState.agents.filter(a => a.isAlive);
    const winner = aliveAgents.length === 1 ? aliveAgents[0].id : undefined;

    // Count alliances at end
    const totalAlliances = this.countActiveAlliances(lastFrame.worldState.agents);

    this.replay.metadata.winner = winner;
    this.replay.metadata.finalStats = {
      survivingAgents: aliveAgents.length,
      totalActions,
      totalNegotiations,
      totalAlliances,
      totalCombats,
    };
  }

  /**
   * Count active alliances among agents
   */
  private countActiveAlliances(agents: AgentState[]): number {
    const alliances = new Set<string>();

    for (const agent of agents) {
      if (!agent.isAlive) continue;

      for (const allyId of agent.allegiances) {
        // Create unique alliance ID (sorted to avoid duplicates)
        const pair = [agent.id, allyId].sort().join('_');
        alliances.add(pair);
      }
    }

    return alliances.size;
  }

  /**
   * Clone tiles for immutability
   */
  private cloneTiles(tiles: Tile[][]): Tile[][] {
    return tiles.map(row => row.map(tile => ({ ...tile })));
  }

  /**
   * Clone agents for immutability
   */
  private cloneAgents(agents: AgentState[]): AgentState[] {
    return agents.map(agent => ({
      ...agent,
      stats: { ...agent.stats },
      inventory: { ...agent.inventory },
      memory: {
        shortTerm: [...agent.memory.shortTerm],
        longTerm: [...agent.memory.longTerm],
      },
      goals: [...agent.goals],
      allegiances: [...agent.allegiances],
      activePlan: agent.activePlan ? { ...agent.activePlan } : undefined,
      planHistory: agent.planHistory ? { ...agent.planHistory } : {
        completedPlans: [],
        failedPlans: [],
        abandonedPlans: [],
        totalPlansCreated: 0,
        averageSuccessRate: 0,
        preferredPlanLength: 3,
      },
    }));
  }

  /**
   * Clone events for immutability
   */
  private cloneEvents(events: WorldEvent[]): WorldEvent[] {
    return events.map(event => ({
      ...event,
      epicenter: { ...event.epicenter },
      effects: { ...event.effects },
    }));
  }

  /**
   * Get replay statistics
   */
  getStatistics(): {
    totalFrames: number;
    totalTurns: number;
    duration: number;
    avgFramesPerSecond: number;
    estimatedSizeBytes: number;
  } {
    const totalFrames = this.replay.frames.length;
    const totalTurns = this.replay.metadata.totalTurns;
    const duration = this.replay.metadata.totalDuration;
    const avgFramesPerSecond = duration > 0 ? (totalFrames / duration) * 1000 : 0;

    // Estimate size
    const jsonString = JSON.stringify(this.replay);
    const estimatedSizeBytes = new Blob([jsonString]).size;

    return {
      totalFrames,
      totalTurns,
      duration,
      avgFramesPerSecond,
      estimatedSizeBytes,
    };
  }
}
