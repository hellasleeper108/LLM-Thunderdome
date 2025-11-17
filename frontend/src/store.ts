/**
 * Zustand Store
 * Global state management for the frontend
 */

import { create } from 'zustand';
import {
  SimulationState,
  WorldState,
  EventLog,
  AgentState,
  Replay,
  ReplayPlaybackState,
  ReplayFrame
} from './types';

interface AppState {
  // Simulation state
  simulation: SimulationState | null;
  world: WorldState | null;
  logs: EventLog[];
  selectedAgent: AgentState | null;

  // WebSocket
  ws: WebSocket | null;
  connected: boolean;

  // Replay state
  replay: Replay | null;
  playbackState: ReplayPlaybackState | null;
  isReplayMode: boolean;
  currentFrame: ReplayFrame | null;

  // Actions
  setSimulation: (simulation: SimulationState) => void;
  setWorld: (world: WorldState) => void;
  setLogs: (logs: EventLog[]) => void;
  addLog: (log: EventLog) => void;
  selectAgent: (agent: AgentState | null) => void;
  setWebSocket: (ws: WebSocket | null) => void;
  setConnected: (connected: boolean) => void;
  reset: () => void;

  // Replay actions
  loadReplay: (replay: Replay) => void;
  setPlaybackState: (state: ReplayPlaybackState) => void;
  setCurrentFrame: (frame: ReplayFrame | null) => void;
  setIsReplayMode: (isReplayMode: boolean) => void;
  clearReplay: () => void;
  updatePlaybackProgress: (currentTurn: number, isPlaying: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  simulation: null,
  world: null,
  logs: [],
  selectedAgent: null,
  ws: null,
  connected: false,

  // Replay initial state
  replay: null,
  playbackState: null,
  isReplayMode: false,
  currentFrame: null,

  setSimulation: (simulation: SimulationState) => set({ simulation }),
  setWorld: (world: WorldState) => set({ world }),
  setLogs: (logs: EventLog[]) => set({ logs }),
  addLog: (log: EventLog) => set((state: AppState) => ({ logs: [...state.logs, log] })),
  selectAgent: (agent: AgentState | null) => set({ selectedAgent: agent }),
  setWebSocket: (ws: WebSocket | null) => set({ ws }),
  setConnected: (connected: boolean) => set({ connected }),
  reset: () => set({
    simulation: null,
    world: null,
    logs: [],
    selectedAgent: null,
  }),

  // Replay actions
  loadReplay: (replay: Replay) => set({
    replay,
    isReplayMode: true,
    playbackState: {
      currentTurn: replay.frames.length > 0 ? replay.frames[0].turn : 0,
      isPlaying: false,
      playbackSpeed: 1.0,
      totalTurns: replay.metadata.totalTurns,
      replay,
    },
    currentFrame: replay.frames.length > 0 ? replay.frames[0] : null,
  }),

  setPlaybackState: (playbackState: ReplayPlaybackState) => set({ playbackState }),

  setCurrentFrame: (currentFrame: ReplayFrame | null) => set((state: AppState) => {
    // Update world and simulation state from the frame
    if (currentFrame) {
      return {
        currentFrame,
        world: {
          width: state.replay?.metadata.worldSize.width || 20,
          height: state.replay?.metadata.worldSize.height || 20,
          tiles: currentFrame.worldState.tiles,
        },
        simulation: {
          turn: currentFrame.turn,
          status: 'paused' as const,
          agents: currentFrame.worldState.agents,
          messages: currentFrame.messages,
        },
      };
    }
    return { currentFrame };
  }),

  setIsReplayMode: (isReplayMode: boolean) => set({ isReplayMode }),

  clearReplay: () => set({
    replay: null,
    playbackState: null,
    isReplayMode: false,
    currentFrame: null,
  }),

  updatePlaybackProgress: (currentTurn: number, isPlaying: boolean) => set((state: AppState) => ({
    playbackState: state.playbackState ? {
      ...state.playbackState,
      currentTurn,
      isPlaying,
    } : null,
  })),
}));
