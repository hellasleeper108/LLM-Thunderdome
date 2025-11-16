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

/**
 * Negotiation System Types
 */

export enum NegotiationProtocol {
  TRADE = 'trade',
  ALLIANCE = 'alliance',
  THREAT = 'threat',
  REQUEST_AID = 'request_aid',
}

export interface ResourceOffer {
  food?: number;
  water?: number;
  material?: number;
}

export interface NegotiationOffer {
  id: string;
  protocol: NegotiationProtocol;
  initiatorId: string;
  targetId: string;
  offering: ResourceOffer;
  requesting: ResourceOffer;
  terms?: string; // Human-readable terms
  conditions?: {
    duration?: number; // For alliances, how many turns
    exclusivity?: boolean; // For alliances
    protection?: boolean; // Defender helps in combat
    immediate?: boolean; // Must be fulfilled this turn
  };
  timestamp: number;
}

export interface NegotiationResponse {
  offerId: string;
  accepted: boolean;
  counterOffer?: NegotiationOffer;
  reason?: string;
  timestamp: number;
}

export interface NegotiationContext {
  initiator: AgentState;
  target: AgentState;
  turn: number;
  recentHistory: NegotiationOffer[]; // Previous offers between these agents
  relationshipScore: number; // -100 to 100, based on past interactions
  powerBalance: number; // -1 to 1, negative means target is stronger
}

export interface NegotiationOutcome {
  success: boolean;
  offer: NegotiationOffer;
  response: NegotiationResponse;
  effects: {
    resourceTransfers?: {
      from: string;
      to: string;
      resources: ResourceOffer;
    }[];
    allianceFormed?: boolean;
    allianceBroken?: boolean;
    threatIssued?: boolean;
    aidProvided?: boolean;
  };
  consequences: string[];
}

/**
 * Alliance System Types
 */

export interface Alliance {
  id: string;
  memberIds: string[]; // Agent IDs in the alliance
  formedAt: number; // Timestamp
  duration?: number; // Turns until expiry (undefined = permanent)
  strength: number; // 0-100, based on cooperation and trust
  conditions: {
    protection: boolean; // Defend each other in combat
    resourceSharing: boolean; // Share observations and resources
    exclusivity: boolean; // Members cannot attack each other
  };
  metadata?: Record<string, any>;
}

export interface AllianceRequest {
  id: string;
  from: string;
  to: string;
  timestamp: number;
  conditions: Alliance['conditions'];
  duration?: number;
}

export interface AllianceStrength {
  baseStrength: number; // From formation conditions
  cooperationBonus: number; // From successful cooperation
  trustBonus: number; // From honoring agreements
  timeBonus: number; // Longer alliances are stronger
  total: number; // Sum of all bonuses (0-100)
}

/**
 * Social Graph Types
 */

export interface RelationshipWeights {
  trust: number; // 0-100: confidence in another agent's reliability
  fear: number; // 0-100: how much one agent fears another
  respect: number; // 0-100: admiration or regard for another agent
  rivalry: number; // 0-100: competitive tension or antagonism
  loyalty: number; // 0-100: commitment and dedication to another agent
}

export interface SocialRelationship {
  from: string;
  to: string;
  weights: RelationshipWeights;
  lastUpdated: number;
  interactionCount: number;
}
