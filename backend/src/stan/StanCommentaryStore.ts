/**
 * STAN Commentary Store
 * In-memory buffer for STAN commentary and annotations
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Scope of commentary
 */
export type CommentaryScope = 'simulation' | 'cluster' | 'agent' | 'faction' | 'global';

/**
 * Commentary message from STAN
 */
export interface StanCommentary {
  id: string;
  timestamp: number;
  scope: CommentaryScope;
  scopeId?: string; // Optional ID of the specific entity (agentId, factionId, etc.)
  summary: string;
  recommendation?: string;
  severity?: 'info' | 'warning' | 'critical'; // Severity level
  metadata?: Record<string, any>; // Additional data
}

/**
 * Store for STAN commentary messages
 * Maintains a rolling buffer of recent commentary
 */
export class StanCommentaryStore {
  private commentaries: StanCommentary[] = [];
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  /**
   * Add a new commentary message
   */
  addCommentary(commentary: Omit<StanCommentary, 'id' | 'timestamp'>): StanCommentary {
    const newCommentary: StanCommentary = {
      id: uuidv4(),
      timestamp: Date.now(),
      ...commentary,
    };

    this.commentaries.push(newCommentary);

    // Maintain max size by removing oldest
    if (this.commentaries.length > this.maxSize) {
      this.commentaries.shift();
    }

    console.log(`[STAN Commentary] Added: ${newCommentary.scope} - ${newCommentary.summary}`);

    return newCommentary;
  }

  /**
   * Get all commentaries
   */
  getAllCommentaries(): StanCommentary[] {
    return [...this.commentaries];
  }

  /**
   * Get recent commentaries (last N)
   */
  getRecentCommentaries(limit: number = 20): StanCommentary[] {
    return this.commentaries.slice(-limit);
  }

  /**
   * Get commentaries by scope
   */
  getCommentariesByScope(scope: CommentaryScope, limit?: number): StanCommentary[] {
    const filtered = this.commentaries.filter(c => c.scope === scope);
    return limit ? filtered.slice(-limit) : filtered;
  }

  /**
   * Get commentaries for a specific entity
   */
  getCommentariesForEntity(scopeId: string, limit?: number): StanCommentary[] {
    const filtered = this.commentaries.filter(c => c.scopeId === scopeId);
    return limit ? filtered.slice(-limit) : filtered;
  }

  /**
   * Get commentaries by severity
   */
  getCommentariesBySeverity(severity: 'info' | 'warning' | 'critical'): StanCommentary[] {
    return this.commentaries.filter(c => c.severity === severity);
  }

  /**
   * Clear all commentaries
   */
  clear(): void {
    this.commentaries = [];
    console.log('[STAN Commentary] Cleared all commentaries');
  }

  /**
   * Get statistics
   */
  getStats() {
    const scopeCounts: Record<string, number> = {};
    const severityCounts: Record<string, number> = {
      info: 0,
      warning: 0,
      critical: 0,
    };

    this.commentaries.forEach(c => {
      scopeCounts[c.scope] = (scopeCounts[c.scope] || 0) + 1;
      if (c.severity) {
        severityCounts[c.severity]++;
      }
    });

    return {
      total: this.commentaries.length,
      maxSize: this.maxSize,
      scopeCounts,
      severityCounts,
      oldestTimestamp: this.commentaries[0]?.timestamp || null,
      newestTimestamp: this.commentaries[this.commentaries.length - 1]?.timestamp || null,
    };
  }
}

/**
 * Global STAN commentary store instance
 */
let globalCommentaryStore: StanCommentaryStore | null = null;

/**
 * Get the global STAN commentary store
 */
export function getCommentaryStore(): StanCommentaryStore {
  if (!globalCommentaryStore) {
    globalCommentaryStore = new StanCommentaryStore(100);
  }
  return globalCommentaryStore;
}

/**
 * Set the global STAN commentary store (for testing)
 */
export function setCommentaryStore(store: StanCommentaryStore): void {
  globalCommentaryStore = store;
}
