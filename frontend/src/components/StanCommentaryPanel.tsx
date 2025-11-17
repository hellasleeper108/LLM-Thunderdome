/**
 * STAN Commentary Panel
 * Displays commentary and annotations from the external STAN overseer system
 */

import { useEffect, useState } from 'react';

// Types matching backend
type CommentaryScope = 'simulation' | 'cluster' | 'agent' | 'faction' | 'global';

interface StanCommentary {
  id: string;
  timestamp: number;
  scope: CommentaryScope;
  scopeId?: string;
  summary: string;
  recommendation?: string;
  severity?: 'info' | 'warning' | 'critical';
  metadata?: Record<string, any>;
}

interface CommentaryResponse {
  commentaries: StanCommentary[];
  stanEnabled: boolean;
  hasWebhook: boolean;
  stats: {
    total: number;
    maxSize: number;
    scopeCounts: Record<string, number>;
    severityCounts: Record<string, number>;
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
  };
}

const API_BASE = 'http://localhost:3001/api';

export function StanCommentaryPanel() {
  const [commentaries, setCommentaries] = useState<StanCommentary[]>([]);
  const [stanEnabled, setStanEnabled] = useState(false);
  const [hasWebhook, setHasWebhook] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch commentaries
  const fetchCommentaries = async () => {
    try {
      const response = await fetch(`${API_BASE}/stan/commentary?limit=50`);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const data: CommentaryResponse = await response.json();
      setCommentaries(data.commentaries);
      setStanEnabled(data.stanEnabled);
      setHasWebhook(data.hasWebhook);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching STAN commentary:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Poll for updates every 3 seconds
  useEffect(() => {
    fetchCommentaries();
    const interval = setInterval(fetchCommentaries, 3000);
    return () => clearInterval(interval);
  }, []);

  // Get severity badge color
  const getSeverityColor = (severity?: 'info' | 'warning' | 'critical') => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500 text-white';
      case 'warning':
        return 'bg-yellow-500 text-black';
      case 'info':
      default:
        return 'bg-blue-500 text-white';
    }
  };

  // Get scope badge color
  const getScopeColor = (scope: CommentaryScope) => {
    switch (scope) {
      case 'simulation':
        return 'bg-green-600 text-white';
      case 'cluster':
        return 'bg-purple-600 text-white';
      case 'agent':
        return 'bg-orange-600 text-white';
      case 'faction':
        return 'bg-pink-600 text-white';
      case 'global':
        return 'bg-gray-600 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  // Render STAN status indicator
  const renderStatus = () => {
    if (loading) {
      return (
        <div className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
          <span className="text-gray-400">Loading...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 bg-red-500 rounded-full" />
          <span className="text-red-400">Error: {error}</span>
        </div>
      );
    }

    if (!stanEnabled || !hasWebhook) {
      return (
        <div className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 bg-yellow-500 rounded-full" />
          <span className="text-yellow-400">STAN Offline</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-sm">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span className="text-green-400">STAN Online</span>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 rounded overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-white">STAN Commentary</h2>
          {renderStatus()}
        </div>
        <p className="text-xs text-gray-400">
          External overseer observations and recommendations
        </p>
      </div>

      {/* Commentary List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && commentaries.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400">Loading commentary...</p>
          </div>
        ) : commentaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="text-6xl">🤖</div>
            <p className="text-gray-400 text-center">
              {!stanEnabled || !hasWebhook
                ? 'STAN is offline. Enable STAN to receive commentary.'
                : 'No commentary yet. STAN is observing...'}
            </p>
            {stanEnabled && hasWebhook && (
              <p className="text-xs text-gray-500 text-center max-w-md">
                STAN commentary will appear here when the external overseer
                sends observations about the simulation.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {[...commentaries].reverse().map((commentary) => (
              <div
                key={commentary.id}
                className="bg-gray-800 rounded-lg p-3 border border-gray-700 hover:border-gray-600 transition-colors"
              >
                {/* Header with badges */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${getScopeColor(commentary.scope)}`}>
                    {commentary.scope}
                  </span>
                  {commentary.severity && (
                    <span className={`text-xs px-2 py-0.5 rounded ${getSeverityColor(commentary.severity)}`}>
                      {commentary.severity}
                    </span>
                  )}
                  <span className="text-xs text-gray-500 ml-auto">
                    {formatTimestamp(commentary.timestamp)}
                  </span>
                </div>

                {/* Scope ID if present */}
                {commentary.scopeId && (
                  <div className="text-xs text-gray-400 mb-2">
                    ID: {commentary.scopeId}
                  </div>
                )}

                {/* Summary */}
                <p className="text-sm text-white mb-2">{commentary.summary}</p>

                {/* Recommendation if present */}
                {commentary.recommendation && (
                  <div className="mt-2 p-2 bg-blue-900/30 border-l-2 border-blue-500 rounded">
                    <p className="text-xs text-gray-300">
                      <span className="font-semibold text-blue-400">Recommendation:</span>{' '}
                      {commentary.recommendation}
                    </p>
                  </div>
                )}

                {/* Metadata if present */}
                {commentary.metadata && Object.keys(commentary.metadata).length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">
                      Show metadata
                    </summary>
                    <pre className="mt-1 text-xs text-gray-500 bg-gray-900 p-2 rounded overflow-x-auto">
                      {JSON.stringify(commentary.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with stats */}
      {commentaries.length > 0 && (
        <div className="bg-gray-800 border-t border-gray-700 px-4 py-2">
          <p className="text-xs text-gray-400">
            Showing {commentaries.length} recent commentaries
          </p>
        </div>
      )}
    </div>
  );
}
