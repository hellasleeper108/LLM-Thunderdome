/**
 * Cinematic Replay System
 * Generates smooth camera paths and highlights for replay visualization
 */

import { Replay, ReplayFrame, ActionType } from '../schemas/types';

/**
 * Camera keyframe for smooth camera movement
 */
export interface CameraKeyframe {
  turn: number;
  position: { x: number; y: number; z: number };
  lookAt: { x: number; y: number; z: number };
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
  duration?: number; // Turns to reach this keyframe
}

/**
 * Highlight sequence for emphasizing specific moments
 */
export interface HighlightSequence {
  turn: number;
  agentIds?: string[];
  worldLocation?: { x: number; y: number };
  label?: string;
  intensity?: number; // 0-1, highlight intensity
  duration?: number; // Turns to maintain highlight
}

/**
 * Complete cinematic replay script
 */
export interface CinematicReplayScript {
  replayId: string;
  cameraPath: CameraKeyframe[];
  highlights: HighlightSequence[];
  metadata?: {
    totalTurns: number;
    focusMode?: string;
    generatedAt: number;
  };
}

/**
 * Options for generating cinematic scripts
 */
export interface CinematicOptions {
  focusOn?: 'wars' | 'alliances' | 'evolution' | 'religion' | 'random';
  keyframeInterval?: number; // Default: every 5 turns
  cameraHeight?: number; // Default: 15
  smoothing?: number; // 0-1, camera movement smoothing
}

/**
 * Cinematic Replay Generator
 */
export class CinematicReplay {
  /**
   * Generate a cinematic script from a replay
   */
  static generateScriptFromReplay(
    replay: Replay,
    options: CinematicOptions = {}
  ): CinematicReplayScript {
    const {
      focusOn = 'random',
      keyframeInterval = 5,
      cameraHeight = 15,
      smoothing = 0.7,
    } = options;

    console.log(`[CinematicReplay] Generating script for replay ${replay.metadata.id} (focus: ${focusOn})`);

    const cameraPath: CameraKeyframe[] = [];
    const highlights: HighlightSequence[] = [];

    // Analyze replay to find key moments
    const keyMoments = this.identifyKeyMoments(replay, focusOn);

    // Generate camera path based on key moments
    cameraPath.push(...this.generateCameraPath(replay, keyMoments, {
      keyframeInterval,
      cameraHeight,
      smoothing,
    }));

    // Generate highlights for key moments
    highlights.push(...this.generateHighlights(replay, keyMoments));

    console.log(
      `[CinematicReplay] Generated ${cameraPath.length} keyframes and ${highlights.length} highlights`
    );

    return {
      replayId: replay.metadata.id,
      cameraPath,
      highlights,
      metadata: {
        totalTurns: replay.frames.length,
        focusMode: focusOn,
        generatedAt: Date.now(),
      },
    };
  }

  /**
   * Identify key moments in the replay based on focus mode
   */
  private static identifyKeyMoments(
    replay: Replay,
    focusOn: string
  ): Array<{ turn: number; type: string; data: any }> {
    const keyMoments: Array<{ turn: number; type: string; data: any }> = [];

    replay.frames.forEach((frame: ReplayFrame, index: number) => {
      const turnNumber = index;

      // Always include first and last turns
      if (turnNumber === 0) {
        keyMoments.push({
          turn: turnNumber,
          type: 'intro',
          data: { agents: frame.worldState.agents },
        });
      }

      if (turnNumber === replay.frames.length - 1) {
        keyMoments.push({
          turn: turnNumber,
          type: 'finale',
          data: { agents: frame.worldState.agents },
        });
      }

      // Focus-specific moments
      switch (focusOn) {
        case 'wars':
          this.identifyWarMoments(frame, turnNumber, keyMoments);
          break;

        case 'alliances':
          this.identifyAllianceMoments(frame, turnNumber, keyMoments);
          break;

        case 'evolution':
          this.identifyEvolutionMoments(frame, turnNumber, keyMoments);
          break;

        case 'religion':
          this.identifyReligionMoments(frame, turnNumber, keyMoments);
          break;

        case 'random':
        default:
          this.identifyRandomMoments(frame, turnNumber, keyMoments);
          break;
      }
    });

    // Sort by turn
    keyMoments.sort((a, b) => a.turn - b.turn);

    return keyMoments;
  }

