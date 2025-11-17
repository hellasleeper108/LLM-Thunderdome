/**
 * Analytics Dashboard Component
 * Displays heatmaps, metrics, and social graph visualizations
 */

import { useEffect, useState } from 'react';
import { useStore } from '../store';

// Analytics data types
interface HeatmapCell {
  x: number;
  y: number;
  value: number;
  count: number;
}

interface Heatmap {
  width: number;
  height: number;
  cells: HeatmapCell[][];
  min: number;
  max: number;
  average: number;
}

interface AnalyticsMetrics {
  simulation: {
    currentTurn: number;
    totalAgents: number;
    agentsAlive: number;
    totalResources: number;
    activeAlliances: number;
  };
  combat: {
    totalAttacks: number;
    successfulAttacks: number;
    totalDamage: number;
    kills: number;
  };
  cooperation: {
    totalTrades: number;
    totalResourcesShared: number;
    alliancesFormed: number;
    alliancesBroken: number;
  };
  exploration: {
    tilesExplored: number;
    resourcesGathered: number;
    averageMovement: number;
  };
}

interface SocialGraphNode {
  id: string;
  name: string;
  personality: string;
  stats: {
    aggression: number;
    cooperation: number;
    empathy: number;
  };
  position: { x: number; y: number };
  health: number;
  isAlive: boolean;
}

interface SocialGraphEdge {
  source: string;
  target: string;
  trust: number;
  fear: number;
  respect: number;
  rivalry: number;
  loyalty: number;
  strength: number;
  isAlliance: boolean;
}

interface SocialGraphData {
  nodes: SocialGraphNode[];
  edges: SocialGraphEdge[];
  clusters: string[][];
}

interface CivilizationAnalytics {
  factions: Array<{
    id: string;
    name: string;
    members: string[];
    stability: number;
    memberCount: number;
    cohesion: number;
    resources: { food: number; water: number; materials: number };
    laws: string[];
  }>;
  factionStability: { [factionId: string]: number };
  conflictRates: { [pairKey: string]: number };
  lawCompliance: {
    [lawId: string]: {
      violations: number;
      totalRelevant: number;
      complianceRate: number;
    };
  };
}

const API_BASE = 'http://localhost:3001/api';

