/**
 * Simulation Controls Component
 * Provides UI controls for managing the simulation
 */

import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { api } from '../api';

interface Preset {
  name: string;
  config: any;
}

export const SimulationControls: React.FC = () => {
  const { simulation, reset } = useStore();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>('cooperative');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      const response = await api.getPresets();
      setPresets(response.presets);
    } catch (error) {
      console.error('Failed to load presets:', error);
    }
  };

  const handleCreateSimulation = async () => {
    setLoading(true);
    try {
      await api.createSimulation(selectedPreset);
      // State will be updated via WebSocket
    } catch (error) {
      console.error('Failed to create simulation:', error);
      alert('Failed to create simulation. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    try {
      await api.startSimulation();
    } catch (error) {
      console.error('Failed to start simulation:', error);
    }
  };

  const handlePause = async () => {
    try {
      await api.pauseSimulation();
    } catch (error) {
      console.error('Failed to pause simulation:', error);
    }
  };

  const handleResume = async () => {
    try {
      await api.resumeSimulation();
    } catch (error) {
      console.error('Failed to resume simulation:', error);
    }
  };

  const handleStep = async () => {
    try {
      await api.stepSimulation();
    } catch (error) {
      console.error('Failed to step simulation:', error);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset the simulation?')) {
      return;
    }

    try {
      await api.resetSimulation();
      reset();
    } catch (error) {
      console.error('Failed to reset simulation:', error);
    }
  };

  const handleExportLogs = async (format: 'json' | 'transcript') => {
    try {
      const response = await api.exportLogs(format);
      alert(`Logs exported to: ${response.filepath}`);
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-800 rounded-lg border-2 border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-700">
        <h2 className="text-xl font-bold text-white">Controls</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Create Simulation */}
        {!simulation && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Create Simulation</h3>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Select Preset</label>
              <select
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-300 focus:outline-none focus:border-blue-500"
              >
                <option value="cooperative">Cooperative Challenge</option>
                <option value="competitive">Competitive Survival</option>
                <option value="diplomatic">Emergent Diplomacy</option>
              </select>
            </div>

            {presets.find(p => p.name === selectedPreset) && (
              <div className="p-3 bg-slate-900 rounded border border-slate-700">
                <p className="text-sm text-slate-300 mb-2">
                  {presets.find(p => p.name === selectedPreset)?.config?.description}
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">World:</span>{' '}
                    <span className="text-slate-300">
                      {presets.find(p => p.name === selectedPreset)?.config?.worldWidth}x
                      {presets.find(p => p.name === selectedPreset)?.config?.worldHeight}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Turns:</span>{' '}
                    <span className="text-slate-300">
                      {presets.find(p => p.name === selectedPreset)?.config?.maxTurns}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Agents:</span>{' '}
                    <span className="text-slate-300">
                      {presets.find(p => p.name === selectedPreset)?.config?.agentPersonalities?.length || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Duration:</span>{' '}
                    <span className="text-slate-300">
                      {(presets.find(p => p.name === selectedPreset)?.config?.turnDuration || 0) / 1000}s/turn
                    </span>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleCreateSimulation}
              disabled={loading}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded transition-colors"
            >
              {loading ? 'Creating...' : 'Create Simulation'}
            </button>
          </div>
        )}

        {/* Simulation Controls */}
        {simulation && (
          <>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Simulation Control</h3>

              <div className="grid grid-cols-2 gap-2">
                {simulation.status === 'idle' && (
                  <button
                    onClick={handleStart}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded transition-colors"
                  >
                    ▶️ Start
                  </button>
                )}

                {simulation.status === 'running' && (
                  <button
                    onClick={handlePause}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded transition-colors"
                  >
                    ⏸️ Pause
                  </button>
                )}

                {simulation.status === 'paused' && (
                  <button
                    onClick={handleResume}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded transition-colors"
                  >
                    ▶️ Resume
                  </button>
                )}

                <button
                  onClick={handleStep}
                  disabled={simulation.status === 'running'}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded transition-colors"
                >
                  ⏭️ Step
                </button>
              </div>

              <button
                onClick={handleReset}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded transition-colors"
              >
                🔄 Reset
              </button>
            </div>

            {/* Statistics */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Statistics</h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-900 rounded">
                  <div className="text-xs text-slate-500 mb-1">Current Turn</div>
                  <div className="text-2xl font-mono text-blue-400">{simulation.turn}</div>
                </div>

                <div className="p-3 bg-slate-900 rounded">
                  <div className="text-xs text-slate-500 mb-1">Alive Agents</div>
                  <div className="text-2xl font-mono text-green-400">
                    {simulation.agents.filter(a => a.isAlive).length}
                  </div>
                </div>

                <div className="p-3 bg-slate-900 rounded">
                  <div className="text-xs text-slate-500 mb-1">Total Agents</div>
                  <div className="text-2xl font-mono text-purple-400">
                    {simulation.agents.length}
                  </div>
                </div>

                <div className="p-3 bg-slate-900 rounded">
                  <div className="text-xs text-slate-500 mb-1">Messages</div>
                  <div className="text-2xl font-mono text-yellow-400">
                    {simulation.messages.length}
                  </div>
                </div>
              </div>
            </div>

            {/* Agent Summary */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                Agents ({simulation.agents.filter(a => a.isAlive).length} alive)
              </h3>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {simulation.agents.map((agent) => (
                  <div
                    key={agent.id}
                    className={`p-2 rounded border ${
                      agent.isAlive
                        ? 'bg-slate-900 border-slate-700'
                        : 'bg-red-900/20 border-red-700/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-semibold ${agent.isAlive ? 'text-slate-300' : 'text-red-400'}`}>
                        {agent.name}
                      </span>
                      {!agent.isAlive && (
                        <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">
                          DEAD
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-500">HP</span>
                          <span className="text-slate-400">{agent.health}</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-1">
                          <div
                            className="bg-green-500 h-1 rounded-full transition-all"
                            style={{ width: `${agent.health}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex gap-1 text-xs">
                        <span title="Food">🍎{agent.inventory.food}</span>
                        <span title="Water">💧{agent.inventory.water}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Export */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Export Logs</h3>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleExportLogs('json')}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded transition-colors text-sm"
                >
                  📄 JSON
                </button>
                <button
                  onClick={() => handleExportLogs('transcript')}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded transition-colors text-sm"
                >
                  📝 Transcript
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