  /**
   * Identify war/combat moments
   */
  private static identifyWarMoments(
    frame: ReplayFrame,
    turnNumber: number,
    keyMoments: Array<{ turn: number; type: string; data: any }>
  ): void {
    const attacks = frame.actions.filter((a: any) => a.action?.type === ActionType.ATTACK);

    if (attacks.length > 0) {
      keyMoments.push({
        turn: turnNumber,
        type: 'combat',
        data: {
          attacks: attacks.length,
          attackers: attacks.map((a: any) => a.action.agentId),
        },
      });
    }

    // Agent deaths
    const deaths = frame.worldState.agents.filter((a: any) => !a.isAlive && turnNumber > 0);
    if (deaths.length > 0) {
      keyMoments.push({
        turn: turnNumber,
        type: 'death',
        data: { deadAgents: deaths.map((a: any) => a.id) },
      });
    }
  }

  /**
   * Identify alliance moments
   */
  private static identifyAllianceMoments(
    frame: ReplayFrame,
    turnNumber: number,
    keyMoments: Array<{ turn: number; type: string; data: any }>
  ): void {
    const allianceFormations = frame.actions.filter(
      (a: any) => a.action?.type === ActionType.FORM_ALLIANCE
    );
    const allianceBreaks = frame.actions.filter(
      (a: any) => a.action?.type === ActionType.BREAK_ALLIANCE
    );

    if (allianceFormations.length > 0) {
      keyMoments.push({
        turn: turnNumber,
        type: 'alliance_formed',
        data: { agents: allianceFormations.map((a: any) => a.action.agentId) },
      });
    }

    if (allianceBreaks.length > 0) {
      keyMoments.push({
        turn: turnNumber,
        type: 'alliance_broken',
        data: { agents: allianceBreaks.map((a: any) => a.action.agentId) },
      });
    }
  }

  /**
   * Identify evolution moments (trait changes, resource milestones)
   */
  private static identifyEvolutionMoments(
    frame: ReplayFrame,
    turnNumber: number,
    keyMoments: Array<{ turn: number; type: string; data: any }>
  ): void {
    // Significant resource gathering
    const resourceGathering = frame.actions.filter(
      (a: any) => a.action?.type === ActionType.GATHER
    );

    if (resourceGathering.length > 3) {
      keyMoments.push({
        turn: turnNumber,
        type: 'resource_boom',
        data: { gatherers: resourceGathering.map((a: any) => a.action.agentId) },
      });
    }

    // Check for agents with very high stats (evolved)
    const evolvedAgents = frame.worldState.agents.filter((a: any) => {
      const avgStat = (
        a.stats.aggression +
        a.stats.cooperation +
        a.stats.empathy +
        a.stats.curiosity
      ) / 4;
      return avgStat > 75 || avgStat < 25;
    });

    if (evolvedAgents.length > 0) {
      keyMoments.push({
        turn: turnNumber,
        type: 'evolution',
        data: { agents: evolvedAgents.map((a: any) => a.id) },
      });
    }
  }

  /**
   * Identify religion moments
   */
  private static identifyReligionMoments(
    frame: ReplayFrame,
    turnNumber: number,
    keyMoments: Array<{ turn: number; type: string; data: any }>
  ): void {
    // Check for agents with goals related to beliefs
    const religiousAgents = frame.worldState.agents.filter((a: any) => {
      return a.goals.some((g: any) =>
        g.description.toLowerCase().includes('belief') ||
        g.description.toLowerCase().includes('ritual') ||
        g.description.toLowerCase().includes('faith')
      );
    });

    if (religiousAgents.length > 0) {
      keyMoments.push({
        turn: turnNumber,
        type: 'religion',
        data: { agents: religiousAgents.map((a: any) => a.id) },
      });
    }
  }

  /**
   * Identify random interesting moments
   */
  private static identifyRandomMoments(
    frame: ReplayFrame,
    turnNumber: number,
    keyMoments: Array<{ turn: number; type: string; data: any }>
  ): void {
    // High activity turns (lots of actions)
    if (frame.actions.length > 5) {
      keyMoments.push({
        turn: turnNumber,
        type: 'activity',
        data: { actionCount: frame.actions.length },
      });
    }

    // Negotiations
    const negotiations = frame.actions.filter(
      (a: any) => a.action?.type === ActionType.NEGOTIATE
    );
    if (negotiations.length > 0) {
      keyMoments.push({
        turn: turnNumber,
        type: 'negotiation',
        data: { negotiators: negotiations.map((a: any) => a.action.agentId) },
      });
    }

    // Movement clustering (agents converging)
    const movements = frame.actions.filter((a: any) => a.action?.type === ActionType.MOVE);
    if (movements.length > 3) {
      keyMoments.push({
        turn: turnNumber,
        type: 'convergence',
        data: { movers: movements.map((a: any) => a.action.agentId) },
      });
    }
  }