export function AnalyticsDashboard() {
  const simulation = useStore((state) => state.simulation);
  const [activeTab, setActiveTab] = useState<'overview' | 'heatmaps' | 'graph' | 'civilization'>('overview');
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [aggressionHeatmap, setAggressionHeatmap] = useState<Heatmap | null>(null);
  const [cooperationHeatmap, setCooperationHeatmap] = useState<Heatmap | null>(null);
  const [socialGraph, setSocialGraph] = useState<SocialGraphData | null>(null);
  const [civilizationData, setCivilizationData] = useState<CivilizationAnalytics | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch analytics data
  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch metrics
      const metricsRes = await fetch(`${API_BASE}/analytics/metrics`);
      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data.metrics);
      }

      // Fetch heatmaps if on heatmaps tab
      if (activeTab === 'heatmaps') {
        const aggrRes = await fetch(`${API_BASE}/analytics/heatmap/aggression`);
        if (aggrRes.ok) {
          const data = await aggrRes.json();
          setAggressionHeatmap(data.heatmap);
        }

        const coopRes = await fetch(`${API_BASE}/analytics/heatmap/cooperation`);
        if (coopRes.ok) {
          const data = await coopRes.json();
          setCooperationHeatmap(data.heatmap);
        }
      }

      // Fetch social graph if on graph tab
      if (activeTab === 'graph') {
        const graphRes = await fetch(`${API_BASE}/analytics/relations/graph`);
        if (graphRes.ok) {
          const data = await graphRes.json();
          setSocialGraph(data.graph);
        }
      }

      // Fetch civilization data if on civilization tab
      if (activeTab === 'civilization') {
        const civRes = await fetch(`${API_BASE}/analytics/civilization`);
        if (civRes.ok) {
          const data = await civRes.json();
          setCivilizationData(data);
        }
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (simulation) {
      fetchAnalytics();
    }
  }, [simulation?.turn, activeTab]);

  if (!simulation) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900 rounded">
        <p className="text-gray-400">No simulation running. Create a simulation to view analytics.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900 rounded overflow-hidden">
      {/* Header with tabs */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-white">Analytics Dashboard</h2>
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-sm rounded"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('heatmaps')}
            className={`px-4 py-2 rounded ${
              activeTab === 'heatmaps'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Heatmaps
          </button>
          <button
            onClick={() => setActiveTab('graph')}
            className={`px-4 py-2 rounded ${
              activeTab === 'graph'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Social Graph
          </button>
          <button
            onClick={() => setActiveTab('civilization')}
            className={`px-4 py-2 rounded ${
              activeTab === 'civilization'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Civilization
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'overview' && (
          <OverviewTab metrics={metrics} loading={loading} />
        )}
        {activeTab === 'heatmaps' && (
          <HeatmapsTab
            aggressionHeatmap={aggressionHeatmap}
            cooperationHeatmap={cooperationHeatmap}
            loading={loading}
          />
        )}
        {activeTab === 'graph' && (
          <SocialGraphTab socialGraph={socialGraph} loading={loading} />
        )}

        {activeTab === 'civilization' && (
          <CivilizationTab civilizationData={civilizationData} loading={loading} />
        )}
      </div>
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ metrics, loading }: { metrics: AnalyticsMetrics | null; loading: boolean }) {
  if (loading || !metrics) {
    return <div className="text-gray-400">Loading metrics...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Simulation Stats */}
      <MetricCard
        title="Simulation"
        icon="🎮"
        metrics={[
          { label: 'Turn', value: metrics.simulation.currentTurn },
          { label: 'Agents', value: `${metrics.simulation.agentsAlive}/${metrics.simulation.totalAgents}` },
          { label: 'Resources', value: metrics.simulation.totalResources },
          { label: 'Alliances', value: metrics.simulation.activeAlliances },
        ]}
      />

      {/* Combat Stats */}
      <MetricCard
        title="Combat"
        icon="⚔️"
        metrics={[
          { label: 'Total Attacks', value: metrics.combat.totalAttacks },
          { label: 'Successful', value: metrics.combat.successfulAttacks },
          { label: 'Total Damage', value: metrics.combat.totalDamage },
          { label: 'Kills', value: metrics.combat.kills },
        ]}
      />

      {/* Cooperation Stats */}
      <MetricCard
        title="Cooperation"
        icon="🤝"
        metrics={[
          { label: 'Trades', value: metrics.cooperation.totalTrades },
          { label: 'Resources Shared', value: metrics.cooperation.totalResourcesShared },
          { label: 'Alliances Formed', value: metrics.cooperation.alliancesFormed },
          { label: 'Alliances Broken', value: metrics.cooperation.alliancesBroken },
        ]}
      />

      {/* Exploration Stats */}
      <MetricCard
        title="Exploration"
        icon="🗺️"
        metrics={[
          { label: 'Tiles Explored', value: metrics.exploration.tilesExplored },
          { label: 'Resources Gathered', value: metrics.exploration.resourcesGathered },
          { label: 'Avg Movement', value: metrics.exploration.averageMovement.toFixed(2) },
        ]}
      />
    </div>
  );
}

// Heatmaps Tab Component
function HeatmapsTab({
  aggressionHeatmap,
  cooperationHeatmap,
  loading,
}: {
  aggressionHeatmap: Heatmap | null;
  cooperationHeatmap: Heatmap | null;
  loading: boolean;
}) {
  if (loading) {
    return <div className="text-gray-400">Loading heatmaps...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Aggression Heatmap */}
      <div>
        <h3 className="text-lg font-bold text-white mb-3">Aggression Heatmap</h3>
        {aggressionHeatmap ? (
          <HeatmapGrid heatmap={aggressionHeatmap} colorScheme="red" />
        ) : (
          <div className="text-gray-400">No heatmap data available</div>
        )}
      </div>

      {/* Cooperation Heatmap */}
      <div>
        <h3 className="text-lg font-bold text-white mb-3">Cooperation Heatmap</h3>
        {cooperationHeatmap ? (
          <HeatmapGrid heatmap={cooperationHeatmap} colorScheme="green" />
        ) : (
          <div className="text-gray-400">No heatmap data available</div>
        )}
      </div>
    </div>
  );
}

// Social Graph Tab Component
function SocialGraphTab({
  socialGraph,
  loading,
}: {
  socialGraph: SocialGraphData | null;
  loading: boolean;
}) {
  if (loading) {
    return <div className="text-gray-400">Loading social graph...</div>;
  }

  if (!socialGraph || socialGraph.nodes.length === 0) {
    return <div className="text-gray-400">No social graph data available</div>;
  }

  return (
    <div>
      <h3 className="text-lg font-bold text-white mb-3">Social Relationship Network</h3>
      <div className="bg-gray-800 rounded p-4 mb-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Nodes:</span>{' '}
            <span className="text-white font-bold">{socialGraph.nodes.length}</span>
          </div>
          <div>
            <span className="text-gray-400">Edges:</span>{' '}
            <span className="text-white font-bold">{socialGraph.edges.length}</span>
          </div>
          <div>
            <span className="text-gray-400">Clusters:</span>{' '}
            <span className="text-white font-bold">{socialGraph.clusters.length}</span>
          </div>
        </div>
      </div>

      {/* Placeholder for D3 Force Graph */}
      <div className="bg-gray-800 rounded p-6 h-96 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-2">D3 Force Graph Visualization</p>
          <p className="text-sm text-gray-500">
            Nodes: {socialGraph.nodes.map((n) => n.name).join(', ')}
          </p>
          <p className="text-xs text-gray-600 mt-2">
            {socialGraph.edges.length} relationships | {socialGraph.clusters.length} alliance clusters
          </p>
        </div>
      </div>

      {/* Node list */}
      <div className="mt-4">
        <h4 className="text-md font-bold text-white mb-2">Agents</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {socialGraph.nodes.map((node) => (
            <div
              key={node.id}
              className={`bg-gray-800 rounded p-3 ${
                !node.isAlive ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">{node.name}</span>
                <span className="text-xs text-gray-400">{node.personality}</span>
              </div>
              <div className="mt-1 flex gap-2 text-xs">
                <span className="text-red-400">Agg: {node.stats.aggression}</span>
                <span className="text-green-400">Coop: {node.stats.cooperation}</span>
                <span className="text-blue-400">Emp: {node.stats.empathy}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Civilization Tab Component
function CivilizationTab({
  civilizationData,
  loading,
}: {
  civilizationData: CivilizationAnalytics | null;
  loading: boolean;
}) {
  if (loading) {
    return <div className="text-gray-400">Loading civilization data...</div>;
  }

  if (!civilizationData || civilizationData.factions.length === 0) {
    return (
      <div className="text-gray-400">
        No factions exist. Use the Civilization endpoints to create factions.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white">Civilization Analytics</h3>

      {/* Factions Overview */}
      <div>
        <h4 className="text-lg font-bold text-white mb-3">Factions</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {civilizationData.factions.map((faction) => (
            <div key={faction.id} className="bg-gray-800 rounded p-4">
              <div className="flex items-center justify-between mb-2">
                <h5 className="font-bold text-white">{faction.name}</h5>
                <span className="text-xs text-gray-400">{faction.memberCount} members</span>
              </div>

              {/* Stability Bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">Stability</span>
                  <span className="text-white">{(faction.stability * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded h-2">
                  <div
                    className={`h-2 rounded ${
                      faction.stability > 0.7
                        ? 'bg-green-500'
                        : faction.stability > 0.4
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${faction.stability * 100}%` }}
                  />
                </div>
              </div>

              {/* Resources */}
              <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                <div>
                  <span className="text-gray-400">Food:</span>
                  <span className="text-white ml-1">{faction.resources.food}</span>
                </div>
                <div>
                  <span className="text-gray-400">Water:</span>
                  <span className="text-white ml-1">{faction.resources.water}</span>
                </div>
                <div>
                  <span className="text-gray-400">Materials:</span>
                  <span className="text-white ml-1">{faction.resources.materials}</span>
                </div>
              </div>

              {/* Laws */}
              <div className="text-xs">
                <span className="text-gray-400">Laws:</span>
                <span className="text-white ml-1">{faction.laws.length}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Faction Stability Chart */}
      <div>
        <h4 className="text-lg font-bold text-white mb-3">Faction Stability</h4>
        <div className="bg-gray-800 rounded p-4">
          {civilizationData.factions.map((faction) => (
            <div key={faction.id} className="mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-white">{faction.name}</span>
                <span className="text-gray-400">{(faction.stability * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded h-3">
                <div
                  className={`h-3 rounded transition-all ${
                    faction.stability > 0.7
                      ? 'bg-green-500'
                      : faction.stability > 0.4
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${faction.stability * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Inter-Faction Conflict Rates */}
      <div>
        <h4 className="text-lg font-bold text-white mb-3">Inter-Faction Conflict Rates</h4>
        <div className="bg-gray-800 rounded p-4">
          {Object.keys(civilizationData.conflictRates).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(civilizationData.conflictRates).map(([pairKey, rate]) => {
                const [faction1, faction2] = pairKey.split('|');
                return (
                  <div key={pairKey} className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">
                      {faction1} ↔ {faction2}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-700 rounded h-2">
                        <div
                          className={`h-2 rounded ${
                            rate > 0.5 ? 'bg-red-500' : rate > 0.2 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${rate * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-white w-12 text-right">
                        {(rate * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-gray-400 text-sm">No inter-faction interactions recorded yet</div>
          )}
        </div>
      </div>

      {/* Law Compliance */}
      <div>
        <h4 className="text-lg font-bold text-white mb-3">Law Compliance Rates</h4>
        <div className="bg-gray-800 rounded overflow-hidden">
          {Object.keys(civilizationData.lawCompliance).length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs text-gray-300">Law ID</th>
                  <th className="px-4 py-2 text-right text-xs text-gray-300">Violations</th>
                  <th className="px-4 py-2 text-right text-xs text-gray-300">Total Relevant</th>
                  <th className="px-4 py-2 text-right text-xs text-gray-300">Compliance Rate</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(civilizationData.lawCompliance).map(([lawId, data]) => (
                  <tr key={lawId} className="border-t border-gray-700">
                    <td className="px-4 py-2 text-sm text-white">{lawId}</td>
                    <td className="px-4 py-2 text-sm text-right text-red-400">{data.violations}</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-400">
                      {data.totalRelevant}
                    </td>
                    <td className="px-4 py-2 text-sm text-right">
                      <span
                        className={`font-semibold ${
                          data.complianceRate > 80
                            ? 'text-green-400'
                            : data.complianceRate > 50
                            ? 'text-yellow-400'
                            : 'text-red-400'
                        }`}
                      >
                        {data.complianceRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-4 text-gray-400 text-sm">No law compliance data available yet</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Metric Card Component
function MetricCard({
  title,
  icon,
  metrics,
}: {
  title: string;
  icon: string;
  metrics: Array<{ label: string; value: string | number }>;
}) {
  return (
    <div className="bg-gray-800 rounded p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{icon}</span>
        <h3 className="text-lg font-bold text-white">{title}</h3>
      </div>
      <div className="space-y-2">
        {metrics.map((metric, idx) => (
          <div key={idx} className="flex justify-between items-center">
            <span className="text-sm text-gray-400">{metric.label}:</span>
            <span className="text-white font-semibold">{metric.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Heatmap Grid Component
function HeatmapGrid({
  heatmap,
  colorScheme,
}: {
  heatmap: Heatmap;
  colorScheme: 'red' | 'green' | 'blue';
}) {
  const getColor = (value: number, count: number) => {
    if (count === 0) return 'bg-gray-800';

    const normalized = (value - heatmap.min) / (heatmap.max - heatmap.min);
    const intensity = Math.floor(normalized * 9); // 0-9 scale

    const colorMap = {
      red: [
        'bg-red-900/10',
        'bg-red-900/20',
        'bg-red-800/30',
        'bg-red-800/40',
        'bg-red-700/50',
        'bg-red-600/60',
        'bg-red-500/70',
        'bg-red-400/80',
        'bg-red-300/90',
        'bg-red-200',
      ],
      green: [
        'bg-green-900/10',
        'bg-green-900/20',
        'bg-green-800/30',
        'bg-green-800/40',
        'bg-green-700/50',
        'bg-green-600/60',
        'bg-green-500/70',
        'bg-green-400/80',
        'bg-green-300/90',
        'bg-green-200',
      ],
      blue: [
        'bg-blue-900/10',
        'bg-blue-900/20',
        'bg-blue-800/30',
        'bg-blue-800/40',
        'bg-blue-700/50',
        'bg-blue-600/60',
        'bg-blue-500/70',
        'bg-blue-400/80',
        'bg-blue-300/90',
        'bg-blue-200',
      ],
    };

    return colorMap[colorScheme][intensity];
  };

  return (
    <div className="bg-gray-800 rounded p-4">
      <div className="mb-2 text-sm text-gray-400">
        Min: {heatmap.min.toFixed(1)} | Max: {heatmap.max.toFixed(1)} | Avg:{' '}
        {heatmap.average.toFixed(1)}
      </div>
      <div
        className="grid gap-0.5"
        style={{
          gridTemplateColumns: `repeat(${heatmap.width}, minmax(0, 1fr))`,
        }}
      >
        {heatmap.cells.map((row, y) =>
          row.map((cell, x) => (
            <div
              key={`${x}-${y}`}
              className={`aspect-square ${getColor(cell.value, cell.count)}`}
              title={`(${x},${y}): ${cell.value.toFixed(1)}`}
            />
          ))
        )}
      </div>
    </div>
  );
}
