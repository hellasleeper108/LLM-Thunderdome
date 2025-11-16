/**
 * Arena View Component
 * Displays the 2D grid world with agents, resources, and events
 */

import React from 'react';
import { TileType, Tile, AgentState } from '../types';
import { useStore } from '../store';

const CELL_SIZE = 30; // pixels

export const ArenaView: React.FC = () => {
  const { world, simulation, selectAgent, selectedAgent } = useStore();

  if (!world || !simulation) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-800 rounded-lg border-2 border-slate-700">
        <div className="text-center">
          <p className="text-slate-400 text-lg">No simulation active</p>
          <p className="text-slate-500 text-sm mt-2">Create a simulation to begin</p>
        </div>
      </div>
    );
  }

  const getTileColor = (tile: Tile): string => {
    switch (tile.type) {
      case TileType.EMPTY:
        return 'bg-slate-900';
      case TileType.RESOURCE_FOOD:
        return 'bg-green-700';
      case TileType.RESOURCE_WATER:
        return 'bg-blue-600';
      case TileType.RESOURCE_MATERIAL:
        return 'bg-yellow-700';
      case TileType.OBSTACLE:
        return 'bg-gray-600';
      case TileType.EVENT_STORM:
        return 'bg-purple-800 animate-pulse-slow';
      case TileType.EVENT_ANOMALY:
        return 'bg-pink-700 animate-pulse-slow';
      case TileType.EVENT_BOON:
        return 'bg-amber-500 animate-pulse-slow';
      default:
        return 'bg-slate-900';
    }
  };

  const getTileIcon = (tile: Tile): string => {
    switch (tile.type) {
      case TileType.RESOURCE_FOOD:
        return '🍎';
      case TileType.RESOURCE_WATER:
        return '💧';
      case TileType.RESOURCE_MATERIAL:
        return '⚒️';
      case TileType.OBSTACLE:
        return '🪨';
      case TileType.EVENT_STORM:
        return '⛈️';
      case TileType.EVENT_ANOMALY:
        return '🌀';
      case TileType.EVENT_BOON:
        return '✨';
      default:
        return '';
    }
  };

  const getAgentAtPosition = (x: number, y: number): AgentState | undefined => {
    return simulation.agents.find(
      (agent) => agent.position.x === x && agent.position.y === y && agent.isAlive
    );
  };

  const getAgentColor = (agent: AgentState): string => {
    const aggression = agent.stats.aggression;
    const cooperation = agent.stats.cooperation;

    if (aggression > 70) return 'bg-red-500';
    if (cooperation > 70) return 'bg-green-500';
    if (agent.stats.curiosity > 70) return 'bg-purple-500';
    return 'bg-blue-500';
  };

  const handleAgentClick = (agent: AgentState) => {
    selectAgent(agent);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 px-4 py-2 bg-slate-800 rounded-t-lg border-2 border-b-0 border-slate-700">
        <h2 className="text-xl font-bold text-white">Arena</h2>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-300">
            Turn: <span className="font-mono text-blue-400">{simulation.turn}</span>
          </span>
          <span className="text-slate-300">
            Agents: <span className="font-mono text-green-400">{simulation.agents.filter(a => a.isAlive).length}</span>
          </span>
          <span
            className={`px-2 py-1 rounded font-semibold ${
              simulation.status === 'running'
                ? 'bg-green-500/20 text-green-400'
                : simulation.status === 'paused'
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-slate-500/20 text-slate-400'
            }`}
          >
            {simulation.status.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-800 rounded-b-lg border-2 border-slate-700 p-4">
        <div
          className="inline-grid gap-0.5 mx-auto"
          style={{
            gridTemplateColumns: `repeat(${world.width}, ${CELL_SIZE}px)`,
          }}
        >
          {world.tiles.map((row, y) =>
            row.map((tile, x) => {
              const agent = getAgentAtPosition(x, y);
              const isSelected = agent && selectedAgent?.id === agent.id;

              return (
                <div
                  key={`${x}-${y}`}
                  className={`
                    grid-cell relative border border-slate-700/50
                    ${getTileColor(tile)}
                    ${agent ? 'cursor-pointer hover:ring-2 hover:ring-white' : ''}
                    ${isSelected ? 'ring-2 ring-yellow-400' : ''}
                  `}
                  style={{
                    width: `${CELL_SIZE}px`,
                    height: `${CELL_SIZE}px`,
                  }}
                  onClick={() => agent && handleAgentClick(agent)}
                  title={agent ? agent.name : tile.type}
                >
                  {/* Tile content */}
                  {!agent && getTileIcon(tile) && (
                    <div className="flex items-center justify-center text-xs">
                      {getTileIcon(tile)}
                    </div>
                  )}

                  {/* Agent */}
                  {agent && (
                    <div className="relative w-full h-full">
                      <div
                        className={`
                          absolute inset-0.5 rounded-full ${getAgentColor(agent)}
                          flex items-center justify-center text-white font-bold text-xs
                          shadow-lg
                        `}
                        title={`${agent.name}\nHealth: ${agent.health}\nEnergy: ${agent.stats.energy}`}
                      >
                        {agent.name.charAt(0).toUpperCase()}
                      </div>
                      {/* Health bar */}
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                        <div
                          className="h-full bg-green-400 transition-all"
                          style={{ width: `${agent.health}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Resource value indicator */}
                  {!agent && tile.value && tile.value > 0 && (
                    <div className="absolute top-0 right-0 bg-black/70 text-white text-[8px] px-1 rounded-bl">
                      {tile.value}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-2 px-4 py-2 bg-slate-800 rounded-lg border-2 border-slate-700">
        <div className="flex flex-wrap gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-700 rounded"></div>
            <span>Food</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-600 rounded"></div>
            <span>Water</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-700 rounded"></div>
            <span>Material</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-600 rounded"></div>
            <span>Obstacle</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Aggressive Agent</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Cooperative Agent</span>
          </div>
        </div>
      </div>
    </div>
  );
};
