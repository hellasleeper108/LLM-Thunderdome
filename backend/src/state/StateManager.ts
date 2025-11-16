/**
 * State Manager
 * Centralized state management for the simulation
 */

import { WorldState, AgentState, Message, Tile } from '../schemas/types';

export class StateManager {
  private state: WorldState;
  private subscribers: Set<(state: WorldState) => void>;

  constructor(width: number, height: number) {
    this.state = {
      width,
      height,
      tiles: [],
      turn: 0,
      agents: new Map(),
      messages: [],
    };

    this.subscribers = new Set();
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback: (state: WorldState) => void): () => void {
    this.subscribers.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify all subscribers of state change
   */
  private notify(): void {
    const stateCopy = this.getState();
    this.subscribers.forEach(callback => callback(stateCopy));
  }

  /**
   * Update world tiles
   */
  updateTiles(tiles: Tile[][]): void {
    this.state.tiles = tiles;
    this.notify();
  }

  /**
   * Update agent state
   */
  updateAgent(agentState: AgentState): void {
    this.state.agents.set(agentState.id, agentState);
    this.notify();
  }

  /**
   * Remove agent
   */
  removeAgent(agentId: string): void {
    this.state.agents.delete(agentId);
    this.notify();
  }

  /**
   * Add message
   */
  addMessage(message: Message): void {
    this.state.messages.push(message);

    // Keep only last 100 messages
    if (this.state.messages.length > 100) {
      this.state.messages.shift();
    }

    this.notify();
  }

  /**
   * Increment turn
   */
  incrementTurn(): void {
    this.state.turn++;
    this.notify();
  }

  /**
   * Set turn
   */
  setTurn(turn: number): void {
    this.state.turn = turn;
    this.notify();
  }

  /**
   * Get current state (immutable copy)
   */
  getState(): Readonly<WorldState> {
    return {
      ...this.state,
      agents: new Map(this.state.agents),
      messages: [...this.state.messages],
      tiles: this.state.tiles.map(row => row.map(tile => ({ ...tile }))),
    };
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AgentState | null {
    return this.state.agents.get(agentId) || null;
  }

  /**
   * Get all agents
   */
  getAllAgents(): AgentState[] {
    return Array.from(this.state.agents.values());
  }

  /**
   * Get messages for agent
   */
  getMessagesForAgent(agentId: string): Message[] {
    return this.state.messages.filter(
      msg => msg.from === agentId || msg.to === agentId
    );
  }

  /**
   * Get recent messages (last N)
   */
  getRecentMessages(count: number = 10): Message[] {
    return this.state.messages.slice(-count);
  }

  /**
   * Reset state
   */
  reset(): void {
    this.state = {
      width: this.state.width,
      height: this.state.height,
      tiles: [],
      turn: 0,
      agents: new Map(),
      messages: [],
    };

    this.notify();
  }

  /**
   * Export state to JSON
   */
  toJSON(): object {
    return {
      width: this.state.width,
      height: this.state.height,
      turn: this.state.turn,
      agents: Array.from(this.state.agents.entries()),
      messages: this.state.messages,
      tiles: this.state.tiles,
    };
  }
}
