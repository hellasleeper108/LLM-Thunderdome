/**
 * Cluster Control Panel Component
 * Allows running multiple simulations in parallel and viewing aggregated results
 */

import { useState, useEffect } from 'react';

interface ClusterStatus {
  active: boolean;
  clusterId?: string;
  totalSimulations?: number;
  running?: number;
  completed?: number;
  idle?: number;
}

interface AggregatedResults {
  totalSimulations: number;
  completedSimulations: number;
  avgTurns: number;
  avgSurvivors: number;
  avgDamage: number;
  avgResourcesGathered: number;
  avgAlliancesFormed: number;
  avgCooperation: number;
  avgAggression: number;
  winnerDistribution: { [agentName: string]: number };
  personalityPerformance: {
    [personalityName: string]: {
      wins: number;
      avgSurvivalRate: number;
      avgResourcesGathered: number;
    };
  };
}

interface Comparison {
  mostAggressive: any;
  mostCooperative: any;
  longestRunning: any;
  mostSurvivors: any;
  mostResources: any;
}

export function ClusterControlPanel() {
  const [simulationCount, setSimulationCount] = useState(5);
  const [preset, setPreset] = useState('cooperative');
  const [randomizeSeed, setRandomizeSeed] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<ClusterStatus>({ active: false });
  const [results, setResults] = useState<AggregatedResults | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [presets, setPresets] = useState<string[]>([]);

  // Fetch available presets
  useEffect(() => {
    fetch('http://localhost:3001/api/presets')
      .then((res) => res.json())
      .then((data) => setPresets(data.presets))
      .catch((err) => console.error('Error fetching presets:', err));
  }, []);

  // Poll cluster status while running
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      fetch('http://localhost:3001/api/cluster/status')
        .then((res) => res.json())
        .then((data) => {
          setStatus(data);

          // Check if completed
          if (data.completed === data.totalSimulations && data.totalSimulations > 0) {
            setIsRunning(false);
            fetchResults();
          }
        })
        .catch((err) => console.error('Error fetching status:', err));
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  const startCluster = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/cluster/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simulationCount,
          preset,
          randomizeSeed,
          autoAdvance: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Cluster started:', data);
        setIsRunning(true);
        setResults(null);
        setComparison(null);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error starting cluster:', error);
      alert('Failed to start cluster');
    }
  };

  const fetchResults = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/cluster/results');
      if (response.ok) {
        const data = await response.json();
        setResults(data.results);
        setComparison(data.comparison);
      }
    } catch (error) {
      console.error('Error fetching results:', error);
    }
  };

  const pauseCluster = async () => {
    try {
      await fetch('http://localhost:3001/api/cluster/pause', {
        method: 'POST',
      });
      setIsRunning(false);
    } catch (error) {
      console.error('Error pausing cluster:', error);
    }
  };

  const resetCluster = async () => {
    try {
      await fetch('http://localhost:3001/api/cluster/reset', {
        method: 'POST',
      });
      setIsRunning(false);
      setResults(null);
      setComparison(null);
      setStatus({ active: false });
    } catch (error) {
      console.error('Error resetting cluster:', error);
    }
  };

  return (
    <div className="h-full flex flex-col gap-4 p-6 bg-slate-900 rounded-lg overflow-y-auto">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">🔬 Cluster Analysis</h2>
        <p className="text-slate-400 text-sm">
          Run multiple simulations in parallel to analyze emergent behaviors
        </p>
      </div>

      {/* Configuration Panel */}
      <div className="bg-slate-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-3">Configuration</h3>

        <div className="space-y-3">
          {/* Simulation Count */}
          <div>
            <label className="block text-sm text-slate-300 mb-1">
              Number of Simulations: {simulationCount}
            </label>
            <input
              type="range"
              min="1"
              max="20"
              value={simulationCount}
              onChange={(e) => setSimulationCount(Number(e.target.value))}
              disabled={isRunning}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>1</span>
              <span>20</span>
            </div>
          </div>

          {/* Preset Selection */}
          <div>
            <label className="block text-sm text-slate-300 mb-1">Preset</label>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              disabled={isRunning}
              className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-blue-500 focus:outline-none"
            >
              {presets.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Randomize Seed */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="randomizeSeed"
              checked={randomizeSeed}
              onChange={(e) => setRandomizeSeed(e.target.checked)}
              disabled={isRunning}
              className="w-4 h-4"
            />
            <label htmlFor="randomizeSeed" className="text-sm text-slate-300">
              Randomize agent positions and world generation
            </label>
          </div>

          {/* Start/Stop Buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={startCluster}
              disabled={isRunning}
              className={`flex-1 px-4 py-2 rounded font-semibold transition-colors ${
                isRunning
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isRunning ? 'Running...' : 'Start Cluster'}
            </button>

            {isRunning && (
              <button
                onClick={pauseCluster}
                className="px-4 py-2 rounded font-semibold bg-yellow-600 text-white hover:bg-yellow-700 transition-colors"
              >
                Pause
              </button>
            )}

            {results && (
              <button
                onClick={resetCluster}
                className="px-4 py-2 rounded font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status Panel */}
      {status.active && (
        <div className="bg-slate-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">Status</h3>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-slate-700 rounded p-3">
              <div className="text-xs text-slate-400">Total</div>
              <div className="text-2xl font-bold text-white">{status.totalSimulations}</div>
            </div>
            <div className="bg-green-900/30 rounded p-3">
              <div className="text-xs text-green-400">Running</div>
              <div className="text-2xl font-bold text-green-400">{status.running}</div>
            </div>
            <div className="bg-blue-900/30 rounded p-3">
              <div className="text-xs text-blue-400">Completed</div>
              <div className="text-2xl font-bold text-blue-400">{status.completed}</div>
            </div>
            <div className="bg-slate-700 rounded p-3">
              <div className="text-xs text-slate-400">Idle</div>
              <div className="text-2xl font-bold text-slate-400">{status.idle}</div>
            </div>
          </div>
          {isRunning && (
            <div className="mt-3">
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      ((status.completed || 0) / (status.totalSimulations || 1)) * 100
                    }%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Panel */}
      {results && (
        <div className="space-y-4">
          {/* Overview Metrics */}
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-3">📊 Aggregated Metrics</h3>
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-slate-700 rounded p-3">
                <div className="text-xs text-slate-400">Avg Turns</div>
                <div className="text-xl font-bold text-white">
                  {results.avgTurns.toFixed(1)}
                </div>
              </div>
              <div className="bg-slate-700 rounded p-3">
                <div className="text-xs text-slate-400">Avg Survivors</div>
                <div className="text-xl font-bold text-white">
                  {results.avgSurvivors.toFixed(1)}
                </div>
              </div>
              <div className="bg-slate-700 rounded p-3">
                <div className="text-xs text-slate-400">Avg Resources</div>
                <div className="text-xl font-bold text-white">
                  {results.avgResourcesGathered.toFixed(0)}
                </div>
              </div>
              <div className="bg-slate-700 rounded p-3">
                <div className="text-xs text-slate-400">Avg Alliances</div>
                <div className="text-xl font-bold text-white">
                  {results.avgAlliancesFormed.toFixed(1)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-slate-700 rounded p-3">
                <div className="text-xs text-slate-400">Avg Cooperation</div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-slate-600 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${results.avgCooperation}%` }}
                    />
                  </div>
                  <span className="text-sm text-white">{results.avgCooperation.toFixed(0)}%</span>
                </div>
              </div>
              <div className="bg-slate-700 rounded p-3">
                <div className="text-xs text-slate-400">Avg Aggression</div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-slate-600 rounded-full h-2">
                    <div
                      className="bg-red-500 h-2 rounded-full"
                      style={{ width: `${results.avgAggression}%` }}
                    />
                  </div>
                  <span className="text-sm text-white">{results.avgAggression.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Winner Distribution */}
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-3">🏆 Winner Distribution</h3>
            <div className="space-y-2">
              {Object.entries(results.winnerDistribution)
                .sort(([, a], [, b]) => b - a)
                .map(([name, count]) => (
                  <div key={name} className="flex items-center gap-2">
                    <div className="w-24 text-sm text-slate-300 truncate">{name}</div>
                    <div className="flex-1 bg-slate-700 rounded-full h-6 relative">
                      <div
                        className="bg-gradient-to-r from-yellow-500 to-yellow-600 h-6 rounded-full transition-all"
                        style={{
                          width: `${(count / results.completedSimulations) * 100}%`,
                        }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white">
                        {count} wins
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Personality Performance */}
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-3">
              🎭 Personality Performance
            </h3>
            <div className="space-y-3">
              {Object.entries(results.personalityPerformance)
                .sort(([, a], [, b]) => b.wins - a.wins)
                .map(([name, stats]) => (
                  <div key={name} className="bg-slate-700 rounded p-3">
                    <div className="font-semibold text-white mb-2">{name}</div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <div className="text-slate-400">Wins</div>
                        <div className="text-white font-semibold">{stats.wins}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">Survival Rate</div>
                        <div className="text-white font-semibold">
                          {stats.avgSurvivalRate.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">Avg Resources</div>
                        <div className="text-white font-semibold">
                          {stats.avgResourcesGathered.toFixed(0)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Comparison */}
          {comparison && (
            <div className="bg-slate-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-3">🔍 Extremes</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-red-900/30 rounded p-3 border border-red-700">
                  <div className="text-xs text-red-400 font-semibold">Most Aggressive</div>
                  <div className="text-sm text-white mt-1">
                    {comparison.mostAggressive.simulationName}
                  </div>
                  <div className="text-xs text-red-300">
                    Aggression: {comparison.mostAggressive.avgAggression.toFixed(1)}
                  </div>
                </div>
                <div className="bg-green-900/30 rounded p-3 border border-green-700">
                  <div className="text-xs text-green-400 font-semibold">Most Cooperative</div>
                  <div className="text-sm text-white mt-1">
                    {comparison.mostCooperative.simulationName}
                  </div>
                  <div className="text-xs text-green-300">
                    Cooperation: {comparison.mostCooperative.avgCooperation.toFixed(1)}
                  </div>
                </div>
                <div className="bg-blue-900/30 rounded p-3 border border-blue-700">
                  <div className="text-xs text-blue-400 font-semibold">Longest Running</div>
                  <div className="text-sm text-white mt-1">
                    {comparison.longestRunning.simulationName}
                  </div>
                  <div className="text-xs text-blue-300">
                    Turns: {comparison.longestRunning.turns}
                  </div>
                </div>
                <div className="bg-yellow-900/30 rounded p-3 border border-yellow-700">
                  <div className="text-xs text-yellow-400 font-semibold">Most Resources</div>
                  <div className="text-sm text-white mt-1">
                    {comparison.mostResources.simulationName}
                  </div>
                  <div className="text-xs text-yellow-300">
                    Resources: {comparison.mostResources.totalResourcesGathered}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
