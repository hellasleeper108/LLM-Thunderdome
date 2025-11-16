/**
 * Zustand Store
 * Global state management for the frontend
 */

import { create } from 'zustand';
import { SimulationState, WorldState, EventLog, AgentState } from './types';

interface AppState {
  // Simulation state
  simulation: SimulationState | null;
  world: WorldState | null;
  logs: EventLog[];
  selectedAgent: AgentState | null;

  // WebSocket
  ws: WebSocket | null;
  connected: boolean;

  // Actions
  setSimulation: (simulation: SimulationState) => void;
  setWorld: (world: WorldState) => void;
  setLogs: (logs: EventLog[]) => void;
  addLog: (log: EventLog) => void;
  selectAgent: (agent: AgentState | null) => void;
  setWebSocket: (ws: WebSocket | null) => void;
  setConnected: (connected: boolean) => void;
  reset: () => void;
}

export const useStore = create<AppState>((set) => ({
  simulation: null,
  world: null,
  logs: [],
  selectedAgent: null,
  ws: null,
  connected: false,

  setSimulation: (simulation) => set({ simulation }),
  setWorld: (world) => set({ world }),
  setLogs: (logs) => set({ logs }),
  addLog: (log) => set((state) => ({ logs: [...state.logs, log] })),
  selectAgent: (agent) => set({ selectedAgent: agent }),
  setWebSocket: (ws) => set({ ws }),
  setConnected: (connected) => set({ connected }),
  reset: () => set({
    simulation: null,
    world: null,
    logs: [],
    selectedAgent: null,
  }),
}));
