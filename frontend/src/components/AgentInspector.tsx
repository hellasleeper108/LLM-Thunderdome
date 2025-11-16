/**
 * Agent Inspector Component
 * Displays detailed information about a selected agent
 */

import React from 'react';
import { useStore } from '../store';
import { AgentStats } from '../types';

export const AgentInspector: React.FC = () => {
  const { selectedAgent, simulation } = useStore();

  if (!selectedAgent) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-800 rounded-lg border-2 border-slate-700">
        <div className="text-center">
          <p className="text-slate-400 text-lg">No agent selected</p>
          <p className="text-slate-500 text-sm mt-2">Click on an agent in the arena to inspect</p>
        </div>
      </div>
    );
  }

  const agent = simulation?.agents.find(a => a.id === selectedAgent.id) || selectedAgent;

  const getStatColor = (value: number): string => {
    if (value >= 70) return 'text-green-400';
    if (value >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const StatBar: React.FC<{ label: string; value: number; max?: number }> = ({ label, value, max = 100 }) => {
    const percentage = (value / max) * 100;
    return (
      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-300">{label}</span>
          <span className={`font-mono ${getStatColor(value)}`}>{value}</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              percentage >= 70 ? 'bg-green-500' : percentage >= 40 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  const allies = simulation?.agents.filter(a => agent.allegiances.includes(a.id)) || [];
  const recentMemories = agent.memory.shortTerm.slice(-5).reverse();
  const dialogueMemories = agent.memory.shortTerm.filter(m => m.type === 'dialogue').slice(-5).reverse();

  return (
    <div className="flex flex-col h-full bg-slate-800 rounded-lg border-2 border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-700">
        <h2 className="text-xl font-bold text-white mb-1">{agent.name}</h2>
        <p className="text-sm text-slate-400">{agent.personality.description}</p>
        <div className="flex gap-2 mt-2">
          <span
            className={`px-2 py-1 rounded text-xs font-semibold ${
              agent.isAlive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}
          >
            {agent.isAlive ? 'ALIVE' : 'DEAD'}
          </span>
          <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-500/20 text-blue-400">
            {agent.personality.name}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Health and Energy */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">Vitals</h3>
          <StatBar label="Health" value={agent.health} />
          <StatBar label="Energy" value={agent.stats.energy} />
        </div>

        {/* Inventory */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">Inventory</h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-900 rounded p-2 text-center">
              <div className="text-xl">🍎</div>
              <div className="text-xs text-slate-400 mt-1">Food</div>
              <div className="text-lg font-mono text-green-400">{agent.inventory.food}</div>
            </div>
            <div className="bg-slate-900 rounded p-2 text-center">
              <div className="text-xl">💧</div>
              <div className="text-xs text-slate-400 mt-1">Water</div>
              <div className="text-lg font-mono text-blue-400">{agent.inventory.water}</div>
            </div>
            <div className="bg-slate-900 rounded p-2 text-center">
              <div className="text-xl">⚒️</div>
              <div className="text-xs text-slate-400 mt-1">Material</div>
              <div className="text-lg font-mono text-yellow-400">{agent.inventory.material}</div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">Personality Traits</h3>
          <StatBar label="Aggression" value={agent.stats.aggression} />
          <StatBar label="Cooperation" value={agent.stats.cooperation} />
          <StatBar label="Risk Tolerance" value={agent.stats.riskTolerance} />
          <StatBar label="Curiosity" value={agent.stats.curiosity} />
          <StatBar label="Empathy" value={agent.stats.empathy} />
        </div>

        {/* Goals */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">Goals</h3>
          <div className="space-y-2">
            {agent.goals.map((goal) => (
              <div
                key={goal.id}
                className={`p-2 rounded ${
                  goal.completed ? 'bg-green-900/30 border border-green-700' : 'bg-slate-900 border border-slate-700'
                }`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={goal.completed}
                    readOnly
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className={`text-sm ${goal.completed ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                      {goal.description}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {goal.priority === 'primary' ? '🎯 Primary' : '📌 Secondary'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alliances */}
        {allies.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">
              Alliances ({allies.length})
            </h3>
            <div className="space-y-1">
              {allies.map((ally) => (
                <div key={ally.id} className="flex items-center gap-2 p-2 bg-slate-900 rounded">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-sm text-slate-300">{ally.name}</span>
                  <span className="text-xs text-slate-500 ml-auto">
                    ❤️ {ally.health}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Dialogue */}
        {dialogueMemories.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">Recent Dialogue</h3>
            <div className="space-y-2">
              {dialogueMemories.map((memory, index) => (
                <div key={index} className="p-2 bg-slate-900 rounded border border-slate-700">
                  <div className="text-xs text-slate-500 mb-1">
                    {new Date(memory.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="text-sm text-slate-300">{memory.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Memory */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">Recent Actions</h3>
          <div className="space-y-1">
            {recentMemories.map((memory, index) => (
              <div key={index} className="flex items-start gap-2 p-2 bg-slate-900 rounded text-xs">
                <span className="text-slate-500 font-mono">
                  {new Date(memory.timestamp).toLocaleTimeString()}
                </span>
                <span className="text-slate-400 flex-1">{memory.content}</span>
                <span
                  className={`px-1 rounded text-[10px] ${
                    memory.type === 'action'
                      ? 'bg-blue-500/20 text-blue-400'
                      : memory.type === 'interaction'
                      ? 'bg-purple-500/20 text-purple-400'
                      : memory.type === 'dialogue'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-slate-500/20 text-slate-400'
                  }`}
                >
                  {memory.type}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Position */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">Location</h3>
          <div className="p-2 bg-slate-900 rounded font-mono text-sm text-slate-400">
            ({agent.position.x}, {agent.position.y})
          </div>
        </div>
      </div>
    </div>
  );
};
