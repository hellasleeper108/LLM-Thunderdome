/**
 * Replay Playback
 * Controls playback of recorded replays with navigation
 */

import {
  Replay,
  ReplayFrame,
  ReplayPlaybackState,
} from '../schemas/types';

export class ReplayPlayback {
  private replay: Replay | null;
  private currentIndex: number;
  private playbackState: ReplayPlaybackState;
  private playbackTimer: NodeJS.Timeout | null;

  constructor() {
    this.replay = null;
    this.currentIndex = 0;
    this.playbackTimer = null;

    this.playbackState = {
      currentTurn: 0,
      isPlaying: false,
      playbackSpeed: 1.0,
      totalTurns: 0,
      replay: null,
    };
  }

  /**
   * Load a replay for playback
   */
  loadReplay(replay: Replay): void {
    this.stop();
    this.replay = replay;
    this.currentIndex = 0;

    this.playbackState = {
      currentTurn: replay.frames.length > 0 ? replay.frames[0].turn : 0,
      isPlaying: false,
      playbackSpeed: 1.0,
      totalTurns: replay.metadata.totalTurns,
      replay,
    };
  }

  /**
   * Start playback
   */
  play(onFrameChange?: (frame: ReplayFrame) => void): void {
    if (!this.replay || this.playbackState.isPlaying) {
      return;
    }

    this.playbackState.isPlaying = true;

    // Calculate interval based on speed
    const baseInterval = 1000; // 1 second per turn
    const interval = baseInterval / this.playbackState.playbackSpeed;

    this.playbackTimer = setInterval(() => {
      if (!this.hasNext()) {
        this.stop();
        return;
      }

      this.stepForward();
      const currentFrame = this.getCurrentFrame();
      if (currentFrame && onFrameChange) {
        onFrameChange(currentFrame);
      }
    }, interval);
  }

