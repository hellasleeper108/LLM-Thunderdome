/**
 * Replay Viewer Component
 * Provides playback controls for recorded simulations
 */

import React, { useEffect, useState, useRef } from 'react';
import { useStore } from '../store';

interface CameraKeyframe {
  turn: number;
  position: { x: number; y: number; z: number };
  lookAt: { x: number; y: number; z: number };
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
  duration?: number;
}

interface HighlightSequence {
  turn: number;
  agentIds?: string[];
  worldLocation?: { x: number; y: number };
  label?: string;
  intensity?: number;
  duration?: number;
}

interface CinematicReplayScript {
  replayId: string;
  cameraPath: CameraKeyframe[];
  highlights: HighlightSequence[];
  metadata?: {
    totalTurns: number;
    focusMode?: string;
    generatedAt: number;
  };
}

export function ReplayViewer() {
  const {
    replay,
    playbackState,
    isReplayMode,
    currentFrame,
    setCurrentFrame,
    updatePlaybackProgress,
    clearReplay,
  } = useStore();

  const [localIsPlaying, setLocalIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cinematicScript, setCinematicScript] = useState<CinematicReplayScript | null>(null);
  const [cinematicMode, setCinematicMode] = useState(false);
  const [loadingCinematic, setLoadingCinematic] = useState(false);
  const [cinematicFocus, setCinematicFocus] = useState<string>('random');
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
    };
  }, []);

  // Stop playback when reaching the end
  useEffect(() => {
    if (replay && currentIndex >= replay.frames.length - 1 && localIsPlaying) {
      handlePause();
    }
  }, [currentIndex, replay, localIsPlaying]);

  if (!isReplayMode || !replay || !playbackState) {
    return null;
  }

  const handlePlay = () => {
    if (!replay) return;

    setLocalIsPlaying(true);
    updatePlaybackProgress(playbackState.currentTurn, true);

    const baseInterval = 1000; // 1 second per turn
    const interval = baseInterval / playbackSpeed;

    playbackTimerRef.current = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = prevIndex + 1;
        if (nextIndex >= replay.frames.length) {
          handlePause();
          return prevIndex;
        }

        const nextFrame = replay.frames[nextIndex];
        setCurrentFrame(nextFrame);
        updatePlaybackProgress(nextFrame.turn, true);
        return nextIndex;
      });
    }, interval);
  };

  const handlePause = () => {
    setLocalIsPlaying(false);
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    updatePlaybackProgress(playbackState.currentTurn, false);
  };

  const handleStepForward = () => {
    if (!replay || currentIndex >= replay.frames.length - 1) return;

    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    const nextFrame = replay.frames[nextIndex];
    setCurrentFrame(nextFrame);
    updatePlaybackProgress(nextFrame.turn, false);
  };

  const handleStepBackward = () => {
    if (currentIndex <= 0) return;

    const prevIndex = currentIndex - 1;
    setCurrentIndex(prevIndex);
    const prevFrame = replay.frames[prevIndex];
    setCurrentFrame(prevFrame);
    updatePlaybackProgress(prevFrame.turn, false);
  };

  const handleJumpToStart = () => {
    if (!replay || replay.frames.length === 0) return;

    setCurrentIndex(0);
    const firstFrame = replay.frames[0];
    setCurrentFrame(firstFrame);
    updatePlaybackProgress(firstFrame.turn, false);
  };

  const handleJumpToEnd = () => {
    if (!replay || replay.frames.length === 0) return;

    const lastIndex = replay.frames.length - 1;
    setCurrentIndex(lastIndex);
    const lastFrame = replay.frames[lastIndex];
    setCurrentFrame(lastFrame);
    updatePlaybackProgress(lastFrame.turn, false);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!replay) return;

    const newIndex = parseInt(e.target.value, 10);
    setCurrentIndex(newIndex);
    const frame = replay.frames[newIndex];
    setCurrentFrame(frame);
    updatePlaybackProgress(frame.turn, localIsPlaying);
  };

  const handleSpeedChange = (newSpeed: number) => {
    setPlaybackSpeed(newSpeed);

    // If currently playing, restart with new speed
    if (localIsPlaying) {
      handlePause();
      setTimeout(() => handlePlay(), 50);
    }
  };

  const handleGoToTurn = () => {
    const turnInput = prompt('Enter turn number:');
    if (!turnInput || !replay) return;

    const targetTurn = parseInt(turnInput, 10);
    if (isNaN(targetTurn)) {
      alert('Invalid turn number');
      return;
    }

    // Find frame with matching turn
    const frameIndex = replay.frames.findIndex((f) => f.turn === targetTurn);

    if (frameIndex === -1) {
      // Find closest frame
      let closestIndex = 0;
      let closestDiff = Math.abs(replay.frames[0].turn - targetTurn);

      for (let i = 1; i < replay.frames.length; i++) {
        const diff = Math.abs(replay.frames[i].turn - targetTurn);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestIndex = i;
        }
      }

      setCurrentIndex(closestIndex);
      const frame = replay.frames[closestIndex];
      setCurrentFrame(frame);
      updatePlaybackProgress(frame.turn, false);
      alert(`Turn ${targetTurn} not found. Jumped to closest turn ${frame.turn}`);
    } else {
      setCurrentIndex(frameIndex);
      const frame = replay.frames[frameIndex];
      setCurrentFrame(frame);
      updatePlaybackProgress(frame.turn, false);
    }
  };

  const handleCloseReplay = () => {
    handlePause();
    clearReplay();
  };

  const handleFetchCinematicScript = async () => {
    setLoadingCinematic(true);
    try {
      const API_BASE = 'http://localhost:3001/api';
      const response = await fetch(`${API_BASE}/simulation/replay/cinematic?focusOn=${cinematicFocus}`);

      if (!response.ok) {
        throw new Error('Failed to fetch cinematic script');
      }

      const script = await response.json();
      setCinematicScript(script);
      console.log('[ReplayViewer] Loaded cinematic script:', script);
    } catch (error) {
      console.error('Error fetching cinematic script:', error);
      alert('Failed to load cinematic script. Make sure a simulation is running.');
    } finally {
      setLoadingCinematic(false);
    }
  };

  const handleToggleCinematicMode = () => {
    if (!cinematicMode && !cinematicScript) {
      // Need to fetch script first
      handleFetchCinematicScript();
    }
    setCinematicMode(!cinematicMode);
  };

  // Get current highlight for the current turn
  const getCurrentHighlight = (): HighlightSequence | null => {
    if (!cinematicScript || !cinematicMode || !replay) return null;

    const currentTurn = replay.frames[currentIndex]?.turn || 0;
    const highlights = cinematicScript.highlights.filter(h => {
      const duration = h.duration || 3;
      return currentTurn >= h.turn && currentTurn < h.turn + duration;
    });

    return highlights.length > 0 ? highlights[highlights.length - 1] : null;
  };

  const currentHighlight = getCurrentHighlight();

  const progress = replay.frames.length > 0
    ? (currentIndex / (replay.frames.length - 1)) * 100
    : 0;

  const speedOptions = [0.25, 0.5, 1.0, 2.0, 4.0];

  return (
    <div className="bg-gray-800 border border-gray-700 rounded p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-white">Replay Viewer</h3>
        <button
          onClick={handleCloseReplay}
          className="px-2 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded"
        >
          Close Replay
        </button>
      </div>

      {/* Replay metadata */}
      <div className="mb-3 text-sm text-gray-300">
        <div>Simulation ID: {replay.metadata.simulationId.slice(0, 8)}...</div>
        <div>Total Turns: {replay.metadata.totalTurns}</div>
        <div>Agents: {replay.metadata.agentCount}</div>
        {replay.metadata.winner && (
          <div className="text-green-400">
            Winner: {replay.metadata.winner.agentName} ({replay.metadata.winner.reason})
          </div>
        )}
      </div>

      {/* Timeline slider */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm text-gray-400">Turn:</span>
          <span className="text-lg font-bold text-white">
            {currentFrame?.turn || 0} / {replay.metadata.totalTurns}
          </span>
          <span className="text-sm text-gray-400 ml-auto">
            Frame: {currentIndex + 1} / {replay.frames.length}
          </span>
        </div>

        <input
          type="range"
          min="0"
          max={replay.frames.length - 1}
          value={currentIndex}
          onChange={handleSliderChange}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />

        {/* Progress bar */}
        <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
          <div
            className="bg-blue-500 h-1.5 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={handleJumpToStart}
          disabled={currentIndex === 0}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded"
          title="Jump to start"
        >
          ⏮
        </button>

        <button
          onClick={handleStepBackward}
          disabled={currentIndex === 0}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded"
          title="Step backward"
        >
          ⏪
        </button>

        {localIsPlaying ? (
          <button
            onClick={handlePause}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold"
          >
            ⏸ Pause
          </button>
        ) : (
          <button
            onClick={handlePlay}
            disabled={currentIndex >= replay.frames.length - 1}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded font-semibold"
          >
            ▶ Play
          </button>
        )}

        <button
          onClick={handleStepForward}
          disabled={currentIndex >= replay.frames.length - 1}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded"
          title="Step forward"
        >
          ⏩
        </button>

        <button
          onClick={handleJumpToEnd}
          disabled={currentIndex >= replay.frames.length - 1}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded"
          title="Jump to end"
        >
          ⏭
        </button>

        <button
          onClick={handleGoToTurn}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded ml-2"
        >
          Go to Turn
        </button>
      </div>

      {/* Speed controls */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400">Speed:</span>
        {speedOptions.map((speed) => (
          <button
            key={speed}
            onClick={() => handleSpeedChange(speed)}
            className={`px-2 py-1 text-sm rounded ${
              playbackSpeed === speed
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {speed}x
          </button>
        ))}
      </div>

      {/* Cinematic controls */}
      <div className="mt-3 pt-3 border-t border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={handleToggleCinematicMode}
            disabled={loadingCinematic}
            className={`px-3 py-2 rounded font-semibold ${
              cinematicMode
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            } disabled:bg-gray-800 disabled:text-gray-600`}
          >
            {loadingCinematic ? '⏳ Loading...' : cinematicMode ? '🎬 Cinematic ON' : '🎥 Cinematic OFF'}
          </button>

          {!cinematicScript && !loadingCinematic && (
            <>
              <span className="text-sm text-gray-400">Focus:</span>
              <select
                value={cinematicFocus}
                onChange={(e) => setCinematicFocus(e.target.value)}
                className="px-2 py-1 text-sm bg-gray-700 text-white rounded border border-gray-600"
              >
                <option value="random">Random</option>
                <option value="wars">Wars</option>
                <option value="alliances">Alliances</option>
                <option value="evolution">Evolution</option>
                <option value="religion">Religion</option>
              </select>
            </>
          )}

          {cinematicScript && (
            <span className="text-sm text-gray-400">
              {cinematicScript.cameraPath.length} keyframes, {cinematicScript.highlights.length} highlights
              {cinematicScript.metadata?.focusMode && ` (${cinematicScript.metadata.focusMode})`}
            </span>
          )}
        </div>

        {cinematicMode && currentHighlight && (
          <div className="bg-purple-900/30 border border-purple-500/50 rounded p-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{currentHighlight.label}</span>
              {currentHighlight.agentIds && currentHighlight.agentIds.length > 0 && (
                <span className="text-xs text-gray-400">
                  ({currentHighlight.agentIds.length} agents)
                </span>
              )}
            </div>
            {currentHighlight.worldLocation && (
              <div className="text-xs text-gray-400 mt-1">
                Location: ({currentHighlight.worldLocation.x}, {currentHighlight.worldLocation.y})
              </div>
            )}
          </div>
        )}
      </div>

      {/* Frame metadata */}
      {currentFrame && currentFrame.metadata && (
        <div className="mt-3 pt-3 border-t border-gray-700 text-sm text-gray-300">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="text-gray-500">Agents Alive:</span>{' '}
              {currentFrame.metadata.totalAgentsAlive}
            </div>
            <div>
              <span className="text-gray-500">Resources:</span>{' '}
              {currentFrame.metadata.totalResourcesGathered}
            </div>
            <div>
              <span className="text-gray-500">Alliances:</span>{' '}
              {currentFrame.metadata.alliancesActive}
            </div>
          </div>

          {currentFrame.worldState.activeEvents.length > 0 && (
            <div className="mt-2">
              <span className="text-gray-500">Active Events:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {currentFrame.worldState.activeEvents.map((event) => (
                  <span
                    key={event.id}
                    className="px-2 py-0.5 bg-yellow-600 text-white text-xs rounded"
                  >
                    {event.type} ({event.severity})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
