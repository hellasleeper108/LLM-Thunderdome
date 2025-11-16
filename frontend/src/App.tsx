/**
 * Main App Component
 * Orchestrates the entire frontend application
 */

import React, { useEffect } from 'react';
import { useStore } from './store';
import { createWebSocket } from './api';
import { ArenaView } from './components/ArenaView';
import { AgentInspector } from './components/AgentInspector';
import { EventLog } from './components/EventLog';
import { SimulationControls } from './components/SimulationControls';
import { ReplayViewer } from './components/ReplayViewer';

function App() {
  const { setSimulation, setWorld, setLogs, addLog, setWebSocket, setConnected } = useStore();

  useEffect(() => {
    // Initialize WebSocket connection
    const ws = createWebSocket((data) => {
      console.log('WebSocket message:', data);

      switch (data.type) {
        case 'initial_state':
          if (data.data.engineState) {
            setSimulation(data.data.engineState);
          }
          if (data.data.worldState) {
            setWorld(data.data.worldState);
          }
          if (data.data.logs) {
            setLogs(data.data.logs);
          }
          break;

        case 'simulation_created':
          // Fetch full state after creation
          break;

        case 'turn_complete':
          setSimulation({
            turn: data.data.turn,
            status: 'running',
            agents: data.data.agents,
            messages: data.data.messages,
          });
          break;

        case 'simulation_started':
        case 'simulation_paused':
        case 'simulation_resumed':
        case 'simulation_reset':
          // These will trigger state updates via subsequent messages
          break;

        case 'state_update':
          if (data.data) {
            setWorld(data.data);
          }
          break;

        default:
          console.log('Unhandled WebSocket message type:', data.type);
      }
    });

    ws.addEventListener('open', () => {
      setConnected(true);
    });

    ws.addEventListener('close', () => {
      setConnected(false);
    });

    setWebSocket(ws);

    // Cleanup on unmount
    return () => {
      ws.close();
    };
  }, [setSimulation, setWorld, setLogs, addLog, setWebSocket, setConnected]);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-950 border-b-2 border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              🎮 LLM Thunderdome
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Multi-Agent Simulation Environment
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${useStore.getState().connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-slate-400">
                {useStore.getState().connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="h-[calc(100vh-88px)] p-4">
        {/* Replay Viewer (appears when in replay mode) */}
        <ReplayViewer />

        <div className="grid grid-cols-12 gap-4 h-full">
          {/* Left Column: Controls */}
          <div className="col-span-3 h-full">
            <SimulationControls />
          </div>

          {/* Middle Column: Arena */}
          <div className="col-span-6 h-full">
            <ArenaView />
          </div>

          {/* Right Column: Agent Inspector & Event Log */}
          <div className="col-span-3 h-full flex flex-col gap-4">
            <div className="flex-1 min-h-0">
              <AgentInspector />
            </div>
            <div className="flex-1 min-h-0">
              <EventLog />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
