/**
 * LLM Thunderdome Backend Server
 * REST API and WebSocket server for the simulation
 */

import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { World } from './world';
import { SimulationEngine } from './engine';
import { EventLogger } from './logging';
import { StateManager } from './state';
import { LLMAgent, ScriptedAgent } from './agents';
import { getPreset, getAllPresetNames, createGoalsFromPersonality } from './simulations';
import { getPersonality, ALL_PERSONALITIES, personalityFromGenome } from './agents/personalities';
import { Position, FitnessCriteria, AgentGenome } from './schemas/types';
import { AnalyticsEngine, PredictionEngine, EarlyStateSnapshot, OutcomePrediction } from './analytics';
import { SimulationCluster, ClusterConfig, AggregatedResults } from './cluster';
import { FactionManager, LawSystem, LawType } from './civilization';
import { initializeStanBridge, getStanBridge, getCommentaryStore, StanCommentary } from './stan';
import { getHistoryManager } from './history';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Middleware
app.use(cors());
app.use(express.json());

// Global state
let world: World | null = null;
let engine: SimulationEngine | null = null;
let logger: EventLogger | null = null;
let stateManager: StateManager | null = null;

// Cluster state
let simulationCluster: SimulationCluster | null = null;
let clusterResults: AggregatedResults | null = null;

// Civilization state
let factionManager: FactionManager | null = null;
let lawSystem: LawSystem | null = null;

// WebSocket clients
const clients = new Set<WebSocket>();

// Broadcast to all connected clients
function broadcast(message: any): void {
  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('Client connected');
  clients.add(ws);

  // Send current state if simulation exists
  if (engine && world && stateManager) {
    ws.send(JSON.stringify({
      type: 'initial_state',
      data: {
        engineState: engine.getState(),
        worldState: world.toJSON(),
        logs: logger?.getLogs().slice(-50) || [],
      },
    }));
  }

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// REST API Routes

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    simulation: engine ? 'active' : 'inactive',
    turn: engine?.getCurrentTurn() || 0,
  });
});

/**
 * POST /api/simulation/create
 * Create a new simulation
 */
