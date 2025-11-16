/**
 * Core type definitions for the LLM Thunderdome simulation
 */

export interface Position {
  x: number;
  y: number;
}

export enum TileType {
  EMPTY = 'empty',
  RESOURCE_FOOD = 'resource_food',
  RESOURCE_WATER = 'resource_water',
  RESOURCE_MATERIAL = 'resource_material',
  OBSTACLE = 'obstacle',
  EVENT_STORM = 'event_storm',
  EVENT_ANOMALY = 'event_anomaly',
  EVENT_BOON = 'event_boon',
}

export interface Tile {
  type: TileType;
  position: Position;
  value?: number; // For resources: amount available
  metadata?: Record<string, any>;
}

export interface AgentStats {
  energy: number;
  aggression: number;
  cooperation: number;
  riskTolerance: number;
  curiosity: number;
  empathy: number;
}

export interface Personality {
  name: string;
  traits: AgentStats;
  description: string;
}

export interface Goal {
  id: string;
  description: string;
  priority: 'primary' | 'secondary';
  completed: boolean;
}

export interface Memory {
  shortTerm: MemoryEntry[];
  longTerm: MemoryEntry[];
}

export interface MemoryEntry {
  timestamp: number;
  type: 'observation' | 'action' | 'interaction' | 'dialogue';
  content: string;
  metadata?: Record<string, any>;
}

export interface Inventory {
  food: number;
  water: number;
  material: number;
}

export interface AgentState {
  id: string;
  name: string;
  position: Position;
  personality: Personality;
  stats: AgentStats;
  goals: Goal[];
  memory: Memory;
  inventory: Inventory;
  health: number;
  isAlive: boolean;
  allegiances: string[]; // IDs of allied agents
}

export enum ActionType {
  MOVE = 'move',
  GATHER = 'gather',
  ATTACK = 'attack',
  COMMUNICATE = 'communicate',
  REST = 'rest',
  SHARE = 'share',
  EXPLORE = 'explore',
  NEGOTIATE = 'negotiate',
  FORM_ALLIANCE = 'form_alliance',
  BREAK_ALLIANCE = 'break_alliance',
}

export interface Action {
  type: ActionType;
  agentId: string;
  target?: Position | string; // Position for movement, string for agent ID
  payload?: Record<string, any>;
}

export interface ActionResult {
  success: boolean;
  action: Action;
  effects: string[];
  timestamp: number;
}

export interface Message {
  id: string;
  from: string;
  to: string;
  content: string;
  type: 'request' | 'threat' | 'bargain' | 'alliance' | 'info' | 'other';
  timestamp: number;
}

export interface WorldState {
  width: number;
  height: number;
  tiles: Tile[][];
  turn: number;
  agents: Map<string, AgentState>;
  messages: Message[];
}

export interface SimulationConfig {
  worldWidth: number;
  worldHeight: number;
  turnDuration: number; // milliseconds
  maxTurns: number;
  preset?: 'cooperative' | 'competitive' | 'diplomatic';
}

export interface EventLog {
  id: string;
  timestamp: number;
  turn: number;
  type: 'action' | 'interaction' | 'resource_change' | 'dialogue' | 'state_update' | 'event';
  description: string;
  agentIds: string[];
  metadata?: Record<string, any>;
}

export interface Observation {
  visibleTiles: Tile[];
  nearbyAgents: AgentState[];
  recentMessages: Message[];
  currentStats: AgentStats;
  inventory: Inventory;
}
