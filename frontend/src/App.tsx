/**
 * Main App Component
 * Orchestrates the entire frontend application
 */

import { useEffect, useState } from 'react';
import { useStore } from './store';
import { createWebSocket } from './api';
import { ArenaView } from './components/ArenaView';
import { WebGLArena } from './components/WebGLArena';
import { AgentInspector } from './components/AgentInspector';
import { EventLog } from './components/EventLog';
import { SimulationControls } from './components/SimulationControls';
import { ReplayViewer } from './components/ReplayViewer';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { ClusterControlPanel } from './components/ClusterControlPanel';
import { StanCommentaryPanel } from './components/StanCommentaryPanel';

type ViewMode = 'simulation' | 'analytics' | 'cluster';
type RenderMode = '2d' | '3d';

function App() {
  const { setSimulation, setWorld, setLogs, addLog, setWebSocket, setConnected } = useStore();
  const [viewMode, setViewMode] = useState<ViewMode>('simulation');
  const [renderMode, setRenderMode] = useState<RenderMode>('2d');
  const [showStanPanel, setShowStanPanel] = useState(false);

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

        case 'stan_commentary':
          // STAN commentary received - panel will auto-refresh via polling
          console.log('STAN commentary received:', data.payload);
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
        <div className="flex items-center justify-between mb-3">
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
            <button
              onClick={() => setShowStanPanel(!showStanPanel)}
              className={`px-4 py-2 rounded transition-colors flex items-center gap-2 ${
                showStanPanel
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
              title="Toggle STAN Commentary Panel"
            >
              <span>🤖</span>
              <span className="text-sm font-medium">STAN</span>
            </button>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('simulation')}
            className={`px-4 py-2 rounded ${
              viewMode === 'simulation'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Simulation
          </button>
          <button
            onClick={() => setViewMode('analytics')}
            className={`px-4 py-2 rounded ${
              viewMode === 'analytics'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Analytics
          </button>
          <button
            onClick={() => setViewMode('cluster')}
            className={`px-4 py-2 rounded ${
              viewMode === 'cluster'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Cluster
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="h-[calc(100vh-144px)] p-4">
        {viewMode === 'simulation' ? (
          <>
            {/* Replay Viewer (appears when in replay mode) */}
            <ReplayViewer />

            <div className="grid grid-cols-12 gap-4 h-full">
              {/* Left Column: Controls */}
              <div className="col-span-3 h-full">
                <SimulationControls />
              </div>

              {/* Middle Column: Arena */}
              <div className="col-span-6 h-full flex flex-col gap-2">
                {/* 2D/3D Toggle */}
                <div className="flex items-center gap-2 bg-slate-800 rounded p-2">
                  <span className="text-sm text-slate-400">View:</span>
                  <button
                    onClick={() => setRenderMode('2d')}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      renderMode === '2d'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    2D Grid
                  </button>
                  <button
                    onClick={() => setRenderMode('3d')}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      renderMode === '3d'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    3D World
                  </button>
                </div>

                {/* Arena View */}
                <div className="flex-1 min-h-0">
                  {renderMode === '2d' ? <ArenaView /> : <WebGLArena />}
                </div>
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
          </>
        ) : viewMode === 'analytics' ? (
          <div className="h-full">
            <AnalyticsDashboard />
          </div>
        ) : (
          <div className="h-full">
            <ClusterControlPanel />
          </div>
        )}
      </main>

      {/* STAN Commentary Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-gray-900 border-l border-gray-700 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 ${
          showStanPanel ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Close button */}
          <div className="p-2 border-b border-gray-700 flex justify-end">
            <button
              onClick={() => setShowStanPanel(false)}
              className="text-gray-400 hover:text-white transition-colors p-2"
              title="Close STAN Panel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Panel content */}
          <div className="flex-1 min-h-0">
            <StanCommentaryPanel />
          </div>
        </div>
      </div>

      {/* Backdrop overlay when STAN panel is open */}
      {showStanPanel && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setShowStanPanel(false)}
        />
      )}
    </div>
  );
}

export default App;