app.post('/api/simulation/create', (req, res) => {
  try {
    const { preset, config } = req.body;

    let finalConfig = config;

    // Load preset if specified
    if (preset) {
      const presetConfig = getPreset(preset);
      if (!presetConfig) {
        return res.status(400).json({ error: 'Invalid preset name' });
      }
      finalConfig = { ...presetConfig, ...config };
    }

    // Create world
    world = new World({
      width: finalConfig.worldWidth || 20,
      height: finalConfig.worldHeight || 20,
      resourceDensity: finalConfig.resourceDensity,
      obstacleDensity: finalConfig.obstacleDensity,
    });

    // Create logger
    logger = new EventLogger({
      maxLogs: 10000,
      autoExport: false,
    });

    // Create state manager
    stateManager = new StateManager(finalConfig.worldWidth || 20, finalConfig.worldHeight || 20);

    // Create engine
    engine = new SimulationEngine(world, logger, {
      turnDuration: finalConfig.turnDuration || 2000,
      maxTurns: finalConfig.maxTurns || 100,
      autoAdvance: false,
      visionRadius: 3,
    });

    // Load culture pack if specified
    let culturePack: any = null;
    if (finalConfig.culturePackId) {
      const { getCulturePack } = require('./civilization');
      culturePack = getCulturePack(finalConfig.culturePackId);
      if (culturePack) {
        console.log(`[Simulation] Applying culture pack: ${culturePack.name}`);
      }
    }

    // Add agents from initialGenomes or preset personalities
    if (finalConfig.initialGenomes && finalConfig.initialGenomes.length > 0) {
      // Use evolved genomes
      console.log(`[Simulation] Creating agents from ${finalConfig.initialGenomes.length} evolved genomes`);

      finalConfig.initialGenomes.forEach((genome: any, index: number) => {
        const position: Position = {
          x: Math.floor(Math.random() * (finalConfig.worldWidth || 20)),
          y: Math.floor(Math.random() * (finalConfig.worldHeight || 20)),
        };

        // Convert genome to personality
        let personality = personalityFromGenome(genome);

        // Apply culture pack biases if present
        if (culturePack) {
          const { applyCultureTraits } = require('./civilization');
          personality.traits = applyCultureTraits(personality.traits, culturePack);
        }

        const goals = createGoalsFromPersonality(personality);

        const agent = new LLMAgent(
          `${personality.name} ${index + 1}`,
          personality,
          position,
          goals,
          { useMock: true }
        );

        engine!.addAgent(agent);
      });
    } else if (finalConfig.agentPersonalities) {
      // Use traditional personality templates
      finalConfig.agentPersonalities.forEach((personality: any, index: number) => {
        const position: Position = {
          x: Math.floor(Math.random() * (finalConfig.worldWidth || 20)),
          y: Math.floor(Math.random() * (finalConfig.worldHeight || 20)),
        };

        // Apply culture pack biases if present
        if (culturePack) {
          const { applyCultureTraits } = require('./civilization');
          personality = {
            ...personality,
            traits: applyCultureTraits(personality.traits, culturePack),
          };
        }

        const goals = createGoalsFromPersonality(personality);

        const agent = new LLMAgent(
          `${personality.name} ${index + 1}`,
          personality,
          position,
          goals,
          { useMock: true }
        );

        engine!.addAgent(agent);
      });
    }

    // Subscribe to state changes
    stateManager.subscribe((state) => {
      broadcast({
        type: 'state_update',
        data: state,
      });
    });

    broadcast({
      type: 'simulation_created',
      data: {
        worldSize: { width: finalConfig.worldWidth, height: finalConfig.worldHeight },
        agentCount: finalConfig.agentPersonalities?.length || 0,
      },
    });

    res.json({
      success: true,
      message: 'Simulation created',
      config: finalConfig,
    });
  } catch (error: any) {
    console.error('Error creating simulation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/simulation/start
 * Start the simulation
 */
app.post('/api/simulation/start', (req, res) => {
  if (!engine) {
    return res.status(400).json({ error: 'No simulation created' });
  }

  engine.start();

  broadcast({
    type: 'simulation_started',
    data: { turn: engine.getCurrentTurn() },
  });

  res.json({ success: true, message: 'Simulation started' });
});

/**
 * POST /api/simulation/pause
 * Pause the simulation
 */
app.post('/api/simulation/pause', (req, res) => {
  if (!engine) {
    return res.status(400).json({ error: 'No simulation created' });
  }

  engine.pause();

  broadcast({
    type: 'simulation_paused',
    data: { turn: engine.getCurrentTurn() },
  });

  res.json({ success: true, message: 'Simulation paused' });
});

/**
 * POST /api/simulation/resume
 * Resume the simulation
 */
app.post('/api/simulation/resume', (req, res) => {
  if (!engine) {
    return res.status(400).json({ error: 'No simulation created' });
  }

  engine.resume();

  broadcast({
    type: 'simulation_resumed',
    data: { turn: engine.getCurrentTurn() },
  });

  res.json({ success: true, message: 'Simulation resumed' });
});

/**
 * POST /api/simulation/step
 * Execute a single turn
 */
app.post('/api/simulation/step', async (req, res) => {
  if (!engine) {
    return res.status(400).json({ error: 'No simulation created' });
  }

  try {
    await engine.executeTurn();

    const state = engine.getState();

    // Update state manager
    if (stateManager && world) {
      stateManager.setTurn(state.turn);
      stateManager.updateTiles(world.getAllTiles());
      state.agents.forEach(agent => {
        stateManager!.updateAgent(agent);
      });
    }

    broadcast({
      type: 'turn_complete',
      data: {
        turn: state.turn,
        agents: state.agents,
        messages: state.messages,
        actionResults: state.actionResults,
      },
    });

    res.json({
      success: true,
      turn: state.turn,
      status: state.status,
    });
  } catch (error: any) {
    console.error('Error executing turn:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/simulation/reset
 * Reset the simulation
 */
app.post('/api/simulation/reset', (req, res) => {
  if (!engine) {
    return res.status(400).json({ error: 'No simulation created' });
  }

  engine.reset();
  world?.reset();
  stateManager?.reset();
  logger?.clear();

  broadcast({
    type: 'simulation_reset',
    data: {},
  });

  res.json({ success: true, message: 'Simulation reset' });
});

/**
 * GET /api/simulation/state
 * Get current simulation state
 */
app.get('/api/simulation/state', (req, res) => {
  if (!engine || !world) {
    return res.status(400).json({ error: 'No simulation created' });
  }

  const state = engine.getState();
  const worldState = world.toJSON();

  res.json({
    engineState: state,
    worldState,
    logs: logger?.getLogs().slice(-50) || [],
  });
});

/**
 * GET /api/presets
 * Get all available presets
 */
app.get('/api/presets', (req, res) => {
  const presetNames = getAllPresetNames();
  const presets = presetNames.map(name => ({
    name,
    config: getPreset(name),
  }));

  res.json({ presets });
});

/**
 * GET /api/personalities
 * Get all available personalities
 */
app.get('/api/personalities', (req, res) => {
  res.json({ personalities: ALL_PERSONALITIES });
});

/**
 * GET /api/logs
 * Get simulation logs
 */
app.get('/api/logs', (req, res) => {
  if (!logger) {
    return res.status(400).json({ error: 'No simulation created' });
  }

  const { turn, agentId, type, limit } = req.query;

  let logs = logger.getLogs();

  if (turn) {
    logs = logger.getLogsForTurn(parseInt(turn as string));
  } else if (agentId) {
    logs = logger.getLogsForAgent(agentId as string);
  } else if (type) {
    logs = logger.getLogsByType(type as any);
  }

  const limitNum = limit ? parseInt(limit as string) : 100;
  logs = logs.slice(-limitNum);

  res.json({ logs, summary: logger.getSummary() });
});

/**
 * POST /api/logs/export
 * Export logs to file
 */
app.post('/api/logs/export', (req, res) => {
  if (!logger) {
    return res.status(400).json({ error: 'No simulation created' });
  }

  try {
    const { format } = req.body;

    let filepath: string;
    if (format === 'transcript') {
      filepath = logger.exportTranscript();
    } else {
      filepath = logger.exportJSON();
    }

    res.json({
      success: true,
      filepath,
      message: `Logs exported to ${filepath}`,
    });
  } catch (error: any) {
    console.error('Error exporting logs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/relations
 * Get social relationship data
 * Query params: agentId (optional), type (optional: trust, fear, respect, rivalry, loyalty)
 */
app.get('/api/relations', (req, res) => {
  if (!engine) {
    return res.status(400).json({ error: 'No simulation created' });
  }

  try {
    const { agentId, type } = req.query;
    const socialGraph = engine.getSocialGraph();

    // If specific agent requested
    if (agentId) {
      const summary = socialGraph.getSocialSummary(agentId as string);

      // If specific relationship type requested, filter results
      if (type) {
        const strongest = socialGraph.getStrongestRelationships(
          agentId as string,
          type as any,
          10
        );

        return res.json({
          agentId,
          type,
          relationships: strongest,
          summary,
        });
      }

      // Return full summary
      return res.json({
        agentId,
        summary,
      });
    }

    // Return all relationships
    const allRelationships = socialGraph.getAllRelationshipData();

    res.json({
      relationships: allRelationships,
      totalCount: allRelationships.length,
    });
  } catch (error: any) {
    console.error('Error fetching relations:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/agents/:id/memory
 * Get memory data for a specific agent
 */
app.get('/api/agents/:id/memory', (req, res) => {
  if (!engine) {
    return res.status(400).json({ error: 'No simulation created' });
  }

  try {
    const { id } = req.params;
    const state = engine.getState();
    const agent = state.agents.find(a => a.id === id);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Get agent from engine to access memory
    const agentInstance = Array.from((engine as any).agents.values())
      .find((a: any) => a.getState().id === id);

    if (!agentInstance) {
      return res.status(404).json({ error: 'Agent instance not found' });
    }

    const memoryManager = (agentInstance as any).getMemoryManager();
    const memorySummary = memoryManager.getSummary();
    const fullExport = memoryManager.export();

    res.json({
      agentId: id,
      agentName: agent.name,
      summary: memorySummary,
      recentEpisodes: fullExport.episodes.slice(-20),
      importantEpisodes: memorySummary.episodic.important,
      allFacts: fullExport.facts,
      confidentFacts: memorySummary.semantic.confident,
      strategicKnowledge: memorySummary.semantic.strategic,
      stats: fullExport.stats,
    });
  } catch (error: any) {
    console.error('Error fetching agent memory:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agents/add
 * Add a new agent to the simulation
 */
app.post('/api/agents/add', (req, res) => {
  if (!engine || !world) {
    return res.status(400).json({ error: 'No simulation created' });
  }

  try {
    const { name, personalityName, agentType, strategy } = req.body;

    const personality = getPersonality(personalityName);
    if (!personality) {
      return res.status(400).json({ error: 'Invalid personality name' });
    }

    const position: Position = {
      x: Math.floor(Math.random() * world.getDimensions().width),
      y: Math.floor(Math.random() * world.getDimensions().height),
    };

    const goals = createGoalsFromPersonality(personality);

    let agent;
    if (agentType === 'scripted') {
      agent = new ScriptedAgent(name, personality, position, goals, {
        strategy: strategy || 'gatherer',
      });
    } else {
      agent = new LLMAgent(name, personality, position, goals, { useMock: true });
    }

    engine.addAgent(agent);

    broadcast({
      type: 'agent_added',
      data: agent.getState(),
    });

    res.json({
      success: true,
      message: 'Agent added',
      agent: agent.getState(),
    });
  } catch (error: any) {
    console.error('Error adding agent:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics/heatmap/aggression
 * Get aggression heatmap for the current simulation
 */
app.get('/api/analytics/heatmap/aggression', (req, res) => {
  if (!engine || !world) {
    return res.status(400).json({ error: 'No simulation created' });
  }

  try {
    const analyticsEngine = new AnalyticsEngine();
    const state = engine.getState();
    const dimensions = world.getDimensions();

    const heatmap = analyticsEngine.generateAggressionHeatmap(
      state.agents,
      dimensions.width,
      dimensions.height
    );

    res.json({ heatmap });
  } catch (error: any) {
    console.error('Error generating aggression heatmap:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics/heatmap/cooperation
 * Get cooperation heatmap for the current simulation
 */
app.get('/api/analytics/heatmap/cooperation', (req, res) => {
  if (!engine || !world) {
    return res.status(400).json({ error: 'No simulation created' });
  }

  try {
    const analyticsEngine = new AnalyticsEngine();
    const state = engine.getState();
    const dimensions = world.getDimensions();

    const heatmap = analyticsEngine.generateCooperationHeatmap(
      state.agents,
      dimensions.width,
      dimensions.height
    );

    res.json({ heatmap });
  } catch (error: any) {
    console.error('Error generating cooperation heatmap:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics/relations/graph
 * Get social graph data with nodes and edges
 */
app.get('/api/analytics/relations/graph', (req, res) => {
  if (!engine) {
    return res.status(400).json({ error: 'No simulation created' });
  }

  try {
    const analyticsEngine = new AnalyticsEngine();
    const state = engine.getState();
    const socialGraph = engine.getSocialGraph();
    const allianceManager = engine.getAllianceManager();

    const graphData = analyticsEngine.buildSocialGraphMatrix(
      state.agents,
      socialGraph,
      allianceManager
    );

    res.json({ graph: graphData });
  } catch (error: any) {
    console.error('Error generating social graph:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics/metrics
 * Get comprehensive analytics metrics
 */
app.get('/api/analytics/metrics', (req, res) => {
  if (!engine || !logger) {
    return res.status(400).json({ error: 'No simulation created' });
  }

  try {
    const analyticsEngine = new AnalyticsEngine();
    const state = engine.getState();

    // Get comprehensive metrics
    const metrics = analyticsEngine.computeMetrics(
      state.agents,
      state.actionResults,
      state.turn
    );

    // Compute resource flow
    const resourceFlow = analyticsEngine.computeResourceFlow(
      state.messages,
      state.actionResults
    );

    // Compute negotiation metrics
    const negotiationMetrics = analyticsEngine.computeNegotiationSuccessRates(
      state.messages,
      state.actionResults
    );

    // Compute survival statistics (with empty death records for now)
    const survivalStats = analyticsEngine.computeSurvivalRates(
      state.agents,
      state.turn,
      []
    );

    res.json({
      metrics,
      resourceFlow,
      negotiationMetrics,
      survivalStats,
    });
  } catch (error: any) {
    console.error('Error computing analytics metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics/resource-flow
 * Get resource flow data
 */
app.get('/api/analytics/resource-flow', (req, res) => {
  if (!engine) {
    return res.status(400).json({ error: 'No simulation created' });
  }

  try {
    const analyticsEngine = new AnalyticsEngine();
    const state = engine.getState();

    const resourceFlow = analyticsEngine.computeResourceFlow(
      state.messages,
      state.actionResults
    );

    res.json({ resourceFlow });
  } catch (error: any) {
    console.error('Error computing resource flow:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics/survival
 * Get survival statistics
 */
app.get('/api/analytics/survival', (req, res) => {
  if (!engine) {
    return res.status(400).json({ error: 'No simulation created' });
  }

  try {
    const analyticsEngine = new AnalyticsEngine();
    const state = engine.getState();

    // TODO: Track actual death records in the simulation
    const survivalStats = analyticsEngine.computeSurvivalRates(
      state.agents,
      state.turn,
      []
    );

    res.json({ survivalStats });
  } catch (error: any) {
    console.error('Error computing survival statistics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics/civilization
 * Get civilization-level analytics (factions, stability, conflicts, law compliance)
 */
app.get('/api/analytics/civilization', (req, res) => {
  try {
    if (!factionManager || !lawSystem) {
      return res.json({
        factions: [],
        factionStability: {},
        conflictRates: {},
        lawCompliance: {},
      });
    }

    const analyticsEngine = new AnalyticsEngine();
    const factions = factionManager.listFactions();
    const laws = lawSystem.listLaws();

    // Compute faction stability
    const factionStability = analyticsEngine.computeFactionStability(factions);

    // Get simulation data for conflict rates and law compliance
    let conflictRates = {};
    let lawCompliance = {};

    if (engine) {
      const state = engine.getState();

      // Compute inter-faction conflict rates
      conflictRates = analyticsEngine.computeInterFactionConflictRates(
        factions,
        state.actionResults,
        state.agents
      );

      // Compute law compliance rates
      // TODO: Track law violations in simulation state
      lawCompliance = analyticsEngine.computeLawComplianceRates(
        laws,
        factions,
        state.actionResults,
        [] // Law violations array (to be implemented)
      );
    }

    // Build response with enriched faction data
    const enrichedFactions = factions.map((faction) => ({
      ...faction,
      members: Array.from(faction.members), // Convert Set to Array
      stability: factionStability[faction.id] || 0,
      memberCount: faction.members.size,
    }));

    res.json({
      factions: enrichedFactions,
      factionStability,
      conflictRates,
      lawCompliance,
    });
  } catch (error: any) {
    console.error('Error computing civilization analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/analytics/predict-outcome
 * Predict simulation outcome based on early-turn data
 */
app.post('/api/analytics/predict-outcome', (req, res) => {
  try {
    const snapshot: EarlyStateSnapshot = req.body;

    // Validate snapshot
    if (!snapshot || !snapshot.agentStates || !snapshot.worldSummary || !snapshot.socialSummary) {
      return res.status(400).json({
        error: 'Invalid snapshot: must include agentStates, worldSummary, and socialSummary',
      });
    }

    // Create prediction engine and predict outcome
    const predictionEngine = new PredictionEngine();

    // For now, use heuristic-based prediction
    // In the future, you could train the engine with historical data:
    // predictionEngine.trainFromHistory(replays);

    const prediction: OutcomePrediction = predictionEngine.predictOutcome(snapshot);

    res.json({ prediction });
  } catch (error: any) {
    console.error('Error predicting outcome:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/stan/config
 * Get current STAN configuration
 */
app.get('/api/stan/config', (req, res) => {
  try {
    const stan = getStanBridge();
    const config = stan.getConfig();
    const stats = stan.getStats();

    res.json({
      config,
      stats,
    });
  } catch (error: any) {
    console.error('Error getting STAN config:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/stan/config
 * Update STAN configuration
 */
app.post('/api/stan/config', (req, res) => {
  try {
    const stan = getStanBridge();
    const { enabled, webhookUrl, apiKey, maxEventsPerSecond } = req.body;

    // Validate inputs
    if (enabled !== undefined && typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }

    if (webhookUrl !== undefined && typeof webhookUrl !== 'string') {
      return res.status(400).json({ error: 'webhookUrl must be a string' });
    }

    if (maxEventsPerSecond !== undefined) {
      const rate = Number(maxEventsPerSecond);
      if (isNaN(rate) || rate < 1 || rate > 100) {
        return res.status(400).json({ error: 'maxEventsPerSecond must be between 1 and 100' });
      }
    }

    // Update configuration
    const updates: any = {};
    if (enabled !== undefined) updates.enabled = enabled;
    if (webhookUrl !== undefined) updates.webhookUrl = webhookUrl;
    if (apiKey !== undefined) updates.apiKey = apiKey;
    if (maxEventsPerSecond !== undefined) updates.maxEventsPerSecond = Number(maxEventsPerSecond);

    stan.updateConfig(updates);

    // If enabled was changed, update the bridge state
    if (enabled !== undefined) {
      stan.setEnabled(enabled);
    }

    res.json({
      success: true,
      config: stan.getConfig(),
    });
  } catch (error: any) {
    console.error('Error updating STAN config:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/stan/stats
 * Get STAN bridge statistics
 */
app.get('/api/stan/stats', (req, res) => {
  try {
    const stan = getStanBridge();
    const stats = stan.getStats();

    res.json({ stats });
  } catch (error: any) {
    console.error('Error getting STAN stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/stan/commentary
 * Add STAN commentary/annotation (called by external STAN overseer)
 */
app.post('/api/stan/commentary', (req, res) => {
  try {
    const commentaryStore = getCommentaryStore();
    const { scope, scopeId, summary, recommendation, severity, metadata } = req.body;

    // Validate required fields
    if (!scope || !summary) {
      return res.status(400).json({
        error: 'Required fields: scope, summary'
      });
    }

    // Validate scope
    const validScopes = ['simulation', 'cluster', 'agent', 'faction', 'global'];
    if (!validScopes.includes(scope)) {
      return res.status(400).json({
        error: `Invalid scope. Must be one of: ${validScopes.join(', ')}`
      });
    }

    // Validate severity if provided
    if (severity && !['info', 'warning', 'critical'].includes(severity)) {
      return res.status(400).json({
        error: 'Invalid severity. Must be one of: info, warning, critical'
      });
    }

    // Add commentary
    const commentary = commentaryStore.addCommentary({
      scope,
      scopeId,
      summary,
      recommendation,
      severity: severity || 'info',
      metadata,
    });

    // Broadcast to WebSocket clients
    broadcast({
      type: 'stan_commentary',
      payload: commentary,
    });

    res.json({
      success: true,
      commentary
    });
  } catch (error: any) {
    console.error('Error adding STAN commentary:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/stan/commentary
 * Get STAN commentary messages
 */
app.get('/api/stan/commentary', (req, res) => {
  try {
    const commentaryStore = getCommentaryStore();
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const scope = req.query.scope as string | undefined;
    const scopeId = req.query.scopeId as string | undefined;
    const severity = req.query.severity as 'info' | 'warning' | 'critical' | undefined;

    let commentaries: StanCommentary[];

    // Filter based on query parameters
    if (scopeId) {
      commentaries = commentaryStore.getCommentariesForEntity(scopeId, limit);
    } else if (scope) {
      commentaries = commentaryStore.getCommentariesByScope(scope as any, limit);
    } else if (severity) {
      commentaries = commentaryStore.getCommentariesBySeverity(severity);
    } else {
      commentaries = commentaryStore.getRecentCommentaries(limit);
    }

    // Check if STAN is enabled
    const stan = getStanBridge();
    const stanConfig = stan.getConfig();

    res.json({
      commentaries,
      stanEnabled: stanConfig.enabled,
      hasWebhook: !!stanConfig.webhookUrl,
      stats: commentaryStore.getStats(),
    });
  } catch (error: any) {
    console.error('Error getting STAN commentary:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/stan/commentary
 * Clear all STAN commentary (admin/debug)
 */
app.delete('/api/stan/commentary', (req, res) => {
  try {
    const commentaryStore = getCommentaryStore();
    commentaryStore.clear();

    res.json({
      success: true,
      message: 'All commentary cleared'
    });
  } catch (error: any) {
    console.error('Error clearing STAN commentary:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/cluster/start
 * Start a cluster of simulations running in parallel
 */
app.post('/api/cluster/start', async (req, res) => {
  try {
    const { simulationCount, preset: presetName, randomizeSeed, autoAdvance } = req.body;

    if (!simulationCount || simulationCount < 1 || simulationCount > 20) {
      return res.status(400).json({
        error: 'simulationCount must be between 1 and 20',
      });
    }

    // Load preset
    const preset = getPreset(presetName || 'cooperative');
    if (!preset) {
      return res.status(400).json({ error: 'Invalid preset' });
    }

    // Create cluster config
    const clusterConfig: ClusterConfig = {
      simulationCount,
      preset,
      randomizeSeed: randomizeSeed ?? true,
      autoAdvance: autoAdvance ?? true,
    };

    console.log(
      `[Cluster API] Starting cluster with ${simulationCount} simulations (preset: ${preset.name})`
    );

    // Create and initialize cluster
    simulationCluster = new SimulationCluster(clusterConfig);
    simulationCluster.initialize();

    // Run simulations in parallel (async)
    const clusterId = simulationCluster.getClusterId();

    // Start execution asynchronously
    simulationCluster.runMultipleSimulationsInParallel().then(() => {
      console.log(`[Cluster ${clusterId}] All simulations completed`);

      // Aggregate results
      clusterResults = simulationCluster!.aggregateResults();

      // Broadcast completion to WebSocket clients
      broadcast({
        type: 'cluster_completed',
        data: {
          clusterId,
          results: clusterResults,
        },
      });
    }).catch((error) => {
      console.error(`[Cluster ${clusterId}] Error:`, error);
    });

    res.json({
      clusterId,
      status: 'started',
      simulationCount,
      preset: preset.name,
    });
  } catch (error: any) {
    console.error('Error starting cluster:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/cluster/status
 * Get the status of the running cluster
 */
app.get('/api/cluster/status', (req, res) => {
  if (!simulationCluster) {
    return res.json({
      active: false,
      message: 'No cluster is currently running',
    });
  }

  const status = simulationCluster.getStatus();
  res.json({
    active: true,
    ...status,
  });
});

/**
 * GET /api/cluster/results
 * Get the aggregated results from the cluster
 */
app.get('/api/cluster/results', (req, res) => {
  if (!simulationCluster) {
    return res.status(400).json({ error: 'No cluster created' });
  }

  if (!clusterResults) {
    // Generate results if not already done
    clusterResults = simulationCluster.aggregateResults();
  }

  const comparison = simulationCluster.compareSimOutcomes();

  res.json({
    results: clusterResults,
    comparison,
  });
});

/**
 * GET /api/cluster/outcomes
 * Get individual simulation outcomes
 */
app.get('/api/cluster/outcomes', (req, res) => {
  if (!simulationCluster) {
    return res.status(400).json({ error: 'No cluster created' });
  }

  const outcomes = simulationCluster.getOutcomes();
  res.json({ outcomes });
});

/**
 * POST /api/cluster/pause
 * Pause all running simulations in the cluster
 */
app.post('/api/cluster/pause', (req, res) => {
  if (!simulationCluster) {
    return res.status(400).json({ error: 'No cluster created' });
  }

  simulationCluster.pauseAll();
  res.json({ message: 'Cluster paused' });
});

/**
 * POST /api/cluster/reset
 * Reset the cluster
 */
app.post('/api/cluster/reset', (req, res) => {
  if (!simulationCluster) {
    return res.status(400).json({ error: 'No cluster created' });
  }

  simulationCluster.resetAll();
  clusterResults = null;
  res.json({ message: 'Cluster reset' });
});

/**
 * GET /api/evolution/presets-support
 * Get information about which presets support genome-based seeding
 */
app.get('/api/evolution/presets-support', (req, res) => {
  try {
    const presetNames = getAllPresetNames();
    const presetsInfo = presetNames.map((presetName) => {
      const preset = getPreset(presetName);
      if (!preset) {
        return null;
      }

      return {
        name: preset.name,
        description: preset.description,
        supportsGenomes: true, // All presets now support genome-based seeding
        expectedAgentCount: preset.agentPersonalities.length,
        currentMode: preset.initialGenomes ? 'genome' : 'personality',
        genomeCount: preset.initialGenomes?.length || 0,
        worldDimensions: {
          width: preset.worldWidth,
          height: preset.worldHeight,
        },
        maxTurns: preset.maxTurns,
      };
    }).filter(Boolean);

    res.json({
      presets: presetsInfo,
      totalPresets: presetsInfo.length,
      message: 'All presets support genome-based seeding. Use initialGenomes field in preset config.',
    });
  } catch (error: any) {
    console.error('Error fetching presets support:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/evolution/next-generation
 * Generate next generation of agent genomes using evolutionary algorithms
 */
app.post('/api/evolution/next-generation', (req, res) => {
  try {
    if (!simulationCluster) {
      return res.status(400).json({ error: 'No cluster created. Run a cluster first.' });
    }

    const { fitnessCriteria, topK, mutationRate, populationSize } = req.body;

    // Validate fitness criteria
    if (!fitnessCriteria) {
      return res.status(400).json({
        error: 'fitnessCriteria is required',
        example: {
          survivalWeight: 1.0,
          resourceWeight: 0.8,
          cooperationWeight: 0.6,
          aggressionWeight: -0.3,
          goalCompletionWeight: 1.0,
        },
      });
    }

    // Set defaults
    const criteria: FitnessCriteria = {
      survivalWeight: fitnessCriteria.survivalWeight ?? 1.0,
      resourceWeight: fitnessCriteria.resourceWeight ?? 0.8,
      cooperationWeight: fitnessCriteria.cooperationWeight ?? 0.6,
      aggressionWeight: fitnessCriteria.aggressionWeight ?? 0.0,
      goalCompletionWeight: fitnessCriteria.goalCompletionWeight ?? 1.0,
    };

    const top = topK ?? 5;
    const mutation = mutationRate ?? 0.1;

    console.log(`[Evolution API] Generating next generation with criteria:`, criteria);
    console.log(`[Evolution API] Top K: ${top}, Mutation rate: ${mutation}`);

    // Generate next generation
    const genomes = simulationCluster.generateNextGenerationConfigs(
      criteria,
      top,
      mutation,
      populationSize
    );

    const generationIndex = genomes[0]?.generation || 1;

    res.json({
      generationIndex,
      genomes,
      count: genomes.length,
      fitnessCriteria: criteria,
      parameters: {
        topK: top,
        mutationRate: mutation,
        populationSize: genomes.length,
      },
    });
  } catch (error: any) {
    console.error('Error generating next generation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/civilization/factions
 * Get all factions and their state
 */
app.get('/api/civilization/factions', (req, res) => {
  try {
    if (!factionManager) {
      return res.json({ factions: [] });
    }

    const factions = factionManager.listFactions().map(f => ({
      ...f,
      members: Array.from(f.members), // Convert Set to Array for JSON
      stability: lawSystem ? lawSystem.computeFactionStability(f) : f.cohesion,
    }));

    res.json({ factions });
  } catch (error: any) {
    console.error('Error fetching factions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/civilization/laws
 * Get all laws in the system
 */
app.get('/api/civilization/laws', (req, res) => {
  try {
    if (!lawSystem) {
      return res.json({ laws: [] });
    }

    const laws = lawSystem.listLaws();

    res.json({ laws });
  } catch (error: any) {
    console.error('Error fetching laws:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/civilization/beliefs
 * Get all beliefs in the system
 */
app.get('/api/civilization/beliefs', (req, res) => {
  try {
    if (!engine) {
      return res.json({ beliefs: [] });
    }

    const beliefSystem = engine.getBeliefSystem();
    const beliefs = beliefSystem.getAllBeliefs();

    res.json({ beliefs });
  } catch (error: any) {
    console.error('Error fetching beliefs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/civilization/rituals
 * Get all rituals in the system
 */
app.get('/api/civilization/rituals', (req, res) => {
  try {
    if (!engine) {
      return res.json({ rituals: [] });
    }

    const beliefSystem = engine.getBeliefSystem();
    const rituals = beliefSystem.getAllRituals();

    res.json({ rituals });
  } catch (error: any) {
    console.error('Error fetching rituals:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/civilization/culture-packs
 * Get all available culture packs
 */
app.get('/api/civilization/culture-packs', (req, res) => {
  try {
    const { getAllCulturePacks } = require('./civilization');
    const culturePacks = getAllCulturePacks();

    res.json({ culturePacks });
  } catch (error: any) {
    console.error('Error fetching culture packs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/language/dialects
 * Get all faction dialects
 */
app.get('/api/language/dialects', (req, res) => {
  try {
    if (!engine) {
      return res.json({ dialects: [] });
    }

    const languageEngine = engine.getLanguageEngine();
    const dialects = languageEngine.getAllDialects();
    const stats = languageEngine.getStats();

    res.json({ dialects, stats });
  } catch (error: any) {
    console.error('Error fetching dialects:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/language/dialects/:factionId
 * Get dialect for a specific faction
 */
app.get('/api/language/dialects/:factionId', (req, res) => {
  try {
    if (!engine) {
      return res.status(404).json({ error: 'No active simulation' });
    }

    const { factionId } = req.params;
    const languageEngine = engine.getLanguageEngine();
    const dialect = languageEngine.getDialect(factionId);

    if (!dialect) {
      return res.status(404).json({ error: `Dialect not found for faction ${factionId}` });
    }

    res.json({ dialect });
  } catch (error: any) {
    console.error('Error fetching dialect:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/history
 * Get historical events with optional filtering
 * Query params: type, minTurn, maxTurn, tags (comma-separated), severity, factionId
 */
app.get('/api/history', (req, res) => {
  try {
    const historyManager = getHistoryManager();
    const { type, minTurn, maxTurn, tags, severity, factionId } = req.query;

    // Build filter object
    const filter: any = {};

    if (type) {
      filter.type = type as string;
    }

    if (minTurn) {
      filter.minTurn = parseInt(minTurn as string, 10);
    }

    if (maxTurn) {
      filter.maxTurn = parseInt(maxTurn as string, 10);
    }

    if (tags) {
      // Split comma-separated tags
      filter.tags = (tags as string).split(',').map(t => t.trim());
    }

    if (severity) {
      filter.severity = severity as 'low' | 'medium' | 'high' | 'critical';
    }

    if (factionId) {
      filter.factionId = factionId as string;
    }

    // Get filtered events
    const events = historyManager.getEvents(filter);

    res.json({
      events,
      count: events.length,
      filter,
    });
  } catch (error: any) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/history/eras
 * Get era summaries for the simulation history
 * Query params: windowSize (default: 20)
 */
app.get('/api/history/eras', (req, res) => {
  try {
    const historyManager = getHistoryManager();
    const windowSize = req.query.windowSize
      ? parseInt(req.query.windowSize as string, 10)
      : 20;

    // Validate window size
    if (isNaN(windowSize) || windowSize < 5 || windowSize > 200) {
      return res.status(400).json({
        error: 'windowSize must be between 5 and 200',
      });
    }

    // Get era summaries
    const eras = historyManager.getEras(windowSize);

    res.json({
      eras,
      count: eras.length,
      windowSize,
    });
  } catch (error: any) {
    console.error('Error fetching eras:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/civilization/factions/debug-seed
 * Debug endpoint to seed initial factions for testing
 */
app.post('/api/civilization/factions/debug-seed', (req, res) => {
  try {
    if (!engine) {
      return res.status(400).json({ error: 'No active simulation. Create a simulation first.' });
    }

    // Initialize faction manager and law system if not already done
    if (!factionManager) {
      factionManager = new FactionManager();
    }

    if (!lawSystem) {
      lawSystem = new LawSystem();
    }

    const agentStates = engine.getState().agents;

    if (agentStates.length === 0) {
      return res.status(400).json({ error: 'No agents in simulation' });
    }

    // Create 2-3 factions from agents
    const agentsPerFaction = Math.ceil(agentStates.length / 3);
    const createdFactions = [];

    for (let i = 0; i < Math.min(3, agentStates.length); i++) {
      const start = i * agentsPerFaction;
      const end = Math.min(start + agentsPerFaction, agentStates.length);
      const factionAgentStates = agentStates.slice(start, end);

      if (factionAgentStates.length === 0) break;

      const factionName = `Faction ${String.fromCharCode(65 + i)}`; // A, B, C

      // Calculate faction stats from agent states
      const avgAggression = factionAgentStates.reduce((sum, a) => sum + a.stats.aggression, 0) / factionAgentStates.length;
      const avgDiplomacy = factionAgentStates.reduce((sum, a) => sum + a.stats.cooperation, 0) / factionAgentStates.length;

      const faction = factionManager.createFactionFromIds(
        factionName,
        factionAgentStates.map(a => a.id),
        {
          description: `Auto-generated faction ${i + 1}`,
          initialResources: {
            food: 10,
            water: 10,
            materials: 5,
          },
          aggression: avgAggression,
          diplomacy: avgDiplomacy,
          cohesion: 0.7,
          founded: engine.getCurrentTurn(),
        }
      );

      // Add some default laws
      const noAttackLaw = lawSystem.getLaw('law-no-attack');
      const cooperationLaw = lawSystem.getLaw('law-cooperation');

      if (noAttackLaw) {
        factionManager.addLaw(faction.id, noAttackLaw.id);
      }

      if (cooperationLaw) {
        factionManager.addLaw(faction.id, cooperationLaw.id);
      }

      createdFactions.push({
        ...faction,
        members: Array.from(faction.members),
      });
    }

    res.json({
      message: `Created ${createdFactions.length} factions`,
      factions: createdFactions,
    });
  } catch (error: any) {
    console.error('Error seeding factions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize STAN bridge
console.log('[Server] Initializing STAN bridge...');
initializeStanBridge();
const stanBridge = getStanBridge();
console.log('[Server] STAN bridge initialized:', {
  enabled: stanBridge.getConfig().enabled,
  hasWebhook: !!stanBridge.getConfig().webhookUrl,
});

// Start server
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║          🎮  LLM THUNDERDOME BACKEND  🎮             ║
║                                                       ║
║  Server running on port ${PORT}                        ║
║  WebSocket endpoint: ws://localhost:${PORT}/ws         ║
║                                                       ║
║  API Documentation:                                   ║
║  - POST /api/simulation/create                        ║
║  - POST /api/cluster/start                            ║
║  - POST /api/evolution/next-generation                ║
║  - GET  /api/evolution/presets-support                ║
║  - GET  /api/cluster/results                          ║
║  - GET  /api/analytics/metrics                        ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});

export { app, server, wss };