  /**
   * Generate camera path from key moments
   */
  private static generateCameraPath(
    replay: Replay,
    keyMoments: Array<{ turn: number; type: string; data: any }>,
    options: {
      keyframeInterval: number;
      cameraHeight: number;
      smoothing: number;
    }
  ): CameraKeyframe[] {
    const keyframes: CameraKeyframe[] = [];
    const { cameraHeight, smoothing } = options;

    // Calculate world bounds
    const worldBounds = this.calculateWorldBounds(replay);

    // Initial overview keyframe
    keyframes.push({
      turn: 0,
      position: {
        x: worldBounds.centerX,
        y: worldBounds.centerY,
        z: cameraHeight * 1.5,
      },
      lookAt: {
        x: worldBounds.centerX,
        y: worldBounds.centerY,
        z: 0,
      },
      easing: 'easeInOut',
      duration: 3,
    });

    // Generate keyframes for each key moment
    keyMoments.forEach((moment, index) => {
      const frame = replay.frames[moment.turn];
      if (!frame) return;

      // Calculate focus point based on moment type
      const focusPoint = this.calculateFocusPoint(frame, moment, worldBounds);

      // Vary camera height based on moment type
      let height = cameraHeight;
      switch (moment.type) {
        case 'combat':
        case 'death':
          height = cameraHeight * 0.7; // Closer for drama
          break;
        case 'intro':
        case 'finale':
          height = cameraHeight * 1.5; // Further for overview
          break;
        default:
          height = cameraHeight;
      }

      // Add slight variation to prevent static feeling
      const variation = Math.sin(index * 0.5) * 2;

      keyframes.push({
        turn: moment.turn,
        position: {
          x: focusPoint.x + variation,
          y: focusPoint.y - height * 0.5,
          z: height,
        },
        lookAt: {
          x: focusPoint.x,
          y: focusPoint.y,
          z: 0,
        },
        easing: smoothing > 0.5 ? 'easeInOut' : 'linear',
        duration: 2,
      });
    });

    // Final overview keyframe
    keyframes.push({
      turn: replay.frames.length - 1,
      position: {
        x: worldBounds.centerX,
        y: worldBounds.centerY,
        z: cameraHeight * 2,
      },
      lookAt: {
        x: worldBounds.centerX,
        y: worldBounds.centerY,
        z: 0,
      },
      easing: 'easeOut',
      duration: 5,
    });

    return keyframes;
  }

