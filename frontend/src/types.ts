/**
 * Frontend type definitions
 * Mirrors backend types for use in React components
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
  value?: number;
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
  allegiances: string[];
}

export interface Message {
  id: string;
  from: string;
  to: string;
  content: string;
  type: 'request' | 'threat' | 'bargain' | 'alliance' | 'info' | 'other';
  timestamp: number;
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

export interface SimulationState {
  turn: number;
  status: 'idle' | 'running' | 'paused' | 'completed';
  agents: AgentState[];
  messages: Message[];
}

export interface WorldState {
  width: number;
  height: number;
  tiles: Tile[][];
}
