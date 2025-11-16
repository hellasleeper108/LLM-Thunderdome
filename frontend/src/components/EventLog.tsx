/**
 * Event Log Component
 * Displays a scrollable list of simulation events in real-time
 */

import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { EventLog as EventLogType } from '../types';

export const EventLog: React.FC = () => {
  const { logs } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<EventLogType['type'] | 'all'>('all');

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const getTypeIcon = (type: EventLogType['type']): string => {
    const iconMap: Record<EventLogType['type'], string> = {
      action: '⚡',
      interaction: '🤝',
      resource_change: '📦',
      dialogue: '💬',
      state_update: '🔄',
      event: '🌟',
    };
    return iconMap[type] || '•';
  };

  const getTypeColor = (type: EventLogType['type']): string => {
    const colorMap: Record<EventLogType['type'], string> = {
      action: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
      interaction: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
      resource_change: 'text-green-400 bg-green-500/10 border-green-500/30',
      dialogue: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
      state_update: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      event: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
    };
    return colorMap[type] || 'text-slate-400 bg-slate-500/10 border-slate-500/30';
  };

  const filteredLogs = filter === 'all' ? logs : logs.filter(log => log.type === filter);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 50;
    setAutoScroll(isAtBottom);
  };

  return (
    <div className="flex flex-col h-full bg-slate-800 rounded-lg border-2 border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-white">Event Log</h2>
          <span className="text-sm text-slate-400">
            {filteredLogs.length} event{filteredLogs.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
              filter === 'all'
                ? 'bg-white text-slate-900'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            All
          </button>
          {(['action', 'interaction', 'dialogue', 'resource_change', 'event', 'state_update'] as const).map(
            (type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                  filter === type
                    ? 'bg-white text-slate-900'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {getTypeIcon(type)} {type.replace('_', ' ')}
              </button>
            )
          )}
        </div>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-2"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-slate-400">No events yet</p>
              <p className="text-slate-500 text-sm mt-1">Events will appear here as the simulation runs</p>
            </div>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className={`p-3 rounded border ${getTypeColor(log.type)} transition-all hover:scale-[1.01]`}
            >
              <div className="flex items-start gap-2">
                <span className="text-xl flex-shrink-0">{getTypeIcon(log.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-slate-500">
                      Turn {log.turn}
                    </span>
                    <span className="text-xs font-mono text-slate-500">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-900/50 text-slate-400 uppercase">
                      {log.type.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-slate-200 break-words">{log.description}</p>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300">
                        Details
                      </summary>
                      <pre className="mt-1 text-xs text-slate-400 bg-slate-900/50 p-2 rounded overflow-x-auto">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <div className="absolute bottom-20 right-8">
          <button
            onClick={() => {
              setAutoScroll(true);
              if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              }
            }}
            className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg transition-colors text-sm font-semibold"
          >
            ↓ New Events
          </button>
        </div>
      )}
    </div>
  );
};