  /**
   * Generate highlights for key moments
   */
  private static generateHighlights(
    replay: Replay,
    keyMoments: Array<{ turn: number; type: string; data: any }>
  ): HighlightSequence[] {
    const highlights: HighlightSequence[] = [];

    keyMoments.forEach(moment => {
      const frame = replay.frames[moment.turn];
      if (!frame) return;

      let label = '';
      let agentIds: string[] = [];
      let worldLocation: { x: number; y: number } | undefined;
      let intensity = 0.8;
      let duration = 3;

      switch (moment.type) {
        case 'intro':
          label = '🎬 Simulation Begin';
          agentIds = frame.worldState.agents.filter((a: any) => a.isAlive).map((a: any) => a.id);
          intensity = 1.0;
          duration = 5;
          break;

        case 'finale':
          label = '🏁 Simulation Complete';
          agentIds = frame.worldState.agents.filter((a: any) => a.isAlive).map((a: any) => a.id);
          intensity = 1.0;
          duration = 5;
          break;

        case 'combat':
          label = `⚔️ Combat (${moment.data.attacks} attacks)`;
          agentIds = moment.data.attackers;
          intensity = 0.9;
          duration = 4;
          break;

        case 'death':
          label = `💀 Agent Death`;
          agentIds = moment.data.deadAgents;
          intensity = 0.95;
          duration = 3;
          break;

        case 'alliance_formed':
          label = '🤝 Alliance Formed';
          agentIds = moment.data.agents;
          intensity = 0.7;
          duration = 4;
          break;

        case 'alliance_broken':
          label = '💔 Alliance Broken';
          agentIds = moment.data.agents;
          intensity = 0.8;
          duration = 3;
          break;

        case 'resource_boom':
          label = '📦 Resource Gathering';
          agentIds = moment.data.gatherers;
          intensity = 0.6;
          duration = 2;
          break;

        case 'evolution':
          label = '🧬 Evolution Detected';
          agentIds = moment.data.agents;
          intensity = 0.75;
          duration = 4;
          break;

        case 'religion':
          label = '✨ Religious Activity';
          agentIds = moment.data.agents;
          intensity = 0.7;
          duration = 3;
          break;

        case 'negotiation':
          label = '💬 Negotiation';
          agentIds = moment.data.negotiators;
          intensity = 0.65;
          duration = 3;
          break;

        case 'activity':
          label = `🌟 High Activity (${moment.data.actionCount} actions)`;
          intensity = 0.6;
          duration = 2;
          break;

        case 'convergence':
          label = '🔄 Agents Converging';
          agentIds = moment.data.movers;
          intensity = 0.65;
          duration = 3;
          break;
      }

      // Find world location from agent positions
      if (agentIds.length > 0) {
        const agents = frame.worldState.agents.filter((a: any) => agentIds.includes(a.id));
        if (agents.length > 0) {
          const avgX = agents.reduce((sum: number, a: any) => sum + a.position.x, 0) / agents.length;
          const avgY = agents.reduce((sum: number, a: any) => sum + a.position.y, 0) / agents.length;
          worldLocation = { x: Math.round(avgX), y: Math.round(avgY) };
        }
      }

      highlights.push({
        turn: moment.turn,
        agentIds: agentIds.length > 0 ? agentIds : undefined,
        worldLocation,
        label,
        intensity,
        duration,
      });
    });

    return highlights;
  }

  /**
   * Calculate world bounds from replay
   */
  private static calculateWorldBounds(replay: Replay): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    centerX: number;
    centerY: number;
  } {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    replay.frames.forEach((frame: ReplayFrame) => {
      frame.worldState.agents.forEach((agent: any) => {
        minX = Math.min(minX, agent.position.x);
        maxX = Math.max(maxX, agent.position.x);
        minY = Math.min(minY, agent.position.y);
        maxY = Math.max(maxY, agent.position.y);
      });
    });

    // Add padding
    const paddingX = (maxX - minX) * 0.2;
    const paddingY = (maxY - minY) * 0.2;

    return {
      minX: minX - paddingX,
      maxX: maxX + paddingX,
      minY: minY - paddingY,
      maxY: maxY + paddingY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
    };
  }

  /**
   * Calculate focus point for a key moment
   */
  private static calculateFocusPoint(
    frame: ReplayFrame,
    moment: { turn: number; type: string; data: any },
    worldBounds: any
  ): { x: number; y: number } {
    // Get relevant agents
    let agentIds: string[] = [];

    if (moment.data.attackers) {
      agentIds = moment.data.attackers;
    } else if (moment.data.deadAgents) {
      agentIds = moment.data.deadAgents;
    } else if (moment.data.agents) {
      agentIds = moment.data.agents;
    } else if (moment.data.gatherers) {
      agentIds = moment.data.gatherers;
    } else if (moment.data.negotiators) {
      agentIds = moment.data.negotiators;
    } else if (moment.data.movers) {
      agentIds = moment.data.movers;
    }

    // Calculate center of relevant agents
    const relevantAgents = frame.worldState.agents.filter((a: any) => agentIds.includes(a.id));

    if (relevantAgents.length > 0) {
      const avgX = relevantAgents.reduce((sum: number, a: any) => sum + a.position.x, 0) / relevantAgents.length;
      const avgY = relevantAgents.reduce((sum: number, a: any) => sum + a.position.y, 0) / relevantAgents.length;
      return { x: avgX, y: avgY };
    }

    // Default to world center
    return {
      x: worldBounds.centerX,
      y: worldBounds.centerY,
    };
  }

  /**
   * Export script to JSON
   */
  static exportScript(script: CinematicReplayScript): string {
    return JSON.stringify(script, null, 2);
  }

  /**
   * Import script from JSON
   */
  static importScript(json: string): CinematicReplayScript {
    return JSON.parse(json);
  }
}
