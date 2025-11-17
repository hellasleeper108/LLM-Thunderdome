/**
 * Event Logger
 * Logs all simulation events and provides export functionality
 */

import { EventLog } from '../schemas/types';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { getHistoryManager } from '../history/HistoryManager';

export interface LoggerConfig {
  maxLogs?: number; // Maximum logs to keep in memory
  autoExport?: boolean; // Auto-export to file
  exportPath?: string; // Path to export logs
}

export class EventLogger {
  private logs: EventLog[];
  private config: Required<LoggerConfig>;
  private currentTurn: number;

  constructor(config: LoggerConfig = {}) {
    this.logs = [];
    this.config = {
      maxLogs: config.maxLogs ?? 10000,
      autoExport: config.autoExport ?? false,
      exportPath: config.exportPath ?? './logs',
    };
    this.currentTurn = 0;
  }

  /**
   * Log an event
   */
  logEvent(event: Omit<EventLog, 'id' | 'timestamp' | 'turn'>): void {
    const log: EventLog = {
      id: uuidv4(),
      timestamp: Date.now(),
      turn: this.currentTurn,
      ...event,
    };

    this.logs.push(log);

    // Trim logs if exceeding max
    if (this.logs.length > this.config.maxLogs) {
      this.logs.shift();
    }

    // Auto-export if enabled
    if (this.config.autoExport) {
      this.appendToFile(log);
    }

    // Record major events in history
    if (this.isMajorEvent(log)) {
      try {
        const historyManager = getHistoryManager();
        historyManager.recordFromLoggedEvent(log);
      } catch (error) {
        // Silently fail if history manager is not available
        console.warn('[EventLogger] Failed to record to history:', error);
      }
    }
  }

  /**
   * Determine if an event is major enough for history
   */
  private isMajorEvent(log: EventLog): boolean {
    const majorTypes = [
      'religion_born',
      'ritual_performed',
      'interaction',
      'event',
    ];

    // Include by type
    if (majorTypes.includes(log.type)) {
      return true;
    }

    // Include events with multiple agents (3+)
    if (log.agentIds && log.agentIds.length >= 3) {
      return true;
    }

    // Include events with specific keywords
    const desc = log.description.toLowerCase();
    const majorKeywords = [
      'alliance',
      'attack',
      'killed',
      'faction',
      'law',
      'disaster',
      'storm',
      'evolved',
      'merged',
      'war',
      'battle',
    ];

    if (majorKeywords.some(keyword => desc.includes(keyword))) {
      return true;
    }

    // Include events with high severity
    if (log.metadata?.severity === 'high' || log.metadata?.severity === 'critical') {
      return true;
    }

    return false;
  }

  /**
   * Set current turn (called by engine)
   */
  setCurrentTurn(turn: number): void {
    this.currentTurn = turn;
  }

  /**
   * Get all logs
   */
  getLogs(): EventLog[] {
    return [...this.logs];
  }

  /**
   * Get logs for specific turn
   */
  getLogsForTurn(turn: number): EventLog[] {
    return this.logs.filter(log => log.turn === turn);
  }

  /**
   * Get logs for specific agent
   */
  getLogsForAgent(agentId: string): EventLog[] {
    return this.logs.filter(log => log.agentIds.includes(agentId));
  }

  /**
   * Get logs by type
   */
  getLogsByType(type: EventLog['type']): EventLog[] {
    return this.logs.filter(log => log.type === type);
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.logs = [];
    this.currentTurn = 0;
  }

  /**
   * Export logs to JSON file
   */
  exportJSON(filename?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportFilename = filename || `simulation-${timestamp}.json`;
    const filepath = path.join(this.config.exportPath, exportFilename);

    // Ensure directory exists
    if (!fs.existsSync(this.config.exportPath)) {
      fs.mkdirSync(this.config.exportPath, { recursive: true });
    }

    const data = {
      exportTime: new Date().toISOString(),
      totalLogs: this.logs.length,
      logs: this.logs,
    };

    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    return filepath;
  }

  /**
   * Export logs to readable transcript
   */
  exportTranscript(filename?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportFilename = filename || `simulation-transcript-${timestamp}.txt`;
    const filepath = path.join(this.config.exportPath, exportFilename);

    // Ensure directory exists
    if (!fs.existsSync(this.config.exportPath)) {
      fs.mkdirSync(this.config.exportPath, { recursive: true });
    }

    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push('LLM THUNDERDOME - SIMULATION TRANSCRIPT');
    lines.push('='.repeat(80));
    lines.push(`Export Time: ${new Date().toISOString()}`);
    lines.push(`Total Events: ${this.logs.length}`);
    lines.push('='.repeat(80));
    lines.push('');

    // Group logs by turn
    const logsByTurn = new Map<number, EventLog[]>();
    for (const log of this.logs) {
      if (!logsByTurn.has(log.turn)) {
        logsByTurn.set(log.turn, []);
      }
      logsByTurn.get(log.turn)!.push(log);
    }

    // Write logs turn by turn
    for (const [turn, turnLogs] of Array.from(logsByTurn.entries()).sort((a, b) => a[0] - b[0])) {
      lines.push(`\n${'─'.repeat(80)}`);
      lines.push(`TURN ${turn}`);
      lines.push('─'.repeat(80));

      for (const log of turnLogs) {
        const time = new Date(log.timestamp).toLocaleTimeString();
        const typeEmoji = this.getTypeEmoji(log.type);

        lines.push(`\n[${time}] ${typeEmoji} ${log.type.toUpperCase()}`);
        lines.push(`  ${log.description}`);

        if (log.metadata && Object.keys(log.metadata).length > 0) {
          lines.push(`  Metadata: ${JSON.stringify(log.metadata)}`);
        }
      }
    }

    lines.push('\n' + '='.repeat(80));
    lines.push('END OF TRANSCRIPT');
    lines.push('='.repeat(80));

    fs.writeFileSync(filepath, lines.join('\n'));
    return filepath;
  }

  /**
   * Append log to file (for auto-export)
   */
  private appendToFile(log: EventLog): void {
    const filename = 'current-simulation.jsonl';
    const filepath = path.join(this.config.exportPath, filename);

    // Ensure directory exists
    if (!fs.existsSync(this.config.exportPath)) {
      fs.mkdirSync(this.config.exportPath, { recursive: true });
    }

    fs.appendFileSync(filepath, JSON.stringify(log) + '\n');
  }

  /**
   * Get emoji for log type
   */
  private getTypeEmoji(type: EventLog['type']): string {
    const emojiMap: Record<EventLog['type'], string> = {
      action: '⚡',
      interaction: '🤝',
      resource_change: '📦',
      dialogue: '💬',
      state_update: '🔄',
      event: '🌟',
      religion_born: '🙏',
      ritual_performed: '✨',
    };

    return emojiMap[type] || '•';
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsByTurn: Record<number, number>;
    uniqueAgents: number;
  } {
    const eventsByType: Record<string, number> = {};
    const eventsByTurn: Record<number, number> = {};
    const uniqueAgents = new Set<string>();

    for (const log of this.logs) {
      // Count by type
      eventsByType[log.type] = (eventsByType[log.type] || 0) + 1;

      // Count by turn
      eventsByTurn[log.turn] = (eventsByTurn[log.turn] || 0) + 1;

      // Collect unique agents
      log.agentIds.forEach(id => uniqueAgents.add(id));
    }

    return {
      totalEvents: this.logs.length,
      eventsByType,
      eventsByTurn,
      uniqueAgents: uniqueAgents.size,
    };
  }
}
