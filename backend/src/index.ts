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
import { getPersonality, ALL_PERSONALITIES } from './agents/personalities';
import { Position } from './schemas/types';

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

    // Add agents from preset
    if (finalConfig.agentPersonalities) {
      finalConfig.agentPersonalities.forEach((personality: any, index: number) => {
        const position: Position = {
          x: Math.floor(Math.random() * (finalConfig.worldWidth || 20)),
          y: Math.floor(Math.random() * (finalConfig.worldHeight || 20)),
        };

        const goals = createGoalsFromPersonality(personality);

        const agent = new LLMAgent(
          `${personality.name} ${index + 1}`,
          personality,
          position,
          goals,
          { mock: true }
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
      agent = new LLMAgent(name, personality, position, goals, { mock: true });
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
║  - POST /api/simulation/start                         ║
║  - POST /api/simulation/pause                         ║
║  - POST /api/simulation/step                          ║
║  - GET  /api/simulation/state                         ║
║  - GET  /api/presets                                  ║
║  - GET  /api/personalities                            ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});

export { app, server, wss };