  /**
   * Pause playback
   */
  pause(): void {
    this.playbackState.isPlaying = false;
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
      this.playbackTimer = null;
    }
  }

  /**
   * Stop playback and reset to beginning
   */
  stop(): void {
    this.pause();
    this.currentIndex = 0;
    if (this.replay && this.replay.frames.length > 0) {
      this.playbackState.currentTurn = this.replay.frames[0].turn;
    }
  }

  /**
   * Step forward one frame
   */
  stepForward(): ReplayFrame | null {
    if (!this.replay || !this.hasNext()) {
      return null;
    }

    this.currentIndex++;
    const frame = this.replay.frames[this.currentIndex];
    this.playbackState.currentTurn = frame.turn;

    return frame;
  }

  /**
   * Step backward one frame
   */
  stepBackward(): ReplayFrame | null {
    if (!this.replay || !this.hasPrevious()) {
      return null;
    }

    this.currentIndex--;
    const frame = this.replay.frames[this.currentIndex];
    this.playbackState.currentTurn = frame.turn;

    return frame;
  }

  /**
   * Go to specific turn
   */
  goToTurn(turn: number): ReplayFrame | null {
    if (!this.replay) {
      return null;
    }

    // Find frame with matching turn
    const frameIndex = this.replay.frames.findIndex(f => f.turn === turn);

    if (frameIndex === -1) {
      // Turn not found, find closest
      const closestIndex = this.findClosestFrameIndex(turn);
      this.currentIndex = closestIndex;
    } else {
      this.currentIndex = frameIndex;
    }

    const frame = this.replay.frames[this.currentIndex];
    this.playbackState.currentTurn = frame.turn;

    return frame;
  }

  /**
   * Go to specific frame index
   */
  goToIndex(index: number): ReplayFrame | null {
    if (!this.replay) {
      return null;
    }

    const clampedIndex = Math.max(0, Math.min(index, this.replay.frames.length - 1));
    this.currentIndex = clampedIndex;

    const frame = this.replay.frames[this.currentIndex];
    this.playbackState.currentTurn = frame.turn;

    return frame;
  }

  /**
   * Jump to beginning
   */
  jumpToStart(): ReplayFrame | null {
    return this.goToIndex(0);
  }

  /**
   * Jump to end
   */
  jumpToEnd(): ReplayFrame | null {
    if (!this.replay) {
      return null;
    }

    return this.goToIndex(this.replay.frames.length - 1);
  }

  /**
   * Set playback speed
   */
  setSpeed(speed: number): void {
    const clampedSpeed = Math.max(0.1, Math.min(10, speed));
    this.playbackState.playbackSpeed = clampedSpeed;

    // If currently playing, restart timer with new speed
    if (this.playbackState.isPlaying && this.playbackTimer) {
      const wasPlaying = true;
      this.pause();
      if (wasPlaying) {
        this.play();
      }
    }
  }

  /**
   * Get current frame
   */
  getCurrentFrame(): ReplayFrame | null {
    if (!this.replay || this.currentIndex >= this.replay.frames.length) {
      return null;
    }

    return this.replay.frames[this.currentIndex];
  }

  /**
   * Get current playback state
   */
  getState(): ReplayPlaybackState {
    return { ...this.playbackState };
  }

  /**
   * Get current turn number
   */
  getCurrentTurn(): number {
    return this.playbackState.currentTurn;
  }

  /**
   * Get current frame index
   */
  getCurrentIndex(): number {
    return this.currentIndex;
  }

  /**
   * Get total frames
   */
  getTotalFrames(): number {
    return this.replay?.frames.length || 0;
  }

  /**
   * Check if there's a next frame
   */
  hasNext(): boolean {
    if (!this.replay) {
      return false;
    }

    return this.currentIndex < this.replay.frames.length - 1;
  }

  /**
   * Check if there's a previous frame
   */
  hasPrevious(): boolean {
    return this.currentIndex > 0;
  }

  /**
   * Get progress percentage (0-100)
   */
  getProgress(): number {
    if (!this.replay || this.replay.frames.length === 0) {
      return 0;
    }

    return (this.currentIndex / (this.replay.frames.length - 1)) * 100;
  }

  /**
   * Find closest frame index to a given turn
   */
  private findClosestFrameIndex(turn: number): number {
    if (!this.replay || this.replay.frames.length === 0) {
      return 0;
    }

    let closestIndex = 0;
    let closestDiff = Math.abs(this.replay.frames[0].turn - turn);

    for (let i = 1; i < this.replay.frames.length; i++) {
      const diff = Math.abs(this.replay.frames[i].turn - turn);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIndex = i;
      }
    }

    return closestIndex;
  }

  /**
   * Get frame range
   */
  getFrameRange(startIndex: number, endIndex: number): ReplayFrame[] {
    if (!this.replay) {
      return [];
    }

    const start = Math.max(0, startIndex);
    const end = Math.min(this.replay.frames.length, endIndex);

    return this.replay.frames.slice(start, end);
  }

  /**
   * Get replay metadata
   */
  getMetadata() {
    return this.replay?.metadata || null;
  }

  /**
   * Search for frames matching criteria
   */
  searchFrames(predicate: (frame: ReplayFrame) => boolean): ReplayFrame[] {
    if (!this.replay) {
      return [];
    }

    return this.replay.frames.filter(predicate);
  }

  /**
   * Get frames where specific events occurred
   */
  getEventFrames(): ReplayFrame[] {
    return this.searchFrames(frame => frame.worldState.activeEvents.length > 0);
  }

  /**
   * Get frames where combat occurred
   */
  getCombatFrames(): ReplayFrame[] {
    return this.searchFrames(frame =>
      frame.actions.some(action => action.action.type === 'attack')
    );
  }

  /**
   * Get frames where alliances were formed
   */
  getAllianceFrames(): ReplayFrame[] {
    return this.searchFrames(frame =>
      frame.actions.some(action => action.action.type === 'form_alliance')
    );
  }

  /**
   * Get statistics about the replay
   */
  getStatistics() {
    if (!this.replay) {
      return null;
    }

    const totalFrames = this.replay.frames.length;
    const totalActions = this.replay.frames.reduce((sum, f) => sum + f.actions.length, 0);
    const totalMessages = this.replay.frames.reduce((sum, f) => sum + f.messages.length, 0);

    const combatFrames = this.getCombatFrames().length;
    const allianceFrames = this.getAllianceFrames().length;
    const eventFrames = this.getEventFrames().length;

    return {
      totalFrames,
      totalActions,
      totalMessages,
      combatFrames,
      allianceFrames,
      eventFrames,
      metadata: this.replay.metadata,
    };
  }

  /**
   * Export current state for saving
   */
  exportState(): {
    currentIndex: number;
    currentTurn: number;
    playbackSpeed: number;
  } {
    return {
      currentIndex: this.currentIndex,
      currentTurn: this.playbackState.currentTurn,
      playbackSpeed: this.playbackState.playbackSpeed,
    };
  }

  /**
   * Restore state from saved data
   */
  restoreState(state: {
    currentIndex: number;
    currentTurn: number;
    playbackSpeed: number;
  }): void {
    if (!this.replay) {
      return;
    }

    this.currentIndex = Math.max(0, Math.min(state.currentIndex, this.replay.frames.length - 1));
    this.playbackState.currentTurn = state.currentTurn;
    this.playbackState.playbackSpeed = state.playbackSpeed;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stop();
    this.replay = null;
  }
}
